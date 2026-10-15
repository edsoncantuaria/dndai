import { PenaiDataSource } from '../database/data-source.js';
import { SessionEntityState } from '../database/entities/SessionEntityState.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import { appendWorldEvent } from '../events/store.js';
import type { EntityTier } from '../database/entities/types/EntityTier.js';
import { loadSessionGameClock } from './gameClock.js';

const DEFAULT_IDLE_DAYS = 90;
const WALL_CLOCK_FALLBACK_MS = DEFAULT_IDLE_DAYS * 24 * 60 * 60 * 1000;

export type CampaignGcResult = {
    archived: number;
    skipped: number;
};

function isIdleByGameDay(currentDay: number, lastSeenGameDay: number, idleDays: number): boolean {
    return currentDay - lastSeenGameDay >= idleDays;
}

/** Arquiva NPCs INCIDENTAl ociosos na campanha — não deleta WorldEntity global. */
export async function runCampaignGc(
    sessionId: number,
    opts?: { idleDays?: number },
): Promise<CampaignGcResult> {
    const idleDays = opts?.idleDays ?? DEFAULT_IDLE_DAYS;
    const wallCutoff = new Date(Date.now() - WALL_CLOCK_FALLBACK_MS);
    const currentDay = (await loadSessionGameClock(sessionId)).day;

    const stateRepo = PenaiDataSource.getRepository(SessionEntityState);
    const entityRepo = PenaiDataSource.getRepository(WorldEntity);
    const states = await stateRepo.find({ where: { sessionId }, take: 200 });

    let archived = 0;
    let skipped = 0;

    for (const st of states) {
        const entity = await entityRepo.findOne({ where: { id: st.worldEntityId } });
        if (!entity) {
            skipped++;
            continue;
        }
        if (entity.entityTier !== 'INCIDENTAL') {
            skipped++;
            continue;
        }
        if (st.appeared) {
            skipped++;
            continue;
        }
        if (st.canAppear === false) {
            skipped++;
            continue;
        }

        let idleEnough = false;
        if (st.lastSeenGameDay != null) {
            idleEnough = isIdleByGameDay(currentDay, st.lastSeenGameDay, idleDays);
        } else {
            const lastSeen = st.lastSeenAt ?? entity.updatedAt;
            idleEnough = lastSeen <= wallCutoff;
        }
        if (!idleEnough) {
            skipped++;
            continue;
        }

        st.canAppear = false;
        st.sessionAlive = false;
        await stateRepo.save(st);

        await appendWorldEvent({
            type: 'ENTITY_ARCHIVED',
            sessionId,
            actorEntityId: entity.id,
            payload: { entityId: entity.id, displayName: entity.displayName, reason: 'idle_gc' },
        });
        archived++;
    }

    return { archived, skipped };
}

export function defaultEntityTierForType(entityType: WorldEntity['entityType']): EntityTier {
    if (entityType === 'hero') return 'HERO';
    if (entityType === 'monster') return 'CREATURE';
    if (entityType === 'npc') return 'INCIDENTAL';
    return 'SECONDARY';
}
