import { PenaiDataSource } from '../database/data-source.js';
import { CanonicalRegion } from '../database/entities/CanonicalRegion.js';
import { CanonicalRegionLink } from '../database/entities/CanonicalRegionLink.js';
import { CanonicalPoi } from '../database/entities/CanonicalPoi.js';
import { TravelModeCatalog } from '../database/entities/TravelModeCatalog.js';
import { appendWorldEvent } from '../events/store.js';
import type { RuleCheckResult } from '../../rules/types.js';

export type TravelIntentPenai = {
    targetRegionSlug: string;
    targetPoiSlug?: string;
    travelMode?: string;
};

export type TravelDurationResult = {
    fromRegionSlug: string;
    toRegionSlug: string;
    distanceKm: number;
    baseDurationHours: number;
    durationHours: number;
    travelMode: string;
    travelModeLabel: string;
};

function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

export function computeTravelDurationHours(
    baseDurationHours: number,
    terrainModifier: number,
    speedMultiplier: number,
): number {
    const safeTerrain = terrainModifier > 0 ? terrainModifier : 1;
    const safeSpeed = speedMultiplier > 0 ? speedMultiplier : 1;
    return Math.round((baseDurationHours * safeTerrain) / safeSpeed * 10) / 10;
}

export async function getRegionBySlug(slug: string): Promise<CanonicalRegion | null> {
    const normalized = slugify(slug);
    if (!normalized) return null;
    return PenaiDataSource.getRepository(CanonicalRegion).findOne({
        where: { slug: normalized },
    });
}

export async function findCanonicalLink(
    fromRegionId: string,
    toRegionId: string,
): Promise<CanonicalRegionLink | null> {
    const repo = PenaiDataSource.getRepository(CanonicalRegionLink);
    const direct = await repo.findOne({ where: { fromRegionId, toRegionId } });
    if (direct) return direct;
    return repo.findOne({ where: { fromRegionId: toRegionId, toRegionId: fromRegionId } });
}

export async function resolveTravelDuration(
    fromSlug: string,
    toSlug: string,
    travelModeSlug = 'walk',
): Promise<TravelDurationResult | null> {
    const from = await getRegionBySlug(fromSlug);
    const to = await getRegionBySlug(toSlug);
    if (!from || !to) return null;

    const link = await findCanonicalLink(from.id, to.id);
    if (!link || link.isLocked) return null;

    const modeRepo = PenaiDataSource.getRepository(TravelModeCatalog);
    const mode =
        (await modeRepo.findOne({ where: { slug: slugify(travelModeSlug) } })) ??
        (await modeRepo.findOne({ where: { slug: 'walk' } }));
    const speedMultiplier = mode?.speedMultiplier ?? 1;

    const durationHours = computeTravelDurationHours(
        link.baseDurationHours,
        link.terrainModifier,
        speedMultiplier,
    );

    return {
        fromRegionSlug: from.slug,
        toRegionSlug: to.slug,
        distanceKm: link.distanceKm,
        baseDurationHours: link.baseDurationHours,
        durationHours,
        travelMode: mode?.slug ?? 'walk',
        travelModeLabel: mode?.displayName ?? 'A pé',
    };
}

