import type { SessionAggregateView } from '../sessions/sessionAggregate.js';
import type { ShardPoliticsState } from '../world/politicsState.js';

export type NarrativeTriggerContext = {
    sessionId: number;
    eventType: string;
    event: Record<string, unknown>;
    regionSlug: string | null;
    regionState: {
        fear: number;
        prosperity: number;
        crime: number;
        resources: Record<string, unknown>;
    } | null;
    shardId: string | null;
    shardPoliticsState: ShardPoliticsState;
    minFactionReputation: number;
    activeQuestCount: number;
};

export function buildNarrativeTriggerContext(opts: {
    sessionId: number;
    eventType: string;
    eventPayload: Record<string, unknown>;
    aggregate: SessionAggregateView;
    shardId: string | null;
    shardPoliticsState: ShardPoliticsState;
}): NarrativeTriggerContext {
    const rs = opts.aggregate.regionState;
    const factionScores = opts.aggregate.reputation.factions.map(f => f.score);
    const minFactionReputation = factionScores.length ? Math.min(...factionScores) : 0;

    return {
        sessionId: opts.sessionId,
        eventType: opts.eventType,
        event: opts.eventPayload,
        regionSlug: opts.aggregate.regionSlug,
        regionState: rs
            ? {
                  fear: Number(rs.fear ?? 0),
                  prosperity: Number(rs.prosperity ?? 0),
                  crime: Number(rs.crime ?? 0),
                  resources: (rs.resources as Record<string, unknown>) ?? {},
              }
            : null,
        shardId: opts.shardId,
        shardPoliticsState: opts.shardPoliticsState,
        minFactionReputation,
        activeQuestCount: opts.aggregate.activeQuests.length,
    };
}

/** Resolve dot-path sobre o contexto (ex.: regionState.fear, event.goal). */
export function readTriggerPath(ctx: NarrativeTriggerContext, path: string): unknown {
    const parts = path.split('.').filter(Boolean);
    let cur: unknown = ctx;
    for (const part of parts) {
        if (cur == null || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[part];
    }
    return cur;
}
