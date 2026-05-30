import createError from 'http-errors';
import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { SessionEntityState } from '../database/entities/SessionEntityState.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import { appendWorldEvent } from '../events/store.js';
import { discoverFactionsByRegion } from './factionDiscovery.js';
import { resolveFactionDisplayName } from './factionDiscovery.js';
import { getOrCreateRegionState, getOrCreateEconomyRow } from './campaignState.js';
import { SessionRegionEconomy } from '../database/entities/SessionRegionEconomy.js';
import { tickWorldSimulation } from './simulation/engine.js';
import { publishWorldPulse } from './publishWorldPulse.js';
import { getRegionBySlug } from './travelCanon.js';
import { generateBootstrapNpcs } from './agents/worldBootstrapNpcAgent.js';
import { generateBootstrapFactionBeats } from './agents/worldBootstrapFactionAgent.js';
import { generateBootstrapEconomy } from './agents/worldBootstrapEconomyAgent.js';
import { materializeBootstrapNpcs } from './materializeBootstrapNpcs.js';
import { generateBootstrapQuests } from './agents/worldQuestSeedAgent.js';
import { listNeighborRegionSlugs } from './listNeighborRegions.js';
import { startSessionQuest } from './sessionQuests.js';
import { WorldGeminiGenerationError } from './agents/worldGeminiGenerationError.js';
import {
    offlineBootstrapNpcs,
    offlineEconomy,
    offlineFactionBeats,
    offlineQuestSeeds,
} from './worldBootstrapFallback.js';
import {
    persistBootstrapMemories,
    validateBootstrapMemory,
} from '../memory/bootstrapMemory.js';
import {
    DEFAULT_WORLD_BOOTSTRAP,
    updateWorldBootstrap,
    type WorldBootstrapStepId,
} from '../sessions/sessionUiState.js';
import { penaiPipelineLog } from '../infra/pipelineLog.js';
import { resolveInferenceApiKey } from '../../services/aiBillingService.js';

async function setStep(
    sessionId: number,
    step: WorldBootstrapStepId,
    stepStatus: 'running' | 'done' | 'failed',
): Promise<void> {
    const steps = { ...DEFAULT_WORLD_BOOTSTRAP.steps };
    steps[step] = stepStatus;
    await updateWorldBootstrap(sessionId, {
        status: 'running',
        step,
        steps,
        startedAt: new Date().toISOString(),
    });
}

async function countSessionNpcs(sessionId: number): Promise<number> {
    const stateRepo = PenaiDataSource.getRepository(SessionEntityState);
    const entityRepo = PenaiDataSource.getRepository(WorldEntity);
    const states = await stateRepo.find({ where: { sessionId }, take: 50 });
    let count = 0;
    for (const st of states) {
        const ent = await entityRepo.findOne({ where: { id: st.worldEntityId } });
        if (ent?.entityType === 'npc') count++;
    }
    return count;
}

