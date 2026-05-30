import { PenaiDataSource } from '../../../database/data-source.js';
import { GameSession } from '../../../database/entities/GameSession.js';
import { getOrCreateRegionState } from '../../campaignState.js';
import { appendWorldEvent } from '../../../events/store.js';

/** Emite REGION_MOOD_CHANGED — estado aplicado só no projector. */
export async function runRegionStateTick(sessionId: number): Promise<string[]> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const regionSlug = session?.currentRegionSlug;
    if (!regionSlug) return [];

    const row = await getOrCreateRegionState(sessionId, regionSlug);
    let fear = row.fear;
    let crime = row.crime;
    let prosperity = row.prosperity;

    if (crime > 55) {
        fear = Math.min(100, fear + 2);
    } else if (prosperity > 60) {
        fear = Math.max(0, fear - 1);
        crime = Math.max(0, crime - 1);
    }

    await appendWorldEvent({
        type: 'REGION_MOOD_CHANGED',
        sessionId,
        payload: { regionSlug, fear, prosperity, crime },
    });

    return [`Região ${regionSlug}: medo ${fear}, prosperidade ${prosperity}.`];
}
