import type { NarrativeContextPack } from '../memory/narrativePack.js';
import { getNpcSpellDisplayName } from '../world/npcSrdSpells.js';

/** Papéis de IA no PENAI — cada um com system curto + schema próprio. */
export type PenaiPromptRole = 'arbiter' | 'narrator' | 'summarizer';

/** Modo de cena (1 linha extra no system; dados vêm no JSON do usuário). */
export type PenaiSceneMode =
    | 'exploration'
    | 'combat'
    | 'social'
    | 'travel'
    | 'opening'
    | 'default';

/** Limites para não estourar tokens no user payload. */
export const PROMPT_BUDGET = {
    playerAction: 420,
    fact: 160,
    maxFacts: 4,
    maxCanonFacts: 3,
    maxEntities: 4,
    maxHints: 3,
    maxKnowledge: 3,
    maxQuests: 3,
    maxTimeline: 4,
    summary: 360,
    rollSummary: 120,
    entityName: 48,
} as const;

const LOCALE = 'pt-BR. Obrigatório: JSON Schema da API.';

const ROLE: Record<PenaiPromptRole, string> = {
    arbiter: 'Árbitro: julgue se a ação é tentável; não narre.',
    narrator: 'Mestre: narre consequências; não mude HP/itens/XP/ouro. NPCs com voz própria.',
    summarizer: 'Resumidor: fatos objetivos; sem diálogo inventado.',
};

const SCENE: Record<Exclude<PenaiSceneMode, 'default'>, string> = {
    opening:
        'Abertura cinematográfica em pt-BR: 2–3 parágrafos curtos, ritmo de filme (luz, som, cheiro, textura). Nomeie o lugar e o POI. Gancho de tensão ou mistério no final. Segundo pessoa do singular implícita ao herói. Não diga que o jogador perguntou nem use tom de tutorial.',
    exploration: 'Exploração: sensores, ritmo moderado.',
    combat: 'Combate: frases curtas, impacto.',
    social: 'Social: diálogo direto, voz de NPC.',
    travel: 'Viagem: passagem de tempo, terreno.',
};

export type ComposeSystemPromptOpts = {
    role: PenaiPromptRole;
    sceneMode?: PenaiSceneMode;
};

/** System instruction compacto (tipicamente &lt; 280 caracteres). */
export function composeSystemPrompt(opts: ComposeSystemPromptOpts): string {
    const parts: string[] = [LOCALE, ROLE[opts.role]];
    const scene = opts.sceneMode ?? 'default';
    if (scene !== 'default') parts.push(SCENE[scene]);
    return parts.join(' ');
}

export function estimatePromptChars(system: string, userPayload: unknown): number {
    return system.length + JSON.stringify(userPayload).length;
}

export function clipText(value: string, max: number): string {
    const t = value.trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
}

export function isSessionOpeningRequest(
    playerAction: string,
    payload?: Record<string, unknown>,
): boolean {
    if (payload?.bootstrap === true) return true;
    const action = playerAction.trim();
    if (action.length > 160) return false;
    return /\b(aventura começa|onde (eu )?estou|o que (está|esta) acontecendo|começo da aventura|in[ií]cio da aventura|apresenta(r)? a cena)\b/i.test(
        action,
    );
}

export function inferSceneMode(opts: {
    playerAction?: string;
    intentType?: string;
    combatPhase?: string | null;
}): PenaiSceneMode {
    const action = (opts.playerAction ?? '').toLowerCase();
    if (isSessionOpeningRequest(opts.playerAction ?? '')) {
        return 'opening';
    }
    if (
        /\b(aventura começa|onde (eu )?estou|o que está acontecendo)\b/i.test(action) &&
        action.length < 120
    ) {
        return 'opening';
    }
    const phase = (opts.combatPhase ?? '').toUpperCase();
    if (phase && phase !== 'IDLE' && phase !== 'NONE') return 'combat';
    if (opts.intentType === 'opening') return 'opening';
    if (opts.intentType === 'travel') return 'travel';
    if (opts.intentType === 'social') return 'social';
    if (opts.intentType === 'combat') return 'combat';
    return 'exploration';
}

export function buildArbiterUserPayload(opts: {
    playerAction: string;
    regionSlug: string | null;
    intentType: string;
    sessionFacts?: string[];
}): Record<string, unknown> {
    return {
        acao: clipText(opts.playerAction, PROMPT_BUDGET.playerAction),
        regiao: opts.regionSlug,
        intent: opts.intentType,
        fatos: (opts.sessionFacts ?? []).slice(0, PROMPT_BUDGET.maxFacts).map(f =>
            clipText(f, PROMPT_BUDGET.fact),
        ),
    };
}

