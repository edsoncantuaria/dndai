import regionGraph from '../../data/regionsSeed.json' with { type: 'json' };
import type { RegionGraphPayload } from '../../schemas/regionSchemas.js';
import { PenaiDataSource } from '../database/data-source.js';
import { findFactionsByPoiSlug } from './factionCatalog.js';
import { CanonicalRegion } from '../database/entities/CanonicalRegion.js';
import { CanonicalRegionLink } from '../database/entities/CanonicalRegionLink.js';
import { CanonicalPoi } from '../database/entities/CanonicalPoi.js';

const graph = regionGraph as RegionGraphPayload;

export type WorldMapLinkView = {
    fromSlug: string;
    toSlug: string;
    travelMode: string;
    travelTimeMinutes: number;
    difficulty: string | null;
    isLocked: boolean;
    notes?: string;
    /** Ambos os extremos já visitados. */
    discovered: boolean;
    /** Pelo menos um extremo visitado — desenha rota no mapa. */
    reachable: boolean;
    /** Toca a região atual do jogador. */
    fromCurrent: boolean;
};

export type WorldMapRegionView = {
    slug: string;
    name: string;
    type: 'world' | 'city' | 'dungeon' | 'wild' | 'instance';
    parentSlug: string | null;
    summary: string | null;
    metadata: Record<string, unknown>;
    isDiscovered: boolean;
    isCurrent: boolean;
    pointsOfInterest: Array<{
        slug: string;
        name: string;
        type: string;
        isDiscovered: boolean;
        factionSlugs: string[];
    }>;
};

const slugify = (value: string): string =>
    value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const seedBySlug = new Map(
    graph.regions.map(r => [slugify(r.slug || r.name), r]),
);

const seedLinkByEdge = new Map<string, (typeof graph.links)[number]>();
for (const link of graph.links ?? []) {
    const a = slugify(link.fromSlug);
    const b = slugify(link.toSlug);
    if (!a || !b) continue;
    const key = [a, b].sort().join('::');
    if (!seedLinkByEdge.has(key)) seedLinkByEdge.set(key, link);
}

export function getAurathisMapLayout(): Record<string, { x: number; y: number }> {
    const world = graph.regions.find(r => r.type === 'world');
    const meta = world?.metadata as Record<string, unknown> | undefined;
    const layout = meta?.mapLayout as { nodes?: Record<string, { x: number; y: number }> } | undefined;
    const nodes = layout?.nodes;
    return nodes ?? {};
}

function mergeSeedLink(
    fromSlug: string,
    toSlug: string,
    fallback: { isLocked: boolean; travelTimeMinutes: number },
): Omit<WorldMapLinkView, 'discovered' | 'reachable' | 'fromCurrent'> {
    const key = [fromSlug, toSlug].sort().join('::');
    const seed = seedLinkByEdge.get(key);
    return {
        fromSlug,
        toSlug,
        travelMode: seed?.travelMode ?? 'walk',
        travelTimeMinutes: seed?.travelTimeMinutes ?? fallback.travelTimeMinutes,
        difficulty: seed?.difficulty ?? null,
        isLocked: seed?.isLocked ?? fallback.isLocked,
        notes: seed?.notes,
    };
}

