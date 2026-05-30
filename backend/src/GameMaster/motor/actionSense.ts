import { penaiEnv } from '../../config/penaiEnv.js';
import { getGameSession } from '../sessions/sessionService.js';
import { getRegionBySlug } from '../world/travelCanon.js';
import { listCanonicalRegions } from '../world/mapCatalog.js';
import { loadPenaiCharacterSnapshot } from './penaiCharacterSnapshot.js';
import { classifyPenaiIntent, classifyPenaiIntentFromText } from './classifyIntent.js';
import type { PenaiActionIntent } from './types.js';
import { inferSkillCheckFromFreeText } from '../../services/dm/freeActionClassifier.js';
import { checkActionPlausibilityGemini } from '../ai/geminiActionSense.js';
import { recallMemoryForTurn } from '../memory/recall.js';

export type ActionSenseResult = {
    ok: boolean;
    reason: string;
    hint?: string;
    /** Intent refinado após heurísticas (ex.: perícia detectada em texto livre). */
    refinedIntent?: PenaiActionIntent;
};

const META_CHAT =
    /\b(como jogar|como funciona|ignore (?:as|suas)? instru|você é (?:uma )?ia|chatgpt|prompt|ooc\b|fora de personagem|meta\b|roll ?20|rola ?20)\b/i;

const IMPOSSIBLE_PHYSICS =
    /\b(voo sem magia|teletransporte instantâneo|destruo o (?:mundo|planeta)|matar todos de uma vez|invencível|imortal)\b/i;

const TOO_VAGUE = /^(sim|não|nao|ok|continua|segue|hm+|ah+)$/i;

function normalizeText(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
}

function intentFromPayload(payload: Record<string, unknown>): string | undefined {
    const explicit = payload.intent as string | undefined;
    return explicit?.toLowerCase();
}

function intentMismatch(
    declared: string | undefined,
    classified: PenaiActionIntent['type'],
): string | null {
    if (!declared || declared === 'free' || declared === classified) return null;
    const map: Record<string, PenaiActionIntent['type'][]> = {
        travel: ['travel'],
        combat: ['combat'],
        social: ['social', 'free'],
        attack: ['combat'],
        skill: ['combat', 'free'],
        'skill-check': ['combat', 'free'],
    };
    const allowed = map[declared];
    if (allowed && !allowed.includes(classified)) {
        return `A intenção declarada (${declared}) não combina com o texto da ação (${classified}).`;
    }
    return null;
}

async function validateTravelMakesSense(
    targetSlug: string,
    currentRegionSlug: string | null,
): Promise<ActionSenseResult | null> {
    const region = await getRegionBySlug(targetSlug);
    if (!region) {
        const all = await listCanonicalRegions();
        const names = all.map(r => r.displayName).join(', ');
        return {
            ok: false,
            reason: `Destino "${targetSlug}" não existe no mapa canônico.`,
            hint: names ? `Regiões conhecidas: ${names}.` : 'Consulte o mapa da sessão.',
        };
    }
    if (currentRegionSlug && currentRegionSlug === region.slug) {
        return {
            ok: false,
            reason: `Você já está em ${region.displayName}.`,
            hint: 'Descreva o que faz nesta região ou viaje para outro lugar.',
        };
    }
    return null;
}

async function validateCombatMakesSense(
    sessionId: number,
    playerAction: string,
): Promise<ActionSenseResult | null> {
    const hero = await loadPenaiCharacterSnapshot(sessionId);
    if (!hero) {
        return {
            ok: false,
            reason: 'Não há herói vinculado à sessão para ações de combate.',
            hint: 'Crie a sessão com heroName ou use ações narrativas/sociais.',
        };
    }
    if (playerAction.length < 8) {
        return {
            ok: false,
            reason: 'Descreva o ataque com mais detalhe (alvo, arma ou feitiço).',
        };
    }
    return null;
}

function validateSocialMakesSense(playerAction: string): ActionSenseResult | null {
    const text = playerAction.toLowerCase();
    const hasTarget =
        /\b(com|para|ao|à|a)\s+[\wà-ú]/i.test(playerAction) ||
        /\b(taverneiro|guarda|mercador|npc|aldeão|bandido)\b/i.test(text);
    if (text.length < 12 && !hasTarget) {
        return {
            ok: false,
            reason: 'Ação social vaga — indique com quem fala ou o que pergunta.',
            hint: 'Ex.: "Pergunto ao guarda sobre rumores na ponte sul."',
        };
    }
    return null;
}

/**
 * Valida se a ação do jogador faz sentido no contexto da sessão (antes do motor mecânico).
 */
