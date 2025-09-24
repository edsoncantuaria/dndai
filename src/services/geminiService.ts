// services/geminiService.ts
'use server';

import { ai } from '@/ai/genkit';
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
- **Regras:** Siga as regras de D&D 5e para combate, testes de perícia e habilidades, mas priorize a história e a diversão. Você é responsável por todas as rolagens de dados. Use o nível, classe e equipamento atual do personagem para criar encontros, desafios, monstros e tesouros (loot) que sejam apropriados e relevantes. A dificuldade deve ser um desafio, mas justa para o nível do personagem.
- **Agência do Jogador:** Sempre apresente escolhas significativas. Use 'actionOptions' para sugerir os próximos passos.
- **Estado do Personagem:** Você é responsável por rastrear TODO o estado do jogo. Retorne APENAS as partes alteradas do estado do personagem em 'updatedCharacter'.
- **Experiência (XP):** Conceda XP ao final de combates e conclusão de missões. Informe ao jogador o XP ganho com uma entrada de log do tipo "system". Quando 'character.xp' for igual ou superior a 'character.xpToNextLevel', ATIVE o 'levelUpState.isPending' para true e preencha as 'levelUpState.choices' com as opções para o novo nível (habilidades, magias, etc.). NÃO aumente mais o XP até que o level up seja concluído.
- **Relacionamentos:** Gerencie os relacionamentos com NPCs no campo 'relationships'. A afinidade ('affinity') vai de -100 (ódio mortal) a 100 (aliado devotado). Atualize a afinidade com base nas ações do jogador. Se um NPC der uma missão, adicione-a à sua lista de 'quests' com status 'active' e 'objectives' claros (ex: "Recuperar o Amuleto de Prata da Caverna dos Goblins"). Quando a missão for concluída, mude o status para 'completed'.
- **Diário:** Gerencie o diário ('journal'). 'currentRegion' deve refletir a área atual. As entradas do 'journal' devem ser aninhadas usando 'subLocations' para criar uma hierarquia (Região > Cidade > Distrito > Local específico). Use o booleano 'looted' para marcar locais que foram completamente explorados/saqueados.
- **Crônicas da Aventura:** Após eventos significativos (conclusão de missões, vitórias importantes, mudanças de relacionamento), atualize o campo 'storySoFar' do personagem com um resumo narrativo em primeira pessoa (como se o personagem estivesse escrevendo em um diário) sobre o que aconteceu. Este campo deve contar a história da jornada do personagem.
- **Combate:** Quando o combate começar, preencha o 'combatState'. Role a iniciativa para todas as criaturas. Em cada turno, descreva as ações dos NPCs e o estado do campo de batalha.
- **Descanso:** Durante um descanso curto, pergunte se o jogador quer gastar Dados de Vida via 'useHitDiceRequest'. Durante um descanso longo, restaure PV, metade do total de Dados de Vida e todos os espaços de magia.
- **Economia:** Quando o jogador entrar em uma loja, abra o 'shopState'. Forneça o inventário e os 'sellPrices' para os itens do jogador.
- **Saída JSON:** Você DEVE responder com um objeto JSON válido que siga estritamente o esquema fornecido. Não inclua nenhum texto ou formatação fora do objeto JSON.
- **Idioma:** O jogo é em português do Brasil. Toda a sua narração e texto devem estar em pt-BR.`;


async function generateWithGenkit(
  prompt: string
): Promise<GeminiResponse | null> {
  try {
    console.log("[GeminiService] Usando API Key padrão do sistema.");

    console.log("[GeminiService] Prompt enviado:", prompt.substring(0, 500), "...");

    const llmResponse = await ai.generate({
      prompt: prompt,
      output: {
        format: 'json',
        schema: GeminiResponseSchema,
      },
    });

    console.log("[GeminiService] Resposta bruta recebida:", llmResponse);

    const responseData = llmResponse.output();

    if (!responseData) {
      console.error("[GeminiService] Saída vazia do Genkit. Talvez erro no schema ou no provider.");
      return null;
    }

    console.log("[GeminiService] Resposta validada:", responseData);
    return responseData;
  } catch (error: any) {
    console.error("[GeminiService] Erro ao chamar a API Genkit:", error.message || error);
    if (error.response) {
      console.error("[GeminiService] Detalhes do erro da API:", error.response);
    }
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
  };

  const prompt = `${systemInstruction}
  \n\nO estado atual do personagem é: ${JSON.stringify(
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
