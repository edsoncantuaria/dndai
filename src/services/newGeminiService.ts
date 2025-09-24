// services/newGeminiService.ts
'use server';

import { ai } from '@/ai/genkit';
import {
    GameMasterFlowInputSchema,
    GameMasterResponseSchema,
    type GameMasterFlowInput,
    type GameMasterResponse
} from './gameSchemas';


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

        O estado atual do personagem é:
        - Nome: {{{name}}}
        - Raça: {{{race}}}
        - Classe: {{{characterClass}}}
        - Nível: {{{level}}}
        - Pontos de Vida (HP): {{{hp.current}}}/{{{hp.max}}}
        - XP: {{{xp}}}/{{{xpToNextLevel}}}
        - Atributos (Modificadores): Força {{{attributes.strength}}} ({{{modifiers.strength}}}), Destreza {{{attributes.dexterity}}} ({{{modifiers.dexterity}}}), Constituição {{{attributes.constitution}}} ({{{modifiers.constitution}}}), Inteligência {{{attributes.intelligence}}} ({{{modifiers.intelligence}}}), Sabedoria {{{attributes.wisdom}}} ({{{modifiers.wisdom}}}), Carisma {{{attributes.charisma}}} ({{{modifiers.charisma}}})
        - Inventário: {{{inventory}}}
        - Proficiências: {{{proficiencies}}}
        - Magias: {{{spells}}}

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
    const { output } = await gameMasterPrompt(input);
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
export async function getGameUpdate(input: GameMasterFlowInput): Promise<GameMasterResponse | null> {
  try {
    console.log("[getGameUpdate] Chamando o fluxo do mestre com a ação:", input.playerAction);
    return await gameMasterFlow(input);
  } catch (error: any) {
    console.error("[getGameUpdate] Erro ao executar o fluxo do mestre:", error.message || error, error);
    return null;
  }
};

/**
 * Gets the initial story introduction for a newly created character.
 */
export async function getInitialStory(input: GameMasterFlowInput): Promise<GameMasterResponse | null> {
  try {
    console.log("[getInitialStory] Chamando o fluxo do mestre para a história inicial.");
    return await gameMasterFlow(input);
  } catch (error: any) {
    console.error("[getInitialStory] Erro ao buscar a história inicial:", error.message || error, error);
    return null;
  }
};