// src/services/gameSchemas.ts
import { z } from "zod";

// Schemas Zod explícitos para o personagem e suas propriedades
const AttributesSchema = z.object({
    strength: z.number(),
    dexterity: z.number(),
    constitution: z.number(),
    intelligence: z.number(),
    wisdom: z.number(),
    charisma: z.number(),
});

const HPSchema = z.object({
    current: z.number(),
    max: z.number(),
    temp: z.number(),
});

// Este é o schema de entrada para o fluxo da IA, agora "achatado"
export const GameMasterFlowInputSchema = z.object({
  // Atributos principais do personagem
  name: z.string(),
  level: z.number(),
  xp: z.number(),
  xpToNextLevel: z.number(),
  characterClass: z.string(),
  race: z.string(),
  background: z.string(),
  alignment: z.string(),
  hp: HPSchema,
  attributes: AttributesSchema,
  modifiers: AttributesSchema,
  
  // Listas simplificadas para contexto
  inventory: z.array(z.string()).describe("Uma lista dos nomes dos itens que o personagem está carregando."),
  proficiencies: z.array(z.string()).describe("Nomes das perícias e proficiências, como 'Stealth' ou 'Light Armor'."),
  spells: z.array(z.string()).describe("Nomes das magias que o personagem conhece."),
  
  // Contexto da Ação e do Jogo
  playerAction: z.string(),
  gameLog: z.array(z.object({
    type: z.string(),
    content: z.string(),
  })).describe("As últimas entradas do log do jogo para dar contexto."),
});
export type GameMasterFlowInput = z.infer<typeof GameMasterFlowInputSchema>;


const LogEntrySchema = z.object({
  type: z.enum(['narration', 'action', 'system', 'combat', 'insight', 'roll']),
  content: z.string(),
  rollResult: z.optional(z.object({
    description: z.string(),
    dice: z.string(),
    modifier: z.number(),
    total: z.number(),
    rolls: z.array(z.number()),
    success: z.optional(z.boolean()),
    dc: z.optional(z.number()),
    rollType: z.enum(['check', 'save', 'attack', 'damage']),
    advantage: z.optional(z.boolean()),
    disadvantage: z.optional(z.boolean()),
  })),
});

const CombatantSchema = z.object({
    id: z.string(),
    name: z.string(),
    hp: z.optional(z.number()),
    maxHp: z.optional(z.number()),
    initiative: z.number(),
});

const CombatStateSchema = z.object({
    isActive: z.boolean(),
    round: z.number(),
    turn: z.number(),
    combatants: z.array(CombatantSchema),
});

const UpdatedCharacterSchema = z.object({
    xp: z.number().optional().describe("A nova quantidade total de XP do personagem."),
    hp: HPSchema.optional().describe("O estado atualizado de HP do personagem (current, max, temp)."),
    conditions: z.array(z.any()).optional().describe("A lista completa de condições que afetam o personagem."),
    inventory: z.array(z.any()).optional().describe("A lista completa e atualizada de todos os itens no inventário do personagem."),
    currency: z.object({ gp: z.number(), sp: z.number(), cp: z.number() }).optional().describe("A nova quantidade de moedas (gp, sp, cp) do personagem."),
    storySoFar: z.string().optional().describe("Um resumo atualizado da história do personagem até agora, em primeira pessoa.")
}).describe("Um objeto contendo SOMENTE os campos do personagem que foram alterados.");

// This is the schema for the *output* from the Gemini model
export const GameMasterResponseSchema = z.object({
  logEntries: z.array(LogEntrySchema).describe("Novas entradas para o log da história, descrevendo o que acontece."),
  actionOptions: z.array(z.string()).describe("Novas opções de escolha para o jogador, que conduzem a história."),
  updatedCharacter: UpdatedCharacterSchema.optional(),
  combatState: z.optional(CombatStateSchema).describe("O estado atualizado do combate, se estiver ativo."),
  levelUpState: z.optional(z.any()).describe("Estado para o processo de level up, se ativado."),
  shopState: z.optional(z.any()).describe("Estado da loja, se o jogador estiver em uma."),
  lootOffer: z.optional(z.any()).describe("Itens oferecidos ao jogador para saquear."),
  useHitDiceRequest: z.optional(z.any()).describe("Requisição para o jogador usar dados de vida durante um descanso."),
});
export type GameMasterResponse = z.infer<typeof GameMasterResponseSchema>;