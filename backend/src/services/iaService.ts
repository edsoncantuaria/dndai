
'use server';
import { ai } from '../config/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';
import { defineFlow, type Flow } from 'genkit';

// Definição do schema de entrada para o fluxo do mestre do jogo
const GameMasterInputSchema = z.object({
  character: z.any().describe('O objeto completo do estado atual do personagem.'),
  playerAction: z.string().describe('A ação realizada pelo jogador.'),
  gameLog: z.array(z.any()).describe('As últimas 15 entradas do log do jogo.'),
  combatState: z.any().optional().describe('O estado atual do combate, se ativo.'),
});

// Definição do schema de saída (usamos z.any() para o streaming)
const GameMasterOutputSchema = z.any();

/**
 * Cria o prompt detalhado para ser enviado ao modelo Gemini.
 * @param input O estado do jogo e a ação do jogador.
 * @returns Uma string formatada contendo o contexto completo para a IA.
 */
const createPrompt = (input: z.infer<typeof GameMasterInputSchema>): string => {
    const { character, playerAction, gameLog, combatState } = input;
    const characterContext = JSON.stringify(character, null, 2);
    const logContext = JSON.stringify(gameLog.slice(-15), null, 2);
    const combatContextValue = (combatState && combatState.isActive)
        ? JSON.stringify(combatState, null, 2)
        : 'Nenhum combate ativo.';

    return `
      Você é um Mestre de Jogo de RPG de texto. Sua função é narrar uma aventura de fantasia sombria para um jogador.
      Responda em português do Brasil.
      Sempre retorne um objeto JSON válido, seguindo o formato definido, mesmo para mensagens de erro.
      O jogador está enviando a ação dele. Com base no estado atual do personagem, no estado de combate, no histórico da conversa e na ação do jogador, continue a história.

      ### Estado do Personagem (JSON)
      ${characterContext}

      ### Estado de Combate (JSON)
      ${combatContextValue}

      ### Últimas 15 Entradas do Log (JSON)
      ${logContext}

      A ação do jogador é: "${playerAction}"

      Responda com o próximo passo da aventura.
    `;
};

// Flow<[Flow's input type], [Flow's output type]>
export const gameMasterFlow: Flow<
  typeof GameMasterInputSchema,
  any
> = defineFlow(
  {
    name: 'gameMasterFlow',
    inputSchema: GameMasterInputSchema,
    outputSchema: GameMasterOutputSchema,
  },
  async (flowInput, { sendChunk }) => {
    const prompt = createPrompt(flowInput);

    const { stream, response } = await ai.generateStream({
      prompt: prompt,
      model: googleAI.model('gemini-1.5-pro-latest'),
      config: {
        temperature: 0.8,
      },
    });

    for await (const chunk of stream) {
        sendChunk(chunk.content);
    }

    return await response;
  }
);
