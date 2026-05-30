/** Marcador WS quando a narração foi enfileirada (texto vem depois no gameStateUpdate). */
export const NARRATION_QUEUED_MARKER = '[pipeline:narration-queued]';

export function isQueuedNarrationAck(
    payload?: { systemLog?: string | null; logEntries?: unknown[] | null } | null,
): boolean {
    if (!payload) return false;
    const hasLogs = Array.isArray(payload.logEntries) && payload.logEntries.length > 0;
    return payload.systemLog === NARRATION_QUEUED_MARKER && !hasLogs;
}

export function hasDeliveredNarration(
    payload?: { systemLog?: string | null; logEntries?: unknown[] | null } | null,
): boolean {
    if (!payload) return false;
    if (Array.isArray(payload.logEntries) && payload.logEntries.length > 0) return true;
    return Boolean(payload.systemLog && payload.systemLog !== NARRATION_QUEUED_MARKER);
}
