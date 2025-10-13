// backend/src/services/aiService.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { GameMasterFlowInput, GameMasterFlowInputSchema, GameMasterResponse, GameMasterResponseSchema } from '../schemas/gameSchemas.js';
import { promptDnD5e } from '../game/prompt5e.js';

// Inicializa o Genkit uma única vez.
// A chave de API será passada dinamicamente em cada chamada.
const ai = genkit({
    plugins: [googleAI({ apiVersion: 'v1beta' })],
    logLevel: 'info',
    enableTracingAndMetrics: process.env.NODE_ENV === 'development',
});

// Define o prompt fora da função de chamada para eficiência.
const gameMasterPrompt = ai.definePrompt(
  {
    name: "gameMasterPrompt",
    input: { schema: GameMasterFlowInputSchema },
    output: { schema: GameMasterResponseSchema },
    prompt: promptDnD5e,
  },
);

/**
 * Executa um turno do Mestre de Jogo IA.
 * @param input Os dados do estado atual do jogo (personagem, ação, log).
 * @param apiKey A chave de API do Google Gemini do usuário.
 * @returns A resposta estruturada da IA.
 */
export async function runGameMasterTurn(input: GameMasterFlowInput, apiKey: string): Promise<GameMasterResponse | null> {
    try {
        const result = await gameMasterPrompt(input, { apiKey });
        return result.output;
    } catch (error) {
        console.error("Erro ao executar o turno do Mestre de Jogo:", error);
        throw new Error('Falha na comunicação com a Inteligência Artificial.');
    }
}

    