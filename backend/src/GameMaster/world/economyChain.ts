import type { ProjectorFn } from '../events/types.js';
import { appendWorldEvent } from '../events/store.js';
import { getOrCreateRegionState } from './campaignState.js';
import { listPresentEntityIds, spreadKnowledgeFromRumor } from './knowledgeGraph.js';
import { recordProvenanceFact } from '../memory/provenanceMemory.js';
import { createHash } from 'crypto';

type EventCtx = Parameters<ProjectorFn>[0];

/** SUPPLY_SHORTAGE → mood + rumor + conhecimento + fato ([FATO]). */
export async function runSupplyShortageChain(event: EventCtx): Promise<void> {
    const regionSlug = String(event.payload.regionSlug ?? '');
    const resource = String(event.payload.resource ?? 'grain');
    if (!regionSlug) return;

    const row = await getOrCreateRegionState(event.sessionId, regionSlug);
    const fear = Math.min(100, row.fear + 2);
    await appendWorldEvent({
        type: 'REGION_MOOD_CHANGED',
        sessionId: event.sessionId,
        payload: {
            regionSlug,
            fear,
            prosperity: row.prosperity,
            crime: row.crime,
            reason: 'supply_shortage',
        },
    });

    const body =
        resource === 'grain'
            ? 'Escassez de grãos: mercados vazios e preços disparam nas feiras.'
            : `Escassez de ${resource} afeta a região.`;
    const title = `Escassez em ${regionSlug.replace(/-/g, ' ')}`;

    await appendWorldEvent({
        type: 'RUMOR_SPREAD',
        sessionId: event.sessionId,
        payload: { title, body, regionSlug, source: 'supply_shortage' },
    });

    const factKey = `supply_${event.sessionId}_${createHash('sha256').update(body).digest('hex').slice(0, 10)}`;
    const holders = await listPresentEntityIds(event.sessionId, 3);
    for (const holderEntityId of holders.slice(0, 2)) {
        await spreadKnowledgeFromRumor(event.sessionId, holderEntityId, factKey, body);
    }

    await recordProvenanceFact({
        sessionId: event.sessionId,
        text: body,
        regionSlug,
        sourceEventType: 'SUPPLY_SHORTAGE',
    });
}
