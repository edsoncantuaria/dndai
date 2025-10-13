// backend/src/services/aiService.ts
import { genkit, type GenkitOptions } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { GameMasterFlowInput, GameMasterFlowInputSchema, GameMasterResponse, GameMasterResponseSchema } from '../schemas/gameSchemas.js';
import { promptDnD5e } from '../game/prompt5e.js';
import { z } from 'zod';


const StreamingGameMasterResponseSchema = z.object({
  llmResponse: z.string().optional(),
  actionOptions: GameMasterResponseSchema.shape.actionOptions,
  updatedCharacter: GameMasterResponseSchema.shape.updatedCharacter,
  combatState: GameMasterResponseSchema.shape.combatState,
  playerRollRequest: GameMasterResponseSchema.shape.playerRollRequest,
  ambientSound: GameMasterResponseSchema.shape.ambientSound,
  imagePrompt: GameMasterResponseSchema.shape.imagePrompt,
  systemLog: GameMasterResponseSchema.shape.systemLog,
  levelUpState: GameMasterResponseSchema.shape.levelUpState,
  shopState: GameMasterResponseSchema.shape.shopState,
  lootOffer: GameMasterResponseSchema.s