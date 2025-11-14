// backend/src/services/rollMetricsService.ts
type ActionKey = string;

interface RollEntry {
    count: number;
    intentType?: string;
    lastUpdated: number;
}

const counters = {
    total: 0,
    repeatedActions: 0,
    unexpectedAiRolls: 0,
};

const actionRolls = new Map<ActionKey, RollEntry>();
const rollQueueSizes = new Map<number, number>();

const toKey = (sessionId: number, actionId: string) => `${sessionId}:${actionId}`;

export const recordRollEmission = (sessionId: number, actionId?: string, intentType?: string) => {
    counters.total += 1;
    if (!actionId) return;
    const key = toKey(sessionId, actionId);
    const existing = actionRolls.get(key);
    if (existing) {
        existing.count += 1;
        existing.lastUpdated = Date.now();
        if (existing.count === 2) {
            counters.repeatedActions += 1;
        }
        console.warn(
            `[RollMonitor] ação ${actionId} da sessão ${sessionId} emitiu ${existing.count} roll requests (intent=${intentType ?? 'desconhecida'}).`
        );
    } else {
        actionRolls.set(key, {
            count: 1,
            intentType,
            lastUpdated: Date.now(),
        });
    }
};

export const clearRollEmission = (sessionId: number, actionId?: string) => {
    if (!actionId) return;
    actionRolls.delete(toKey(sessionId, actionId));
};
export const updateRollQueueSize = (sessionId: number, size: number) => {
    if (size > 0) {
        rollQueueSizes.set(sessionId, size);
    } else {
        rollQueueSizes.delete(sessionId);
    }
};

export const recordUnexpectedAiRoll = (sessionId?: number, reason?: string) => {
    counters.unexpectedAiRolls += 1;
    if (sessionId) {
        console.warn(`[RollMonitor] IA tentou emitir rollRequest sem intent (sessionId=${sessionId}${reason ? `, reason=${reason}` : ''}).`);
    } else {
        console.warn('[RollMonitor] IA tentou emitir rollRequest sem intent.');
    }
};

export const formatRollMetrics = () => {
    const activeLines = Array.from(actionRolls.entries()).map(([key, entry]) => {
        const [sessionId, actionId] = key.split(':');
        return `dndai_action_roll_requests{sessionId="${sessionId}",actionId="${actionId}",intent="${entry.intentType ?? 'unknown'}"} ${entry.count}`;
    });
    const queueLines = Array.from(rollQueueSizes.entries()).map(([sessionId, size]) => {
        return `dndai_roll_queue_size{sessionId="${sessionId}"} ${size}`;
    });

    return [
        `dndai_roll_requests_total ${counters.total}`,
        `dndai_roll_request_repeats_total ${counters.repeatedActions}`,
        `dndai_ai_roll_requests_unexpected_total ${counters.unexpectedAiRolls}`,
        ...activeLines,
        ...queueLines,
    ].join('\n');
};
