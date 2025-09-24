// services/newGeminiService.ts
'use server';

import { ai } from '@/ai/genkit';
import {
  Character,
  LogEntry,
} from '@/types';
import { z } from 'zod';

// --- Zod Schemas for Input and Output Validation ---

export const GameMasterFlowInputSchema = z.object({
  character: z.custom<Character>(),
  playerAction: z.string(),
  gameLog: z.array(z.custom<LogEntry>()),
});
export type GameMasterFlowInput = z.infer<typeof GameMasterFlowInputSchema>;


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

// This is the schema for the *output* from the Gemini model
const GameMasterResponseSchema = z.object({
  logEntries: z.array(LogEntrySchema).describe("Novas entradas para o log da história, descrevendo o que acontece."),
  actionOptions: z.array(z.string()).describe("Novas opções de escolha para o jogador, que conduzem a história."),
  updatedCharacter: z.any().optional().describe("Um objeto contendo SOMENTE os campos do personagem que foram alterados (ex: hp, xp, inventário)."),
  combatState: z.optional(CombatStateSchema).describe("O estado atualizado do combate, se estiver ativo."),
  levelUpState: z.optional(z.any()).describe("Estado para o processo de level up, se ativado."),
  shopState: z.optional(z.any()).describe("Estado da loja, se o jogador estiver em uma."),
  lootOffer: z.optional(z.any()).describe("Itens oferecidos ao jogador para saquear."),
  useHitDiceRequest: z.optional(z.any()).describe("Requisição para o jogador usar dados de vida durante um descanso."),
});
export type GameMasterResponse = z.infer<typeof GameMasterResponseSchema>;

// --- System Instruction Prompt for the AI ---

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


// --- NEW Genkit Prompt Definition ---
const gameMasterPrompt = ai.definePrompt(
  {
    name: 'gameMasterPrompt',
    input: { schema: GameMasterFlowInputSchema },
    output: { schema: GameMasterResponseSchema },
    prompt: `
        ${systemInstruction}

        O estado atual do personagem é: {{{character}}}
        As últimas 10 entradas do log da aventura são: {{{gameLog}}}
        A ação do jogador é: "{{{playerAction}}}"

        Com base nisso, continue a aventura.
    `,
  }
);


// --- Genkit Flow Definition ---
const gameMasterFlow = ai.defineFlow(
  {
    name: 'gameMasterFlow',
    inputSchema: GameMasterFlowInputSchema,
    outputSchema: GameMasterResponseSchema,
  },
  async (input) => {
    console.log("[newGeminiService] Fluxo 'gameMasterFlow' invocado com a ação:", input.playerAction);
    
    // Create a summarized character object to keep the prompt concise
    const characterSummary = {
        ...input.character,
        // Avoid sending overly large or redundant data to the AI
        classLevelsData: undefined, 
        subclassLevelsData: undefined,
        inventory: input.character.inventory.map(({ id, name, quantity, equipped }) => ({
            id, name, quantity, equipped,
        })),
    };

    const { output } = await gameMasterPrompt({
      ...input,
      character: characterSummary as any,
    });
    
    if (!output) {
        console.error("[newGeminiService] Erro: A resposta da IA foi nula ou vazia.");
        throw new Error("A resposta da IA foi nula.");
    }
    
    console.log("[newGeminiService] Resposta da IA recebida e validada com sucesso.");
    return output;
  }
);


// --- Service Functions Exported for Use in the App ---

/**
 * Gets the next state of the game from the AI based on player action.
 */
export const getGameUpdate = async (input: GameMasterFlowInput): Promise<GameMasterResponse | null> => {
  try {
    return await gameMasterFlow(input);
  } catch (error: any) {
    console.error("[newGeminiService - getGameUpdate] Erro ao executar o fluxo do mestre:", error.message || error, error);
    return null;
  }
};

/**
 * Gets the initial story introduction for a newly created character.
 */
export const getInitialStory = async (input: GameMasterFlowInput): Promise<GameMasterResponse | null> => {
  try {
    return await gameMasterFlow(input);
  } catch (error: any) {
    console.error("[newGeminiService - getInitialStory] Erro ao buscar a história inicial:", error.message || error, error);
    return null;
  }
};
