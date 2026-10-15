import { PenaiDataSource } from '../../../database/data-source.js';
import { GameSession } from '../../../database/entities/GameSession.js';
import { getOrCreateRegionState } from '../../campaignState.js';
import { appendWorldEvent } from '../../../events/store.js';

/** Economia causal — só eventos; preços aplicados no projector. */
export async function runEconomyTick(sessionId: number): Promise<string[]> {
    const pulses: string[] = [];
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const regionSlug = session?.currentRegionSlug;
    if (!regionSlug) return pulses;

    const region = await getOrCreateRegionState(sessionId, regionSlug);
    const wolfStock = region.resources?.wolfStock ?? 40;

    if (wolfStock < 15) {
        await appendWorldEvent({
            type: 'PRICE_CHANGED',
            sessionId,
            payload: {
                regionSlug,
                itemSlug: 'wolf_pelt',
                scarcityDelta: 8,
                reason: 'low_wolf_stock',
            },
        });
        pulses.push('Escassez de peles de lobo — preços sobem.');
    } else if (wolfStock > 50) {
        await appendWorldEvent({
            type: 'PRICE_CHANGED',
            sessionId,
            payload: {
                regionSlug,
                itemSlug: 'wolf_pelt',
                scarcityDelta: -5,
                reason: 'abundant_wolf_stock',
            },
        });
        pulses.push('Abundância de caça — peles mais baratas.');
    }

    const grainSupply = region.resources?.grainSupply;
    if (grainSupply != null && grainSupply < 20) {
        await appendWorldEvent({
            type: 'SUPPLY_SHORTAGE',
            sessionId,
            payload: { regionSlug, resource: 'grain', severity: 'medium', grainSupply },
        });
        pulses.push('Escassez de grãos na região.');
    }

    return pulses;
}
