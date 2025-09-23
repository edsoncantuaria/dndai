// services/geminiService.ts
'use server';

import { ai } from '@/ai/genkit';
import { geminiPro } from '@genkit-ai/googleai';
import {
  Character,
  LogEntry,
  CombatState,
  LevelUpState,
  ShopState,
  LootOffer,
  UseHitDiceRequest,
} from '@/types';
import { z } from 'zod';

// Zod schemas for Gemini response validation
const LogEntrySchema = z.object({
  type: z.enum(['narration', 'action', 'system', 'combat', 'insight', 'roll']),
  content: z.string(),
  rollResult: z.optional(z.object({
    description: z.string(),
    dice: z.string(),
    modifier: z.number(),
    total: z.number(),
    rolls: z.array(z.number()),
    success: z.optional(z.boolean()),
    dc: z.optional(z.number()),
    rollType: z.enum(['check', 'save', 'attack', 'damage']),
    advantage: z.optional(z.boolean()),
    disadvantage: z.optional(z.boolean()),
  })),
});

const CombatantSchema = z.object({
    id: z.string(),
    name: z.string(),
    hp: z.optional(z.number()),
    maxHp: z.optional(z.number()),
    initiative: z.number(),
});

const CombatStateSchema = z.object({
    isActive: z.boolean(),
    round: z.number(),
    turn: z.number(),
    combatants: z.array(CombatantSchema),
});


const GeminiResponseSchema = z.object({
  logEntries: z.array(LogEntrySchema),
  actionOptions: z.array(z.string()),
  updatedCharacter: z.optional(z.any()), // Using `any` for flexibility in partial updates
  combatState: z.optional(CombatStateSchema),
  levelUpState: z.optional(z.any()),
  shopState: z.optional(z.any()),
  lootOffer: z.optional(z.any()),
  useHitDiceRequest: z.optional(z.any()),
});


export type GeminiResponse = z.infer<typeof GeminiResponseSchema>;


const systemInstruction = `Você é um Mestre de Jogo criativo e justo para um RPG de texto solo de Dungeons & Dragons 5ª Edição. Seu objetivo é criar uma história contínua e envolvente que reaja às escolhas do jogador.
- **Narração:** Teça uma narrativa rica. Descreva o mundo, as pessoas e as consequências das ações do jogador de forma vívida.
- **Regras:** Siga as regras de D&D 5e para combate, testes de perícia e habilidades de personagem, mas priorize a história e a diversão em vez de seguir rigidamente as regras. Você é responsável por todas as rolagens de dados.
- **Agência do Jogador:** Sempre apresente ao jogador escolhas significativas. Use 'actionOptions' para sugerir os próximos passos possíveis.
- **Estado do Personagem:** Você é responsável por rastrear todo o estado do personagem e do jogo. Retorne APENAS as partes alteradas do estado do personagem em 'updatedCharacter'.
- **Saída JSON:** Você DEVE responder com um objeto JSON válido que siga estritamente o esquema fornecido. Não inclua nenhum texto ou formatação fora do objeto JSON.
- **Combate:** Quando o combate começar, preencha o 'combatState'. Role a iniciativa para todas as criaturas. Em cada turno, descreva as ações dos NPCs e o estado do campo de batalha. Aplique regras táticas como vantagem em ataques contra alvos caídos.
- **Descanso:** Durante um descanso curto, pergunte ao jogador se ele quer gastar Dados de Vida. Se sim, use 'useHitDiceRequest'. Durante um descanso longo, restaure PV, metade do total de Dados de Vida e todos os espaços de magia.
- **Economia:** Quando o jogador entrar em uma loja, abra o 'shopState'. Forneça o inventário da loja e defina os 'sellPrices' para os itens do jogador. Se o jogador pechinchar, atualize os preços e defina 'isHaggling' como verdadeiro até que um acordo seja feito.
- **Idioma:** O jogo é em português do Brasil. Toda a sua narração e texto devem estar em pt-BR.`;


async function generateWithGenkit(prompt: string): Promise<GeminiResponse | null> {
  try {
    const llmResponse = await ai.generate({
      model: geminiPro,
      prompt: prompt,
      output: {
        format: 'json',
        schema: GeminiResponseSchema,
      },
    });

    const responseData = llmResponse.output();
    if (!responseData) {
      console.error('API Genkit retornou uma saída vazia.');
      return null;
    }
    return responseData;
  } catch (error) {
    console.error('Erro ao chamar a API Genkit:', error);
    return null;
  }
}

export const getGameUpdate = async (
  character: Character,
  playerAction: string,
  fullLog: LogEntry[]
): Promise<GeminiResponse | null> => {
  const characterSummary = {
    ...character,
    inventory: character.inventory.map(({ id, name, quantity, equipped }) => ({
      id,
      name,
      quantity,
      equipped,
    })),
    // Remove data that is too large or complex for the prompt
    classLevelsData: undefined, 
    subclassLevelsData: undefined,
  };

  const prompt = `${systemInstruction}\n\nO estado atual do personagem é: ${JSON.stringify(
    characterSummary
  )}\nAs últimas 10 entradas do log da aventura são: ${JSON.stringify(
    fullLog.slice(-10)
  )}\nA ação do jogador é: "${playerAction}"\n\nCom base nisso, continue a aventura.`;

  return generateWithGenkit(prompt);
};

export const getInitialStory = async (
  character: Character
): Promise<GeminiResponse | null> => {
  const action =
    'A aventura começa. Onde eu estou e o que está acontecendo?';
  return getGameUpdate(character, action, []);
};