export async function validateActionSense(opts: {
    sessionId: number;
    userId: number;
    playerAction: string;
    payload?: Record<string, unknown>;
}): Promise<ActionSenseResult> {
    const text = normalizeText(opts.playerAction);
    const payload = opts.payload ?? {};

    const structured = payload.structuredIntent as { type?: string } | undefined;
    const structuredType = structured?.type ?? (payload.intent as string | undefined);
    if (
        structuredType &&
        ['rest', 'claim-loot', 'equip-item', 'drop-item', 'open-shop', 'buy-item', 'sell-item', 'close-shop', 'start-encounter'].includes(
            structuredType,
        )
    ) {
        return { ok: true, reason: 'Intent estruturado.', refinedIntent: classifyPenaiIntent(text, payload) };
    }

    if (text.length < 3) {
        return { ok: false, reason: 'Descreva sua ação com pelo menos algumas palavras.' };
    }
    if (TOO_VAGUE.test(text)) {
        return {
            ok: false,
            reason: 'Resposta muito vaga — diga o que seu personagem faz.',
        };
    }
    if (META_CHAT.test(text)) {
        return {
            ok: false,
            reason: 'Isso parece conversa fora da cena, não uma ação do personagem.',
            hint: 'Narre o que seu herói faz no mundo (explorar, falar, combater, viajar).',
        };
    }
    if (IMPOSSIBLE_PHYSICS.test(text)) {
        return {
            ok: false,
            reason: 'Essa ação não é plausível nas regras ou na cena atual.',
            hint: 'Tente algo que seu personagem poderia tentar com os recursos da sessão.',
        };
    }

    let intent = classifyPenaiIntent(text, payload);
    const declared = intentFromPayload(payload);
    const textIntentType = classifyPenaiIntentFromText(text);
    const mismatch = intentMismatch(
        declared,
        declared ? textIntentType : intent.type,
    );
    if (mismatch) {
        return { ok: false, reason: mismatch };
    }

    // Destino inexistente não depende da sessão — falha cedo (também em testes sem TypeORM).
    if (intent.type === 'travel' && intent.payload.targetRegionSlug) {
        const unknownDest = await validateTravelMakesSense(
            intent.payload.targetRegionSlug,
            null,
        );
        if (unknownDest) return unknownDest;
    }

    let currentRegionSlug: string | null = null;
    try {
        const session = await getGameSession(opts.sessionId);
        currentRegionSlug = (session?.currentRegionSlug as string | null) ?? null;
    } catch {
        currentRegionSlug = null;
    }

    if (intent.type === 'travel' && intent.payload.targetRegionSlug && currentRegionSlug) {
        const travelFail = await validateTravelMakesSense(
            intent.payload.targetRegionSlug,
            currentRegionSlug,
        );
        if (travelFail) return travelFail;
    }

    if (intent.type === 'combat') {
        const combatFail = await validateCombatMakesSense(opts.sessionId, text);
        if (combatFail) return combatFail;
    }

    if (intent.type === 'social') {
        const socialFail = validateSocialMakesSense(text);
        if (socialFail) return socialFail;
    }

    if (intent.type === 'free') {
        const skillIntent = await inferSkillCheckFromFreeText(
            opts.sessionId,
            opts.userId,
            text,
        );
        if (skillIntent?.type === 'skill-check') {
            intent = {
                type: 'combat',
                payload: {
                    structuredIntent: 'skill-check',
                    skillIndex: skillIntent.payload.skillIndex,
                    difficulty: skillIntent.payload.difficulty,
                },
            };
        } else if (text.length < 10 && !/\b(examino|olho|escuto|cheiro|sinto)\b/i.test(text)) {
            return {
                ok: false,
                reason: 'Ação livre muito curta — detalhe o que você faz no ambiente.',
                hint: 'Ex.: "Examino as marcas de pegadas perto da porta."',
            };
        }
    }

    if (
        penaiEnv.GEMINI_API_KEY &&
        (intent.type === 'free' || intent.type === 'social')
    ) {
        const recalled = await recallMemoryForTurn({
            sessionId: opts.sessionId,
            query: text,
            limit: 4,
        });
        const gemini = await checkActionPlausibilityGemini({
            playerAction: text,
            regionSlug: currentRegionSlug,
            intentType: intent.type,
            sessionFacts: [...recalled.sessionFacts, ...recalled.canonFacts].slice(0, 6),
        });
        if (!gemini.acceptable) {
            return {
                ok: false,
                reason: gemini.reason,
                hint: gemini.playerFacingHint,
                refinedIntent: intent,
            };
        }
    }

    return { ok: true, reason: 'Ação plausível.', refinedIntent: intent };
}
