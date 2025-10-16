// backend/src/schemas/gameSchemas.ts
import { z } from 'zod';
import { CreateHomebrewSchema } from './validationSchemas.js';

// Schema for PlayerRollRequest
export const PlayerRollRequestSchema = z.object({
    reason: z.string().describe("The reason for the roll (e.g., 'to persuade the guard', 'to dodge the fireball'). This will be displayed to the player."),
    dice: z.string().describe("The dice to roll, in standard notation (e.g., '1d20', '2d6')."),
    modifier: z.number().describe("The total modifier to add to the roll, calculated from character stats."),
    dc: z.number().optional().describe("The Difficulty Class of the check. This is crucial for the player to know what they need to beat."),
    rollType: z.enum(['check', 'save', 'attack', 'damage', 'initiative']).describe("The type of roll being made."),
    advantage: z.boolean().optional().describe("Whether the roll should be made with advantage."),
    disadvantage: z.boolean().optional().describe("Whether the roll should be made with disadvantage.")
}).refine(data => !(data.advantage && data.disadvantage), {
        message: "Uma rolagem não pode ter vantagem e desvantagem ao mesmo tempo",
      });
export type PlayerRollRequest = z.infer<typeof PlayerRollRequestSchema>;


// Schema para uma única entrada no log da aventura.
const LogEntrySchema = z.object({
    type: z.enum(['narration', 'action', 'system', 'combat', 'insight', 'roll', 'image']),
    content: z.union([
      z.string(),
      z.object({
        text: z.string().optional(),
        imageUrl: z.string().optional(),
        status: z.enum(['generating', 'failed', 'done']).optional(),
        prompt: z.string().optional(),
        meta: z.record(z.any()).optional(),
      })
    ]).describe("The content of the log entry, which can be a simple string or a structured object for special types like 'image'."),
    rollResult: z.any().optional().describe("Optional structured data for a dice roll."),
}).describe("An entry in the game's adventure log.");


export const FullCombatantSchema = z.object({
    id: z.string().describe("Unique ID for the combatant (e.g., 'player', 'goblin-1')."),
    name: z.string().describe("Display name of the combatant."),
    hp: z.object({ 
        current: z.number().describe("Current hit points."), 
        max: z.number().describe("Maximum hit points.") 
    }).describe("Combatant's hit points."),
    ac: z.number().optional().describe("Armor Class of the combatant."),
    initiative: z.number().optional().describe("The combatant's total initiative score."),
    initiativeRoll: z.number().optional().describe("The raw d20 roll for initiative."),
    isPlayer: z.boolean().optional().default(false).describe("Whether this combatant is the player character."),
    conditions: z.array(z.string()).optional().default([]).describe("List of active conditions (e.g., 'Grappled', 'Poisoned')."),
    distance: z.number().optional().describe("Distance in meters from the player character."),
    hasMoved: z.boolean().default(false).describe("If the combatant has used their movement this turn."),
    hasActed: z.boolean().default(false).describe("If the combatant has used their Action this turn."),
    actionPoints: z.number().default(1).describe("Number of main actions available (usually 1)."),
    bonusActionPoints: z.number().default(1).describe("Number of bonus actions available (usually 1)."),
    isDead: z.boolean().default(false).describe("If the combatant is dead or unconscious."),
    readyAction: z.string().optional().describe("A description of the action readied for a trigger."),
    readyWeapon: z.string().optional().describe("Weapon to be used with a readied action."),
    readySpell: z.string().optional().describe("Spell to be used with a readied action."),
    tempModifiers: z.any().optional().describe("Temporary modifiers from spells or effects."),
    rollHistory: z.array(z.object({
        type: z.enum(['initiative', 'attack', 'damage', 'save', 'check']),
        roll: z.number(),
        total: z.number(),
        modifier: z.number(),
        description: z.string(),
    })).optional().default([]).describe("A log of all rolls made by or against this combatant."),
});

export const CombatStateSchema = z.object({
    isActive: z.boolean().describe("If combat is currently active. MUST be true if enemies are present and not defeated."),
    round: z.number().describe("The current combat round number."),
    turn: z.number().describe("The index in the initiativeOrder array indicating whose turn it is."),
    combatants: z.array(FullCombatantSchema).describe("List of all combatants involved in the encounter."),
    initiativeOrder: z.array(z.string()).optional().describe("Array of combatant IDs, sorted from highest to lowest initiative."),
    log: z.array(z.union([z.string(), LogEntrySchema])).optional().default([]).describe("Log of significant events in the combat."),
}).describe("The complete state of the combat encounter.");


