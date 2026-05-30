import { PenaiDataSource } from '../database/data-source.js';
import { WorldEvent } from '../database/entities/WorldEvent.js';
import { Rumor } from '../database/entities/Rumor.js';
import { WorldEntityRelation } from '../database/entities/WorldEntityRelation.js';
import { GameSession } from '../database/entities/GameSession.js';
import { SessionFactionState } from '../database/entities/SessionFactionState.js';

export type ProjectedWorldState = {
    sessionId: number;
    currentRegionSlug: string | null;
    activeRumors: Array<{ id: number; title: string; body: string }>;
    recentEvents: Array<{ type: string; payload: Record<string, unknown>; createdAt: Date }>;
};

export async function projectSessionWorldState(sessionId: number): Promise<ProjectedWorldState> {
    const sessionRepo = PenaiDataSource.getRepository(GameSession);
    const session = await sessionRepo.findOne({ where: { id: sessionId } });

    const eventRepo = PenaiDataSource.getRepository(WorldEvent);
    const lastId = session?.lastProjectedEventId ? Number(session.lastProjectedEventId) : 0;
    const events = await eventRepo
        .createQueryBuilder('e')
        .where('e.sessionId = :sessionId', { sessionId })
        .andWhere('e.id > :lastId', { lastId })
        .orderBy('e.id', 'ASC')
        .take(50)
        .getMany();

    for (const ev of events) {
        await applyEventProjection(ev);
    }

    if (events.length && session) {
        session.lastProjectedEventId = String(events[events.length - 1].id);
        await sessionRepo.save(session);
    }

    const recent = await eventRepo.find({
        where: { sessionId },
        order: { createdAt: 'DESC' },
        take: 20,
    });

    const rumorRepo = PenaiDataSource.getRepository(Rumor);
    const rumors = await rumorRepo.find({
        where: { sessionId, status: 'active' },
        order: { createdAt: 'DESC' },
        take: 10,
    });

    return {
        sessionId,
        currentRegionSlug: session?.currentRegionSlug ?? null,
        activeRumors: rumors.map(r => ({ id: r.id, title: r.title, body: r.body })),
        recentEvents: recent.map(e => ({
            type: e.type,
            payload: e.payload,
            createdAt: e.createdAt,
        })),
    };
}

async function applyEventProjection(event: WorldEvent): Promise<void> {
    if (event.type === 'RELATION_CHANGED') {
        const p = event.payload;
        const fromId = String(p.fromEntityId ?? '');
        const toId = String(p.toEntityId ?? '');
        if (!fromId || !toId) return;

        const repo = PenaiDataSource.getRepository(WorldEntityRelation);
        let rel = await repo.findOne({
            where: {
                fromEntityId: fromId,
                toEntityId: toId,
                relationType: String(p.relationType ?? 'neutral'),
            },
        });
        if (!rel) {
            rel = repo.create({
                fromEntityId: fromId,
                toEntityId: toId,
                relationType: String(p.relationType ?? 'neutral'),
                sessionId: event.sessionId,
            });
        }
        rel.score = Number(p.score ?? rel.score);
        await repo.save(rel);
    }

    if (event.type === 'RUMOR_SPREAD') {
        const p = event.payload;
        const title = String(p.title ?? 'Rumor');
        const body = String(p.body ?? '');
        if (!body) return;

        const rumorRepo = PenaiDataSource.getRepository(Rumor);
        const existing = await rumorRepo.findOne({
            where: { sessionId: event.sessionId, title, body },
        });
        if (existing) return;

        await rumorRepo.save(
            rumorRepo.create({
                sessionId: event.sessionId,
                title,
                body,
                regionSlug: p.regionSlug ? String(p.regionSlug) : null,
                status: 'active',
                locale: 'pt-BR',
            }),
        );
    }

    if (event.type === 'FACTION_TICK' || event.type === 'FACTION_REPUTATION') {
        const p = event.payload;
        const factionSlug = String(p.factionSlug ?? '');
        if (!factionSlug) return;
        const delta = Number(p.delta ?? 0);
        const repo = PenaiDataSource.getRepository(SessionFactionState);
        let row = await repo.findOne({ where: { sessionId: event.sessionId, factionSlug } });
        if (!row) {
            row = repo.create({ sessionId: event.sessionId, factionSlug, reputationScore: 0 });
        }
        row.reputationScore += delta;
        await repo.save(row);
    }
}
