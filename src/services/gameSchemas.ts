// services/gameSchemas.ts
import { z } from 'zod';

// Schema for PlayerRollRequest
export const PlayerRollRequestSchema = z.object({
    reason: z.string().describe("The reason for the roll (e.g., 'to persuade the guard', 'to dodge the fireball'). This will be displayed to the player."),
    dice: z.string().describe("The dice to roll, in standard notation (e.g., '1d20', '2d6')."),
    modifier: z.number().describe("The total modifier to add to the roll, calculated from character stats."),
    dc: z.number().optional().describe("The Difficulty Class of the check. This is crucial for the player to know what they need to beat. The DC MUST be calculated based on the desired chance of success for the player. Example for a d20 roll with a total +3 modifier (max roll of 23): Easy (60-70% success) -> DC ~8-10. Medium (40-50% success) -> DC ~12-14. Hard (15-20% success) -> DC ~18-20. Impossible (0% success) -> DC > 23."),
    rollType: z.enum(['check', 'save', 'attack', 'damage']).describe("The type of roll being made."),
    advantage: z.boolean().optional().describe("Whether the roll should be made with advantage."),
    disadvantage: z.boolean().optional().describe("Whether the roll should be made with disadvantage.")
});
export type PlayerRollRequest = z.infer<typeof PlayerRollRequestSchema>;


// Schema para uma única entrada no log da aventura.
const LogEntrySchema = z.object({
    type: z.enum(['narration', 'action', 'system', 'combat', 'insight', 'roll', 'image']),
    content: z.string(),
    rollResult: z.any().optional(),
}).describe("An entry in the game's adventure log.");

const CombatantSchema = z.object({
    id: z.string(),
    name: z.string(),
    hp: z.number().optional(),
    maxHp: z.number().optional(),
    initiative: z.number(),
});

const CombatStateSchema = z.object({
    isActive: z.boolean(),
    round: z.number(),
    turn: z.number(),
    combatants: z.array(CombatantSchema),
});

const LevelUpStateSchema = z.object({
    isPending: z.boolean(),
    newLevel: z.number(),
    choices: z.any(),
});

const ShopStateSchema = z.object({
    isOpen: z.boolean(),
    isHaggling: z.boolean(),
    name: z.string(),
    inventory: z.any(),
    sellPrices: z.record(z.string(), z.number()),
});

const LootOfferSchema = z.object({
    items: z.any(),
    currency: z.object({ gp: z.number() }),
});

const UseHitDiceRequestSchema = z.object({
    maxDice: z.number(),
    hitDieValue: z.number(),
});

export const GameMasterResponseSchema = z.object({
    logEntries: z.array(LogEntrySchema).optional().describe("New entries for the adventure log, including narration, system messages, or combat details."),
    actionOptions: z.array(z.union([z.string(), z.object({ text: z.string(), action: z.string() })])).optional().describe("A list of suggested actions for the player to take next."),
    updatedCharacter: z.any().optional().describe("An object containing ONLY the character fields that have been changed by the last action."),
    combatState: CombatStateSchema.optional().describe("The current state of combat, if any."),
    levelUpState: LevelUpStateSchema.optional().describe("The state of a pending level-up for the character."),
    playerRollRequest: PlayerRollRequestSchema.optional().describe("If the Game Master needs the player to roll dice for a skill check, saving throw, or attack, this object MUST be populated. This is the ONLY way to make the player roll dice."),
    shopState: ShopStateSchema.optional().describe("The state of a shop, if the player is currently in one."),
    lootOffer: LootOfferSchema.optional().describe("An offer of loot for the player to accept."),
    useHitDiceRequest: UseHitDiceRequestSchema.optional().describe("A request for the player to spend hit dice during a short rest."),
    imagePrompt: z.string().optional().describe("Occasionally, for an important scene, provide a detailed image prompt (in English) to generate an illustration. Example: 'Dungeons and Dragons 5e style: A tiefling man in a dark cloak watches you from across a tavern, while blurry dwarves dance in the foreground.'"),
    ambientSound: z.string().optional().describe("The ID of the ambient sound to play (e.g., 'forest_night', 'dungeon_i', 'none' for silence). This should be chosen from the available `ambient-sounds.json` file to match the current scene's atmosphere."),
    systemLog: z.string().optional().describe("Optional log where the GM explains decisions, e.g., DC choice, damage calculation, NPC rolls."),
    worldState: z.object({
        weather: z.string().optional(),
        timeOfDay: z.string().optional(),
        ongoingEvents: z.array(z.string()).optional(),
    }).optional().describe("Global world state variables to track persistent environment and events."),
    factionReputation: z.record(z.string(), z.number()).optional().describe("Tracks the player's reputation with different factions. Negative values indicate hostility."),
    conditions: z.array(z.object({
        name: z.string(),
        durationRounds: z.number().optional(),
        durationMinutes: z.number().optional(),
        concentration: z.boolean().optional(),
        savingThrowEachTurn: z.boolean().optional(),
    })).optional().describe("Ongoing conditions, effects, and status ailments on characters or NPCs."),
    modularRules: z.array(z.enum(['realism', 'cinematic'])).optional().describe("Active rule modules that modify gameplay mechanics or narrative style."),
}).describe("The Game Master's response, containing all updates to the game state.");

export type GameMasterResponse = z.infer<typeof GameMasterResponseSchema>;

// Schema para os dados que enviamos para a IA.
export const GameMasterFlowInputSchema = z.object({
  character: z.any().describe("The entire current character state object."),
  playerAction: z.string().describe("The action taken by the player. If this action is the result of a dice roll, it will be prefixed with 'O resultado da minha rolagem de...'"),
  gameLog: z.array(LogEntrySchema).describe("The last 15 entries of the game log."),
});

export type GameMasterFlowInput = z.infer<typeof GameMasterFlowInputSchema>;
