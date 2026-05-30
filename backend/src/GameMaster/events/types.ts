/** Catálogo de tipos de evento append-only (world_events). */
export const WORLD_EVENT_TYPES = [
    'TRAVEL_STARTED',
    'TRAVEL_COMPLETED',
    'NARRATION_COMPLETED',
    'COMBAT_NARRATION_DEFERRED',
    'RUMOR_SPREAD',
    'FACTION_TICK',
    'FACTION_REPUTATION',
    'RELATION_CHANGED',
    'NPC_ROUTINE',
    'NPC_GOAL_SELECTED',
    'NPC_ACTION_EXECUTED',
    'ENTITY_SPAWNED',
    'ENTITY_REUSED',
    'ENTITY_RETIRED',
    'ENTITY_PROMOTED',
    'CANON_APPROVED',
    'CANON_PROPOSED',
    'PRICE_CHANGED',
    'SUPPLY_SHORTAGE',
    'TURN_NARRATED',
    'CREATURE_SLAIN',
    'REGION_MOOD_CHANGED',
    'QUEST_STARTED',
    'QUEST_STAGE_ADVANCED',
    'QUEST_FAILED',
    'WITNESSED',
    'KNOWLEDGE_SPREAD',
    'ENTITY_ARCHIVED',
    'MICRO_WORLD_TICK',
    'FACT_RECORDED',
    'TIME_ADVANCED',
    'WORLD_PULSE_RENDERED',
    'RUMOR_FADED',
    'POLITICS_STATE_CHANGED',
] as const;

export type WorldEventType = (typeof WORLD_EVENT_TYPES)[number];

/** Estado não replayável via world_events (snapshots separados). */
export const NON_REPLAYABLE_STATE = [
    'session_combat_encounters',
    'session_combatants',
    'hero_inventory_items',
    'redis_roll_store',
] as const;

export type ProjectorFn = (event: {
    type: string;
    sessionId: number;
    payload: Record<string, unknown>;
    actorEntityId?: string | null;
}) => Promise<void>;
