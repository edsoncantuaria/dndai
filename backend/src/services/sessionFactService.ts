import { AppDataSource } from '../database/data-source.js';
import { SessionFact, type SessionFactCategory, type SessionFactSource } from '../entities/SessionFact.js';
import { NewFactSchema, type NewFact } from '../schemas/memorySchemas.js';
import { expireStaleSessionFacts, resolveFactTierFromCategory } from './sessionFactTtl.js';

const MAX_FACTS_PER_TURN = 5;
const MAX_STORED_FACTS = 200;

const STATE_CHANGE_BLOCKLIST = [
    'hp', 'vida', 'inventário', 'inventory', 'ouro', 'gold', 'xp', 'nível', 'level',
    'dano', 'damage', 'cura', 'healing', 'slot', 'magia',
];

const normalizeFactText = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, ' ');

const factRepository = () => AppDataSource.getRepository(SessionFact);

export interface PersistFactsResult {
    accepted: NewFact[];
    rejected: Array<{ fact: NewFact; reason: string }>;
}

export const validateNewFact = (fact: unknown, currentRegionSlug?: string | null): { ok: true; data: NewFact } | { ok: false; reason: string } => {
    const parsed = NewFactSchema.safeParse(fact);
    if (!parsed.success) {
        return { ok: false, reason: parsed.error.issues.map(i => i.message).join('; ') };
    }
    const data = parsed.data;
    const lowered = data.fact.toLowerCase();
    if (STATE_CHANGE_BLOCKLIST.some(token => lowered.includes(token))) {
        return { ok: false, reason: 'Fato parece alterar estado mecânico (bloqueado).' };
    }
    if (data.category === 'region' && !data.regionSlug && !currentRegionSlug) {
        return { ok: false, reason: 'Fato de região requer regionSlug ou contexto regional.' };
    }
    return { ok: true, data };
};

export const persistValidatedFacts = async (params: {
    sessaoId: number;
    characterId?: number | null;
    facts: unknown[];
    source?: SessionFactSource;
    currentRegionSlug?: string | null;
}): Promise<PersistFactsResult> => {
    const accepted: NewFact[] = [];
    const rejected: PersistFactsResult['rejected'] = [];
    const repo = factRepository();
    const existing = await repo.find({
        where: { sessaoId: params.sessaoId, isActive: true },
        select: ['fact'],
        take: MAX_STORED_FACTS,
        order: { createdAt: 'DESC' },
    });
    const existingSet = new Set(existing.map(row => normalizeFactText(row.fact)));

    for (const raw of params.facts.slice(0, MAX_FACTS_PER_TURN)) {
        const check = validateNewFact(raw, params.currentRegionSlug);
        if (!check.ok) {
            rejected.push({ fact: raw as NewFact, reason: check.reason });
            continue;
        }
        const normalized = normalizeFactText(check.data.fact);
        if (existingSet.has(normalized)) {
            rejected.push({ fact: check.data, reason: 'Fato duplicado.' });
            continue;
        }
        existingSet.add(normalized);
        accepted.push(check.data);
    }

    if (accepted.length) {
        await repo.save(
            accepted.map(fact => ({
                sessaoId: params.sessaoId,
                characterId: params.characterId ?? null,
                category: fact.category as SessionFactCategory,
                subject: fact.subject ?? null,
                fact: fact.fact.trim(),
                regionSlug: fact.regionSlug ?? params.currentRegionSlug ?? null,
                npcId: fact.npcId ?? null,
                questId: fact.questId ?? null,
                source: params.source ?? 'ai',
                isActive: true,
                tier: resolveFactTierFromCategory(fact.category),
            })),
        );
        void expireStaleSessionFacts(params.sessaoId).catch(err => {
            console.warn('[sessionFact] TTL cleanup:', err);
        });
    }

    return { accepted, rejected };
};

export interface FactQueryContext {
    regionSlug?: string | null;
    npcIds?: string[];
    questIds?: string[];
    limit?: number;
}

export const queryRelevantFacts = async (
    sessaoId: number,
    ctx: FactQueryContext = {},
): Promise<SessionFact[]> => {
    const limit = ctx.limit ?? 12;
    const repo = factRepository();
    const all = await repo.find({
        where: { sessaoId, isActive: true },
        order: { createdAt: 'DESC' },
        take: MAX_STORED_FACTS,
    });

    const npcSet = new Set((ctx.npcIds ?? []).map(id => id.toLowerCase()));
    const questSet = new Set((ctx.questIds ?? []).map(id => id.toLowerCase()));
    const regionSlug = ctx.regionSlug?.toLowerCase() ?? null;

    const scored = all.map(fact => {
        let score = 0;
        if (regionSlug && fact.regionSlug?.toLowerCase() === regionSlug) score += 3;
        if (fact.category === 'region' && regionSlug) score += 1;
        if (fact.npcId && npcSet.has(fact.npcId.toLowerCase())) score += 4;
        if (fact.category === 'npc' && fact.npcId && npcSet.has(fact.npcId.toLowerCase())) score += 1;
        if (fact.questId && questSet.has(fact.questId.toLowerCase())) score += 4;
        if (fact.category === 'quest' && questSet.size > 0) score += 1;
        if (fact.category === 'general') score += 0.5;
        return { fact, score };
    });

    return scored
        .filter(entry => entry.score > 0 || (!regionSlug && !npcSet.size && !questSet.size))
        .sort((a, b) => b.score - a.score || b.fact.createdAt.getTime() - a.fact.createdAt.getTime())
        .slice(0, limit)
        .map(entry => entry.fact);
};

export const formatFactsForPrompt = (facts: SessionFact[]): string => {
    if (!facts.length) return '';
    return facts
        .map(fact => {
            const tags = [fact.category.toUpperCase()];
            if (fact.subject) tags.push(fact.subject);
            return `- [${tags.join(': ')}] ${fact.fact}`;
        })
        .join('\n');
};

export const recordMotorFact = async (params: {
    sessaoId: number;
    characterId?: number | null;
    category: SessionFactCategory;
    fact: string;
    subject?: string;
    regionSlug?: string | null;
    npcId?: string | null;
    questId?: string | null;
}) => {
    await persistValidatedFacts({
        sessaoId: params.sessaoId,
        characterId: params.characterId,
        source: 'motor',
        currentRegionSlug: params.regionSlug,
        facts: [{
            category: params.category,
            fact: params.fact,
            subject: params.subject,
            regionSlug: params.regionSlug ?? undefined,
            npcId: params.npcId ?? undefined,
            questId: params.questId ?? undefined,
        }],
    });
};
