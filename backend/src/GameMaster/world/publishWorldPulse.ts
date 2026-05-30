import { publishWsToUser } from '../transport/wsPubSub.js';
import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { tickWorldSimulation } from './simulation/engine.js';
import { getOrCreateRegionState } from './campaignState.js';
import { penaiPipelineLog, penaiPipelinePreview } from '../infra/pipelineLog.js';
import { saveWorldPulseSnapshot } from '../sessions/sessionUiState.js';
import { narrateWorldPulse } from './agents/worldPulseNarratorAgent.js';
import { loadRecentWorldMemoryLines } from '../memory/bootstrapMemory.js';
import { recordProvenanceFact } from '../memory/provenanceMemory.js';
import { appendWorldEvent } from '../events/store.js';
import { listDiscoveredFactions, resolveFactionDisplayName } from './factionDiscovery.js';
import { listActiveQuests } from './sessionQuests.js';
import { getRegionBySlug } from './travelCanon.js';
import { resolveInferenceApiKey } from '../../services/aiBillingService.js';
import { composeWorldPulsePresentation } from './pulseCopy.js';

/** Simula + narra pulso (só Gemini) + memória + WS. */
export async function publishWorldPulse(
    sessionId: number,
    opts?: { bootstrap?: boolean },
): Promise<string[]> {
    const ctx = { sessionId };
    const label = opts?.bootstrap ? 'bootstrap' : 'tick';
    penaiPipelineLog('WORLD_PULSE', `início (${label})`, undefined, ctx);

    const { pulses, projected } = await tickWorldSimulation(sessionId, { logTicks: true, ctx });

    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (!session) return [];

    const regionSlug = projected.currentRegionSlug ?? session.currentRegionSlug ?? null;
    let regionMood: { fear: number; prosperity: number; crime: number } | null = null;
    if (regionSlug) {
        const rs = await getOrCreateRegionState(sessionId, regionSlug);
        regionMood = { fear: rs.fear, prosperity: rs.prosperity, crime: rs.crime };
    }

    const regionMeta = regionSlug ? await getRegionBySlug(regionSlug) : null;
    const regionName = regionMeta?.displayName ?? regionSlug ?? 'região';

    const simulationLines = [
        ...pulses,
        ...projected.activeRumors.map(r => r.body || r.title),
        ...projected.recentEvents
            .filter(e => e.type === 'NPC_ROUTINE')
            .map(e => {
                const name = String(e.payload.displayName ?? 'Alguém');
                const desc = String(e.payload.description ?? '');
                return desc ? `${name}: ${desc}` : '';
            })
            .filter(Boolean),
    ];

    const discovered = await listDiscoveredFactions(sessionId);
    const factions = await Promise.all(
        discovered.slice(0, 6).map(async d => ({
            slug: d.factionSlug,
            displayName: await resolveFactionDisplayName(d.factionSlug),
        })),
    );

    const questsRaw = await listActiveQuests(sessionId);
    const activeQuests = await Promise.all(
        questsRaw.map(async q => {
            const slug = String((q.payload as { regionSlug?: string }).regionSlug ?? regionSlug ?? '');
            const meta = slug ? await getRegionBySlug(slug) : null;
            return {
                title: q.title,
                regionSlug: slug,
                regionName: meta?.displayName ?? slug,
                synopsis: String((q.payload as { synopsis?: string }).synopsis ?? ''),
                kind: String((q.payload as { kind?: string }).kind ?? 'local'),
            };
        }),
    );

    const userApiKey = (await resolveInferenceApiKey(session.userId)) ?? undefined;
    const recentMemoryLines = await loadRecentWorldMemoryLines(sessionId, 5);

    const narrated = await narrateWorldPulse({
        sessionId,
        userId: session.userId,
        regionSlug,
        regionName,
        regionMood,
        simulationLines,
        rumorTitles: projected.activeRumors.map(r => r.title),
        rumorBodies: projected.activeRumors.map(r => r.body),
        factions,
        activeQuests,
        recentMemoryLines,
        userApiKey,
        ctx,
    });

    const { presentation, source } = narrated;
    const eventsForClient = [presentation.headline, ...presentation.beats];

    const simFacts = [...pulses, presentation.headline].filter(Boolean).slice(0, 3);
    for (const line of simFacts) {
        await recordProvenanceFact({
            sessionId,
            text: line,
            regionSlug,
            sourceEventType: 'WORLD_PULSE_RENDERED',
            ctx,
        });
    }

    await appendWorldEvent({
        type: 'WORLD_PULSE_RENDERED',
        sessionId,
        payload: {
            headline: presentation.headline,
            source,
            regionSlug,
            beatCount: presentation.beats.length,
        },
    });

    penaiPipelinePreview(
        'WORLD_PULSE',
        `preview (${label})`,
        [
            { label: 'fonte', preview: source },
            { label: 'região', preview: regionSlug ?? '—' },
            { label: 'headline', preview: presentation.headline },
            ...presentation.beats.map((b, i) => ({ label: `beat-${i + 1}`, preview: b })),
        ],
        ctx,
    );

    await publishWsToUser(session.userId, {
        type: 'worldPulse',
        sessionId,
        locale: 'pt-BR',
        events: eventsForClient,
        headline: presentation.headline,
        beats: presentation.beats,
        mood: presentation.mood,
        worldState: {
            currentRegionSlug: projected.currentRegionSlug,
            rumors: projected.activeRumors,
        },
    });

    await saveWorldPulseSnapshot(sessionId, {
        headline: presentation.headline,
        events: eventsForClient,
    });

    penaiPipelineLog('WORLD_PULSE', 'WS worldPulse enviado', { events: eventsForClient.length, source }, ctx);
    return eventsForClient;
}

