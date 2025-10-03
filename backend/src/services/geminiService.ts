
'use server';
/**
 * @fileOverview Gemini Service for the Game Master AI.
 * This service defines the Genkit flow that acts as the game master,
 * processing player actions and generating game state updates.
 */
import { z } from 'zod';
import { GameMasterResponseSchema, GameMasterFlowInputSchema, TestAiInputSchema } from './gameSchemas';
import { promptDnD5e } from '../game/promptDnD5e';
import { ai } from '../config/genkit';
import { UserFacingError } from 'genkit';


/**
 * Creates the detailed prompt to be sent to the Gemini model.
 * @param input The game state and player action input.
 * @returns A formatted string containing the full context for the AI.
 */
const createPrompt = (input: z.infer<typeof GameMasterFlowInputSchema>): string => {
    // Exclui a apiKey do objeto que será enviado para o prompt.
    const { apiKey, ...gameContext } = input;
    
    const characterContext = JSON.stringify(gameContext.character, null, 2);
    const logContext = JSON.stringify(gameContext.gameLog.slice(-15), null, 2);
    const combatContextValue = gameContext.combatState && gameContext.combatState.isActive ? JSON.stringify(gameContext.combatState, null, 2) : "Nenhum combate ativo.";
  
    return `### Estado Atual do Personagem (JSON)
  ${characterContext}
  
  ### Estado de Combate (JSON)
  ${combatContextValue}
  
  ### Últimos Eventos do Jogo (JSON)
  ${logContext}
  
  A ação do jogador é: "${gameContext.playerAction}"
  
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
      
      if (!flowInput.apiKey) {
        throw new UserFacingError('UNAUTHENTICATED', 'A chave de API é necessária.');
      }
        
      const response = await ai.generate({
        model: 'googleai/gemini-1.5-pro-latest',
        apiKey: flowInput.apiKey,
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
    async ({ model, prompt, apiKey }) => {
      if (!apiKey) {
        throw new UserFacingError('UNAUTHENTICATED', 'A chave de API é necessária.');
      }
        
      const response = await ai.generate({
        model: `googleai/${model}`,
        apiKey: apiKey,
        prompt: prompt,
      });
      
      const outputText = response.text;
      if (!outputText) {
        throw new Error("A IA não retornou uma resposta de texto.");
      }
      return outputText;
    }
);
