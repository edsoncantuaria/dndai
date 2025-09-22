// services/geminiService.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import {
  Character,
  LogEntry,
  CombatState,
  LevelUpState,
  ShopState,
  LootOffer,
  UseHitDiceRequest,
} from '../types';

// Inicialize o Genkit com o plugin da Google AI.
// A chave da API será lida a partir de process.env.NEXT_PUBLIC_GEMINI_API_KEY
genkit({
  plugins: [googleAI()],
});

// A interface de resposta da API do Gemini
export interface GeminiResponse {
  logEntries: Omit<LogEntry, 'id'>[];
  actionOptions: string[];
  updatedCharacter?: Partial<Character>;
  combatState?: CombatState;
  levelUpState?: Partial<LevelUpState>;
  shopState?: ShopState;
  lootOffer?: LootOffer;
  useHitDiceRequest?: UseHitDiceRequest;
}

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

// Esta função agora usa o Genkit para gerar o conteúdo
async function generateWithGenkit(prompt: string): Promise<GeminiResponse | null> {
  try {
    const llmResponse = await genkit.generate({
      model: 'gemini-1.5-flash',
      prompt: prompt,
      config: {
        // A API Genkit não possui um mapeamento direto para `systemInstruction`
        // mas a instrução é geralmente passada no início do prompt.
      },
      output: {
        format: 'json',
        schema: {
          logEntries: [
            {
              type: 'string',
              content: 'string',
              rollResult: {
                description: 'string',
                dice: 'string',
                modifier: 'number',
                total: 'number',
                rolls: ['number'],
                success: 'boolean',
                dc: 'number',
                rollType: 'string',
              },
            },
          ],
          actionOptions: ['string'],
        },
      },
    });

    const responseText = llmResponse.output as string;
    return JSON.parse(responseText) as GeminiResponse;
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
