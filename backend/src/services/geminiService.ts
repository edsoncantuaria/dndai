'use server';
/**
 * @fileOverview Gemini Service for the Game Master AI.
 * This service defines the Genkit flow that acts as the game master,
 * processing player actions and generating game state updates.
 * It dynamically uses the user's stored Google API key for each call.
 */
import { ai, genkit, configureGenkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { GameMasterResponseSchema, GameMasterFlowInputSchema } from '../../src/services/gameSchemas';
import { getUserApiKey } from '../utils/user-service'; 

// Define o schema para a entrada do fluxo, que inclui a entrada padrão do jogo e o userId.
const flowInput = z.object({
  flowInput: GameMasterFlowInputSchema,
  userId: z.number(),
  modelName: z.string().default('gemini-1.5-pro-latest'),
  generationConfig: z.any().optional(),
});

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
  async (input) => {
    const { flowInput, userId, modelName, generationConfig } = input;
    
    // 1. Busca a chave de API específica do usuário no banco de dados.
    const apiKey = await getUserApiKey(userId);
    if (!apiKey) {
      throw new Error(
        'A chave de API do Google do usuário não foi encontrada. Por favor, configure-a no seu perfil.'
      );
    }
    
    // 2. Cria um plugin do Google AI dinamicamente com a chave do usuário.
    const userGoogleAI = googleAI({ apiKey: apiKey });
    const localAI = genkit({
      plugins: [userGoogleAI],
      logLevel: 'debug',
      enableTracingAndMetrics: true,
    });
    
    // 3. Obtém uma referência ao modelo de gerador específico solicitado.
    const model = localAI.getGenerator(modelName);

    // 4. Gera o conteúdo usando o modelo, prompt e configuração especificados.
    const result = await model.generate({
      prompt: createPrompt(flowInput),
      config: generationConfig,
      output: {
        format: 'json',
        schema: GameMasterResponseSchema,
      },
    });

    // 5. Analisa e retorna a resposta estruturada.
    const response = result.output();
    if (!response) {
      throw new Error('A resposta da IA foi vazia ou em um formato inválido.');
    }
    
    return response;
  }
);
