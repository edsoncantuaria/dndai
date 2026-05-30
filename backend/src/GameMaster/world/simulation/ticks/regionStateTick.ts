import { PenaiDataSource } from '../../../database/data-source.js';
import { GameSession } from '../../../database/entities/GameSession.js';
import { SessionRegionState } from '../../../database/entities/SessionRegionState.js';
import { getOrCreateRegionState } from '../../campaignState.js';
import { appendWorldEvent } from '../../../events/store.js';

export async function runRegionStateTick(sessionId: number): Promise<string[]> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const regionSlug = session?.currentRegionSlug;
    if (!regionSlug) return [];

    const row = await getOrCreateRegionState(sessionId, regionSlug);
    const pulses: string[] = [];

    if (row.crime > 55) {
        row.fear = Math.min(100, row.fear + 2);
    } else if (row.prosperity > 60) {
        row.fear = Math.max(0, row.fear - 1);
        row.crime = Math.max(0, row.crime - 1);
    }

    await PenaiDataSource.getRepository(SessionRegionState).save(row);

    await appendWorldEvent({
        type: 'REGION_MOOD_CHANGED',
        sessionId,
        payload: {
            regionSlug,
            fear: row.fear,
            prosperity: row.prosperity,
            crime: row.crime,
        },
    });

    pulses.push(`Região ${regionSlug}: medo ${row.fear}, prosperidade ${row.prosperity}.`);
    return pulses;
}
