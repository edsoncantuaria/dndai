'use server';

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { Character, LogEntry, CombatState, LevelUpState, ShopState, LootOffer, UseHitDiceRequest, InventoryItem } from '../types';
import { GameMasterResponse, GameMasterFlowInput } from "./gameSchemas";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.warn("A variável de ambiente GOOGLE_API_KEY não está definida.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

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

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: {
    role: "model",
    parts: [{ text: systemInstruction }],
  },
});

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
};

const createPrompt = (input: GameMasterFlowInput) => {
    const { character, playerAction, gameLog } = input;
    
    // Constrói uma versão mais limpa e legível do personagem para o prompt
    const characterContext = JSON.stringify(character, null, 2);
    const logContext = JSON.stringify(gameLog.slice(-15), null, 2);

    return `
### Estado do Personagem (JSON)
${characterContext}

### Últimos Eventos (JSON)
${logContext}
---
A ação do jogador é: "${playerAction}"

Com base no estado atual do personagem e no histórico, continue a aventura.
    `;
}

export const getGameUpdate = async (input: GameMasterFlowInput): Promise<GameMasterResponse | null> => {
    if (!apiKey) {
      console.error("GOOGLE_API_KEY não está definida. O serviço de IA não funcionará.");
      return {
        logEntries: [{ type: 'system', content: 'Erro: A chave da API do Google não foi configurada no servidor.' }],
        actionOptions: ['Tentar novamente mais tarde.'],
      };
    }
    try {
        const prompt = createPrompt(input);
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: generationConfig
        });

        const response = result.response;
        const jsonText = response.text();
        console.log("[geminiService] Resposta da IA recebida:", jsonText); 

        const responseData = JSON.parse(jsonText) as GameMasterResponse;
        
        return responseData;

    } catch (error) {
        console.error("Erro ao chamar ou processar a resposta da API do Gemini:", error);
        return {
            logEntries: [{ type: 'system', content: `O Mestre está confuso e não pôde continuar. Erro: ${(error as Error).message}` }],
            actionOptions: ['Tentar uma ação diferente.'],
        };
    }
};

export const testAiConnection = async (): Promise<string | null> => {
     if (!apiKey) {
        return "Erro: A chave da API do Google não está configurada no servidor.";
    }
    try {
        const testModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = "Você é o Mestre de um jogo de RPG de texto. Um jogador pergunta 'Mestre, você está aí?'. Responda de forma concisa e temática, em português do Brasil, confirmando que você está presente e pronto. Exemplo: 'Sim, estou aqui. O que você faz?'";
        console.log("[geminiService] Testando conexão com a IA com o prompt:", prompt);
        const result = await testModel.generateContent(prompt);
        const response = result.response;
        const textResponse = response.text();
        console.log("[geminiService] Resposta do teste de conexão:", textResponse);
        return textResponse;
    } catch (error: any) {
        console.error("Erro no teste de conexão com a IA:", error);
        return `Falha ao conectar com a IA. Detalhes: ${error.message}`;
    }
};
