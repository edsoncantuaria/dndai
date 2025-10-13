// backend/src/services/aiService.ts
import { genkit, type GenkitOptions } from 'genkit';
import { googleAI, type GoogleAIOptions } from '@genkit-ai/google-genai';
import { GameMasterFlowInput, GameMasterFlowInputSchema, GameMasterResponse, GameMasterResponseSchema } from '../schemas/gameSchemas.js';
import { promptDnD5e } from '../game/prompt5e.js';

// Define o prompt fora da função de chamada para eficiência.
// A instância 'ai' é criada dinamicamente dentro da função.
const gameMasterPrompt = (options: GenkitOptions) => {
  const ai = genkit(options);
  return ai.definePrompt(
    {
      name: "gameMasterPrompt",
      input: { schema: GameMasterFlowInputSchema },
      output: { schema: GameMasterResponseSchema },
      prompt: promptDnD5e,
    },
  );
}

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
        // Configura o Genkit dinamicamente com a chave e modelo do usuário.
        const dynamicGenkitOptions: GenkitOptions = {
            plugins: [googleAI({ apiKey, apiVersion: 'v1beta' })],
            logLevel: 'info',
            enableTracingAndMetrics: process.env.NODE_ENV === 'development',
        };

        const prompt = gameMasterPrompt(dynamicGenkitOptions);
        
        // Executa o prompt, passando o modelo dinamicamente na chamada.
        const result = await prompt(input, { model: `googleai/${model}` });
        
        return result.output;
    } catch (error) {
        console.error("Erro ao executar o turno do Mestre de Jogo:", error);
        throw new Error('Falha na comunicação com a Inteligência Artificial.');
    }
}