export async function validateTravelIntentPenai(
    currentRegionSlug: string | null,
    payload: TravelIntentPenai,
): Promise<RuleCheckResult & { travel?: TravelDurationResult }> {
    const targetSlug = slugify(payload.targetRegionSlug);
    if (!targetSlug) {
        return { status: 'rejected', reason: 'Slug de destino inválido.' };
    }

    const targetRegion = await getRegionBySlug(targetSlug);
    if (!targetRegion) {
        return { status: 'rejected', reason: 'Região de destino desconhecida.' };
    }

    const currentSlug = currentRegionSlug ? slugify(currentRegionSlug) : null;

    if (currentSlug === targetSlug && !payload.targetPoiSlug) {
        return { status: 'rejected', reason: 'Você já está nesta região.' };
    }

    if (currentSlug && currentSlug !== targetSlug) {
        const currentRegion = await getRegionBySlug(currentSlug);
        if (!currentRegion) {
            return { status: 'rejected', reason: 'Região atual inválida.' };
        }
        const link = await findCanonicalLink(currentRegion.id, targetRegion.id);
        if (!link) {
            return { status: 'rejected', reason: 'Não há rota canônica para esta região.' };
        }
        if (link.isLocked) {
            return { status: 'rejected', reason: 'A rota para esta região está bloqueada.' };
        }
    }

    if (payload.targetPoiSlug) {
        const poi = await PenaiDataSource.getRepository(CanonicalPoi).findOne({
            where: { regionId: targetRegion.id, slug: slugify(payload.targetPoiSlug) },
        });
        if (!poi) {
            return { status: 'rejected', reason: 'POI não encontrado na região de destino.' };
        }
    }

    const travel = currentSlug
        ? await resolveTravelDuration(currentSlug, targetSlug, payload.travelMode ?? 'walk')
        : null;

    return {
        status: 'accepted',
        reason: `Viagem autorizada para ${targetRegion.displayName}.`,
        authoritativeSignature: `travel:${targetSlug}`,
        travel: travel ?? undefined,
    };
}

export async function applyTravelToSession(opts: {
    sessionId: number;
    fromRegionSlug: string | null;
    payload: TravelIntentPenai;
    actionId: string;
    actionSequence: number;
}): Promise<{ ok: boolean; result: RuleCheckResult; travel?: TravelDurationResult }> {
    const check = await validateTravelIntentPenai(opts.fromRegionSlug, opts.payload);
    if (check.status !== 'accepted') {
        return { ok: false, result: check };
    }

    const targetSlug = slugify(opts.payload.targetRegionSlug);
    const travel =
        check.travel ??
        (opts.fromRegionSlug
            ? await resolveTravelDuration(
                  opts.fromRegionSlug,
                  targetSlug,
                  opts.payload.travelMode ?? 'walk',
              )
            : null);

    await appendWorldEvent({
        type: 'TRAVEL_STARTED',
        sessionId: opts.sessionId,
        payload: {
            actionId: opts.actionId,
            actionSequence: opts.actionSequence,
            fromRegionSlug: opts.fromRegionSlug,
            toRegionSlug: targetSlug,
            targetPoiSlug: opts.payload.targetPoiSlug ?? null,
            travelMode: travel?.travelMode ?? 'walk',
            distanceKm: travel?.distanceKm,
            durationHours: travel?.durationHours,
        },
    });

    const { PenaiDataSource: ds } = await import('../database/data-source.js');
    const { GameSession } = await import('../database/entities/GameSession.js');
    const sessionRepo = ds.getRepository(GameSession);
    const row = await sessionRepo.findOne({ where: { id: opts.sessionId } });
    if (row) {
        row.currentRegionSlug = targetSlug;
        await sessionRepo.save(row);
    }

    if (travel?.durationHours) {
        const { advanceSessionGameClock } = await import('./gameClockPenai.js');
        await advanceSessionGameClock(opts.sessionId, travel.durationHours);
    }

    await appendWorldEvent({
        type: 'TRAVEL_COMPLETED',
        sessionId: opts.sessionId,
        payload: {
            actionId: opts.actionId,
            actionSequence: opts.actionSequence,
            regionSlug: targetSlug,
            targetPoiSlug: opts.payload.targetPoiSlug ?? null,
            distanceKm: travel?.distanceKm,
            durationHours: travel?.durationHours,
        },
    });

    const { maybeScheduleWorldPulse } = await import('./worldPulseSchedulePenai.js');
    void maybeScheduleWorldPulse(opts.sessionId, 'travel').catch(() => undefined);

    return { ok: true, result: check, travel: travel ?? undefined };
}
