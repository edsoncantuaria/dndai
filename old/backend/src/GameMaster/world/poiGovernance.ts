import type { CanonicalPoi } from '../database/entities/CanonicalPoi.js';
import { PenaiDataSource } from '../database/data-source.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import { SessionEntityState } from '../database/entities/SessionEntityState.js';

/** Marca excedentes como phantom (nunca aparecem na sessão). */
export async function prunePhantomNpcsForPoi(
    sessionId: number,
    poi: CanonicalPoi,
    selectedEntityIds: string[],
): Promise<void> {
    const max = poi.maxImportantNpcs ?? 5;
    const keep = new Set(selectedEntityIds.slice(0, max));
    const repo = PenaiDataSource.getRepository(WorldEntity);
    const stateRepo = PenaiDataSource.getRepository(SessionEntityState);

    const npcs = await repo.find({ where: { poiId: poi.id, entityType: 'npc' } });
    for (const npc of npcs) {
        if (keep.has(npc.id)) continue;
        let state = await stateRepo.findOne({ where: { sessionId, worldEntityId: npc.id } });
        if (!state) {
            state = stateRepo.create({
                sessionId,
                worldEntityId: npc.id,
                appeared: false,
                sessionAlive: false,
                canAppear: false,
            });
        } else {
            state.canAppear = false;
            state.sessionAlive = false;
        }
        await stateRepo.save(state);
    }
}
