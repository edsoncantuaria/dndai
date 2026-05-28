import type { WebSocket } from 'ws';
import { incrementStateVersion, loadStateVersion } from '../services/stateVersionService.js';
import { getRollQueueSize } from '../services/rollRequestService.js';
import { getActionTelemetry } from '../services/actionObservabilityService.js';

export const ACTION_TIMEOUT_MS = Number(process.env.ACTION_TIMEOUT_MS) || 120_000;
export const cancelledActions = new Set<string>();
const ACTION_FLOW_DEBUG = process.env.ACTION_FLOW_DEBUG !== 'false';

export const logActionFlow = (stage: string, details: Record<string, unknown>) => {
    if (!ACTION_FLOW_DEBUG) return;
    const sessionId =
        typeof details.sessionId === 'number' ? (details.sessionId as number) : null;
    const actionId =
        typeof details.actionId === 'string' ? (details.actionId as string) : null;
    const telemetry =
        sessionId !== null && actionId ? getActionTelemetry(sessionId, actionId) : null;
    const basePayload = {
        ...details,
        traceId: telemetry?.traceId ?? actionId ?? null,
        intentHash: telemetry?.intentHash ?? null,
        phase: details.phase ?? telemetry?.currentPhase ?? undefined,
    };
    if (sessionId == null) {
        console.log(`[ActionFlow] ${stage}`, basePayload);
        return;
    }
    getRollQueueSize(sessionId)
        .then(size => {
            console.log(`[ActionFlow] ${stage}`, {
                ...basePayload,
                rollQueueSize: size,
            });
        })
        .catch(() => {
            console.log(`[ActionFlow] ${stage}`, basePayload);
        });
};

const actionTimers = new Map<string, NodeJS.Timeout>();

export const startActionTimer = (ws: WebSocket, actionId: string) => {
    const timer = setTimeout(() => {
        actionTimers.delete(actionId);
        ws.send(JSON.stringify({ type: 'timeout', payload: { actionId } }));
    }, ACTION_TIMEOUT_MS);
    actionTimers.set(actionId, timer);
};

export const clearActionTimer = (actionId: string) => {
    const timer = actionTimers.get(actionId);
    if (timer) {
        clearTimeout(timer);
        actionTimers.delete(actionId);
    }
};

export const emitActionRelease = (ws: WebSocket, actionId: string | undefined) => {
    if (!actionId) return;
    clearActionTimer(actionId);
    ws.send(JSON.stringify({ type: 'narrationComplete', payload: { actionId } }));
    ws.send(JSON.stringify({ type: 'stopLoading', payload: { actionId } }));
};

const sessionStateVersions = new Map<number, number>();

export const getSessionStateVersion = (sessionId: number) => sessionStateVersions.get(sessionId) ?? 0;

export const bumpSessionStateVersion = async (sessionId: number) => {
    const next = await incrementStateVersion(sessionId);
    sessionStateVersions.set(sessionId, next);
    return next;
};

export const loadSessionStateVersion = async (sessionId: number) => {
    const fromDb = await loadStateVersion(sessionId);
    sessionStateVersions.set(sessionId, fromDb);
    return fromDb;
};

export const setSessionStateVersion = (sessionId: number, version: number) => {
    sessionStateVersions.set(sessionId, version);
};

export const hasCachedSessionStateVersion = (sessionId: number) => sessionStateVersions.has(sessionId);