export const LevelUpStateSchema = z.object({
    isPending: z.boolean(),
    newLevel: z.number(),
    choices: z.any(),
}).nullable().optional();

export const ShopStateSchema = z.object({
    isOpen: z.boolean(),
    isHaggling: z.boolean(),
    name: z.string(),
    inventory: z.any(),
    sellPrices: z.any(),
}).nullable().optional();

export const LootOfferSchema = z.object({
    items: z.any(),
    currency: z.object({ gp: z.number() }),
}).nullable().optional();

export const UseHitDiceRequestSchema = z.object({
    maxDice: z.number(),
    hitDieValue: z.number(),
}).nullable().optional();


// Itens do inventário com propriedades de uso/equipamento
export const InventoryItemSchema = z.object({
    name: z.string(),
    quantity: z.number().min(1),
    equipped: z.boolean().optional().describe("Se o item está atualmente equipado."),
});
export type InventoryItem = z.infer<typeof InventoryItemSchema>;

const JournalEntrySchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    region: z.string(),
    summary: z.string(),
    looted: z.boolean(),
});

const QuestSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    status: z.enum(['active', 'completed', 'failed']),
    objectives: z.array(z.string()),
});

const RelationshipSchema = z.object({
    npcId: z.string(),
    name: z.string(),
    description: z.string().optional(),
    status: z.enum(['hostile', 'unfriendly', 'neutral', 'friendly', 'ally']),
    affinity: z.number(),
    quests: z.array(QuestSchema).optional(),
});

const WorldStateSchema = z.object({
    timeOfDay: z.enum(['Manhã', 'Tarde', 'Noite']).describe("Current time of day."),
    weather: z.enum(['Ensolarado', 'Nublado', 'Chuva', 'Tempestade', 'Neve', 'Nevoeiro']).describe("Current weather conditions."),
    currentRegion: z.string().optional().describe("The current region or general location of the player."),
}).describe("Describes the overall state of the world.");


export const GameMasterResponseSchema = z.object({
    logEntries: z.array(LogEntrySchema).optional().describe("New entries for the adventure log, including narration, system messages, or combat details."),
    actionOptions: z.array(z.union([z.string(), z.object({ text: z.string(), action: z.string(), skill: z.string().optional() })])).optional().describe("A list of suggested actions for the player to take next."),
    updatedCharacter: z.any().optional().describe("An object containing ONLY the character fields that have been changed by the last action. E.g., { attributes: { hp: 25 }, inventory: [...] }"),
    combatState: CombatStateSchema.nullable().optional().describe("The complete state of combat, if it is active."),
    playerRollRequest: PlayerRollRequestSchema.nullable().optional().describe("If the Game Master needs the player to roll dice, this object MUST be populated."),
    ambientSound: z.string().optional().describe("The ID of the ambient sound to play (e.g., 'forest_night')."),
    systemLog: z.string().optional().nullable().describe("Optional log for the GM to explain decisions (DC choice, NPC rolls, etc.)."),
    levelUpState: LevelUpStateSchema,
    shopState: ShopStateSchema,
    lootOffer: LootOfferSchema,
    useHitDiceRequest: UseHitDiceRequestSchema,
    worldState: WorldStateSchema.nullable().optional().describe("Updates to the global world state, like time and weather. This MUST always be returned."),
    newHomebrewContent: z.array(CreateHomebrewSchema).nullable().optional().describe("A list of new homebrew content (monsters, items, etc.) created by the GM that should be persisted."),
}).describe("The Game Master's complete response to a player action.");

export type GameMasterResponse = z.infer<typeof GameMasterResponseSchema>;

// Esquema para os dados que enviamos para a IA.
export const GameMasterFlowInputSchema = z.object({
  character: z.any().describe("A summary of the current character state."),
  playerAction: z.string().describe("The action taken by the player."),
  gameLog: z.string().describe("A JSON string representing a summary of the last few turns of game history."),
  combatState: CombatStateSchema.optional().describe("The current state of combat, if active."),
  installedHomebrew: z.array(z.any()).optional().describe("An array of homebrew content objects (races, classes, monsters, etc.) that are active in this session."),
});

export type GameMasterFlowInput = z.infer<typeof GameMasterFlowInputSchema>;
