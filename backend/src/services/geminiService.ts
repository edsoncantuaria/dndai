'use server';
/**
 * @fileOverview Gemini Service for the Game Master AI.
 * This service defines the Genkit flow that acts as the game master,
 * processing player actions and generating game state updates.
 * It dynamically uses the user's stored Google API key for each call.
 */
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { GameMasterResponseSchema, GameMasterFlowInputSchema } from './gameSchemas';
import { getUserApiKey } from '../utils/user-service'; // Helper para buscar a chave do usuário

// Define the input schema for the flow, which includes the standard game input and the userId.
const flowInput = z.object({
  flowInput: GameMasterFlowInputSchema,
  userId: z.number(),
  modelName: z.string(),
  generationConfig: z.any(),
});

/**
 * The main Game Master flow.
 * This flow is responsible for receiving the game state, processing the player's action
 * through the Gemini model, and returning a structured update to the game state.
 */
export const gameMasterFlow = genkit.defineFlow(
  {
    name: 'gameMasterFlow',
    inputSchema: flowInput,
    outputSchema: GameMasterResponseSchema,
  },
  async (input) => {
    const { flowInput, userId, modelName, generationConfig } = input;

    // 1. Fetch the user-specific API key from the database.
    const apiKey = await getUserApiKey(userId);
    if (!apiKey) {
      throw new Error(
        'A chave de API do Google do usuário não foi encontrada. Por favor, configure-a no seu perfil.'
      );
    }

    // 2. Initialize the Google AI plugin dynamically with the user's key.
    // This ensures each user's requests are made with their own credentials.
    const dynamicGoogleAI = googleAI({ apiKey });
    
    // 3. Get a reference to the specific generator model requested.
    const model = dynamicGoogleAI.getGenerator(modelName);
    if (!model) {
      throw new Error(`Modelo ${modelName} não encontrado ou não suportado.`);
    }

    // 4. Generate the content using the specified model, prompt, and configuration.
    const result = await model.generate({
      prompt: createPrompt(flowInput),
      config: generationConfig,
      output: {
        format: 'json',
        schema: GameMasterResponseSchema,
      },
    });

    // 5. Parse and return the structured response.
    const response = result.output();
    if (!response) {
      throw new Error('A resposta da IA foi vazia ou em um formato inválido.');
    }

    return response;
  }
);


/**
 * Creates the detailed prompt to be sent to the Gemini model.
 * @param input The game state and player action input.
 * @returns A formatted string containing all the context for the AI.
 */
const createPrompt = (input: z.infer<typeof GameMasterFlowInputSchema>): string => {
    const { character, playerAction, gameLog, combatState } = input;
    
    const characterContext = JSON.stringify(character, null, 2);
    const logContext = JSON.stringify(gameLog.slice(-15), null, 2);
    const combatContextValue = combatState && combatState.isActive ? JSON.stringify(combatState, null, 2) : "Nenhum combate ativo.";
  
    // O System Instruction será adicionado pelo serviço que chama este, para manter a flexibilidade.
    // O prompt aqui foca apenas no contexto dinâmico do jogo.
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
