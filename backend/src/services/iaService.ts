
'use server';
import { ai } from '../config/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';
import Character from '../models/Character';
import { UserFacingError } from 'genkit';
import { defineFlow, Flow } from 'genkit/flow';

// Schema para a entrada que o controller (cliente) enviará.
const PlayerActionInputSchema = z.object({
  characterId: z.number().int().positive(),
  playerAction: z.string(),
  gameLog: z.array(z.any()).optional(),
  combatState: z.any().optional(),
});


// Schema para a saída do fluxo
const GameMasterOutputSchema = z.any();

/**
 * Cria o prompt detalhado para ser enviado ao modelo Gemini.
 */
const createPrompt = (character: any, playerAction: string, gameLog: any[], combatState: any): string => {
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


export const gameMasterFlow: Flow<typeof PlayerActionInputSchema, typeof GameMasterOutputSchema> = defineFlow(
  {
    name: 'gameMasterFlow',
    inputSchema: PlayerActionInputSchema,
    outputSchema: GameMasterOutputSchema,
  },
  async (flowInput, { sendChunk, context }) => {
    
    // Acessa o userId diretamente do contexto populado pelo authContext
    const userId = context.auth?.userId;
    if (!userId) {
      throw new UserFacingError("UNAUTHENTICATED", "Autenticação necessária para executar esta ação.");
    }
    
    // Busca o personagem no banco de dados.
    const character = await Character.findOne({ where: { id: flowInput.characterId, userId } });
    if (!character) {
      throw new UserFacingError("NOT_FOUND", "Personagem não encontrado ou não pertence a este usuário.");
    }
    
    const prompt = createPrompt(character.stats, flowInput.playerAction, flowInput.gameLog || [], flowInput.combatState);

    const { stream, response } = await ai.generateStream({
      prompt: prompt,
      model: googleAI.model('gemini-1.5-pro-latest'),
      config: {
        temperature: 0.8,
      },
    });

    for await (const chunk of stream) {
        if(chunk.content) {
            // O expressHandler gerencia o envio do chunk para o cliente.
            sendChunk(chunk.content);
        }
    }
    
    // Retorna a resposta final completa.
    return await response;
  }
);
