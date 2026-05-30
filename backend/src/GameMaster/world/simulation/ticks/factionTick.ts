import { PenaiDataSource } from '../../../database/data-source.js';
import { Faction } from '../../../database/entities/Faction.js';
import { SessionFactionState } from '../../../database/entities/SessionFactionState.js';
import { GameSession } from '../../../database/entities/GameSession.js';
import { appendWorldEvent } from '../../../events/store.js';
import { adjustFactionInfluence } from '../../campaignState.js';
import { randomUUID } from 'crypto';

const FACTION_SLUGS = ['guilda-mercadores', 'ordem-crepuscular', 'circulo-druidas', 'coroa-ferro'];

type FactionGoal = 'expand' | 'defend' | 'trade';

const GOAL_DELTAS: Record<FactionGoal, number> = {
    expand: 2,
    defend: 0,
    trade: 1,
};

async function ensureFactionCatalog(): Promise<void> {
    const repo = PenaiDataSource.getRepository(Faction);
    for (const slug of FACTION_SLUGS) {
        const exists = await repo.findOne({ where: { slug } });
        if (!exists) {
            await repo.save(
                repo.create({
                    id: randomUUID(),
                    slug,
                    displayName: slug.replace(/-/g, ' '),
                    alignment: 'neutral',
                    locale: 'pt-BR',
                }),
            );
        }
    }
}

function pickFactionGoal(reputation: number, influence: number): FactionGoal {
    if (reputation < -2 || influence < 20) return 'defend';
    if (reputation > 3 || influence > 60) return 'expand';
    return 'trade';
}

export async function runFactionTick(sessionId: number): Promise<string[]> {
    await ensureFactionCatalog();
    const pulses: string[] = [];
    const stateRepo = PenaiDataSource.getRepository(SessionFactionState);
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const regionSlug = session?.currentRegionSlug ?? 'unknown';
    const factionSlug = FACTION_SLUGS[Math.floor(Math.random() * FACTION_SLUGS.length)];

    let row = await stateRepo.findOne({ where: { sessionId, factionSlug } });
    if (!row) {
        row = stateRepo.create({ sessionId, factionSlug, reputationScore: 0 });
    }

    const influenceRow = await adjustFactionInfluence(sessionId, factionSlug, regionSlug, 0);
    const goal = pickFactionGoal(row.reputationScore, influenceRow.influence);
    const repDelta = GOAL_DELTAS[goal];
    const infDelta = goal === 'expand' ? 3 : goal === 'defend' ? 1 : 2;

    row.reputationScore += repDelta;
    await stateRepo.save(row);
    await adjustFactionInfluence(sessionId, factionSlug, regionSlug, infDelta);

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
