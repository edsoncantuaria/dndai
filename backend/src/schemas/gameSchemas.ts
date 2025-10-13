'use client';
import { z } from 'zod';

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
    content: z.string().describe("The text content of the log entry."),
    rollResult: z.any().optional().describe("Optional structured data for a dice roll."),
}).describe("An entry in the game's adventure log.");


const CombatantSchema = z.object({
    id: z.string(),
    name: z.string(),
    hp: z.object({ current: z.number(), max: z.number() }),
    ac: z.number().optional(),
    initiative: z.number().optional(),
    isPlayer: z.boolean().optional(),
    conditions: z.array(z.string()).optional(),
    distance: z.number().optional().describe("Distância em metros do jogador."),
});

export const CombatStateSchema = z.object({
    isActive: z.boolean().describe("Se o combate está ativo."),
    round: z.number().describe("Número do round atual."),
    turn: z.number().describe("Índice do combatente que está na vez de agir."),
    combatants: z.array(CombatantSchema).describe("Lista de todos os combatentes envolvidos."),
    log: z.array(z.string()).optional().describe("Log de eventos significativos do combate."),
}).describe("O estado completo do combate.");


const LevelUpStateSchema = z.object({
    isPending: z.boolean(),
    newLevel: z.number(),
    choices: z.any(),
});

// Itens do inventário com propriedades de uso/equipamento
export const InventoryItemSchema = z.object({
    name: z.string(),
    quantity: z.number().min(1),
    equipped: z.boolean().optional().describe("Se o item está atualmente equipado."),
});
export type InventoryItem = z.infer<typeof InventoryItemSchema>;

const QuestSchema = z.object({
    id: z.string(),
    title: z.string(),
    status: z.enum(['active', 'completed', 'failed']),
    objectives: z.array(z.string()),
});
const RelationshipSchema = z.object({
    npcId: z.string(),
    name: z.string(),
    status: z.enum(['hostile', 'unfriendly', 'neutral', 'friendly', 'ally']),
    affinity: z.number(),
    quests: z.array(QuestSchema).optional(),
});
const JournalEntrySchema = z.object({
    id: z.string(),
    name: z.string(),
    region: z.string(),
    summary: z.string(),
    looted: z.boolean(),
    subLocations: z.array(z.lazy(() => JournalEntrySchema)).optional(),
});

// Esquema otimizado do personagem enviado para a IA
const CharacterAISchema = z.object({
    name: z.string(),
    race: z.string(),
    characterClass: z.string(),
    level: z.number(),
    attributes: z.object({
        strength: z.number(),
        dexterity: z.number(),
        constitution: z.number(),
        intelligence: z.number(),
        wisdom: z.number(),
        charisma: z.number(),
        hp: z.number(),
        ac: z.number(),
        conditions: z.array(z.string()).optional(),
    }),
    proficiencies: z.array(z.string()),
    inventory: z.array(InventoryItemSchema),
    spells: z.array(z.string()),
    journal: z.array(JournalEntrySchema).optional(),
    relationships: z.array(RelationshipSchema).optional(),
    storySoFar: z.string().optional(),
    worldState: z.record(z.any()).optional(),
    factionReputation: z.record(z.number()).optional(),
});

export const GameMasterResponseSchema = z.object({
    logEntries: z.array(LogEntrySchema).optional().describe("New entries for the adventure log, including narration, system messages, or combat details."),
    actionOptions: z.array(z.union([z.string(), z.object({ text: z.string(), action: z.string(), skill: z.string().optional() })])).optional().describe("A list of suggested actions for the player to take next."),
    updatedCharacter: z.any().optional().describe("An object containing ONLY the character fields that have been changed by the last action. E.g., { attributes: { hp: 25 }, inventory: [...] }"),
    combatState: CombatStateSchema.optional().describe("The complete state of combat, if it is active."),
    playerRollRequest: PlayerRollRequestSchema.optional().describe("If the Game Master needs the player to roll dice, this object MUST be populated."),
    ambientSound: z.string().optional().describe("The ID of the ambient sound to play (e.g., 'forest_night')."),
    imagePrompt: z.string().optional().describe("A prompt for the image generation model to create a scene."),
    systemLog: z.string().optional().describe("Optional log for the GM to explain decisions (DC choice, NPC rolls, etc.)."),
}).describe("The Game Master's complete response to a player action.");

export type GameMasterResponse = z.infer<typeof GameMasterResponseSchema>;

// Schema para os dados que enviamos para a IA.
export const GameMasterFlowInputSchema = z.object({
  character: CharacterAISchema.describe("A summary of the current character state."),
  playerAction: z.string().describe("The action taken by the player."),
  gameLog: z.string().describe("A summary of the last few turns of game history."),
  combatState: CombatStateSchema.optional().describe("The current state of combat, if active.")
});

export type GameMasterFlowInput = z.infer<typeof GameMasterFlowInputSchema>;
