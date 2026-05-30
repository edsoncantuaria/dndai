import { PenaiDataSource } from '../../database/data-source.js';
import { SessionEntityState } from '../../database/entities/SessionEntityState.js';
import { WorldEntity } from '../../database/entities/WorldEntity.js';
import { appendWorldEvent } from '../../events/store.js';
import { parseNpcPersonality } from '../../schemas/npcPersonality.js';
import { DEFAULT_GOAP_ACTIONS, extractGoapGoals } from './goals.js';
import { isGoapEligibleTier } from '../../database/entities/types/EntityTier.js';

type GoapOverlay = {
    worldState?: string[];
    currentPlan?: string[];
};

function pickPlan(goalId: string): string[] {
    const action = DEFAULT_GOAP_ACTIONS.find(a => a.id === 'patrol') ?? DEFAULT_GOAP_ACTIONS[0];
    return [action.id, goalId];
}

/** GOAP simplificado (utility-based) para NPCs com planner=goap. */
export async function advanceGoapNpc(sessionId: number): Promise<string | null> {
    const stateRepo = PenaiDataSource.getRepository(SessionEntityState);
    const entityRepo = PenaiDataSource.getRepository(WorldEntity);
    const states = await stateRepo.find({ where: { sessionId }, take: 20 });

    for (const st of states) {
        const entity = await entityRepo.findOne({ where: { id: st.worldEntityId } });
        if (!entity || entity.entityType !== 'npc') continue;
        if (!isGoapEligibleTier(entity.entityTier)) continue;

        const personality = parseNpcPersonality(entity.personality);
        if (personality.planner !== 'goap') continue;

        const goals = extractGoapGoals(personality);
        const goal = goals[0];
        if (!goal) return null;

        const overlay = (st.sessionOverlay ?? {}) as GoapOverlay;
        const plan = overlay.currentPlan ?? pickPlan(goal.id);
        const actionId = plan[0] ?? 'patrol';
        const action = DEFAULT_GOAP_ACTIONS.find(a => a.id === actionId);

        st.sessionOverlay = {
            ...overlay,
            currentPlan: plan.slice(1),
            worldState: [...(overlay.worldState ?? []), action?.effects[0] ?? 'acted'].slice(-8),
        };
        await stateRepo.save(st);

        await appendWorldEvent({
            type: 'NPC_GOAL_SELECTED',
            sessionId,
            actorEntityId: entity.id,
            payload: { goalId: goal.id, description: goal.description },
        });
        await appendWorldEvent({
            type: 'NPC_ACTION_EXECUTED',
            sessionId,
            actorEntityId: entity.id,
            payload: { actionId, actionName: action?.name ?? actionId, goalId: goal.id },
        });

        return `${entity.displayName} executa ${action?.name ?? actionId}: ${goal.description}`;
    }

    return null;
}
