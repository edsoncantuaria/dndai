import { PenaiDataSource } from '../database/data-source.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import { SessionEntityState } from '../database/entities/SessionEntityState.js';
import { randomUUID } from 'crypto';
import { defaultProviders } from '../adapters/index.js';
import { COLLECTIONS } from '../adapters/qdrant/vectorStore.js';
import { parseNpcPersonality } from '../schemas/npcPersonality.js';
import { defaultEntityTierForType } from './campaignGc.js';
import { loadSessionGameClock } from './gameClock.js';

export async function findEntityCandidates(opts: {
    regionSlug?: string;
    poiSlug?: string;
    levelBand?: number;
    limit?: number;
}): Promise<Array<{ id: string; slug: string; displayName: string; entityType: string }>> {
    const repo = PenaiDataSource.getRepository(WorldEntity);
    const qb = repo.createQueryBuilder('e').where('e.statusGlobal = :alive', { alive: 'alive' });

    if (opts.levelBand != null) {
        qb.andWhere("(e.stats->>'level')::int <= :lvl", { lvl: opts.levelBand + 2 });
    }

    const rows = await qb.orderBy('e.updatedAt', 'DESC').take(opts.limit ?? 10).getMany();
    return rows.map(r => ({
        id: r.id,
        slug: r.slug,
        displayName: r.displayName,
        entityType: r.entityType,
    }));
}

export async function markEntityAppeared(
    sessionId: number,
    worldEntityId: string,
    snapshot?: Record<string, unknown>,
): Promise<void> {
    const repo = PenaiDataSource.getRepository(SessionEntityState);
    let state = await repo.findOne({ where: { sessionId, worldEntityId } });
    if (!state) {
        state = repo.create({ sessionId, worldEntityId });
    }
    state.appeared = true;
    state.lastSeenAt = new Date();
    const clock = await loadSessionGameClock(sessionId);
    state.lastSeenGameDay = clock.day;
    if (snapshot) state.sessionStatsSnapshot = snapshot;
    await repo.save(state);
}

export async function findEntityCandidatesByEmbedding(
    query: string,
    opts: { regionSlug?: string; limit?: number },
): Promise<Array<{ id: string; slug: string; displayName: string; entityType: string; score: number }>> {
    if (!defaultProviders.vectorStore.isReady() || !query.trim()) return [];

    const vector = await defaultProviders.embedding.embed(query);
    if (!vector.length) return [];

    const hits = await defaultProviders.vectorStore.search(COLLECTIONS[2], vector, opts.limit ?? 5);
    if (!hits.length) return [];

    const repo = PenaiDataSource.getRepository(WorldEntity);
    const ids = hits.map(h => String(h.payload.entityId ?? '')).filter(Boolean);
    if (!ids.length) return [];

    const rows = await repo
        .createQueryBuilder('e')
        .where('e.id IN (:...ids)', { ids })
        .getMany();
    const byId = new Map(rows.map(r => [r.id, r]));

    return hits
        .map(h => {
            const entity = byId.get(String(h.payload.entityId ?? ''));
            if (!entity) return null;
            return {
                id: entity.id,
                slug: entity.slug,
                displayName: entity.displayName,
                entityType: entity.entityType,
                score: h.score,
            };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
}

export async function findOrReuseNpcEntity(opts: {
    displayName: string;
    description?: string;
    poiId?: string | null;
    createdByUserId?: number;
}): Promise<WorldEntity> {
    const similar = await findEntityCandidatesByEmbedding(
        `${opts.displayName} ${opts.description ?? ''}`,
        { limit: 3 },
    );
    const normalizedName = opts.displayName.trim().toLowerCase();
    const match = similar.find(
        s => s.displayName.trim().toLowerCase() === normalizedName && s.entityType === 'npc',
    );
    if (match) {
        const existing = await PenaiDataSource.getRepository(WorldEntity).findOne({
            where: { id: match.id },
        });
        if (existing) return existing;
    }
    return createNpcEntity(opts);
}

export async function createNpcEntity(opts: {
    displayName: string;
    poiId?: string | null;
    stats?: Record<string, unknown>;
    personality?: Record<string, unknown>;
    createdByUserId?: number;
    entityTier?: import('../database/entities/types/EntityTier.js').EntityTier;
}): Promise<WorldEntity> {
    const repo = PenaiDataSource.getRepository(WorldEntity);
    const slug = `${opts.displayName}-${randomUUID().slice(0, 8)}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-');

    const entity = await repo.save(
        repo.create({
            id: randomUUID(),
            entityType: 'npc',
            entityTier: opts.entityTier ?? defaultEntityTierForType('npc'),
            canonical: true,
            slug,
            displayName: opts.displayName,
            description: null,
            stats: opts.stats ?? { level: 1 },
            personality: parseNpcPersonality(opts.personality ?? { goals: [] }),
            visual: {},
            poiId: opts.poiId ?? null,
            createdByUserId: opts.createdByUserId ?? null,
            source: 'ai_generated',
            locale: 'pt-BR',
        }),
    );

    if (defaultProviders.vectorStore.isReady()) {
        const vector = await defaultProviders.embedding.embed(
            `${entity.displayName} ${entity.description ?? ''}`,
        );
        if (vector.length) {
            const pointId = randomUUID();
            await defaultProviders.vectorStore.upsert(COLLECTIONS[2], pointId, vector, {
                entityId: entity.id,
                slug: entity.slug,
                displayName: entity.displayName,
            });
            entity.embeddingPointId = pointId;
            await repo.save(entity);
        }
    }

    return entity;
}
