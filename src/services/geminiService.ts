'use server';

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { Character, LogEntry, CombatState, LevelUpState, ShopState, LootOffer, UseHitDiceRequest, InventoryItem } from '../types';

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.warn("A variável de ambiente GOOGLE_API_KEY não está definida.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
};

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig,
  safetySettings,
});

const systemInstruction = `Você é um Mestre de Jogo criativo e justo para um RPG de texto solo de Dungeons & Dragons 5ª Edição. Seu objetivo é criar uma história contínua e envolvente que reaja às escolhas do jogador.
- **Narração:** Teça uma narrativa rica. Descreva o mundo, as pessoas e as consequências das ações do jogador de forma vívida.
- **Regras:** Siga as regras de D&D 5e para combate, testes de perícia e habilidades, mas priorize a história e a diversão. Você é responsável por todas as rolagens de dados.
- **Agência do Jogador:** Sempre apresente escolhas significativas. Use 'actionOptions' para sugerir os próximos passos.
- **Estado do Personagem:** Você é responsável por rastrear TODO o estado do jogo. Retorne APENAS as partes alteradas do estado do personagem em 'updatedCharacter'.
- **Experiência (XP):** Conceda XP ao final de combates e conclusão de missões. Informe ao jogador o XP ganho com uma entrada de log do tipo "system". Quando 'character.xp' for igual ou superior a 'character.xpToNextLevel', ATIVE o 'levelUpState.isPending' para true e preencha as 'levelUpState.choices' com as opções para o novo nível (habilidades, magias, etc.). NÃO aumente mais o XP até que o level up seja concluído.
- **Relacionamentos:** Gerencie os relacionamentos com NPCs no campo 'relationships'. A afinidade ('affinity') vai de -100 (ódio mortal) a 100 (aliado devotado). Atualize a afinidade com base nas ações do jogador.
- **Diário:** Gerencie o diário ('journal'). 'currentRegion' deve refletir a área atual. As entradas do 'journal' devem ser aninhadas usando 'subLocations'.
- **Combate:** Quando o combate começar, preencha o 'combatState'. Role a iniciativa para todas as criaturas. Descreva as ações dos NPCs e o estado do campo de batalha.
- **Descanso:** Durante um descanso curto, pergunte se o jogador quer gastar Dados de Vida via 'useHitDiceRequest'. Durante um descanso longo, restaure PV, metade do total de Dados de Vida e todos os espaços de magia.
- **Economia:** Quando o jogador entrar em uma loja, abra o 'shopState'. Forneça o inventário e os 'sellPrices' para os itens do jogador.
- **Saída JSON:** Você DEVE responder com um objeto JSON válido. Não inclua nenhum texto ou formatação fora do objeto JSON.
- **Idioma:** O jogo é em português do Brasil. Toda a sua narração e texto devem estar em pt-BR.`;


export interface GeminiResponse {
    narration?: string;
    updatedCharacter?: Partial<Character>;
    logEntries: Omit<LogEntry, 'id'>[];
    actionOptions: string[];
    combatState?: CombatState;
    levelUpState?: Partial<LevelUpState>;
    shopState?: ShopState;
    lootOffer?: LootOffer;
    useHitDiceRequest?: UseHitDiceRequest;
}

const createCharacterSummary = (character: Character) => {
    const { 
        classLevelsData, 
        subclassLevelsData,
        ...summary 
    } = character;
    
    return {
        name: summary.name,
        level: summary.level,
        xp: summary.xp,
        xpToNextLevel: summary.xpToNextLevel,
        characterClass: summary.characterClass,
        race: summary.race,
        background: summary.background,
        alignment: summary.alignment,
        hp: summary.hp,
        attributes: summary.attributes,
        modifiers: summary.modifiers,
        inventory: summary.inventory.map(item => `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`),
        proficiencies: summary.proficiencies.map(p => p.name),
        spells: summary.spells,
    };
};


export const getGameUpdate = async (
    character: Character,
    playerAction: string,
    fullLog: LogEntry[]
): Promise<GeminiResponse | null> => {
    if (!apiKey) {
      console.error("GOOGLE_API_KEY não está definida. O serviço de IA não funcionará.");
      return {
        logEntries: [{ type: 'system', content: 'Erro: A chave da API do Google não foi configurada no servidor.' }],
        actionOptions: ['Tentar novamente mais tarde.'],
      };
    }
    try {
        const characterSummary = createCharacterSummary(character);

        const prompt = `
            O estado atual do personagem é: ${JSON.stringify(characterSummary)}
            As últimas 10 entradas do log da aventura são: ${JSON.stringify(fullLog.slice(-10).map(l => ({type: l.type, content: l.content})))}
            A ação do jogador é: "${playerAction}"

            Com base nisso, continue a aventura. Sua resposta DEVE ser um objeto JSON.
        `;

        const contents = [{
            role: "user",
            parts: [{ text: prompt }]
        }];

        const result = await model.generateContent({ contents, system: { parts: [{ text: systemInstruction }] } });
        const responseText = result.response.text();
        const responseData = JSON.parse(responseText) as GeminiResponse;
        
        console.log("[geminiService] Resposta da IA recebida e validada:", responseData);
        return responseData;

    } catch (error) {
        console.error("Erro ao chamar a API do Gemini:", error);
        return null;
    }
};

export const getInitialStory = async (character: Character): Promise<GeminiResponse | null> => {
    const action = "A aventura começa. Onde eu estou e o que está acontecendo?";
    return getGameUpdate(character, action, []);
}
