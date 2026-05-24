import createError from 'http-errors';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { mergeCharacterUpdates } from './safeMerge.js';
import * as RegionService from './regionService.js';
import { canonicalSlug } from '../narration/regionContext.js';
import { recordMotorFact } from './sessionFactService.js';

import type { TravelIntentPayload } from '../rules/types.js';

export interface RegionTransitionResult {
    regionName: string;
    regionSlug: string;
    poiName?: string;
    stateHints: string[];
    worldStatePatch: Record<string, unknown>;
}

const mergeVisitedRegions = (existing: unknown, slug: string) => {
    const set = new Set<string>();
    if (Array.isArray(existing)) {
        for (const value of existing) {
            if (typeof value === 'string' && value.trim()) set.add(canonicalSlug(value));
        }
    }
    set.add(canonicalSlug(slug));
    return Array.from(set);
};

/** Aplica transição de região no personagem (motor autoritativo — Fase 4.5). */
export async function applyRegionTransition(
    sessionId: number,
    userId: number,
    payload: TravelIntentPayload,
): Promise<RegionTransitionResult> {
    const sessaoRepo = AppDataSource.getRepository(SessaoIA);
    const sessao = await sessaoRepo.findOne({
        where: { id: sessionId, userId },
        relations: ['character'],
    });
    if (!sessao?.character) {
        throw createError(404, 'Sessão ou personagem não encontrado.');
    }

    const targetSlug = canonicalSlug(payload.targetRegionSlug);
    if (!targetSlug) {
        throw createError(400, 'Região de destino inválida.');
    }

    const targetRegion = await RegionService.getRegionBySlug(targetSlug);
    if (!targetRegion) {
        throw createError(404, 'Região de destino não encontrada.');
    }

    const worldState = { ...((sessao.character.worldState as Record<string, unknown>) ?? {}) };
    const currentSlug = canonicalSlug(
        (worldState.regionSlug as string) ??
        (worldState.currentRegionSlug as string) ??
        sessao.character.currentRegion,
    );

    if (currentSlug && currentSlug !== targetSlug) {
        const currentRegion = currentSlug ? await RegionService.getRegionBySlug(currentSlug).catch(() => null) : null;
        const neighbor = currentRegion?.neighbors?.find(
            link => canonicalSlug(link.targetRegionSlug) === targetSlug,
        );
        if (neighbor?.isLocked) {
            throw createError(403, 'Rota bloqueada para esta região.');
        }
    }

    let poiName: string | undefined;
    if (payload.targetPoiSlug) {
        const poiSlug = canonicalSlug(payload.targetPoiSlug);
        const poi = targetRegion.pointsOfInterest?.find(p => canonicalSlug(p.slug) === poiSlug);
        if (!poi) {
            throw createError(404, 'POI de destino não encontrado na região.');
        }
        if (poi.isLocked) {
            throw createError(403, 'POI bloqueado.');
        }
        poiName = poi.name;
        worldState.poiSlug = poi.slug;
        worldState.poiName = poi.name;
        const visitedPois = Array.isArray(worldState.visitedPois) ? [...worldState.visitedPois] : [];
        const key = `${targetSlug}::${poiSlug}`;
        if (!visitedPois.some((entry: any) => `${canonicalSlug(entry.regionSlug)}::${canonicalSlug(entry.poiSlug)}` === key)) {
            visitedPois.push({ regionSlug: targetSlug, poiSlug: poi.slug, name: poi.name });
        }
        worldState.visitedPois = visitedPois;
    } else {
        delete worldState.poiSlug;
        delete worldState.poiName;
    }

    worldState.regionSlug = targetRegion.slug;
    worldState.currentRegion = targetRegion.name;
    worldState.currentRegionSlug = targetRegion.slug;
    worldState.visitedRegions = mergeVisitedRegions(worldState.visitedRegions, targetRegion.slug);

    const worldStatePatch = {
        worldState,
        currentRegion: targetRegion.name,
    };

    await mergeCharacterUpdates(sessao.character.id, worldStatePatch);

    const stateHints = [
        `[Região] Chegada em ${targetRegion.name} (${targetRegion.slug})${poiName ? ` — ${poiName}` : ''}.`,
        `[Região] Narre a chegada e o ambiente; não altere HP, inventário ou combate.`,
    ];

    await recordMotorFact({
        sessaoId: sessionId,
        characterId: sessao.character.id,
        category: 'region',
        subject: targetRegion.name,
        fact: `O grupo chegou em ${targetRegion.name}${poiName ? ` (${poiName})` : ''}.`,
        regionSlug: targetRegion.slug,
    });

    return {
        regionName: targetRegion.name,
        regionSlug: targetRegion.slug,
        poiName,
        stateHints,
        worldStatePatch,
    };
}
