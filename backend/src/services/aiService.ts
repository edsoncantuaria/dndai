// backend/src/services/aiService.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { GameMasterFlowInput, GameMasterFlowInputSchema, GameMasterResponse, GameMasterResponseSchema } from '../schemas/gameSchemas.js';
import { promptDnD5e } from '../game/prompt5e.js';

// Define o prompt fora da função de chamada para eficiência.
const systemInstruction = promptDnD5e;

/**
 * Executa um turno do Mestre de Jogo IA.
 * @param input Os dados do estado atual do jogo (personagem, ação, log).
 * @param apiKey A chave de API do Google Gemini do usuário.
 * @param model O modelo de IA a ser usado (ex: "gemini-1.5-flash").
 * @returns A resposta estruturada da IA.
 */
export async function runGameMasterTurn(
  input: GameMasterFlowInput,
  apiKey: string,
  model: string,
): Promise<GameMasterResponse | null> {
    try {
        const ai = genkit({
            plugins: [googleAI({ apiKey, apiVersion: 'v1beta' })],
            enableTracingAndMetrics: process.env.NODE_ENV === 'development',
        });
        
        const gameMasterFlow = ai.defineFlow(
            {
                name: "gameMasterFlow",
                inputSchema: GameMasterFlowInputSchema,
                outputSchema: GameMasterResponseSchema,
                system: systemInstruction, // Usando a instrução de sistema aqui
            },
            async (flowInput) => {
                const llmResponse = await ai.generate({
                    model: `googleai/${model}`,
                    prompt: {
                        text: `A ação do jogador é: "${flowInput.playerAction}"`,
                        context: {
                            character: flowInput.character,
                            gameLog: flowInput.gameLog,
                            combatState: flowInput.combatState,
                            installedHomebrew: flowInput.installedHomebrew,
                        }
                    },
                    // Configuração de formato de saída JSON
                    config: {
                        response: {
                            format: 'json',
                            schema: GameMasterResponseSchema,
                        },
                    },
                });
                
                const output = llmResponse.output();
                if (!output) {
                    throw new Error("A resposta da IA foi nula ou vazia.");
                }
                return output;
            }
        );

        const result = await gameMasterFlow(input);
        return result;

    } catch (error) {
        console.error("Erro ao executar o turno do Mestre de Jogo:", error);
        throw new Error('Falha na comunicação com a Inteligência Artificial.');
    }
}
