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
import { getUserApiKey } from '../utils/user-service';
import { promptDnD5e } from './promptDnD5e';
import { ai } from '../config/genkit'; // Import the central AI instance

// Define o schema para a entrada do fluxo, que inclui a entrada padrão do jogo e o userId.
const flowInput = z.object({
  flowInput: GameMasterFlowInputSchema,
  userId: z.number(),
  modelName: z.string().default('gemini-1.5-pro-latest'),
  generationConfig: z.any().optional(),
});

type FlowInputType = z.infer<typeof flowInput>;

/**
 * Cria o prompt detalhado a ser enviado para o modelo Gemini.
 * @param input O estado do jogo e a entrada da ação do jogador.
 * @returns Uma string formatada contendo todo o contexto para a IA.
 */
const createPrompt = (input: z.infer<typeof GameMasterFlowInputSchema>): string => {
    const { character, playerAction, gameLog, combatState } = input;
    
    const characterContext = JSON.stringify(character, null, 2);
    const logContext = JSON.stringify(gameLog.slice(-15), null, 2);
    const combatContextValue = combatState && combatState.isActive ? JSON.stringify(combatState, null, 2) : "Nenhum combate ativo.";
  
    // A Instrução do Sistema será adicionada pelo serviço que chama este, para manter a flexibilidade.
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


export const gameMasterFlow = ai.defineFlow(
  {
    name: 'gameMasterFlow',
    inputSchema: flowInput,
    outputSchema: GameMasterResponseSchema,
  },
  async (input: FlowInputType) => {
    const { flowInput, userId, modelName, generationConfig } = input;
    
    // 1. Busca a chave de API específica do usuário no banco de dados.
    const apiKey = await getUserApiKey(userId);
    if (!apiKey) {
      throw new Error(
        'A chave de API do Google do usuário não foi encontrada. Por favor, configure-a no seu perfil.'
      );
    }
    
    // 2. Cria um plugin do Google AI dinamicamente com a chave do usuário.
    // We create a temporary Genkit instance with the user's key.
    const userGoogleAI = googleAI({ apiKey: apiKey });
    const localAI = genkit({
      plugins: [userGoogleAI],
      enableTracingAndMetrics: true,
    });
    
    // 3. Gera o conteúdo usando o modelo, prompt e configuração especificados.
    const { output } = await localAI.generate({
      model: `googleai/${modelName}`,
      prompt: createPrompt(flowInput),
      system: promptDnD5e,
      config: generationConfig,
      output: {
        format: 'json',
        schema: GameMasterResponseSchema,
      },
    });

    // 5. Analisa e retorna a resposta estruturada.
    if (!output) {
      throw new Error('A resposta da IA foi vazia ou em um formato inválido.');
    }
    
    return output;
  }
);
