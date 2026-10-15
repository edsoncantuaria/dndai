import { appendWorldEvent } from '../events/store.js';
import { applyEventProjection } from '../events/projector.js';
import type { WorldEvent } from '../database/entities/WorldEvent.js';

export type PenaiCommand =
    | { kind: 'APPEND_EVENT'; sessionId: number; type: string; payload?: Record<string, unknown> }
    | { kind: 'PROJECT_SESSION'; sessionId: number };

export type CommandResult = { ok: boolean; event?: WorldEvent };

/**
 * Barramento mínimo (P10): único caminho preferencial para mutações de mundo via evento.
 */
export async function dispatchPenaiCommand(cmd: PenaiCommand): Promise<CommandResult> {
    if (cmd.kind === 'APPEND_EVENT') {
        const event = await appendWorldEvent({
            type: cmd.type,
            sessionId: cmd.sessionId,
            payload: cmd.payload ?? {},
        });
        await applyEventProjection(event);
        return { ok: true, event };
    }

    if (cmd.kind === 'PROJECT_SESSION') {
        const { projectSessionWorldState } = await import('../events/projector.js');
        await projectSessionWorldState(cmd.sessionId);
        return { ok: true };
    }

    return { ok: false };
}
