import { PenaiDataSource } from '../../../database/data-source.js';
import { GameSession } from '../../../database/entities/GameSession.js';
import { getOrCreateRegionState, applyScarcityToPrice } from '../../campaignState.js';
import { appendWorldEvent } from '../../../events/store.js';

/** Economia causal por campanha — deriva de recursos regionais. */
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
        const econ = await applyScarcityToPrice(sessionId, regionSlug, 'wolf_pelt', 8);
        await appendWorldEvent({
            type: 'PRICE_CHANGED',
            sessionId,
            payload: {
                regionSlug,
                itemSlug: 'wolf_pelt',
                currentPrice: econ.currentPrice,
                reason: 'low_wolf_stock',
            },
        });
        pulses.push(`Escassez de peles de lobo — preço ${econ.currentPrice.toFixed(1)}.`);
    } else if (wolfStock > 50) {
        const econ = await applyScarcityToPrice(sessionId, regionSlug, 'wolf_pelt', -5);
        await appendWorldEvent({
            type: 'PRICE_CHANGED',
            sessionId,
            payload: {
                regionSlug,
                itemSlug: 'wolf_pelt',
                currentPrice: econ.currentPrice,
                reason: 'abundant_wolf_stock',
            },
        });
        pulses.push(`Abundância de caça — peles mais baratas (${econ.currentPrice.toFixed(1)}).`);
    }

    if (region.resources?.grainSupply != null && region.resources.grainSupply < 20) {
        await appendWorldEvent({
            type: 'SUPPLY_SHORTAGE',
            sessionId,
            payload: { regionSlug, resource: 'grain', severity: 'medium' },
        });
        pulses.push('Escassez de grãos na região.');
    }

    return pulses;
}
