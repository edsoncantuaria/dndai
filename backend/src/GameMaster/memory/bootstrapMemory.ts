import { PenaiDataSource } from '../database/data-source.js';
import { SessionMemory } from '../database/entities/SessionMemory.js';
import { SessionEntityState } from '../database/entities/SessionEntityState.js';
import { storeSessionMemory } from './sessionMemory.js';
import { storeGlobalMemory } from './globalMemory.js';
import { penaiPipelineLog } from '../infra/pipelineLog.js';
import type { PipelineCtx } from '../infra/pipelineLog.js';

export const BOOTSTRAP_MEMORY_TAG = '[MUNDO]';
export const PULSE_MEMORY_TAG = '[PULSO]';

export type BootstrapMemorySnapshot = {
    regionSlug: string;
    regionName: string;
    regionBlurb?: string;
    marketSummary?: string;
    factionRumors: string[];
    npcFacts: string[];
    questFacts?: string[];
};

/** Persiste fatos do bootstrap na memória da sessão + vetor global (região). */
export async function persistBootstrapMemories(
    sessionId: number,
    snapshot: BootstrapMemorySnapshot,
    ctx?: PipelineCtx,
): Promise<number> {
    const pipelineCtx = ctx ?? { sessionId };
    let stored = 0;

    const lines: string[] = [];
    if (snapshot.regionBlurb) {
        lines.push(`${BOOTSTRAP_MEMORY_TAG} Região ${snapshot.regionName}: ${snapshot.regionBlurb}`);
    }
    if (snapshot.marketSummary) {
        lines.push(`${BOOTSTRAP_MEMORY_TAG} Economia: ${snapshot.marketSummary}`);
    }
    for (const r of snapshot.factionRumors) {
        lines.push(`${BOOTSTRAP_MEMORY_TAG} ${r}`);
    }
    for (const n of snapshot.npcFacts) {
        lines.push(`${BOOTSTRAP_MEMORY_TAG} ${n}`);
    }
    for (const q of snapshot.questFacts ?? []) {
        lines.push(`${BOOTSTRAP_MEMORY_TAG} ${q}`);
    }

    for (const text of lines) {
        const row = await storeSessionMemory({
            sessionId,
            text,
            storyKind: 'system',
            importanceScore: 72,
        });
        if (row) stored++;
        await storeGlobalMemory({
            sessionId,
            text,
            regionSlug: snapshot.regionSlug,
        });
    }

    penaiPipelineLog('WORLD_MEMORY', 'memórias de bootstrap gravadas', { count: stored }, pipelineCtx);
    return stored;
}

export type BootstrapMemoryValidation = {
    ok: boolean;
    sessionMemoryCount: number;
    npcStateCount: number;
    issues: string[];
};

/** Valida que o bootstrap deixou memória consultável e NPCs na sessão. */
export async function validateBootstrapMemory(
    sessionId: number,
    opts?: { minMemories?: number; minNpcs?: number },
): Promise<BootstrapMemoryValidation> {
    const minMemories = opts?.minMemories ?? 3;
    const minNpcs = opts?.minNpcs ?? 3;
    const issues: string[] = [];

    const memRepo = PenaiDataSource.getRepository(SessionMemory);
    const memories = await memRepo.find({
        where: { sessionId },
        order: { createdAt: 'DESC' },
        take: 40,
    });
    const bootstrapMemories = memories.filter(m => m.text.includes(BOOTSTRAP_MEMORY_TAG));
    if (bootstrapMemories.length < minMemories) {
        issues.push(`Memórias de bootstrap insuficientes (${bootstrapMemories.length}/${minMemories})`);
    }

    const stateRepo = PenaiDataSource.getRepository(SessionEntityState);
    const states = await stateRepo.find({ where: { sessionId } });
    const npcStateCount = states.length;
    if (npcStateCount < minNpcs) {
        issues.push(`NPCs na sessão insuficientes (${npcStateCount}/${minNpcs})`);
    }

    const recallable = await memRepo
        .createQueryBuilder('m')
        .where('m.sessionId = :sessionId', { sessionId })
        .andWhere('m.text LIKE :tag', { tag: `%${BOOTSTRAP_MEMORY_TAG}%` })
        .andWhere('m.decayedAt IS NULL')
        .getCount();

    if (recallable < minMemories) {
        issues.push(`Memórias ativas abaixo do mínimo (${recallable})`);
    }

    const questMemories = memories.filter(
        m => m.text.includes('[MISSÃO]') || m.text.toLowerCase().includes('missão'),
    );
    if (questMemories.length === 0) {
        issues.push('Nenhuma memória de missão — aviso (bootstrap pode ter 0 quests)');
    }

    return {
        ok: issues.length === 0 || (bootstrapMemories.length >= 2 && npcStateCount >= minNpcs),
        sessionMemoryCount: bootstrapMemories.length,
        npcStateCount,
        issues,
    };
}

/** Fatos do pulso agendado (viagem, descanso, bootstrap). */
export async function persistPulseMemories(
    sessionId: number,
    regionSlug: string | null,
    facts: string[],
    ctx?: PipelineCtx,
): Promise<number> {
    if (!facts.length) return 0;
    const pipelineCtx = ctx ?? { sessionId };
    let stored = 0;
    for (const fact of facts) {
        const text = `${PULSE_MEMORY_TAG} ${fact.trim()}`.slice(0, 500);
        if (!text || text.length < 12) continue;
        const row = await storeSessionMemory({
            sessionId,
            text,
            storyKind: 'system',
            importanceScore: 68,
        });
        if (row) stored++;
        await storeGlobalMemory({ sessionId, text, regionSlug });
    }
    penaiPipelineLog('WORLD_MEMORY', 'memórias de pulso gravadas', { count: stored }, pipelineCtx);
    return stored;
}

export async function loadRecentWorldMemoryLines(sessionId: number, limit = 5): Promise<string[]> {
    const memRepo = PenaiDataSource.getRepository(SessionMemory);
    const rows = await memRepo.find({
        where: { sessionId },
        order: { createdAt: 'DESC' },
        take: 20,
    });
    return rows
        .filter(
            m =>
                m.text.includes(BOOTSTRAP_MEMORY_TAG) ||
                m.text.includes(PULSE_MEMORY_TAG) ||
                m.text.includes('[MISSÃO]') ||
                m.text.includes('[FATO]'),
        )
        .map(m => m.text.slice(0, 200))
        .slice(0, limit);
}
