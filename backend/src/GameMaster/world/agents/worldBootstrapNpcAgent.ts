import { z } from 'zod';
import { penaiEnv } from '../../../config/penaiEnv.js';
import { parseWorldNpcBatchJson } from '../../ai/llmJsonSchemas.js';
import { buildWorldNpcBatchJsonSchema } from '../../ai/geminiSchemas.js';
import { generateGeminiStructuredJson } from '../../ai/geminiStructured.js';
import { resolveGeminiApiKey } from '../../adapters/gemini/apiKey.js';
import {
    penaiPipelineAiRequest,
    penaiPipelineAiResponse,
    penaiPipelineLog,
} from '../../infra/pipelineLog.js';
import type { PipelineCtx } from '../../infra/pipelineLog.js';
import type { EntityTier } from '../../database/entities/types/EntityTier.js';
import { normalizeBootstrapNpcIdentity } from '../npcDisplayName.js';
import {
    ALLOWED_NPC_WEAPON_SLUGS,
    parseAiNpcSheet,
    type NpcAiSheetInput,
} from '../npcAiSheet.js';
import { ensureNpcSpellCatalog, NPC_SPELL_CATALOG_URL } from '../npcSrdSpells.js';
import { buildNpcCombatSheet, resolveHeroLevelForSession } from '../npcSheet.js';
import { failWorldGemini, WorldGeminiGenerationError } from './worldGeminiGenerationError.js';

export type BootstrapNpcDraft = {
    givenName: string;
    roleTitle: string;
    /** Formato canônico: "Uldric, Mestre da Forja". */
    displayName: string;
    role: string;
    description: string;
    goal: string;
    tier: EntityTier;
    maxHp: number;
    /** Atributos, classe, magias e arma vindos do Gemini (obrigatório). */
    aiSheet: NpcAiSheetInput;
};

const npcClassEnum = z.enum(['fighter', 'rogue', 'wizard', 'cleric', 'bard', 'commoner']);

const NpcAtributosSchema = z
    .object({
        forca: z.coerce.number().int().min(6).max(20).optional(),
        destreza: z.coerce.number().int().min(6).max(20).optional(),
        constituicao: z.coerce.number().int().min(6).max(20).optional(),
        inteligencia: z.coerce.number().int().min(6).max(20).optional(),
        sabedoria: z.coerce.number().int().min(6).max(20).optional(),
        carisma: z.coerce.number().int().min(6).max(20).optional(),
    })
    .passthrough();

const NpcItemSchema = z
    .object({
        givenName: z.string().min(2).max(40).optional(),
        roleTitle: z.string().min(2).max(56).optional(),
        displayName: z.string().min(2).max(80).optional(),
        role: z.string().min(2).max(48),
        description: z.string().min(8).max(280),
        goal: z.string().max(120).optional(),
        tier: z.enum(['INCIDENTAL', 'SECONDARY', 'MAJOR']).optional(),
        maxHp: z.number().int().min(4).max(400).optional(),
        level: z.number().int().min(1).max(20).optional(),
        armorClass: z.number().int().min(8).max(22).optional(),
        atributos: NpcAtributosSchema.optional(),
        characterClass: z.preprocess(
            val => (typeof val === 'string' ? val.trim().toLowerCase() : val),
            npcClassEnum.optional(),
        ),
        characterClassLabel: z.string().max(40).optional(),
        isSpellcaster: z.boolean().optional(),
        spells: z.array(z.string()).optional(),
        mainWeaponSlug: z.string().max(32).optional(),
    })
    .transform(raw => {
        const identity = normalizeBootstrapNpcIdentity(raw);
        const aiSheet = parseAiNpcSheet(raw);
        if (!aiSheet) {
            throw new Error(
                `NPC "${identity.givenName}" sem ficha SRD válida (atributos FOR–CAR obrigatórios)`,
            );
        }
        return {
            ...identity,
            role: raw.role.trim(),
            description: raw.description.trim(),
            goal: (raw.goal ?? `Viver como ${raw.role} na região`).trim(),
            tier: raw.tier ?? ('SECONDARY' as EntityTier),
            maxHp: raw.maxHp,
            aiSheet,
        };
    });

