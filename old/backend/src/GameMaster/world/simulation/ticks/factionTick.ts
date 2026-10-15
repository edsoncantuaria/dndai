import { PenaiDataSource } from '../../../database/data-source.js';
import { SessionFactionState } from '../../../database/entities/SessionFactionState.js';
import { GameSession } from '../../../database/entities/GameSession.js';
import { appendWorldEvent } from '../../../events/store.js';
import { adjustFactionInfluence } from '../../campaignState.js';
import { listCatalogFactionSlugs } from '../../factionCatalog.js';
import { ensureFactionCatalogInDatabase } from '../../factionSeed.js';

type FactionGoal = 'expand' | 'defend' | 'trade';

const GOAL_DELTAS: Record<FactionGoal, number> = {
    expand: 2,
    defend: 0,
    trade: 1,
};

function pickFactionGoal(reputation: number, influence: number): FactionGoal {
    if (reputation < -2 || influence < 20) return 'defend';
    if (reputation > 3 || influence > 60) return 'expand';
    return 'trade';
}

export async function runFactionTick(sessionId: number): Promise<string[]> {
    await ensureFactionCatalogInDatabase();
    const pulses: string[] = [];
    const stateRepo = PenaiDataSource.getRepository(SessionFactionState);
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const regionSlug = session?.currentRegionSlug ?? 'unknown';
    const slugs = listCatalogFactionSlugs();
    const factionSlug = slugs[Math.floor(Math.random() * slugs.length)];

    let row = await stateRepo.findOne({ where: { sessionId, factionSlug } });
    if (!row) {
        row = stateRepo.create({ sessionId, factionSlug, reputationScore: 0 });
    }

    const influenceRow = await adjustFactionInfluence(sessionId, factionSlug, regionSlug, 0);
    const goal = pickFactionGoal(row.reputationScore, influenceRow.influence);
    const repDelta = GOAL_DELTAS[goal];
    const infDelta = goal === 'expand' ? 3 : goal === 'defend' ? 1 : 2;

    /** Estado aplicado só via projector (FACTION_TICK) — evita double-apply. */
    await appendWorldEvent({
        type: 'FACTION_TICK',
        sessionId,
        payload: {
            factionSlug,
            regionSlug,
            delta: repDelta,
            influenceDelta: infDelta,
            goal,
            note: `Facção ${factionSlug} — objetivo ${goal}`,
        },
    });

    pulses.push(
        `Facção ${factionSlug} (${goal}): rep ${repDelta >= 0 ? '+' : ''}${repDelta}, influência +${infDelta}`,
    );
    return pulses;
}
