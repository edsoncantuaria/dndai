import { In } from 'typeorm';
import { findEntityCandidates, findEntityCandidatesByEmbedding } from '../world/entityRegistry.js';
import { recallMemoryForTurn } from './recall.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import { parseNpcPersonality } from '../schemas/npcPersonality.js';
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
import { loadAmbientWorldLines } from './ambientWorld.js';
import {
    buildNarrativeWorldConsult,
    mergeSessionFactsWithMandate,
    type NarrativeWorldConsult,
    type WorldPulseBrief,
} from './narrativeContextDto.js';
import type { CampaignQuestView } from '../sessions/questCampaignHelpers.js';
import type { TimelineDeltaEntry } from './timelineEngine.js';
import { recallKgEdgesForSession } from '../world/knowledgeGraphV2.js';
import { npcCastFromEntity } from '../world/npcSheet.js';
import { parseNpcSessionOverlay } from '../world/npcSessionOverlay.js';
import { SessionEntityState } from '../database/entities/SessionEntityState.js';

export type NpcCastEntry = {
    slug: string;
    name: string;
    voiceTone?: string;
    traits: string[];
    activeGoal?: string;
    givenName?: string;
    roleTitle?: string;
    level?: number;
    role?: string;
    archetype?: string;
    ac?: number;
    maxHp?: number;
    vida?: number;
    vidaMax?: number;
    mainWeapon?: string;
    inventorySummary?: string;
    characterClass?: string;
    atributos?: { forca: number; destreza: number; constituicao: number; inteligencia: number; sabedoria: number; carisma: number };
    isSpellcaster?: boolean;
    spells?: string[];
};

export type NarrativeContextPack = {
    locale: string;
    playerAction: string;
    regionSlug: string | null;
    entities: Array<{ id: string; slug: string; displayName: string; entityType: string }>;
    npcCast: NpcCastEntry[];
    sessionFacts: string[];
    canonFacts: string[];
    narrativeSummary?: string | null;
    rollSummary?: string;
    motorHints?: string[];
    combatPhase?: string | null;
    regionMood?: { fear: number; prosperity: number; crime: number } | null;
    campaignKnowledge?: string[];
    heroReputation?: Array<{ targetSlug: string; score: number }>;
    /** Ambiente off-turn (rumores, NPCs, humor da região) — sem tick extra. */
    ambientWorld?: string[];
    /** Consulta determinística ao mundo (missões, pulso, timeline). */
    worldConsult?: NarrativeWorldConsult;
    activeQuests?: CampaignQuestView[];
    worldPulse?: WorldPulseBrief | null;
    timelineDelta?: TimelineDeltaEntry[];
    mandatedFacts?: string[];
};

async function loadNpcCast(
    entities: Array<{ id: string; slug: string; displayName: string; entityType: string }>,
    sessionId: number,
): Promise<NpcCastEntry[]> {
    const npcIds = entities.filter(e => e.entityType === 'npc').map(e => e.id);
    if (!npcIds.length) return [];

    const repo = PenaiDataSource.getRepository(WorldEntity);
    const rows = await repo.find({ where: { id: In(npcIds) } });
    const stateRepo = PenaiDataSource.getRepository(SessionEntityState);
    const states = await stateRepo.find({
        where: { sessionId, worldEntityId: In(npcIds) },
    });
    const overlayByEntity = new Map(
        states.map(s => [s.worldEntityId, parseNpcSessionOverlay(s.sessionOverlay)]),
    );

    return rows.map(r => {
        const p = parseNpcPersonality(r.personality);
        const goal = p.goals.find(g => g.status === 'active');
        const mechanical = npcCastFromEntity(r);
        const overlay =
            overlayByEntity.get(r.id) ?? null;
        const inv = overlay?.inventory ?? [];
        const equipped = inv.filter(i => i.equipped);
        const inventorySummary =
            equipped.length > 0
                ? equipped.map(i => i.name).join(', ')
                : inv.slice(0, 2).map(i => `${i.name}×${i.quantity}`).join(', ') || undefined;

        return {
            slug: r.slug,
            name: r.displayName,
            voiceTone: p.voiceTone,
            traits: p.traits.slice(0, 3),
            activeGoal: goal?.description,
            givenName: mechanical.givenName,
            roleTitle: mechanical.roleTitle,
            level: mechanical.level,
            role: mechanical.role,
            archetype: mechanical.archetype,
            ac: mechanical.ac,
            maxHp: mechanical.maxHp,
            vida: mechanical.vida,
            vidaMax: mechanical.vidaMax,
            mainWeapon: mechanical.mainWeaponName,
            inventorySummary,
            characterClass: mechanical.characterClass,
            atributos: mechanical.atributos,
            isSpellcaster: mechanical.isSpellcaster,
            spells: mechanical.spells,
        };
    });
}

export async function buildNarrativeContextPack(opts: {
    sessionId: number;
    playerAction: string;
    regionSlug?: string | null;
    rollSummary?: string;
    motorHints?: string[];
}): Promise<NarrativeContextPack> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: opts.sessionId },
    });
    const regionSlug = opts.regionSlug ?? session?.currentRegionSlug ?? null;

    const recalled = await recallMemoryForTurn({
        sessionId: opts.sessionId,
        query: opts.playerAction,
        regionSlug: regionSlug ?? undefined,
    });

    const entitiesByEmbed = await findEntityCandidatesByEmbedding(opts.playerAction, {
        regionSlug: regionSlug ?? undefined,
        limit: 5,
    });
    const entities =
        entitiesByEmbed.length > 0
            ? entitiesByEmbed
            : await findEntityCandidates({
                  regionSlug: regionSlug ?? undefined,
                  limit: 5,
              });

    let regionMood: NarrativeContextPack['regionMood'] = null;
    if (regionSlug) {
        const rs = await getOrCreateRegionState(opts.sessionId, regionSlug);
        regionMood = { fear: rs.fear, prosperity: rs.prosperity, crime: rs.crime };
    }

    const campaignKnowledge = await recallKnowledgeForSession(opts.sessionId, 4);
    const kgEdges = await recallKgEdgesForSession(opts.sessionId, 4);
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

    const npcCast = await loadNpcCast(entities, opts.sessionId);
    const ambientWorld = await loadAmbientWorldLines(opts.sessionId, regionSlug);
    const worldConsult = await buildNarrativeWorldConsult(opts.sessionId);
    const sessionFacts = mergeSessionFactsWithMandate(
        [...recalled.sessionFacts, ...campaignKnowledge, ...kgEdges],
        worldConsult.mandatedFacts,
        8,
    );

    return {
        locale: 'pt-BR',
        playerAction: opts.playerAction,
        regionSlug,
        entities,
        npcCast,
        sessionFacts,
        canonFacts: recalled.canonFacts,
        narrativeSummary: recalled.narrativeSummary,
        rollSummary: opts.rollSummary,
        motorHints,
        combatPhase: await getActivePenaiCombatPhase(opts.sessionId),
        regionMood,
        campaignKnowledge,
        heroReputation,
        ambientWorld,
        worldConsult,
        activeQuests: worldConsult.activeQuests,
        worldPulse: worldConsult.worldPulse,
        timelineDelta: worldConsult.timelineDelta.entries,
        mandatedFacts: worldConsult.mandatedFacts,
    };
}
