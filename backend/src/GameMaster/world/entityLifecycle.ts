import { PenaiDataSource } from '../../database/data-source.js';
import { WorldEntity } from '../../database/entities/WorldEntity.js';
import { SessionEntityState } from '../../database/entities/SessionEntityState.js';
import { appendWorldEvent } from '../../events/store.js';
import {
    findEntityCandidates,
    findOrReuseNpcEntity,
    markEntityAppeared,
    createNpcEntity,
} from './entityRegistry.js';
import { getGameSession } from '../sessions/sessionService.js';

export type LifecycleDecision = 'reuse' | 'spawn' | 'promote' | 'retire' | 'kill' | 'noop';

export type LifecycleContext = {
    sessionId: number;
    userId: number;
    playerAction: string;
    regionSlug?: string | null;
};

export function decideEntityLifecycle(ctx: LifecycleContext): LifecycleDecision {
    const action = ctx.playerAction.toLowerCase();
    if (/npc|encontr|falar com|conversar/i.test(action)) {
        return 'reuse';
    }
    if (/matar|executar|eliminar/i.test(action)) {
        return 'kill';
    }
    return 'noop';
}

export async function applyEntityLifecycle(
    decision: LifecycleDecision,
    ctx: LifecycleContext,
): Promise<WorldEntity | null> {
    switch (decision) {
        case 'reuse': {
            const candidates = await findEntityCandidates({
                regionSlug: ctx.regionSlug ?? undefined,
                limit: 3,
            });
            if (candidates[0]) {
                await markEntityAppeared(ctx.sessionId, candidates[0].id, { level: 1 });
                await appendWorldEvent({
                    type: 'ENTITY_REUSED',
                    sessionId: ctx.sessionId,
                    payload: { entityId: candidates[0].id, displayName: candidates[0].displayName },
                });
                const entity = await PenaiDataSource.getRepository(WorldEntity).findOne({
                    where: { id: candidates[0].id },
                });
                return entity;
            }
            const reused = await findOrReuseNpcEntity({
                displayName: 'Viajante',
                createdByUserId: ctx.userId,
            });
            await markEntityAppeared(ctx.sessionId, reused.id, { level: 1 });
            await appendWorldEvent({
                type: 'ENTITY_REUSED',
                sessionId: ctx.sessionId,
                payload: { entityId: reused.id, displayName: reused.displayName },
            });
            return reused;
        }
        case 'spawn': {
            const entity = await createNpcEntity({
                displayName: 'Viajante',
                createdByUserId: ctx.userId,
            });
            await markEntityAppeared(ctx.sessionId, entity.id, { level: 1 });
            await appendWorldEvent({
                type: 'ENTITY_SPAWNED',
                sessionId: ctx.sessionId,
                payload: { entityId: entity.id, displayName: entity.displayName },
            });
            return entity;
        }
        case 'retire': {
            const repo = PenaiDataSource.getRepository(WorldEntity);
            const stale = await repo.find({
                where: { statusGlobal: 'alive', entityType: 'npc' },
                order: { updatedAt: 'ASC' },
                take: 1,
            });
            if (!stale[0]) return null;
            stale[0].statusGlobal = 'retired';
            await repo.save(stale[0]);
            await appendWorldEvent({
                type: 'ENTITY_RETIRED',
                sessionId: ctx.sessionId,
                payload: { entityId: stale[0].id },
            });
            return stale[0];
        }
        case 'promote': {
            await appendWorldEvent({
                type: 'ENTITY_PROMOTED',
                sessionId: ctx.sessionId,
                payload: { note: 'Promovido via canon approval' },
            });
            return null;
        }
        default:
            return null;
    }
}

/** Hook pós-mecânico: decide e aplica lifecycle sem bloquear narração. */
export async function runPostMechanicalEntityLifecycle(opts: {
    sessionId: number;
    userId: number;
    playerAction: string;
}): Promise<void> {
    const session = await getGameSession(opts.sessionId);
    const decision = decideEntityLifecycle({
        sessionId: opts.sessionId,
        userId: opts.userId,
        playerAction: opts.playerAction,
        regionSlug: session?.currentRegionSlug ?? null,
    });
    if (decision === 'noop') return;
    await applyEntityLifecycle(decision, {
        sessionId: opts.sessionId,
        userId: opts.userId,
        playerAction: opts.playerAction,
        regionSlug: session?.currentRegionSlug ?? null,
    });
}

export async function promoteEntityOnCanonApproval(entityId: string, sessionId: number): Promise<void> {
    const repo = PenaiDataSource.getRepository(WorldEntity);
    const entity = await repo.findOne({ where: { id: entityId } });
    if (!entity) return;
    entity.canonical = true;
    await repo.save(entity);
    await appendWorldEvent({
        type: 'ENTITY_PROMOTED',
        sessionId,
        actorEntityId: entityId,
        payload: { entityId, displayName: entity.displayName },
        canonCandidate: true,
    });
}

export async function countActiveSessionsForEntity(worldEntityId: string): Promise<number> {
    const stateRepo = PenaiDataSource.getRepository(SessionEntityState);
    const count = await stateRepo.count({
        where: { worldEntityId, appeared: true, sessionAlive: true },
    });
    return count;
}
