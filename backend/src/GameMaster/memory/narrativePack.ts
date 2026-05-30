import { findEntityCandidates, findEntityCandidatesByEmbedding } from '../world/entityRegistry.js';
import { recallMemoryForTurn } from './recall.js';
import {
    shouldAllowPenaiCombatNarration,
    advancePenaiCombatPhaseAfterNarration,
    getActivePenaiCombatPhase,
} from '../combat/phaseGate.js';
import { appendWorldEvent } from '../events/store.js';
import { getOrCreateRegionState } from '../world/campaignState.js';
import { recallKnowledgeForSession } from '../world/knowledgeGraph.js';
import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { listTopReputations } from '../world/campaignState.js';

export type NarrativeContextPack = {
    locale: string;
    playerAction: string;
    regionSlug: string | null;
    entities: Array<{ slug: string; displayName: string; entityType: string }>;
    sessionFacts: string[];
    canonFacts: string[];
    narrativeSummary?: string | null;
    rollSummary?: string;
    motorHints?: string[];
    combatPhase?: string | null;
    regionMood?: { fear: number; prosperity: number; crime: number } | null;
    campaignKnowledge?: string[];
    heroReputation?: Array<{ targetSlug: string; score: number }>;
};

export async function buildNarrativeContextPack(opts: {
    sessionId: number;
    playerAction: string;
    regionSlug?: string | null;
    rollSummary?: string;
    motorHints?: string[];
}): Promise<NarrativeContextPack> {
    const recalled = await recallMemoryForTurn({
        sessionId: opts.sessionId,
        query: opts.playerAction,
    });

    const entitiesByEmbed = await findEntityCandidatesByEmbedding(opts.playerAction, {
        regionSlug: opts.regionSlug ?? undefined,
        limit: 5,
    });
    const entities =
        entitiesByEmbed.length > 0
            ? entitiesByEmbed
            : await findEntityCandidates({
                  regionSlug: opts.regionSlug ?? undefined,
                  limit: 5,
              });

    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: opts.sessionId },
    });
    const regionSlug = opts.regionSlug ?? session?.currentRegionSlug ?? null;

    let regionMood: NarrativeContextPack['regionMood'] = null;
    if (regionSlug) {
        const rs = await getOrCreateRegionState(opts.sessionId, regionSlug);
        regionMood = { fear: rs.fear, prosperity: rs.prosperity, crime: rs.crime };
    }

    const campaignKnowledge = await recallKnowledgeForSession(opts.sessionId, 4);
    const heroId = session?.heroWorldEntityId ?? null;
    const heroReputation = heroId
        ? await listTopReputations(opts.sessionId, heroId, 3)
        : [];

    const motorHints = [...(opts.motorHints ?? [])];
    if (regionMood && regionMood.fear > 60) {
        motorHints.push('A região está tensa — medo elevado entre os locais.');
    }
    if (heroReputation.some(r => r.score >= 20)) {
        motorHints.push('O herói tem boa reputação nesta campanha.');
    }

    return {
        locale: 'pt-BR',
        playerAction: opts.playerAction,
        regionSlug,
        entities,
        sessionFacts: [...recalled.sessionFacts, ...campaignKnowledge],
        canonFacts: recalled.canonFacts,
        narrativeSummary: recalled.narrativeSummary,
        rollSummary: opts.rollSummary,
        motorHints,
        combatPhase: await getActivePenaiCombatPhase(opts.sessionId),
        regionMood,
        campaignKnowledge,
        heroReputation,
    };
}
