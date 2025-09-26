import { z } from 'zod';

// Schema for the game master to request a dice roll from the player
const PlayerRollRequestSchema = z.object({
    reason: z.string().describe("The reason for the roll, to be displayed to the player. E.g., 'Teste de Força (Atletismo) para escalar a parede.'"),
    dice: z.string().describe("The dice to roll, in standard notation (e.g., '1d20', '2d6')."),
    modifier: z.number().describe("The total modifier to add to the roll."),
    dc: z.number().optional().describe("The difficulty class to beat, if it's not a secret."),
    rollType: z.enum(['check', 'save', 'attack', 'damage']).describe("The type of roll being made."),
});

// Schema for a single entry in the adventure log.
const LogEntrySchema = z.object({
    type: z.enum(['narration', 'action', 'system', 'combat', 'insight', 'roll', 'image']),
    content: z.string().describe("The descriptive text of the narration or the content of the message."),
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
    choices: z.any().describe("Details of available level up choices, like attribute boosts, new skills, or spells."),
});

const ShopStateSchema = z.object({
    isOpen: z.boolean(),
    isHaggling: z.boolean(),
    name: z.string(),
    inventory: z.any().describe("Array of items available in the shop."),
    sellPrices: z.record(z.string(), z.number()).describe("An object mapping item IDs to their sell prices."),
});

const LootOfferSchema = z.object({
    items: z.any().describe("Array of items offered as loot."),
    currency: z.object({ gp: z.number() }),
});

const UseHitDiceRequestSchema = z.object({
    maxDice: z.number().describe("The maximum number of Hit Dice the player can spend."),
    hitDieValue: z.number().describe("The character's class Hit Die value (e.g., 10 for a d10)."),
});

export const GameMasterResponseSchema = z.object({
    logEntries: z.array(LogEntrySchema).optional().describe("New entries for the adventure log, including narration, system messages, or combat details."),
    actionOptions: z.array(z.union([z.string(), z.object({ text: z.string(), action: z.string() })])).optional().describe("A list of suggested actions for the player to take next."),
    updatedCharacter: z.any().optional().describe("An object containing ONLY the character fields that have changed due to the last action. Examples: hp, xp, inventory, journal, relationships."),
    combatState: CombatStateSchema.optional().describe("The current state of combat, if any."),
    levelUpState: LevelUpStateSchema.optional().describe("The state of a pending level-up for the character."),
    shopState: ShopStateSchema.optional().describe("The state of a shop, if the player is currently in one."),
    lootOffer: LootOfferSchema.optional().describe("A loot offer for the player to accept."),
    useHitDiceRequest: UseHitDiceRequestSchema.optional().describe("A request for the player to spend Hit Dice during a short rest."),
    playerRollRequest: PlayerRollRequestSchema.optional().describe("A request for the player to make a dice roll. When this is sent, the game will pause and wait for the player's roll result."),
    imagePrompt: z.string().optional().describe("Occasionally, for an important scene, provide a detailed image prompt (in English) to generate an illustration. Ex: 'Dungeons and Dragons 5e style: A tiefling man in a dark cloak watches you from across a tavern, while blurry dwarves dance in the foreground.'"),
    ambientSound: z.string().optional().describe("The ID of a new ambient soundtrack to play, based on a change in scene or mood (e.g., 'tavern-lively', 'dungeon-eerie', 'forest-day')."),
}).describe("The Game Master's response, containing all updates to the game state.");

export type GameMasterResponse = z.infer<typeof GameMasterResponseSchema>;

// Schema for the data we send to the AI.
export const GameMasterFlowInputSchema = z.object({
  character: z.any().describe("The complete state object of the current character."),
  playerAction: z.string().describe("The action taken by the player. If it follows a dice roll request, it will be in the format 'I rolled a [result] on my [dice] for [reason].'"),
  gameLog: z.array(LogEntrySchema).describe("The last 15 entries from the game log for context."),
});

export type GameMasterFlowInput = z.infer<typeof GameMasterFlowInputSchema>;
