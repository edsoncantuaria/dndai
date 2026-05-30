import { appendWorldEvent } from '../../events/store.js';
import { projectSessionWorldState } from '../../events/projector.js';
import { advanceActiveQuests } from '../sessionQuests.js';
import { penaiPipelineLog } from '../../infra/pipelineLog.js';
import type { PipelineCtx } from '../../infra/pipelineLog.js';
import { PenaiDataSource } from '../../database/data-source.js';
import { Rumor } from '../../database/entities/Rumor.js';

const MICRO_PULSE_ON_TURN =
    process.env.MICRO_PULSE_ON_TURN === undefined ||
    ['1', 'true', 'yes', 'on'].includes(String(process.env.MICRO_PULSE_ON_TURN).toLowerCase());

/** Fade leve de rumores via evento RUMOR_FADED (projector aplica status). */
async function microRumorFade(sessionId: number): Promise<string[]> {
    const rumorRepo = PenaiDataSource.getRepository(Rumor);
    const active = await rumorRepo.find({
        where: { sessionId, status: 'active' },
        order: { createdAt: 'ASC' },
        take: 20,
    });
    if (active.length <= 10) return [];

    const toFade = active.slice(0, active.length - 10);
    for (const r of toFade) {
        await appendWorldEvent({
            type: 'RUMOR_FADED',
            sessionId,
            payload: { rumorId: r.id, title: r.title },
        });
    }
    return ['Alguns boatos antigos deixam de circular.'];
}

/**
 * Micro-pulso pós-mecânico: determinístico, sem Gemini, orçamento &lt;50ms alvo.
 */
export async function runMicroWorldTick(
    sessionId: number,
    ctx?: PipelineCtx,
): Promise<string[]> {
    if (!MICRO_PULSE_ON_TURN) return [];

    const pipelineCtx = ctx ?? { sessionId };
    const lines: string[] = [];

    try {
        lines.push(...(await microRumorFade(sessionId)));
        lines.push(...(await advanceActiveQuests(sessionId)));

        await appendWorldEvent({
            type: 'MICRO_WORLD_TICK',
            sessionId,
            payload: {
                lines: lines.slice(0, 6),
                tickKind: 'turn',
            },
        });

        await projectSessionWorldState(sessionId);

        if (lines.length) {
            penaiPipelineLog('WORLD_MICRO', 'micro-pulso', { lines: lines.length }, pipelineCtx);
        }
    } catch (err) {
        penaiPipelineLog(
            'WORLD_MICRO',
            'micro-pulso falhou (não bloqueia turno)',
            { error: err instanceof Error ? err.message : String(err) },
            pipelineCtx,
        );
    }

    return lines;
}
