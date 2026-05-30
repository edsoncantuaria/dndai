import { PenaiDataSource } from '../database/data-source.js';
import { WorldEvent } from '../database/entities/WorldEvent.js';
import { Rumor } from '../database/entities/Rumor.js';
import { WorldEntityRelation } from '../database/entities/WorldEntityRelation.js';
import { GameSession } from '../database/entities/GameSession.js';
import { SessionFactionState } from '../database/entities/SessionFactionState.js';
import type { ProjectorFn } from './types.js';
import {
    adjustRegionResource,
    applyScarcityToPrice,
    adjustFactionInfluence,
} from '../world/campaignState.js';

const projectCreatureSlain: ProjectorFn = async event => {
    const p = event.payload;
    const regionSlug = String(p.regionSlug ?? 'unknown');
    const qty = Number(p.qty ?? 1);
    await adjustRegionResource(event.sessionId, regionSlug, 'wolfStock', -qty);
    await applyScarcityToPrice(event.sessionId, regionSlug, 'wolf_pelt', qty * 2);
};

const projectFactionInfluence: ProjectorFn = async event => {
    const p = event.payload;
    const factionSlug = String(p.factionSlug ?? '');
    const regionSlug = String(p.regionSlug ?? 'unknown');
    const infDelta = Number(p.influenceDelta ?? 0);
    if (!factionSlug || !infDelta) return;
    await adjustFactionInfluence(event.sessionId, factionSlug, regionSlug, infDelta);
};

export type ProjectedWorldState = {
    sessionId: number;
    currentRegionSlug: string | null;
    activeRumors: Array<{ id: number; title: string; body: string }>;
    recentEvents: Array<{ type: string; payload: Record<string, unknown>; createdAt: Date }>;
};

const projectRelationChanged: ProjectorFn = async event => {
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
};

const projectRumorSpread: ProjectorFn = async event => {
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
};

const projectFactionDelta: ProjectorFn = async event => {
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
};

const projectFactionTickCombined: ProjectorFn = async event => {
    await projectFactionDelta(event);
    await projectFactionInfluence(event);
};

export const EVENT_PROJECTORS: Record<string, ProjectorFn> = {
    RELATION_CHANGED: projectRelationChanged,
    RUMOR_SPREAD: projectRumorSpread,
    FACTION_TICK: projectFactionTickCombined,
    FACTION_REPUTATION: projectFactionDelta,
    CREATURE_SLAIN: projectCreatureSlain,
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

export async function applyEventProjection(event: WorldEvent): Promise<void> {
    const projector = EVENT_PROJECTORS[event.type];
    if (projector) {
        await projector({
            type: event.type,
            sessionId: event.sessionId,
            payload: event.payload,
            actorEntityId: event.actorEntityId,
        });
    }
}
