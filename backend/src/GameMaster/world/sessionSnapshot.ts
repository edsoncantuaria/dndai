import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { CanonicalRegion } from '../database/entities/CanonicalRegion.js';
import { CanonicalRegionLink } from '../database/entities/CanonicalRegionLink.js';
import { CanonicalPoi } from '../database/entities/CanonicalPoi.js';
import { listSessionWorldEvents } from '../events/store.js';
import {
    buildWorldStateView,
    loadSessionGameClock,
    parseGameClock,
} from './gameClock.js';

export async function buildPenaiWorldMapSnapshot(sessionId: number) {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (!session) return null;

    const regions = await PenaiDataSource.getRepository(CanonicalRegion).find();
    const links = await PenaiDataSource.getRepository(CanonicalRegionLink).find();
    const pois = await PenaiDataSource.getRepository(CanonicalPoi).find();

    const events = await listSessionWorldEvents(sessionId, 200);
    const visitedRegions = new Set<string>();
    for (const ev of events) {
        const p = ev.payload as Record<string, unknown> | undefined;
        if (ev.type === 'TRAVEL_COMPLETED' && typeof p?.regionSlug === 'string') {
            visitedRegions.add(p.regionSlug);
        }
        if (typeof p?.toRegionSlug === 'string') visitedRegions.add(p.toRegionSlug);
        if (typeof p?.fromRegionSlug === 'string') visitedRegions.add(p.fromRegionSlug);
    }
    if (session.currentRegionSlug) visitedRegions.add(session.currentRegionSlug);

    const currentRegionSlug = session.currentRegionSlug;
    const regionRows = regions.map(r => ({
        slug: r.slug,
        name: r.displayName,
        description: r.description ?? '',
        isDiscovered: visitedRegions.has(r.slug),
        isCurrent: r.slug === currentRegionSlug,
        pointsOfInterest: pois
            .filter(p => p.regionId === r.id)
            .map(p => ({
                slug: p.slug,
                name: p.displayName,
                isDiscovered: visitedRegions.has(r.slug),
            })),
    }));

    const linkRows = links.map(l => {
        const from = regions.find(r => r.id === l.fromRegionId);
        const to = regions.find(r => r.id === l.toRegionId);
        if (!from || !to) return null;
        return {
            fromSlug: from.slug,
            toSlug: to.slug,
            travelMode: 'walk',
            travelTimeMinutes: Math.round((l.baseDurationHours ?? 1) * 60),
            difficulty: 'normal',
            isLocked: Boolean(l.isLocked),
            discovered: visitedRegions.has(from.slug) && visitedRegions.has(to.slug),
        };
    }).filter(Boolean);

    return {
        currentRegionSlug,
        currentPoiSlug: null,
        visitedRegions: Array.from(visitedRegions),
        visitedPois: [],
        regions: regionRows,
        links: linkRows,
        markers: [],
        updatedAt: session.updatedAt.toISOString(),
    };
}

export type PenaiSessionSummary = {
    sessionId: number;
    nome: string;
    currentRegionSlug: string | null;
    currentRegionName: string | null;
    worldState: ReturnType<typeof buildWorldStateView>;
    gameClock: ReturnType<typeof parseGameClock>;
    recentFacts: Array<{ type: string; summary: string; at: string }>;
    actionSequence: number;
};

export async function buildPenaiSessionSummary(sessionId: number): Promise<PenaiSessionSummary | null> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (!session) return null;

    const clock = parseGameClock(session.gameClock as Record<string, unknown> | null);
    let regionName: string | null = null;
    if (session.currentRegionSlug) {
        const region = await PenaiDataSource.getRepository(CanonicalRegion).findOne({
            where: { slug: session.currentRegionSlug },
        });
        regionName = region?.displayName ?? session.currentRegionSlug;
    }

    const events = await listSessionWorldEvents(sessionId, 30);
    const recentFacts = events
        .map(ev => {
            const p = ev.payload as Record<string, unknown> | undefined;
            let summary = ev.type.replace(/_/g, ' ').toLowerCase();
            if (ev.type === 'TRAVEL_COMPLETED' && typeof p?.regionSlug === 'string') {
                summary = `Chegou em ${p.regionSlug}`;
            }
            if (ev.type === 'NARRATION_COMPLETED') summary = 'Narração concluída';
            if (ev.type === 'COMBAT_STARTED') summary = 'Combate iniciado';
            if (ev.type === 'REST_COMPLETED') summary = `Descanso ${String(p?.restType ?? '')}`.trim();
            return {
                type: ev.type,
                summary,
                at: ev.createdAt?.toISOString?.() ?? new Date().toISOString(),
            };
        })
        .slice(0, 12);

    return {
        sessionId,
        nome: session.nome,
        currentRegionSlug: session.currentRegionSlug,
        currentRegionName: regionName,
        worldState: buildWorldStateView(clock, session.currentRegionSlug, regionName),
        gameClock: clock,
        recentFacts,
        actionSequence: session.actionSequence,
    };
}

export async function loadSessionWorldStateView(sessionId: number) {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (!session) return buildWorldStateView(await loadSessionGameClock(sessionId), null, null);

    let regionName: string | null = null;
    if (session.currentRegionSlug) {
        const region = await PenaiDataSource.getRepository(CanonicalRegion).findOne({
            where: { slug: session.currentRegionSlug },
        });
        regionName = region?.displayName ?? session.currentRegionSlug;
    }
    const clock = parseGameClock(session.gameClock as Record<string, unknown> | null);
    return buildWorldStateView(clock, session.currentRegionSlug, regionName);
}
