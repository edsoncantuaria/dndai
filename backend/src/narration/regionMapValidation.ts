import type { GameMasterResponse } from '../schemas/gameSchemas.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import * as RegionService from '../services/regionService.js';
import { appendSystemLogEntry } from './systemLog.js';

const canonicalSlug = (value?: string | null) => {
    if (!value) return '';
    return value
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

type VisitedPoiEntry = { regionSlug: string; poiSlug: string; name?: string };

const mergeVisitedRegions = (existing?: unknown, incoming?: unknown, mandatorySlug?: string | null) => {
    const normalized = new Set<string>();
    const collect = (source?: unknown) => {
        if (!Array.isArray(source)) return;
        for (const value of source) {
            if (typeof value === 'string' && value.trim().length) {
                normalized.add(canonicalSlug(value));
            }
        }
    };
    collect(existing);
    collect(incoming);
    if (mandatorySlug) normalized.add(canonicalSlug(mandatorySlug));
    return Array.from(normalized).filter(Boolean);
};

const mergeVisitedPois = (
    existing?: unknown,
    incoming?: unknown,
    current?: VisitedPoiEntry | null,
): VisitedPoiEntry[] => {
    const map = new Map<string, VisitedPoiEntry>();
    const collect = (source?: unknown) => {
        if (!Array.isArray(source)) return;
        for (const entry of source) {
            if (!entry || typeof entry !== 'object') continue;
            const regionSlug = canonicalSlug((entry as VisitedPoiEntry).regionSlug);
            const poiSlug = canonicalSlug((entry as VisitedPoiEntry).poiSlug);
            if (!regionSlug || !poiSlug) continue;
            const key = `${regionSlug}:${poiSlug}`;
            map.set(key, { regionSlug, poiSlug, name: (entry as VisitedPoiEntry).name });
        }
    };
    collect(existing);
    collect(incoming);
    if (current?.regionSlug && current?.poiSlug) {
        const key = `${canonicalSlug(current.regionSlug)}:${canonicalSlug(current.poiSlug)}`;
        map.set(key, {
            regionSlug: canonicalSlug(current.regionSlug),
            poiSlug: canonicalSlug(current.poiSlug),
            name: current.name,
        });
    }
    return Array.from(map.values());
};

/** Valida transições de região/POI vindas da IA (extraído de narrarService). */
export async function enforceWorldStateLocation(sessao: SessaoIA, response: GameMasterResponse) {
    if (!response.worldState || !sessao?.character) return;
    const worldState = response.worldState as Record<string, unknown>;
    const previousState = (sessao.character.worldState as Record<string, unknown>) ?? {};
    const previousRegionSlug =
        (previousState.regionSlug as string) ??
        sessao.character.worldState?.currentRegion ??
        null;
    const previousRegionName = sessao.character.worldState?.currentRegion ?? null;
    const previousPoiSlug = (previousState.poiSlug as string) ?? null;
    const hasPoiField = Object.prototype.hasOwnProperty.call(worldState, 'poiSlug');
    const requestedRegionName = worldState.currentRegion as string | undefined;

    if (!worldState.regionSlug && previousRegionSlug) {
        worldState.regionSlug = previousRegionSlug;
    }

    const revertToPreviousRegion = () => {
        if (previousRegionSlug) {
            worldState.currentRegion = previousRegionName ?? previousRegionSlug;
            worldState.regionSlug = previousRegionSlug;
        } else {
            delete worldState.currentRegion;
            delete worldState.regionSlug;
        }
    };

    if (requestedRegionName) {
        const isLeavingPoiWithoutExit =
            previousPoiSlug &&
            (!hasPoiField || canonicalSlug(worldState.poiSlug as string) === canonicalSlug(previousPoiSlug)) &&
            canonicalSlug(requestedRegionName) !== canonicalSlug(previousRegionSlug);
        if (isLeavingPoiWithoutExit) {
            response.systemLog = appendSystemLogEntry(
                response.systemLog,
                '[Mapa] Saia do sublocal atual antes de viajar para outra região.',
            );
            revertToPreviousRegion();
        } else {
            try {
                const resolved = await RegionService.validateRegionTransition(
                    previousRegionSlug,
                    requestedRegionName,
                    { worldState: sessao.character.worldState },
                );
                worldState.currentRegion = resolved.name;
                worldState.regionSlug = resolved.slug;
                worldState.visitedRegions = mergeVisitedRegions(
                    previousState.visitedRegions,
                    worldState.visitedRegions,
                    resolved.slug,
                );
                if (!hasPoiField || !worldState.poiSlug) {
                    delete worldState.poiSlug;
                    delete worldState.poiName;
                }
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                console.warn('[regionMapValidation] Movimento de região rejeitado:', message);
                response.systemLog = appendSystemLogEntry(
                    response.systemLog,
                    `[Mapa] ${message || 'Transição inválida de região.'}`,
                );
                revertToPreviousRegion();
            }
        }
    } else if (worldState.regionSlug) {
        worldState.visitedRegions = mergeVisitedRegions(
            previousState.visitedRegions,
            worldState.visitedRegions,
            worldState.regionSlug as string,
        );
        if (!worldState.currentRegion && previousRegionName) {
            worldState.currentRegion = previousRegionName;
        }
    }

    const effectiveRegionSlug = (worldState.regionSlug as string) ?? previousRegionSlug ?? null;
    if (hasPoiField) {
        if (!worldState.poiSlug) {
            delete worldState.poiSlug;
            delete worldState.poiName;
        } else if (effectiveRegionSlug) {
            try {
                const poi = await RegionService.validatePoiEntry(
                    effectiveRegionSlug,
                    worldState.poiSlug as string,
                );
                worldState.poiSlug = poi.slug;
                worldState.poiName = poi.name;
                worldState.visitedPois = mergeVisitedPois(
                    previousState.visitedPois,
                    worldState.visitedPois,
                    { regionSlug: poi.regionSlug ?? effectiveRegionSlug, poiSlug: poi.slug, name: poi.name },
                );
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                console.warn('[regionMapValidation] Entrada em POI rejeitada:', message);
                response.systemLog = appendSystemLogEntry(
                    response.systemLog,
                    `[Mapa] ${message || 'Ponto de interesse inválido.'}`,
                );
                if (previousPoiSlug) {
                    worldState.poiSlug = previousPoiSlug;
                    if (previousState.poiName) {
                        worldState.poiName = previousState.poiName;
                    }
                } else {
                    delete worldState.poiSlug;
                    delete worldState.poiName;
                }
            }
        } else {
            response.systemLog = appendSystemLogEntry(
                response.systemLog,
                '[Mapa] Não é possível acessar um sublocal sem definir a região atual.',
            );
            delete worldState.poiSlug;
            delete worldState.poiName;
        }
    } else if (previousPoiSlug && !worldState.poiSlug) {
        worldState.poiSlug = previousPoiSlug;
        if (previousState.poiName && !worldState.poiName) {
            worldState.poiName = previousState.poiName;
        }
    }

    if (!Array.isArray(worldState.visitedPois) && Array.isArray(previousState.visitedPois)) {
        worldState.visitedPois = previousState.visitedPois;
    }
    if (!Array.isArray(worldState.visitedRegions) && Array.isArray(previousState.visitedRegions)) {
        worldState.visitedRegions = previousState.visitedRegions;
    }
}
