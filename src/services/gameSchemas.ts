// src/services/gameSchemas.ts
import { z } from "zod";
import type { Character, LogEntry } from "@/types";

export const GameMasterFlowInputSchema = z.object({
  character: z.custom<Character>(),
  playerAction: z.string(),
  gameLog: z.array(z.custom<LogEntry>()),
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

// This is the schema for the *output* from the Gemini model
export const GameMasterResponseSchema = z.object({
  logEntries: z.array(LogEntrySchema).describe("Novas entradas para o log da história, descrevendo o que acontece."),
  actionOptions: z.array(z.string()).describe("Novas opções de escolha para o jogador, que conduzem a história."),
  updatedCharacter: z.any().optional().describe("Um objeto contendo SOMENTE os campos do personagem que foram alterados (ex: hp, xp, inventário)."),
  combatState: z.optional(CombatStateSchema).describe("O estado atualizado do combate, se estiver ativo."),
  levelUpState: z.optional(z.any()).describe("Estado para o processo de level up, se ativado."),
  shopState: z.optional(z.any()).describe("Estado da loja, se o jogador estiver em uma."),
  lootOffer: z.optional(z.any()).describe("Itens oferecidos ao jogador para saquear."),
  useHitDiceRequest: z.optional(z.any()).describe("Requisição para o jogador usar dados de vida durante um descanso."),
});
export type GameMasterResponse = z.infer<typeof GameMasterResponseSchema>;
