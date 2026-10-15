import { IsNull } from 'typeorm';
import { PenaiDataSource } from '../database/data-source.js';
import { KgNode } from '../database/entities/KgNode.js';
import { KgEdge } from '../database/entities/KgEdge.js';
import { resolveSessionShardId } from './shardResolver.js';

export type KgRelation =
    | 'KNOWS'
    | 'HATES'
    | 'WORKS_FOR'
    | 'MEMBER_OF'
    | 'LOCATED_IN'
    | 'PARTICIPATED_IN';

export async function upsertKgNode(opts: {
    shardId?: string | null;
    nodeType: string;
    slug: string;
    displayName: string;
}): Promise<KgNode> {
    const repo = PenaiDataSource.getRepository(KgNode);
    const where = {
        shardId: opts.shardId == null ? IsNull() : opts.shardId,
        nodeType: opts.nodeType,
        slug: opts.slug,
    };
    let row = await repo.findOne({ where });
    if (!row) {
        row = await repo.save(
            repo.create({
                shardId: opts.shardId ?? null,
                nodeType: opts.nodeType,
                slug: opts.slug,
                displayName: opts.displayName,
            }),
        );
    }
    return row;
}

export async function addKgEdge(opts: {
    fromNodeId: string;
    toNodeId: string;
    relation: KgRelation;
    strength?: number;
    sinceWorldDay?: number;
    sourceEventId?: string;
    sessionId?: number;
}): Promise<KgEdge> {
    const repo = PenaiDataSource.getRepository(KgEdge);
    const existing = await repo.findOne({
        where: {
            fromNodeId: opts.fromNodeId,
            toNodeId: opts.toNodeId,
            relation: opts.relation,
        },
    });
    if (existing) {
        existing.strength = opts.strength ?? existing.strength;
        return repo.save(existing);
    }
    return repo.save(
        repo.create({
            fromNodeId: opts.fromNodeId,
            toNodeId: opts.toNodeId,
            relation: opts.relation,
            strength: opts.strength ?? 0,
            sinceWorldDay: opts.sinceWorldDay ?? null,
            sourceEventId: opts.sourceEventId ?? null,
            sessionId: opts.sessionId ?? null,
        }),
    );
}

/** Consulta arestas para o narrador (anti-invenção estrutural). */
export async function recallKgEdgesForSession(
    sessionId: number,
    limit = 8,
): Promise<string[]> {
    const shardId = await resolveSessionShardId(sessionId);
    if (!shardId) return [];

    const edgeRepo = PenaiDataSource.getRepository(KgEdge);
    const nodeRepo = PenaiDataSource.getRepository(KgNode);
    const edges = await edgeRepo.find({
        where: { sessionId },
        order: { createdAt: 'DESC' },
        take: limit * 2,
    });

    const lines: string[] = [];
    for (const e of edges.slice(0, limit)) {
        const from = await nodeRepo.findOne({ where: { id: e.fromNodeId } });
        const to = await nodeRepo.findOne({ where: { id: e.toNodeId } });
        if (!from || !to) continue;
        lines.push(`${from.displayName} ${e.relation} ${to.displayName}`);
    }
    return lines;
}
