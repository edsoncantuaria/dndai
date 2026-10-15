import type { RuleCheckResult, TravelIntentPayload } from './types.js';
import { validateTravelIntentPenai } from '../GameMaster/world/travelCanon.js';

function canonicalSlug(value?: string | null): string {
    if (!value) return '';
    return value
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export async function validateTravelIntent(
    worldState: Record<string, unknown> | null | undefined,
    payload: TravelIntentPayload,
): Promise<RuleCheckResult> {
    const currentSlug = canonicalSlug(
        (worldState?.regionSlug as string) ??
            (worldState?.currentRegionSlug as string) ??
            (worldState?.currentRegion as string),
    );

    return validateTravelIntentPenai(currentSlug || null, payload);
}
