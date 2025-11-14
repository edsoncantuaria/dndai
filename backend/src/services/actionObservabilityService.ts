import crypto from 'node:crypto';
import type { ActionIntent } from '../rules/actionIntentService.js';
import type { ActionPhase } from './actionPhaseService.js';

type TelemetryKey = string;

type ActionTelemetry = {
    traceId: string;
    intentHash?: string | null;
    startedAt: number;
    currentPhase?: ActionPhase | 'RECEIVED';
    phaseStartedAt?: number;
};

const telemetryByAction = new Map<TelemetryKey, ActionTelemetry>();
const lastIntentBySession = new Map<number, { intentHash?: string | null; actionId: string; timestamp: number }>();
let actionRetryCounter = 0;

const buildKey = (sessionId: number, actionId: string) => `${sessionId}:${actionId}`;

const normalizeString = (value: string) => value.replace(/\s+/g, ' ').trim();

export const computeIntentHash = ({
    intent,
    prompt,
}: {
    intent?: ActionIntent | null;
    prompt?: string | null;
}): string | null => {
    if (intent) {
        const serialized = JSON.stringify(intent);
        return crypto.createHash('sha1').update(serialized).digest('hex').slice(0, 12);
    }
    if (prompt && prompt.trim().length) {
        return crypto.createHash('sha1').update(normalizeString(prompt)).digest('hex').slice(0, 12);
    }
    return null;
};

export const registerActionIntentTelemetry = (
    sessionId: number,
    actionId: string,
    intentHash: string | null,
) => {
    const key = buildKey(sessionId, actionId);
    const telemetry: ActionTelemetry = {
        traceId: actionId,
        intentHash,
        startedAt: Date.now(),
        currentPhase: 'RECEIVED',
        phaseStartedAt: Date.now(),
    };
    telemetryByAction.set(key, telemetry);

    const previous = lastIntentBySession.get(sessionId);
    if (intentHash && previous && previous.intentHash === intentHash && previous.actionId !== actionId) {
        actionRetryCounter += 1;
        console.warn('[ActionFlow] action retry detected', {
            sessionId,
            previousActionId: previous.actionId,
            actionId,
            intentHash,
        });
    }
    lastIntentBySession.set(sessionId, { intentHash, actionId, timestamp: Date.now() });
    return telemetry;
};

export const getActionTelemetry = (sessionId: number, actionId: string) =>
    telemetryByAction.get(buildKey(sessionId, actionId));

export const clearActionTelemetry = (sessionId: number, actionId: string) => {
    telemetryByAction.delete(buildKey(sessionId, actionId));
};

export const markActionPhaseTelemetry = (
    sessionId: number,
    actionId: string,
    nextPhase: ActionPhase,
) => {
    const telemetry = getActionTelemetry(sessionId, actionId);
    if (!telemetry) return null;
    const now = Date.now();
    const previousPhase = telemetry.currentPhase;
    const previousPhaseDurationMs =
        telemetry.phaseStartedAt && previousPhase ? now - telemetry.phaseStartedAt : undefined;
    telemetry.currentPhase = nextPhase;
    telemetry.phaseStartedAt = now;
    return { previousPhase, previousPhaseDurationMs };
};

export const formatActionMetrics = () => `dndai_action_retries_total ${actionRetryCounter}`;
