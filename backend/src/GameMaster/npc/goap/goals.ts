import type { NpcPersonality } from '../../schemas/npcPersonality.js';

export type GoapAction = {
    id: string;
    name: string;
    preconditions: string[];
    effects: string[];
    cost: number;
};

export type GoapGoal = {
    id: string;
    description: string;
    priority: number;
};

export const DEFAULT_GOAP_ACTIONS: GoapAction[] = [
    { id: 'patrol', name: 'Patrulhar', preconditions: ['idle'], effects: ['patrolling'], cost: 1 },
    { id: 'trade', name: 'Negociar', preconditions: ['near_market'], effects: ['traded'], cost: 2 },
    { id: 'warn', name: 'Alertar', preconditions: ['knows_threat'], effects: ['alerted_party'], cost: 1 },
    { id: 'flee', name: 'Fugir', preconditions: ['in_danger'], effects: ['safe'], cost: 3 },
];

export function extractGoapGoals(personality: NpcPersonality): GoapGoal[] {
    return personality.goals
        .filter(g => g.status === 'active')
        .map(g => ({
            id: g.id,
            description: g.description,
            priority: g.priority === 'high' ? 3 : g.priority === 'medium' ? 2 : 1,
        }))
        .sort((a, b) => b.priority - a.priority);
}
