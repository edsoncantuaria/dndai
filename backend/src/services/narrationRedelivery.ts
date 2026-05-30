import { AppDataSource } from '../database/data-source.js';
import { SessionLog } from '../entities/SessionLog.js';
import type { GameMasterResponse } from '../schemas/gameSchemas.js';
import { getSessaoDetails } from './sessaoService.js';

function parseJson<T>(raw: string | null | undefined): T | null {
    if (!raw?.trim()) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

function logEntryFromSessionLog(log: SessionLog): GameMasterResponse['logEntries'][number] | null {
    let content: unknown = log.response;
    const parsed = typeof log.response === 'string' ? parseJson<unknown>(log.response) : log.response;
    if (parsed !== null) content = parsed;
    if (content && typeof content === 'object' && content !== null && 'content' in content) {
        content = (content as { content: unknown }).content;
    }
    if (typeof content !== 'string' || !content.trim()) return null;
    return {
        type: (log.type as 'narration' | 'action' | 'system') || 'narration',
        content,
        ...(log.rollResult ? { rollResult: log.rollResult as never } : {}),
    };
}

/** Reenvia ao cliente a última narração já persistida (retry / entrega perdida). */
export async function buildRedeliveredResponse(
    sessionId: number,
    userId: number,
    actionSequence?: number | null,
): Promise<GameMasterResponse | null> {
    const details = await getSessaoDetails(sessionId, userId);
    const logs = details.logs ?? [];
    const stateLog = [...logs].reverse().find(l => l.type === 'state');
    const statePayload = parseJson<GameMasterResponse>(stateLog?.response ?? null);
    if (!statePayload) return null;

    const logRepo = AppDataSource.getRepository(SessionLog);
    const lastNarration = await logRepo.findOne({
        where: { sessaoId: sessionId, type: 'narration' },
        order: { timestamp: 'DESC' },
    });
    const narrationEntry = lastNarration ? logEntryFromSessionLog(lastNarration) : null;
    if (!narrationEntry) return null;

    return {
        ...statePayload,
        logEntries: [narrationEntry],
        stateVersion: details.stateVersion ?? statePayload.stateVersion,
        actionSequence: actionSequence ?? undefined,
        updatedCharacter: (details.character as GameMasterResponse['updatedCharacter']) ?? statePayload.updatedCharacter,
        combatState: details.combatState ?? statePayload.combatState,
    };
}
