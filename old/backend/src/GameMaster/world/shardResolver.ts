import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { WorldShard } from '../database/entities/WorldShard.js';
import { getRegionBySlug } from './travelCanon.js';

/** Um shard por região canônica — estado compartilhado entre campanhas. */
export async function getOrCreateShardForRegion(regionSlug: string): Promise<WorldShard> {
    const normalized = regionSlug.trim().toLowerCase();
    const repo = PenaiDataSource.getRepository(WorldShard);
    let shard = await repo.findOne({ where: { regionSlug: normalized } });
    if (shard) return shard;

    const meta = await getRegionBySlug(normalized);
    shard = await repo.save(
        repo.create({
            regionSlug: normalized,
            displayName: meta?.displayName ?? normalized,
            version: 0,
        }),
    );
    return shard;
}

export async function assignSessionShard(
    sessionId: number,
    regionSlug: string | null,
): Promise<string | null> {
    if (!regionSlug?.trim()) return null;
    const shard = await getOrCreateShardForRegion(regionSlug);
    const sessionRepo = PenaiDataSource.getRepository(GameSession);
    const session = await sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) return null;
    if (session.shardId === shard.id) return shard.id;
    session.shardId = shard.id;
    await sessionRepo.save(session);

    const { startShardBackgroundWorkflow } = await import('../../temporal/client.js');
    void startShardBackgroundWorkflow(shard.id).catch(() => undefined);

    return shard.id;
}

export async function resolveSessionShardId(sessionId: number): Promise<string | null> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (session?.shardId) return session.shardId;
    if (session?.currentRegionSlug) {
        return assignSessionShard(sessionId, session.currentRegionSlug);
    }
    return null;
}

export async function bumpShardVersion(shardId: string): Promise<void> {
    const repo = PenaiDataSource.getRepository(WorldShard);
    const shard = await repo.findOne({ where: { id: shardId } });
    if (!shard) return;
    shard.version += 1;
    await repo.save(shard);
}