export function buildCanonicalWorldMapLinks(
    visitedRegions: Set<string>,
    currentRegionSlug: string | null,
    dbLinks: CanonicalRegionLink[],
    dbRegions: CanonicalRegion[],
): WorldMapLinkView[] {
    const edgeMap = new Map<string, WorldMapLinkView>();
    const regionById = new Map(dbRegions.map(r => [r.id, r]));

    const addEdge = (fromSlug: string, toSlug: string, partial: Parameters<typeof mergeSeedLink>[2]) => {
        if (!fromSlug || !toSlug || fromSlug === toSlug) return;
        const key = [fromSlug, toSlug].sort().join('::');
        if (edgeMap.has(key)) return;
        const base = mergeSeedLink(fromSlug, toSlug, partial);
        const fromVisited = visitedRegions.has(fromSlug);
        const toVisited = visitedRegions.has(toSlug);
        edgeMap.set(key, {
            ...base,
            discovered: fromVisited && toVisited,
            reachable: fromVisited || toVisited,
            fromCurrent:
                Boolean(currentRegionSlug) &&
                (fromSlug === currentRegionSlug || toSlug === currentRegionSlug),
        });
    };

    for (const link of graph.links ?? []) {
        addEdge(slugify(link.fromSlug), slugify(link.toSlug), {
            isLocked: link.isLocked ?? false,
            travelTimeMinutes: link.travelTimeMinutes ?? 60,
        });
    }

    for (const link of dbLinks) {
        const from = regionById.get(link.fromRegionId);
        const to = regionById.get(link.toRegionId);
        if (!from || !to) continue;
        addEdge(from.slug, to.slug, {
            isLocked: link.isLocked,
            travelTimeMinutes: Math.round((link.baseDurationHours ?? 1) * 60),
        });
    }

    return Array.from(edgeMap.values());
}

export function buildCanonicalWorldMapRegions(
    visitedRegions: Set<string>,
    currentRegionSlug: string | null,
    dbRegions: CanonicalRegion[],
    pois: CanonicalPoi[],
): WorldMapRegionView[] {
    const worldEntry = graph.regions.find(r => r.type === 'world');
    const layout = getAurathisMapLayout();
    const worldMetadata = {
        ...(worldEntry?.metadata ?? {}),
        mapArt: (worldEntry?.metadata as Record<string, unknown> | undefined)?.mapArt ?? {
            url: '/assets/AI/aurathis-continente-v4.png',
            width: 1100,
            height: 780,
            version: 4,
        },
        mapLayout: {
            coordinateSpace: 'pixel',
            nodes: layout,
            canvas: { width: 1100, height: 780 },
        },
    };

    const rows: WorldMapRegionView[] = [];

    if (worldEntry) {
        rows.push({
            slug: slugify(worldEntry.slug),
            name: worldEntry.name,
            type: 'world',
            parentSlug: null,
            summary: worldEntry.summary ?? null,
            metadata: worldMetadata,
            isDiscovered: true,
            isCurrent: false,
            pointsOfInterest: [],
        });
    }

    for (const db of dbRegions) {
        const seed = seedBySlug.get(db.slug);
        const parentSlug = seed?.parentSlug ? slugify(seed.parentSlug) : null;
        rows.push({
            slug: db.slug,
            name: db.displayName,
            type: (seed?.type as WorldMapRegionView['type']) ?? 'wild',
            parentSlug,
            summary: db.summary ?? seed?.summary ?? null,
            metadata: {
                ...(seed?.metadata ?? {}),
                levelRange: (seed?.metadata as { levelRange?: string })?.levelRange,
            },
            isDiscovered: visitedRegions.has(db.slug),
            isCurrent: db.slug === currentRegionSlug,
            pointsOfInterest: pois
                .filter(p => p.regionId === db.id)
                .map(p => ({
                    slug: p.slug,
                    name: p.displayName,
                    type: p.poiType ?? 'landmark',
                    isDiscovered: visitedRegions.has(db.slug),
                    factionSlugs: findFactionsByPoiSlug(p.slug).map(f => f.slug),
                })),
        });
    }

    return rows;
}

export async function loadPenaiWorldMapData(sessionId: number) {
    const { GameSession } = await import('../database/entities/GameSession.js');
    const { listSessionWorldEvents } = await import('../events/store.js');

    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (!session) return null;

    const dbRegions = await PenaiDataSource.getRepository(CanonicalRegion).find();
    const dbLinks = await PenaiDataSource.getRepository(CanonicalRegionLink).find();
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

    const regions = buildCanonicalWorldMapRegions(
        visitedRegions,
        session.currentRegionSlug,
        dbRegions,
        pois,
    );
    const links = buildCanonicalWorldMapLinks(
        visitedRegions,
        session.currentRegionSlug,
        dbLinks,
        dbRegions,
    );

    return {
        session,
        visitedRegions,
        regions,
        links,
    };
}
