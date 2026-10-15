import type { ProjectorFn } from '../events/types.js';
import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import { resolveSessionShardId } from './shardResolver.js';
import { upsertKgNode, addKgEdge } from './knowledgeGraphV2.js';
import { resolveFactionDisplayName } from './factionDiscovery.js';
import { getRegionBySlug } from './travelCanon.js';

type EventCtx = Parameters<ProjectorFn>[0];

const KG_EVENT_TYPES = new Set([
    'FACTION_TICK',
    'RELATION_CHANGED',
    'TRAVEL_COMPLETED',
]);

export async function projectEventToKnowledgeGraph(event: EventCtx): Promise<void> {
    if (!KG_EVENT_TYPES.has(event.type)) return;

    const shardId = await resolveSessionShardId(event.sessionId);

    if (event.type === 'FACTION_TICK') {
        const factionSlug = String(event.payload.factionSlug ?? '');
        if (!factionSlug) return;
        const name = await resolveFactionDisplayName(factionSlug);
        const factionNode = await upsertKgNode({
            shardId,
            nodeType: 'faction',
            slug: factionSlug,
            displayName: name,
        });
        const regionSlug = String(event.payload.regionSlug ?? '');
        if (regionSlug) {
            const meta = await getRegionBySlug(regionSlug);
            const regionNode = await upsertKgNode({
                shardId,
                nodeType: 'region',
                slug: regionSlug,
                displayName: meta?.displayName ?? regionSlug,
            });
            await addKgEdge({
                fromNodeId: factionNode.id,
                toNodeId: regionNode.id,
                relation: 'MEMBER_OF',
                strength: Number(event.payload.influenceDelta ?? 1),
                sessionId: event.sessionId,
            });
        }
    }

    if (event.type === 'RELATION_CHANGED') {
        const fromId = String(event.payload.fromEntityId ?? '');
        const toId = String(event.payload.toEntityId ?? '');
        if (!fromId || !toId) return;
        const repo = PenaiDataSource.getRepository(WorldEntity);
        const fromEnt = await repo.findOne({ where: { id: fromId } });
        const toEnt = await repo.findOne({ where: { id: toId } });
        if (!fromEnt || !toEnt) return;
        const relType = String(event.payload.relationType ?? 'neutral');
        const kgRel = relType === 'hostile' ? 'HATES' : 'KNOWS';
        const fromNode = await upsertKgNode({
            shardId,
            nodeType: fromEnt.entityType,
            slug: fromEnt.slug,
            displayName: fromEnt.displayName,
        });
        const toNode = await upsertKgNode({
            shardId,
            nodeType: toEnt.entityType,
            slug: toEnt.slug,
            displayName: toEnt.displayName,
        });
        await addKgEdge({
            fromNodeId: fromNode.id,
            toNodeId: toNode.id,
            relation: kgRel,
            strength: Number(event.payload.score ?? 0),
            sessionId: event.sessionId,
        });
    }

    if (event.type === 'TRAVEL_COMPLETED') {
        const regionSlug = String(event.payload.regionSlug ?? '');
        if (!regionSlug) return;
        const session = await PenaiDataSource.getRepository(GameSession).findOne({
            where: { id: event.sessionId },
        });
        const heroId = session?.heroWorldEntityId;
        if (!heroId) return;
        const hero = await PenaiDataSource.getRepository(WorldEntity).findOne({
            where: { id: heroId },
        });
        if (!hero) return;
        const meta = await getRegionBySlug(regionSlug);
        const heroNode = await upsertKgNode({
            shardId,
            nodeType: 'hero',
            slug: hero.slug,
            displayName: hero.displayName,
        });
        const regionNode = await upsertKgNode({
            shardId,
            nodeType: 'region',
            slug: regionSlug,
            displayName: meta?.displayName ?? regionSlug,
        });
        await addKgEdge({
            fromNodeId: heroNode.id,
            toNodeId: regionNode.id,
            relation: 'LOCATED_IN',
            strength: 10,
            sessionId: event.sessionId,
        });
    }
}
