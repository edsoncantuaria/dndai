import { PenaiDataSource } from '../database/data-source.js';
import { SessionEntityState } from '../database/entities/SessionEntityState.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import { appendWorldEvent } from '../events/store.js';
import { parseNpcPersonality } from '../schemas/npcPersonality.js';

type NpcOverlay = {
    currentGoalId?: string;
    goalStatus?: 'idle' | 'active' | 'complete';
};

export async function advanceNpcRoutine(sessionId: number): Promise<string | null> {
    const stateRepo = PenaiDataSource.getRepository(SessionEntityState);
    const states = await stateRepo.find({ where: { sessionId }, take: 12 });
    if (!states.length) return null;

    const entityRepo = PenaiDataSource.getRepository(WorldEntity);
    const candidates: Array<{ entity: WorldEntity; state: SessionEntityState }> = [];

    for (const st of states) {
        const entity = await entityRepo.findOne({ where: { id: st.worldEntityId } });
        if (!entity || entity.entityType === 'hero' || entity.entityType === 'faction') continue;
        candidates.push({ entity, state: st });
    }
    if (!candidates.length) return null;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const { entity, state } = pick;
    const personality = parseNpcPersonality(entity.personality);
    const overlay = (state.sessionOverlay ?? {}) as NpcOverlay;

    const goals = personality.goals.filter(g => g.status !== 'completed');
    const goal = goals.find(g => g.id === overlay.currentGoalId) ?? goals[0];
    if (!goal) return null;

    const nextStatus: NpcOverlay['goalStatus'] =
        overlay.goalStatus === 'active' ? 'complete' : 'active';

    state.sessionOverlay = {
        ...overlay,
        currentGoalId: goal.id,
        goalStatus: nextStatus,
    };
    await stateRepo.save(state);

    await appendWorldEvent({
        type: 'NPC_ROUTINE',
        sessionId,
        actorEntityId: entity.id,
        payload: {
            goalId: goal.id,
            description: goal.description,
            status: nextStatus,
            displayName: entity.displayName,
        },
    });

    const verb = nextStatus === 'active' ? 'inicia' : 'conclui';
    return `${entity.displayName} ${verb}: ${goal.description}`;
}
