import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { CanonicalRegion } from '../database/entities/CanonicalRegion.js';
import { listSessionWorldEvents } from '../events/store.js';
import { humanizeWorldEvents } from '../events/eventHumanizer.js';
import {
    buildWorldStateView,
    loadSessionGameClock,
    parseGameClock,
    type PenaiWorldStateView,
} from './gameClock.js';
import { resolveAmbientLocationContext } from './ambientLocationContext.js';
import { loadPenaiWorldMapData } from './worldMapCatalog.js';

export async function buildPenaiWorldMapSnapshot(sessionId: number) {
    const data = await loadPenaiWorldMapData(sessionId);
    if (!data) return null;

    const { session, visitedRegions, regions, links } = data;
    const currentRegionSlug = session.currentRegionSlug;
    const currentRegion = currentRegionSlug
        ? regions.find(r => r.slug === currentRegionSlug)
        : undefined;
    const currentPoiSlug =
        (currentRegion?.metadata?.defaultSpawnPoi as string | undefined)?.trim() || null;

    return {
        currentRegionSlug,
        currentPoiSlug,
        visitedRegions: Array.from(visitedRegions),
        visitedPois: [],
        regions: regions.map(r => ({
            id: 0,
            slug: r.slug,
            name: r.name,
            summary: r.summary,
            description: r.summary ?? '',
            type: r.type,
            parentSlug: r.parentSlug,
            metadata: r.metadata,
            isDiscovered: r.isDiscovered,
            isCurrent: r.isCurrent,
            pointsOfInterest: r.pointsOfInterest,
        })),
        links: links.map(l => ({
            fromSlug: l.fromSlug,
            toSlug: l.toSlug,
            travelMode: l.travelMode,
            travelTimeMinutes: l.travelTimeMinutes,
            difficulty: l.difficulty,
            isLocked: l.isLocked,
            metadata: l.notes ? { notes: l.notes } : undefined,
            discovered: l.discovered,
            reachable: l.reachable,
            fromCurrent: l.fromCurrent,
        })),
        markers: currentRegionSlug
            ? [
                  {
                      id: `player:${sessionId}`,
                      type: 'player' as const,
                      label: 'Você',
                      regionSlug: currentRegionSlug,
                      poiSlug: currentPoiSlug,
                      isDiscovered: true,
                  },
              ]
            : [],
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
    recentFacts: Array<{
        type: string;
        category: string;
        subject?: string;
        summary: string;
        at: string;
    }>;
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

    const regionNames: Record<string, string> = {};
    if (session.currentRegionSlug && regionName) {
        regionNames[session.currentRegionSlug] = regionName;
    }
    const allRegions = await PenaiDataSource.getRepository(CanonicalRegion).find();
    for (const r of allRegions) {
        regionNames[r.slug] = r.displayName;
    }

    const events = await listSessionWorldEvents(sessionId, 60);
    const recentFacts = humanizeWorldEvents(
        events.map(ev => ({
            id: ev.id,
            type: ev.type,
            payload: ev.payload,
            createdAt: ev.createdAt,
        })),
        { regionNames },
    )
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 15)
        .map(h => ({
            type: h.type,
            category: h.category,
            subject: h.subject,
            summary: h.summary,
            at: h.at,
        }));

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

export async function loadSessionWorldStateView(sessionId: number): Promise<PenaiWorldStateView> {
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
    const base = buildWorldStateView(clock, session.currentRegionSlug, regionName);
    const location = await resolveAmbientLocationContext(sessionId, session.currentRegionSlug);

    const poiLabel = location.poiName ?? location.poiSlug;
    return {
        ...base,
        regionSlug: location.regionSlug,
        regionType: location.regionType,
        poiSlug: location.poiSlug,
        poiName: location.poiName,
        environmentTags: location.environmentTags,
        location: poiLabel ? `${base.currentRegion} — ${poiLabel}` : base.location,
    };
}
