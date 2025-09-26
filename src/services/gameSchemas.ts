// services/gameSchemas.ts
import { z } from 'zod';

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
    shopState: ShopStateSchema.optional().describe("The state of a shop, if the player is currently in one."),
    lootOffer: LootOfferSchema.optional().describe("An offer of loot for the player to accept."),
    useHitDiceRequest: UseHitDiceRequestSchema.optional().describe("A request for the player to spend hit dice during a short rest."),
    imagePrompt: z.string().optional().describe("Occasionally, for an important scene, provide a detailed image prompt (in English) to generate an illustration. Example: 'Dungeons and Dragons 5e style: A tiefling man in a dark cloak watches you from across a tavern, while blurry dwarves dance in the foreground.'"),
}).describe("The Game Master's response, containing all updates to the game state.");

export type GameMasterResponse = z.infer<typeof GameMasterResponseSchema>;

// Schema para os dados que enviamos para a IA.
export const GameMasterFlowInputSchema = z.object({
  character: z.any().describe("The entire current character state object."),
  playerAction: z.string().describe("The action taken by the player."),
  gameLog: z.array(LogEntrySchema).describe("The last 15 entries of the game log."),
});

export type GameMasterFlowInput = z.infer<typeof GameMasterFlowInputSchema>;