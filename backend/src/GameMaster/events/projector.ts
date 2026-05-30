import { PenaiDataSource } from '../database/data-source.js';
import { WorldEvent } from '../database/entities/WorldEvent.js';
import { Rumor } from '../database/entities/Rumor.js';
import { WorldEntityRelation } from '../database/entities/WorldEntityRelation.js';
import { GameSession } from '../database/entities/GameSession.js';
import { SessionFactionState } from '../database/entities/SessionFactionState.js';
import { SessionRegionState } from '../database/entities/SessionRegionState.js';
import type { ProjectorFn } from './types.js';
import {
    adjustRegionResource,
    applyScarcityToPrice,
    adjustFactionInfluence,
    adjustEntityReputation,
    getOrCreateRegionState,
} from '../world/campaignState.js';
import { projectEventToKnowledgeGraph } from '../world/kgProjector.js';
import { runSupplyShortageChain } from '../world/economyChain.js';
import { isCatalogFaction } from '../world/factionCatalog.js';
import {
    discoverFaction,
    discoverFactionsByPoi,
    discoverFactionsByRegion,
} from '../world/factionDiscovery.js';
import { factionReputationKey } from '../world/reputationView.js';

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
    if (!factionSlug || !isCatalogFaction(factionSlug)) return;
    const delta = Number(p.delta ?? 0);

    await discoverFaction(event.sessionId, factionSlug, 'reputation_event');

    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: event.sessionId },
    });
    const heroId = session?.heroWorldEntityId;
    if (heroId && delta !== 0) {
        await adjustEntityReputation(
            event.sessionId,
            heroId,
            factionReputationKey(factionSlug),
            delta,
        );
    }

    const repo = PenaiDataSource.getRepository(SessionFactionState);
    let row = await repo.findOne({ where: { sessionId: event.sessionId, factionSlug } });
    if (!row) {
        row = repo.create({ sessionId: event.sessionId, factionSlug, reputationScore: 0 });
    }
    row.reputationScore += delta;
    await repo.save(row);
};

const projectTravelCompleted: ProjectorFn = async event => {
    const regionSlug = event.payload.regionSlug;
    if (regionSlug && typeof regionSlug === 'string') {
        await discoverFactionsByRegion(event.sessionId, regionSlug);
    }
    const poiSlug = event.payload.targetPoiSlug;
    if (poiSlug && typeof poiSlug === 'string') {
        await discoverFactionsByPoi(event.sessionId, poiSlug);
    }
};

const projectFactionTickCombined: ProjectorFn = async event => {
    await projectFactionDelta(event);
    await projectFactionInfluence(event);
    const { resolveSessionShardId } = await import('../world/shardResolver.js');
    const { maybeTransitionPoliticsAfterFactionTick } = await import('../world/politicsState.js');
    const shardId = await resolveSessionShardId(event.sessionId);
    await maybeTransitionPoliticsAfterFactionTick({
        sessionId: event.sessionId,
        shardId,
        regionSlug: String(event.payload.regionSlug ?? ''),
        goal: String(event.payload.goal ?? ''),
    });
};

const projectRegionMood: ProjectorFn = async event => {
    const p = event.payload;
    const regionSlug = String(p.regionSlug ?? '');
    if (!regionSlug) return;
    const row = await getOrCreateRegionState(event.sessionId, regionSlug);
    if (typeof p.fear === 'number') row.fear = p.fear;
    if (typeof p.prosperity === 'number') row.prosperity = p.prosperity;
    if (typeof p.crime === 'number') row.crime = p.crime;
    await PenaiDataSource.getRepository(SessionRegionState).save(row);
};

const projectPriceChanged: ProjectorFn = async event => {
    const p = event.payload;
    const regionSlug = String(p.regionSlug ?? '');
    const itemSlug = String(p.itemSlug ?? '');
    const scarcityDelta = Number(p.scarcityDelta ?? 0);
    if (!regionSlug || !itemSlug) return;
    if (scarcityDelta !== 0) {
        await applyScarcityToPrice(event.sessionId, regionSlug, itemSlug, scarcityDelta);
        return;
    }
    const currentPrice = Number(p.currentPrice ?? 0);
    if (currentPrice > 0) {
        const { getOrCreateEconomyRow } = await import('../world/campaignState.js');
        const { SessionRegionEconomy } = await import('../database/entities/SessionRegionEconomy.js');
        const row = await getOrCreateEconomyRow(event.sessionId, regionSlug, itemSlug);
        row.currentPrice = currentPrice;
        await PenaiDataSource.getRepository(SessionRegionEconomy).save(row);
    }
};

const projectRumorFaded: ProjectorFn = async event => {
    const rumorId = Number(event.payload.rumorId ?? 0);
    if (!rumorId) return;
    const rumorRepo = PenaiDataSource.getRepository(Rumor);
    const row = await rumorRepo.findOne({ where: { id: rumorId, sessionId: event.sessionId } });
    if (row) {
        row.status = 'faded';
        await rumorRepo.save(row);
    }
};

const projectSupplyShortage: ProjectorFn = async event => {
    await runSupplyShortageChain(event);
};

export const EVENT_PROJECTORS: Record<string, ProjectorFn> = {
    RELATION_CHANGED: projectRelationChanged,
    RUMOR_SPREAD: projectRumorSpread,
    RUMOR_FADED: projectRumorFaded,
    FACTION_TICK: projectFactionTickCombined,
    FACTION_REPUTATION: projectFactionDelta,
    TRAVEL_COMPLETED: projectTravelCompleted,
    CREATURE_SLAIN: projectCreatureSlain,
    REGION_MOOD_CHANGED: projectRegionMood,
    PRICE_CHANGED: projectPriceChanged,
    SUPPLY_SHORTAGE: projectSupplyShortage,
};

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseLastProjectedEventId(value: string | null | undefined): string | null {
    if (!value || !UUID_RE.test(value)) return null;
    return value;
}

export async function projectSessionWorldState(sessionId: number): Promise<ProjectedWorldState> {
    const sessionRepo = PenaiDataSource.getRepository(GameSession);
    const session = await sessionRepo.findOne({ where: { id: sessionId } });

    const eventRepo = PenaiDataSource.getRepository(WorldEvent);
    const lastId = parseLastProjectedEventId(session?.lastProjectedEventId);
    const qb = eventRepo
        .createQueryBuilder('e')
        .where('e.sessionId = :sessionId', { sessionId })
        .orderBy('e.id', 'ASC')
        .take(50);
    if (lastId) {
        qb.andWhere('e.id > :lastId', { lastId });
    }
    const events = await qb.getMany();

    for (const ev of events) {
        await applyEventProjection(ev);
    }

    if (events.length && session) {
        session.lastProjectedEventId = events[events.length - 1].id;
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
    const ctx = {
        type: event.type,
        sessionId: event.sessionId,
        payload: event.payload,
        actorEntityId: event.actorEntityId,
    };
    const projector = EVENT_PROJECTORS[event.type];
    if (projector) {
        await projector(ctx);
    }
    await projectEventToKnowledgeGraph(ctx);
}