/** Pack narrativo enxuto para o turno do usuário (dados, não instruções longas). */
export function slimNarrationPack(
    pack: NarrativeContextPack,
    extra?: { orquestracao?: Record<string, unknown> },
): Record<string, unknown> {
    return {
        acao: clipText(pack.playerAction, PROMPT_BUDGET.playerAction),
        regiao: pack.regionSlug,
        faseCombate: pack.combatPhase ?? null,
        entidades: pack.entities.slice(0, PROMPT_BUDGET.maxEntities).map(e => ({
            nome: clipText(e.displayName, PROMPT_BUDGET.entityName),
            tipo: e.entityType,
        })),
        elenco: (pack.npcCast ?? []).slice(0, 3).map(n => ({
            nome: clipText(n.name, PROMPT_BUDGET.entityName),
            nomeProprio: n.givenName ? clipText(n.givenName, 32) : null,
            titulo: n.roleTitle ? clipText(n.roleTitle, 40) : null,
            nivel: n.level ?? null,
            papel: n.role ? clipText(n.role, 32) : null,
            arma: n.mainWeapon ? clipText(n.mainWeapon, 48) : null,
            ca: n.ac ?? null,
            vida: n.vida ?? n.maxHp ?? null,
            vidaMax: n.vidaMax ?? n.maxHp ?? null,
            classe: n.characterClass ? clipText(n.characterClass, 24) : null,
            atributos: n.atributos
                ? {
                      FOR: n.atributos.forca,
                      DES: n.atributos.destreza,
                      CON: n.atributos.constituicao,
                      INT: n.atributos.inteligencia,
                      SAB: n.atributos.sabedoria,
                      CAR: n.atributos.carisma,
                  }
                : null,
            magias:
                n.isSpellcaster && n.spells?.length
                    ? n.spells
                          .slice(0, 6)
                          .map(s => clipText(getNpcSpellDisplayName(s), 32))
                    : null,
            voz: n.voiceTone ? clipText(n.voiceTone, 40) : null,
            tracos: n.traits.slice(0, 2).map(t => clipText(t, 40)),
            meta: n.activeGoal ? clipText(n.activeGoal, 80) : null,
            itens: n.inventorySummary ? clipText(n.inventorySummary, 60) : null,
        })),
        fatosSessao: pack.sessionFacts.slice(0, PROMPT_BUDGET.maxFacts).map(f =>
            clipText(f, PROMPT_BUDGET.fact),
        ),
        fatosCanon: pack.canonFacts.slice(0, PROMPT_BUDGET.maxCanonFacts).map(f =>
            clipText(f, PROMPT_BUDGET.fact),
        ),
        resumo: pack.narrativeSummary
            ? clipText(pack.narrativeSummary, PROMPT_BUDGET.summary)
            : null,
        rolagem: pack.rollSummary ? clipText(pack.rollSummary, PROMPT_BUDGET.rollSummary) : null,
        dicas: pack.motorHints?.slice(0, PROMPT_BUDGET.maxHints).map(h => clipText(h, PROMPT_BUDGET.fact)),
        humorRegiao: pack.regionMood ?? null,
        reputacao: pack.heroReputation?.slice(0, 2),
        ambiente: (pack.ambientWorld ?? []).slice(0, 3).map(l => clipText(l, PROMPT_BUDGET.fact)),
        missoes: (pack.activeQuests ?? []).slice(0, PROMPT_BUDGET.maxQuests).map(q => ({
            titulo: clipText(q.title, PROMPT_BUDGET.entityName),
            regiao: q.regionName ? clipText(q.regionName, PROMPT_BUDGET.entityName) : null,
            estagio: clipText(q.stageLabel, 60),
            aqui: q.isHere,
            tipo: q.kind,
        })),
        pulsoMundo: pack.worldPulse?.headline
            ? {
                  manchete: clipText(pack.worldPulse.headline, PROMPT_BUDGET.fact),
                  batidas: (pack.worldPulse.beats ?? []).slice(0, 2).map(b =>
                      clipText(b, PROMPT_BUDGET.fact),
                  ),
              }
            : null,
        linhaDoTempo: (pack.timelineDelta ?? [])
            .slice(0, PROMPT_BUDGET.maxTimeline)
            .map(e => ({
                dia: e.worldDay,
                resumo: clipText(e.summary, PROMPT_BUDGET.fact),
            })),
        orquestracao: extra?.orquestracao ?? null,
    };
}


export function buildSummarizerUserPayload(opts: {
    sessionId: number;
    fromSeq: number;
    toSeq: number;
    memories: string[];
}): Record<string, unknown> {
    return {
        sessao: opts.sessionId,
        turnos: `${opts.fromSeq}-${opts.toSeq}`,
        fatos: opts.memories.slice(0, 12).map(m => clipText(m, PROMPT_BUDGET.fact)),
    };
}
