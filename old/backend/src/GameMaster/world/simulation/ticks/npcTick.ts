import { advanceNpcRoutine } from '../../../npc/routine.js';
import { advanceGoapNpc } from '../../../npc/goap/planner.js';
import { PenaiDataSource } from '../../../database/data-source.js';
import { SessionEntityState } from '../../../database/entities/SessionEntityState.js';
import { WorldEntity } from '../../../database/entities/WorldEntity.js';
import { isGoapEligibleTier } from '../../../database/entities/types/EntityTier.js';

const MAX_MAJOR_ROUTINE_PER_PULSE = 3;

export async function runNpcTick(sessionId: number): Promise<string[]> {
    const pulses: string[] = [];
    let majorCount = 0;

    const routine = await advanceNpcRoutine(sessionId, {
        filterTier: tier => tier === 'INCIDENTAL' || tier === 'SECONDARY' || tier === 'CREATURE',
    });
    if (routine) pulses.push(routine);

    while (majorCount < MAX_MAJOR_ROUTINE_PER_PULSE) {
        const goap = await advanceGoapNpc(sessionId);
        if (!goap) break;
        pulses.push(goap);
        majorCount++;
    }

    return pulses;
}

export async function countEligibleNpcStates(sessionId: number): Promise<number> {
    const stateRepo = PenaiDataSource.getRepository(SessionEntityState);
    const entityRepo = PenaiDataSource.getRepository(WorldEntity);
    const states = await stateRepo.find({ where: { sessionId }, take: 50 });
    let count = 0;
    for (const st of states) {
        const entity = await entityRepo.findOne({ where: { id: st.worldEntityId } });
        if (entity && isGoapEligibleTier(entity.entityTier)) count++;
    }
    return count;
}