function buildResponseSchema(npcCount: number) {
    const n = Math.max(1, Math.min(10, npcCount));
    return z.object({
        npcs: z.array(NpcItemSchema).min(n).max(n),
        regionBlurb: z.string().max(200).optional(),
    });
}

function failNpcBatch(reason: string, detail: string, ctx: PipelineCtx, ms?: number): never {
    penaiPipelineLog('WORLD_AGENT:npc', `${reason}: ${detail}`, undefined, ctx);
    if (ms !== undefined) {
        penaiPipelineAiResponse('worldBootstrap:npc', ctx, { ok: false, ms, parsed: reason });
    }
    failWorldGemini('npc', reason, detail);
}

export async function generateBootstrapNpcs(opts: {
    sessionId: number;
    userId: number;
    regionSlug: string;
    regionName: string;
    factionNames: string[];
    heroName?: string;
    userApiKey?: string;
    ctx?: PipelineCtx;
    /** 4–6 bootstrap sessão; até 20 no seed canônico. */
    npcCount?: number;
    /** Exige nomes próprios únicos no lote (seed em massa). */
    uniqueNames?: boolean;
    /** Nomes já existentes no mundo (evita repetir no Gemini). */
    reservedGivenNames?: string[];
}): Promise<{
    npcs: BootstrapNpcDraft[];
    regionBlurb?: string;
    source: 'gemini';
}> {
    const npcCount = Math.max(1, Math.min(10, opts.npcCount ?? 6));
    // Schema Gemini é mínimo; contagem exata validada aqui (Zod).
    ensureNpcSpellCatalog();
    const ctx = opts.ctx ?? { sessionId: opts.sessionId, userId: opts.userId };
    const apiKey = resolveGeminiApiKey(opts.userApiKey);
    if (!apiKey) {
        failNpcBatch(
            'no_api_key',
            'Chave de inferência indisponível (BYOK ou plataforma)',
            ctx,
        );
    }

    const model = penaiEnv.GEMINI_GENERATION_MODEL;
    if (!model) {
        failNpcBatch(
            'gemini_error',
            'GEMINI_GENERATION_MODEL ausente (padrão: gemini-2.5-flash-lite)',
            ctx,
        );
    }

    penaiPipelineAiRequest('worldBootstrap:npc', ctx, { model, inputSummary: 'npc-batch' });
    const t0 = Date.now();

    try {
        const raw = await generateGeminiStructuredJson({
            apiKey,
            model,
            systemInstruction: [
                'Você cria NPCs iniciais para uma campanha D&D 5e em português brasileiro.',
                'Use APENAS a região e facções fornecidas. Não invente reinos ou deuses novos.',
                'Todo NPC precisa de givenName (nome próprio) e roleTitle (ofício).',
                'O jogo exibe "givenName, roleTitle" (ex: Uldric, Mestre da Forja).',
                'Papéis variados (comércio, guarda, fé, crime, ofício).',
                'Informe maxHp (pontos de vida) coerente com tier: INCIDENTAL 6–12, SECONDARY 12–24, MAJOR 24–45.',
                'Descrições concretas e jogáveis; role é etiqueta mecânica curta.',
                'Para CADA NPC gere ficha SRD completa:',
                '- atributos (objeto obrigatório): forca, destreza, constituicao, inteligencia, sabedoria, carisma — cada um número inteiro 8–18.',
                '- characterClass: fighter | rogue | wizard | cleric | bard | commoner.',
                '- isSpellcaster: true só para mago/clérigo/bardo com magias; false para guerreiro/ladino/plebeu.',
                '- spells: se conjurador, lista de magias do SRD 2014 (campo index kebab-case da API).',
                `- catálogo oficial: ${NPC_SPELL_CATALOG_URL} (ex.: cure-wounds, fire-bolt, sacred-flame).`,
                '- Se não conjurador, spells: [].',
                `- armas (mainWeaponSlug): ${[...ALLOWED_NPC_WEAPON_SLUGS].join(', ')}.`,
                '- level (1–20) e armorClass (8–22) coerentes com tier e classe.',
                'Não invente magias ou armas fora das listas.',
                `Retorne exatamente ${npcCount} NPCs no array npcs.`,
                opts.uniqueNames
                    ? 'Cada givenName deve ser único no array — nunca repetir nome próprio.'
                    : '',
                opts.reservedGivenNames?.length
                    ? `NÃO use estes nomes (já existem no mundo): ${opts.reservedGivenNames.slice(0, 80).join(', ')}.`
                    : '',
            ]
                .filter(Boolean)
                .join('\n'),
            userPayload: {
                regionSlug: opts.regionSlug,
                regionName: opts.regionName,
                factionsPresent: opts.factionNames,
                heroName: opts.heroName ?? 'Herói',
                locale: 'pt-BR',
                reservedGivenNames: opts.reservedGivenNames?.slice(0, 80) ?? [],
            },
            responseJsonSchema: buildWorldNpcBatchJsonSchema(npcCount),
            temperature: 0.35,
            maxOutputTokens: npcCount > 8 ? 8192 : 4096,
        });

        const parsed = parseWorldNpcBatchJson(raw);
        if (!parsed.ok) {
            failNpcBatch(
                'translate_fail',
                `${parsed.detail} | preview: ${parsed.preview.slice(0, 200)}`,
                ctx,
                Date.now() - t0,
            );
        }

        const zod = buildResponseSchema(npcCount).safeParse(parsed.data);
        if (!zod.success) {
            const detail = zod.error.issues
                .slice(0, 8)
                .map(i => `${i.path.join('.')}: ${i.message}`)
                .join('; ');
            failNpcBatch('zod_fail', detail, ctx, Date.now() - t0);
        }

        if (zod.data.npcs.length === 0) {
            failNpcBatch('empty_batch', 'Gemini devolveu array npcs vazio', ctx, Date.now() - t0);
        }

        if (zod.data.npcs.length !== npcCount) {
            failNpcBatch(
                'incomplete_batch',
                `Esperados ${npcCount} NPCs, recebidos ${zod.data.npcs.length}`,
                ctx,
                Date.now() - t0,
            );
        }

        const heroLevel = await resolveHeroLevelForSession(opts.sessionId);
        const npcs: BootstrapNpcDraft[] = zod.data.npcs.map(n => {
            const sheet = buildNpcCombatSheet({
                role: n.role,
                tier: n.tier,
                heroLevel,
                givenName: n.givenName,
                roleTitle: n.roleTitle,
                displayName: n.displayName,
                suggestedMaxHp: n.maxHp,
                aiSheet: n.aiSheet,
            });
            return {
                givenName: n.givenName,
                roleTitle: n.roleTitle,
                displayName: n.displayName,
                role: n.role,
                description: n.description,
                goal: n.goal,
                tier: n.tier,
                maxHp: sheet.worldStats.vidaMax,
                aiSheet: n.aiSheet,
            };
        });

        penaiPipelineAiResponse('worldBootstrap:npc', ctx, { ok: true, ms: Date.now() - t0, parsed: String(npcs.length) });
        return {
            npcs,
            regionBlurb: zod.data.regionBlurb?.trim(),
            source: 'gemini',
        };
    } catch (err) {
        if (err instanceof WorldGeminiGenerationError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        penaiPipelineAiResponse('worldBootstrap:npc', ctx, { ok: false, ms: Date.now() - t0, error: msg });
        failNpcBatch('gemini_error', msg, ctx);
    }
}
