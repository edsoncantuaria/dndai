import createError from 'http-errors';
import type { RuleCheckResult, TravelIntentPayload } from './types.js';
import * as RegionService from '../services/regionService.js';
import { canonicalSlug } from '../narration/regionContext.js';

export async function validateTravelIntent(
    worldState: Record<string, unknown> | null | undefined,
    payload: TravelIntentPayload,
): Promise<RuleCheckResult> {
    const targetSlug = canonicalSlug(payload.targetRegionSlug);
    if (!targetSlug) {
        return { status: 'rejected', reason: 'Slug de destino inválido.' };
    }

    const targetRegion = await RegionService.getRegionBySlug(targetSlug).catch(() => null);
    if (!targetRegion) {
        return { status: 'rejected', reason: 'Região de destino desconhecida.' };
    }

    const currentSlug = canonicalSlug(
        (worldState?.regionSlug as string) ??
        (worldState?.currentRegionSlug as string) ??
        (worldState?.currentRegion as string),
    );

    if (currentSlug === targetSlug && !payload.targetPoiSlug) {
        return { status: 'rejected', reason: 'Você já está nesta região.' };
    }

    if (currentSlug && currentSlug !== targetSlug) {
        const currentRegion = await RegionService.getRegionBySlug(currentSlug).catch(() => null);
        const neighbor = currentRegion?.neighbors?.find(
            link => canonicalSlug(link.targetRegionSlug) === targetSlug,
        );
        if (!neighbor) {
            return { status: 'rejected', reason: 'Não há rota conhecida para esta região.' };
        }
        if (neighbor.isLocked) {
            return { status: 'rejected', reason: 'A rota para esta região está bloqueada.' };
        }
    }

    if (payload.targetPoiSlug) {
        const poi = targetRegion.pointsOfInterest?.find(
            p => canonicalSlug(p.slug) === canonicalSlug(payload.targetPoiSlug),
        );
        if (!poi) {
            return { status: 'rejected', reason: 'POI não encontrado na região de destino.' };
        }
        if (poi.isLocked) {
            return { status: 'rejected', reason: 'Este POI está bloqueado.' };
        }
    }

    return {
        status: 'accepted',
        reason: `Viagem autorizada para ${targetRegion.name}.`,
        authoritativeSignature: `travel:${targetSlug}`,
    };
}