/** Materializa mundo (LLM + Qdrant + simulação) e valida memória. */
export async function runSessionWorldBootstrap(
    sessionId: number,
    opts?: { offline?: boolean },
): Promise<void> {
    const repo = PenaiDataSource.getRepository(GameSession);
    const session = await repo.findOne({ where: { id: sessionId } });
    if (!session) throw createError(404, 'Sessão não encontrada');

    const ctx = { sessionId, userId: session.userId };
    const current = session.worldBootstrap as { status?: string } | null;
    if (current?.status === 'ready') {
        penaiPipelineLog('WORLD_BOOTSTRAP', 'já pronto — skip', undefined, ctx);
        return;
    }
    if (current?.status === 'running') {
        penaiPipelineLog('WORLD_BOOTSTRAP', 'já em execução — skip', undefined, ctx);
        return;
    }

    await updateWorldBootstrap(sessionId, {
        status: 'running',
        step: 'region',
        steps: { ...DEFAULT_WORLD_BOOTSTRAP.steps },
        startedAt: new Date().toISOString(),
    });

    const regionSlug = session.currentRegionSlug;
    if (!regionSlug) {
        await updateWorldBootstrap(sessionId, {
            status: 'failed',
            error: 'Sessão sem região de spawn',
        });
        throw createError(409, 'Sessão sem região');
    }

    const userApiKey = (await resolveInferenceApiKey(session.userId)) ?? undefined;
    const forceOffline = opts?.offline === true;
    let heroName: string | undefined;
    if (session.heroWorldEntityId) {
        const hero = await PenaiDataSource.getRepository(WorldEntity).findOne({
            where: { id: session.heroWorldEntityId },
        });
        heroName = hero?.displayName;
    }

    const memorySnapshot: {
        regionSlug: string;
        regionName: string;
        factionRumors: string[];
        npcFacts: string[];
        questFacts: string[];
        regionBlurb?: string;
        marketSummary?: string;
    } = {
        regionSlug,
        regionName: regionSlug,
        factionRumors: [] as string[],
        npcFacts: [] as string[],
        questFacts: [] as string[],
    };

    try {
        await setStep(sessionId, 'region', 'running');
        const regionMeta = await getRegionBySlug(regionSlug);
        const regionName = regionMeta?.displayName ?? regionSlug;
        memorySnapshot.regionName = regionName;
        const regionState = await getOrCreateRegionState(sessionId, regionSlug);
        await appendWorldEvent({
            type: 'REGION_SETTLED',
            sessionId,
            payload: { regionSlug, displayName: regionName },
        });
        await setStep(sessionId, 'region', 'done');

        await setStep(sessionId, 'factions', 'running');
        const factionSlugs = await discoverFactionsByRegion(sessionId, regionSlug);
        if (factionSlugs.length) {
            await appendWorldEvent({
                type: 'FACTIONS_DISCOVERED',
                sessionId,
                payload: { regionSlug, factions: factionSlugs },
            });
        }

        const factionNames = await Promise.all(
            factionSlugs.map(s => resolveFactionDisplayName(s)),
        );
        let factionBeats: Awaited<
            ReturnType<typeof generateBootstrapFactionBeats>
        >['beats'];
        let factionSource: string;
        if (forceOffline) {
            const offline = offlineFactionBeats(factionSlugs, regionName);
            factionBeats = offline.beats;
            factionSource = offline.source;
        } else {
            try {
                const generated = await generateBootstrapFactionBeats({
                    sessionId,
                    userId: session.userId,
                    regionSlug,
                    regionName,
                    factionSlugs,
                    userApiKey,
                    ctx,
                });
                factionBeats = generated.beats;
                factionSource = generated.source;
            } catch (err) {
                if (!(err instanceof WorldGeminiGenerationError)) throw err;
                penaiPipelineLog(
                    'WORLD_BOOTSTRAP',
                    'fallback factions (offline seed)',
                    { error: err.message },
                    ctx,
                );
                const offline = offlineFactionBeats(factionSlugs, regionName);
                factionBeats = offline.beats;
                factionSource = offline.source;
            }
        }
        for (const beat of factionBeats) {
            const line = `${beat.localHeadline}: ${beat.rumor}`;
            memorySnapshot.factionRumors.push(line);
            await appendWorldEvent({
                type: 'RUMOR_CREATED',
                sessionId,
                payload: {
                    factionSlug: beat.factionSlug,
                    title: beat.localHeadline,
                    body: beat.rumor,
                    source: factionSource,
                },
            });
        }
        await setStep(sessionId, 'factions', 'done');

        await setStep(sessionId, 'npcs', 'running');
        let npcCount = await countSessionNpcs(sessionId);
        if (npcCount >= 4) {
            penaiPipelineLog('WORLD_BOOTSTRAP', 'NPCs existentes — skip geração', { npcCount }, ctx);
            await setStep(sessionId, 'npcs', 'done');
        } else {
            let npcs: Awaited<ReturnType<typeof generateBootstrapNpcs>>['npcs'];
            let regionBlurb: string | undefined;
            let npcSource: string;
            if (forceOffline) {
                const offline = await offlineBootstrapNpcs({ sessionId, regionSlug, regionName });
                npcs = offline.npcs;
                regionBlurb = offline.regionBlurb;
                npcSource = offline.source;
            } else {
                try {
                    const generated = await generateBootstrapNpcs({
                        sessionId,
                        userId: session.userId,
                        regionSlug,
                        regionName,
                        factionNames,
                        heroName,
                        userApiKey,
                        ctx,
                    });
                    npcs = generated.npcs;
                    regionBlurb = generated.regionBlurb;
                    npcSource = generated.source;
                } catch (err) {
                    if (!(err instanceof WorldGeminiGenerationError)) throw err;
                    penaiPipelineLog(
                        'WORLD_BOOTSTRAP',
                        'fallback npcs (offline seed)',
                        { error: err.message },
                        ctx,
                    );
                    const offline = await offlineBootstrapNpcs({ sessionId, regionSlug, regionName });
                    npcs = offline.npcs;
                    regionBlurb = offline.regionBlurb;
                    npcSource = offline.source;
                }
            }
            memorySnapshot.regionBlurb = regionBlurb;
            const materialized = await materializeBootstrapNpcs({
                sessionId,
                userId: session.userId,
                regionSlug,
                npcs,
                ctx,
            });
            npcCount = materialized.length;
            for (const m of materialized) {
                memorySnapshot.npcFacts.push(
                    `${m.displayName} (${m.reused ? 'conhecido no mundo' : 'novo'}) está em ${regionName}.`,
                );
            }
            penaiPipelineLog('WORLD_BOOTSTRAP', 'NPCs materializados', { npcCount, npcSource }, ctx);
            await setStep(sessionId, 'npcs', 'done');
        }

        await setStep(sessionId, 'quests', 'running');
        const neighbors = await listNeighborRegionSlugs(regionSlug, 3);
        let questDrafts: Awaited<ReturnType<typeof generateBootstrapQuests>>['quests'];
        let questSource: string;
        if (forceOffline) {
            const offline = offlineQuestSeeds({
                spawnRegionSlug: regionSlug,
                spawnRegionName: regionName,
            });
            questDrafts = offline.quests;
            questSource = offline.source;
        } else {
            try {
                const generated = await generateBootstrapQuests({
                    sessionId,
                    userId: session.userId,
                    spawnRegionSlug: regionSlug,
                    spawnRegionName: regionName,
                    neighborRegions: neighbors,
                    userApiKey,
                    ctx,
                });
                questDrafts = generated.quests;
                questSource = generated.source;
            } catch (err) {
                if (!(err instanceof WorldGeminiGenerationError)) throw err;
                penaiPipelineLog(
                    'WORLD_BOOTSTRAP',
                    'fallback quests (offline seed)',
                    { error: err.message },
                    ctx,
                );
                const offline = offlineQuestSeeds({
                    spawnRegionSlug: regionSlug,
                    spawnRegionName: regionName,
                });
                questDrafts = offline.quests;
                questSource = offline.source;
            }
        }
        for (const q of questDrafts) {
            const targetMeta = await getRegionBySlug(q.regionSlug);
            await startSessionQuest({
                sessionId,
                questSlug: q.questSlug,
                title: q.title,
                payload: {
                    regionSlug: q.regionSlug,
                    regionName: targetMeta?.displayName ?? q.regionSlug,
                    synopsis: q.synopsis,
                    stageLabel: q.stageLabel,
                    kind: q.kind,
                    urgency: q.urgency ?? 'medium',
                    source: questSource,
                },
            });
            memorySnapshot.questFacts.push(
                `[MISSÃO] ${q.title} (${q.kind === 'travel' ? 'em outro lugar' : 'aqui'}: ${targetMeta?.displayName ?? q.regionSlug}) — ${q.synopsis.slice(0, 120)}`,
            );
        }
        penaiPipelineLog('WORLD_BOOTSTRAP', 'missões semeadas', { count: questDrafts.length, questSource }, ctx);
        await setStep(sessionId, 'quests', 'done');

        await setStep(sessionId, 'economy', 'running');
        await getOrCreateEconomyRow(sessionId, regionSlug, 'wolf_pelt');
        await getOrCreateEconomyRow(sessionId, regionSlug, 'healing_potion');
        await getOrCreateEconomyRow(sessionId, regionSlug, 'iron_ingot');
        let marketSummary: string;
        let items: Array<{ itemSlug: string; priceNote: string; scarcityDelta?: number }>;
        let econSource: string;
        if (forceOffline) {
            const offline = offlineEconomy(regionName);
            marketSummary = offline.marketSummary;
            items = offline.items;
            econSource = offline.source;
        } else {
            try {
                const generated = await generateBootstrapEconomy({
                    sessionId,
                    userId: session.userId,
                    regionSlug,
                    regionName,
                    resources: regionState.resources ?? {},
                    userApiKey,
                    ctx,
                });
                marketSummary = generated.marketSummary;
                items = generated.items;
                econSource = generated.source;
            } catch (err) {
                if (!(err instanceof WorldGeminiGenerationError)) throw err;
                penaiPipelineLog(
                    'WORLD_BOOTSTRAP',
                    'fallback economy (offline seed)',
                    { error: err.message },
                    ctx,
                );
                const offline = offlineEconomy(regionName);
                marketSummary = offline.marketSummary;
                items = offline.items;
                econSource = offline.source;
            }
        }
        memorySnapshot.marketSummary = marketSummary;
        for (const item of items) {
            const row = await getOrCreateEconomyRow(sessionId, regionSlug, item.itemSlug);
            if (item.scarcityDelta != null) {
                row.scarcity = Math.max(0, Math.min(100, row.scarcity + item.scarcityDelta));
                await PenaiDataSource.getRepository(SessionRegionEconomy).save(row);
            }
            await appendWorldEvent({
                type: 'ECONOMY_NOTE',
                sessionId,
                payload: {
                    itemSlug: item.itemSlug,
                    note: item.priceNote,
                    source: econSource,
                },
            });
        }
        const { runEconomyTick } = await import('./simulation/ticks/economyTick.js');
        await runEconomyTick(sessionId);
        await setStep(sessionId, 'economy', 'done');

        await setStep(sessionId, 'simulation', 'running');
        for (let i = 0; i < 2; i++) {
            await tickWorldSimulation(sessionId, { ctx });
        }
        await setStep(sessionId, 'simulation', 'done');

        const storedMemories = await persistBootstrapMemories(sessionId, memorySnapshot, ctx);
        const validation = await validateBootstrapMemory(sessionId);
        if (!validation.ok) {
            penaiPipelineLog('WORLD_MEMORY', 'validação com avisos', validation, ctx);
        } else {
            penaiPipelineLog('WORLD_MEMORY', 'validação OK', { storedMemories, ...validation }, ctx);
        }

        await setStep(sessionId, 'pulse', 'running');
        try {
            await publishWorldPulse(sessionId, { bootstrap: true });
        } catch (err) {
            if (!(err instanceof WorldGeminiGenerationError) && !forceOffline) throw err;
            penaiPipelineLog(
                'WORLD_BOOTSTRAP',
                'fallback pulse (offline copy)',
                { error: err instanceof Error ? err.message : String(err) },
                ctx,
            );
            const { publishWorldPulseOffline } = await import('./publishWorldPulse.js');
            await publishWorldPulseOffline(sessionId, { bootstrap: true });
        }
        await setStep(sessionId, 'pulse', 'done');

        await updateWorldBootstrap(sessionId, {
            status: 'ready',
            step: null,
            finishedAt: new Date().toISOString(),
            ...(validation.ok
                ? {}
                : { error: `Memória: ${validation.issues.join('; ')}` }),
        });

        penaiPipelineLog(
            'WORLD_BOOTSTRAP',
            'mundo pronto',
            {
                regionSlug,
                factions: factionSlugs.length,
                memories: storedMemories,
                memoryOk: validation.ok,
            },
            ctx,
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await updateWorldBootstrap(sessionId, {
            status: 'failed',
            error: message,
        });
        penaiPipelineLog('WORLD_BOOTSTRAP', 'falhou', { error: message }, ctx);
        throw err;
    }
}
