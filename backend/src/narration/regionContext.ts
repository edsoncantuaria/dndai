import type { Character } from '../entities/Character.js';
import * as RegionService from '../services/regionService.js';

export type RegionPromptContext = {
    slug: string;
    name: string;
    type: string;
    summary?: string | null;
    metadata?: Record<string, unknown> | null;
    breadcrumbs?: Array<{ slug: string; name: string }>;
    neighbors?: Array<{
        slug?: string;
        name?: string;
        travelMode: string;
        travelTimeMinutes: number;
        difficulty?: string | null;
        isLocked: boolean;
        isDiscovered?: boolean;
    }>;
    pointsOfInterest?: Array<{
        slug: string;
        name: string;
        type: string;
        summary?: string | null;
        isLocked: boolean;
        isDiscovered?: boolean;
    }>;
    activePoi?: {
        slug: string;
        name: string;
        type: string;
        summary?: string | null;
    } | null;
    discoveredRoutes?: RegionPromptContext['neighbors'];
    visitedRegions?: string[];
};

export const canonicalSlug = (value?: string | null) => {
    if (!value) return '';
    return value
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

export const resolveRegionContextForPrompt = async (
    character: Character | null,
    optimizedCharacter: any,
): Promise<RegionPromptContext | null> => {
    const visitedRegionSet = new Set<string>();
    const visitedPoiSet = new Set<string>();
    const collectVisited = (source?: any) => {
        if (!Array.isArray(source)) return;
        for (const value of source) {
            if (typeof value === 'string' && value.trim()) {
                visitedRegionSet.add(canonicalSlug(value));
            }
        }
    };
    const collectVisitedPois = (source?: any) => {
        if (!Array.isArray(source)) return;
        for (const entry of source) {
            if (entry && typeof entry === 'object') {
                const key = `${canonicalSlug(entry.regionSlug)}::${canonicalSlug(entry.poiSlug)}`;
                if (key !== '::') visitedPoiSet.add(key);
            }
        }
    };
    collectVisited(optimizedCharacter?.worldState?.visitedRegions);
    collectVisited((character?.worldState as any)?.visitedRegions);
    collectVisitedPois(optimizedCharacter?.worldState?.visitedPois);
    collectVisitedPois((character?.worldState as any)?.visitedPois);

    const labels: Array<string | null | undefined> = [
        optimizedCharacter?.worldState?.regionSlug,
        optimizedCharacter?.worldState?.currentRegion,
        (character?.worldState as any)?.regionSlug,
        character?.worldState?.currentRegion,
        character?.currentRegion,
    ];
    const tried = new Set<string>();
    for (const label of labels) {
        if (!label) continue;
        const normalized = label.toString().trim();
        if (!normalized) continue;
        const key = normalized.toLowerCase();
        if (tried.has(key)) continue;
        tried.add(key);
        const resolved = await RegionService.resolveRegionByLabelOrSlug(normalized).catch(() => null);
        if (!resolved) continue;
        const payload = await RegionService.getRegionBySlug(resolved.slug).catch(() => null);
        if (!payload) continue;
        const breadcrumbs = await RegionService.getRegionBreadcrumbs(payload.slug).catch(() => []);
        visitedRegionSet.add(canonicalSlug(payload.slug));
        const poiCandidates: Array<string | null | undefined> = [
            optimizedCharacter?.worldState?.poiSlug,
            (character?.worldState as any)?.poiSlug,
        ];
        let activePoi: RegionPromptContext['activePoi'] = null;
        for (const candidate of poiCandidates) {
            const normalizedPoi = canonicalSlug(candidate);
            if (!normalizedPoi) continue;
            const match = payload.pointsOfInterest?.find(
                poi => canonicalSlug(poi.slug) === normalizedPoi,
            );
            if (match) {
                activePoi = {
                    slug: match.slug,
                    name: match.name,
                    type: match.type,
                    summary: match.summary ?? null,
                };
                break;
            }
        }
        const neighbors =
            payload.neighbors?.map(neighbor => {
                const slug = canonicalSlug(neighbor.targetRegionSlug);
                return {
                    slug: neighbor.targetRegionSlug,
                    name: neighbor.targetRegionName,
                    travelMode: neighbor.travelMode,
                    travelTimeMinutes: neighbor.travelTimeMinutes,
                    difficulty: neighbor.difficulty ?? null,
                    isLocked: neighbor.isLocked,
                    isDiscovered: slug ? visitedRegionSet.has(slug) : false,
                };
            }) ?? [];
        const discoveredRoutes = neighbors.filter(neighbor => neighbor.isDiscovered);

        return {
            slug: payload.slug,
            name: payload.name,
            type: payload.type,
            summary: payload.summary ?? payload.description ?? null,
            metadata: (payload.metadata as Record<string, unknown> | undefined) ?? null,
            breadcrumbs,
            neighbors,
            pointsOfInterest: payload.pointsOfInterest?.map(poi => ({
                slug: poi.slug,
                name: poi.name,
                type: poi.type,
                summary: poi.summary ?? null,
                isLocked: poi.isLocked,
                isDiscovered: visitedPoiSet.has(`${canonicalSlug(payload.slug)}::${canonicalSlug(poi.slug)}`),
            })),
            activePoi,
            discoveredRoutes,
            visitedRegions: Array.from(visitedRegionSet),
        };
    }
    return null;
};

export const formatRegionGraphSummary = (context: RegionPromptContext): string => {
    const lines: string[] = [];
    const baseSummary = context.summary?.trim() || 'Sem resumo disponível.';
    const breadcrumbLabel = context.breadcrumbs?.length
        ? context.breadcrumbs.map(entry => entry.name).join(' > ')
        : context.name;
    lines.push(`Localização: ${breadcrumbLabel} [${context.slug}] (${context.type}) - ${baseSummary}`);

    const meta = context.metadata as Record<string, unknown> | null | undefined;
    const ruler = meta?.ruler as Record<string, unknown> | undefined;
    if (ruler && typeof ruler.name === 'string') {
        const title = typeof ruler.title === 'string' ? ruler.title : 'Soberano';
        const notes = typeof ruler.notes === 'string' ? ` — ${ruler.notes}` : '';
        lines.push(`Soberano: ${ruler.name} (${title})${notes}`);
    }
    if (meta?.role === 'kingdom' && Array.isArray(meta.rivals) && meta.rivals.length) {
        lines.push(`Rivais regionais: ${(meta.rivals as string[]).join(', ')}`);
    }

    if (context.activePoi) {
        const poiSummary = context.activePoi.summary ? ` - ${context.activePoi.summary}` : '';
        lines.push(`Sublocal atual: ${context.activePoi.name} [${context.activePoi.slug}] (${context.activePoi.type})${poiSummary}`);
    }

    const discoveredRoutes = context.discoveredRoutes?.length
        ? context.discoveredRoutes
        : context.neighbors?.filter(neighbor => neighbor.isDiscovered);
    if (discoveredRoutes?.length) {
        const routes = discoveredRoutes.map(neighbor => {
            const label = neighbor.name || neighbor.slug || 'Destino desconhecido';
            const travelMode = neighbor.travelMode || 'deslocamento';
            const travelTime = Number.isFinite(neighbor.travelTimeMinutes)
                ? `${neighbor.travelTimeMinutes}min`
                : 'tempo desconhecido';
            const difficulty = neighbor.difficulty ? `, dificuldade ${neighbor.difficulty}` : '';
            const locked = neighbor.isLocked ? ' [BLOQUEADA]' : '';
            return `${label} (${travelMode}, ${travelTime}${difficulty})${locked}`;
        });
        lines.push(`Rotas descobertas: ${routes.join('; ')}`);
    } else {
        lines.push('Rotas descobertas: nenhuma. Desbrave novos caminhos para liberar deslocamentos seguros.');
    }

    const hiddenRoutes = context.neighbors?.filter(neighbor => !neighbor.isDiscovered);
    if (hiddenRoutes?.length) {
        const hidden = hiddenRoutes.map(neighbor => {
            const label = neighbor.name || neighbor.slug || 'Destino desconhecido';
            const locked = neighbor.isLocked ? ' (bloqueada)' : '';
            return `${label}${locked}`;
        });
        lines.push(`Rotas ainda não exploradas: ${hidden.join('; ')}.`);
    }

    if (context.pointsOfInterest?.length) {
        const discovered = context.pointsOfInterest.filter(poi => poi.isDiscovered);
        const unknown = context.pointsOfInterest.filter(poi => !poi.isDiscovered);
        if (discovered.length) {
            lines.push(`POIs conhecidos: ${discovered.map(poi => poi.name).join('; ')}`);
        }
        if (unknown.length) {
            lines.push(`POIs não visitados: ${unknown.map(poi => poi.name).join('; ')}`);
        }
    } else {
        lines.push('Pontos de interesse: nenhum registrado.');
    }

    return lines.join('\n');
};
