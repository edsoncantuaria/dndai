import { appendWorldEvent } from '../events/store.js';
import { storeSessionMemory } from './sessionMemory.js';
import { storeGlobalMemory } from './globalMemory.js';
import { penaiPipelineLog } from '../infra/pipelineLog.js';
import type { PipelineCtx } from '../infra/pipelineLog.js';

export const FACT_MEMORY_TAG = '[FATO]';

/** Fato derivado de evento simulado — única fonte para memória de longo prazo (anti-alucinação). */
export async function recordProvenanceFact(opts: {
    sessionId: number;
    text: string;
    regionSlug?: string | null;
    sourceEventId?: string;
    sourceEventType?: string;
    importanceScore?: number;
    ctx?: PipelineCtx;
}): Promise<void> {
    const trimmed = opts.text.trim();
    if (!trimmed || trimmed.length < 8) return;

    const tagged = `${FACT_MEMORY_TAG} ${trimmed}`.slice(0, 500);
    const event = await appendWorldEvent({
        type: 'FACT_RECORDED',
        sessionId: opts.sessionId,
        payload: {
            text: trimmed,
            regionSlug: opts.regionSlug ?? null,
            sourceEventId: opts.sourceEventId ?? null,
            sourceEventType: opts.sourceEventType ?? null,
        },
    });

    await storeSessionMemory({
        sessionId: opts.sessionId,
        text: tagged,
        storyKind: 'system',
        importanceScore: opts.importanceScore ?? 70,
    });
    await storeGlobalMemory({
        sessionId: opts.sessionId,
        text: tagged,
        regionSlug: opts.regionSlug ?? undefined,
    });

    penaiPipelineLog(
        'WORLD_MEMORY',
        'fato com proveniência',
        { eventId: event.id, preview: trimmed.slice(0, 80) },
        opts.ctx ?? { sessionId: opts.sessionId },
    );
}
