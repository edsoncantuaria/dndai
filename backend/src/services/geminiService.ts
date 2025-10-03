
'use server';
/**
 * @fileOverview Gemini Service for the Game Master AI.
 * This service defines the Genkit flow that acts as the game master,
 * processing player actions and generating game state updates.
 * It dynamically uses the user's stored Google API key for each call.
 */
import { z } from 'zod';
import { GameMasterResponseSchema, GameMasterFlowInputSchema, TestAiInputSchema } from './gameSchemas';
import { promptDnD5e } from '../game/promptDnD5e';
import { ai } from '../config/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { ActionContext, UserFacingError } from 'genkit';


/**
 * Creates the detailed prompt to be sent to the Gemini model.
 * @param input The game state and player action input.
 * @returns A formatted string containing the full context for the AI.
 */
const createPrompt = (input: z.infer<typeof GameMasterFlowInputSchema>): string => {
    const { character, playerAction, gameLog, combatState } = input;
    
    const characterContext = JSON.stringify(character, null, 2);
    const logContext = JSON.stringify(gameLog.slice(-15), null, 2);
    const combatContextValue = combatState && combatState.isActive ? JSON.stringify(combatState, null, 2) : "Nenhum combate ativo.";
  
    return `### Estado Atual do Personagem (JSON)
  ${characterContext}
  
  ### Estado de Combate (JSON)
  ${combatContextValue}
  
  ### Últimos Eventos do Jogo (JSON)
  ${logContext}
  
  A ação do jogador é: "${playerAction}"
  
  Com base no estado atual do personagem, do combate e no histórico, continue a aventura. 
  Sempre retorne um objeto JSON válido seguindo o GameMasterResponseSchema.`;
};


export const gameMasterFlow = ai.defineFlow(
    {
      name: 'gameMasterFlow',
      inputSchema: GameMasterFlowInputSchema,
      outputSchema: GameMasterResponseSchema,
    },
    async (flowInput) => {
        
      const model = googleAI('gemini-1.5-pro-latest');
      
      const response = await ai.generate({
        model,
        prompt: createPrompt(flowInput),
        system: promptDnD5e,
        output: {
          format: 'json',
          schema: GameMasterResponseSchema,
        },
      });
  
      if (!response.output) {
        throw new Error('A resposta da IA foi vazia ou em um formato inválido.');
      }
      
      return response.output;
    }
  );

// New flow for testing AI connection
export const testAiConnectionFlow = ai.defineFlow(
    {
      name: 'testAiConnectionFlow',
      inputSchema: TestAiInputSchema, 
      outputSchema: z.string(),
    },
    async ({model, prompt}) => {
      const aiModel = googleAI(model as any);
      
      const response = await ai.generate({
        model: aiModel,
        prompt: prompt,
      });
      
      const outputText = response.text;
      if (!outputText) {
        throw new Error("A IA não retornou uma resposta de texto.");
      }
      return outputText;
    }
  );