/** Pulso determinístico — sem Gemini (fallback de bootstrap). */
export async function publishWorldPulseOffline(
    sessionId: number,
    opts?: { bootstrap?: boolean },
): Promise<string[]> {
    const ctx = { sessionId };
    const label = opts?.bootstrap ? 'bootstrap-offline' : 'tick-offline';
    penaiPipelineLog('WORLD_PULSE', `início (${label})`, undefined, ctx);

    const { pulses, projected } = await tickWorldSimulation(sessionId, { logTicks: true, ctx });

    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (!session) return [];

    const regionSlug = projected.currentRegionSlug ?? session.currentRegionSlug ?? null;
    let regionMood: { fear: number; prosperity: number; crime: number } | null = null;
    if (regionSlug) {
        const rs = await getOrCreateRegionState(sessionId, regionSlug);
        regionMood = { fear: rs.fear, prosperity: rs.prosperity, crime: rs.crime };
    }

    const simulationLines = [
        ...pulses,
        ...projected.activeRumors.map(r => r.body || r.title),
    ];

    const composed =
        composeWorldPulsePresentation({
            regionSlug,
            regionMood,
            simulationLines,
            rumorTitles: projected.activeRumors.map(r => r.title),
            rumorBodies: projected.activeRumors.map(r => r.body),
        }) ?? {
            headline: `O mundo de ${regionSlug ?? 'Aurathis'} desperta em silêncio cauteloso.`,
            beats: simulationLines.slice(0, 3).map(line => (line.endsWith('.') ? line : `${line}.`)),
            mood: 'calm' as const,
        };

    const source = 'offline_seed';
    const eventsForClient = [composed.headline, ...composed.beats];

    await appendWorldEvent({
        type: 'WORLD_PULSE_RENDERED',
        sessionId,
        payload: {
            headline: composed.headline,
            source,
            regionSlug,
            beatCount: composed.beats.length,
        },
    });

    await publishWsToUser(session.userId, {
        type: 'worldPulse',
        sessionId,
        locale: 'pt-BR',
        events: eventsForClient,
        headline: composed.headline,
        beats: composed.beats,
        mood: composed.mood,
        worldState: {
            currentRegionSlug: projected.currentRegionSlug,
            rumors: projected.activeRumors,
        },
    });

    await saveWorldPulseSnapshot(sessionId, {
        headline: composed.headline,
        events: eventsForClient,
    });

    penaiPipelineLog('WORLD_PULSE', 'WS worldPulse offline', { events: eventsForClient.length, source }, ctx);
    return eventsForClient;
}
