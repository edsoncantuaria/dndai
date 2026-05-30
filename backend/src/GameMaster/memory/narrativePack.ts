import { findEntityCandidates, findEntityCandidatesByEmbedding } from '../world/entityRegistry.js';
import { recallMemoryForTurn } from './recall.js';
import {
    shouldAllowPenaiCombatNarration,
    advancePenaiCombatPhaseAfterNarration,
    getActivePenaiCombatPhase,
} from '../combat/combatPhasePenai.js';
import { appendWorldEvent } from '../events/store.js';

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

    return {
        locale: 'pt-BR',
        playerAction: opts.playerAction,
        regionSlug: opts.regionSlug ?? null,
        entities,
        sessionFacts: recalled.sessionFacts,
        canonFacts: recalled.canonFacts,
        narrativeSummary: recalled.narrativeSummary,
        rollSummary: opts.rollSummary,
        motorHints: opts.motorHints,
        combatPhase: await getActivePenaiCombatPhase(opts.sessionId),
    };
}
