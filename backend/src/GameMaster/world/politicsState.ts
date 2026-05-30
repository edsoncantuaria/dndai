import { PenaiDataSource } from '../database/data-source.js';
import { WorldShard } from '../database/entities/WorldShard.js';
import { appendWorldEvent } from '../events/store.js';
import { getOrCreateRegionState } from './campaignState.js';

export type ShardPoliticsState = 'stable' | 'tense' | 'coup_risk';

export async function getShardPoliticsState(shardId: string): Promise<ShardPoliticsState> {
    const shard = await PenaiDataSource.getRepository(WorldShard).findOne({
        where: { id: shardId },
    });
    const raw = shard?.politicsState;
    if (raw === 'tense' || raw === 'coup_risk') return raw;
    return 'stable';
}

export async function setShardPoliticsState(
    shardId: string,
    state: ShardPoliticsState,
): Promise<void> {
    const repo = PenaiDataSource.getRepository(WorldShard);
    const shard = await repo.findOne({ where: { id: shardId } });
    if (!shard) return;
    shard.politicsState = state;
    await repo.save(shard);
}

/** Transição leve após FACTION_TICK + medo regional alto. */
export async function maybeTransitionPoliticsAfterFactionTick(opts: {
    sessionId: number;
    shardId: string | null;
    regionSlug: string;
    goal: string;
}): Promise<void> {
    if (!opts.shardId) return;
    const current = await getShardPoliticsState(opts.shardId);
    const region = await getOrCreateRegionState(opts.sessionId, opts.regionSlug);

    let next: ShardPoliticsState | null = null;
    if (current === 'stable' && opts.goal === 'expand' && region.fear >= 60) {
        next = 'tense';
    } else if (current === 'tense' && region.crime >= 65 && opts.goal === 'expand') {
        next = 'coup_risk';
    } else if (current === 'coup_risk' && region.fear < 45 && region.crime < 50) {
        next = 'stable';
    }

    if (!next || next === current) return;

    await setShardPoliticsState(opts.shardId, next);
    await appendWorldEvent({
        type: 'POLITICS_STATE_CHANGED',
        sessionId: opts.sessionId,
        payload: {
            shardId: opts.shardId,
            from: current,
            to: next,
            regionSlug: opts.regionSlug,
        },
    });
}

export function politicsStateLabel(state: ShardPoliticsState): string {
    switch (state) {
        case 'tense':
            return 'Região tensa — facções em disputa';
        case 'coup_risk':
            return 'Risco de golpe ou revolta iminente';
        default:
            return 'Política local estável';
    }
}
