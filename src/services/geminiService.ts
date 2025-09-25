'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
import { GameMasterResponse, GameMasterFlowInput, GameMasterResponseSchema } from "./gameSchemas";
import { GenerationConfig } from "@/contexts/SettingsContext";

// Esta função agora aceita a chave de API como um argumento.
const getGenAI = (apiKey: string) => {
    return new GoogleGenerativeAI(apiKey);
}

const systemInstruction = `
Você é um Mestre de Jogo criativo e justo para um RPG de texto solo de Dungeons & Dragons 5ª Edição. Seu papel é narrar a aventura, gerenciar o estado do personagem e controlar os elementos do mundo.

### Diretrizes principais
- **Narrativa:** Use o campo \`logEntries\` para descrever o que acontece. Seja imersivo e reaja às ações do jogador.
- **Regras de D&D:** Aplique as regras de D&D 5e para combate, testes de perícia e habilidades. Você rola todos os dados e determina os resultados.
- **Agência do jogador:** Sempre forneça de 2 a 4 opções de ação claras em \`actionOptions\` para guiar o jogador.
- **Estado do personagem:** O campo mais importante é \`updatedCharacter\`. Use-o para refletir **todas** as mudanças no personagem. Retorne apenas os campos que mudaram. Por exemplo, se o jogador perde vida, retorne \`{ "hp": { "current": novo_valor } }\`. Se ele ganha um item, retorne o array \`inventory\` completo e atualizado.
- **Diário e Relações:** Para atualizar o diário ou os relacionamentos, modifique os campos \`journal\` e \`relationships\` dentro de \`updatedCharacter\`.
- **Combate:** Quando um combate começar, preencha o objeto \`combatState\`.
- **Experiência (XP):** Conceda XP por completar desafios. Quando \`character.xp\` atingir \`character.xpToNextLevel\`, ative \`levelUpState.isPending = true\`.
- **JSON Válido:** Sua resposta DEVE sempre ser um objeto JSON válido que corresponda ao schema fornecido.

### Idioma
Toda a narrativa e texto devem estar em **português do Brasil**. Os prompts de imagem, no entanto, devem ser em inglês.
`;


const createPrompt = (input: GameMasterFlowInput) => {
    const { character, playerAction, gameLog } = input;
    
    // Serializa os objetos principais para fornecer como contexto para a IA
    const characterContext = JSON.stringify(character, null, 2);
    const logContext = JSON.stringify(gameLog.slice(-15), null, 2); // Apenas as últimas 15 entradas

    return `
### Estado Atual do Personagem (JSON)
${characterContext}

### Últimos Eventos do Jogo (JSON)
${logContext}
---
A ação do jogador é: "${playerAction}"

Com base no estado atual do personagem e no histórico do jogo, continue a aventura como o Mestre de Jogo. Forneça sua resposta como um objeto JSON válido.
    `;
}

export const getGameUpdate = async (input: GameMasterFlowInput, modelName: string, generationConfig: GenerationConfig, apiKey: string): Promise<GameMasterResponse | null> => {
    if (!apiKey) {
      throw new Error("Chave de API do Google não configurada. Por favor, adicione sua chave nas configurações.");
    }
    const genAI = getGenAI(apiKey);

    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: {
            role: "model",
            parts: [{ text: systemInstruction }],
        },
    });

    try {
        const prompt = createPrompt(input);
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                ...generationConfig,
                responseMimeType: "application/json",
                responseSchema: GameMasterResponseSchema,
            }
        });

        const response = result.response;
        const jsonText = response.text();
        
        // A resposta já é validada pelo schema, então podemos parseá-la com segurança.
        const responseData = JSON.parse(jsonText);

        return responseData as GameMasterResponse;

    } catch (error: any) {
        console.error(`[geminiService (${modelName})] Erro ao chamar ou processar a resposta da API do Gemini:`, error);
        throw new Error(`O Mestre está confuso e não pôde continuar. Erro: ${(error as Error).message}`);
    }
};

export const testAiConnection = async (modelName: string, generationConfig: GenerationConfig, apiKey: string): Promise<string | null> => {
     if (!apiKey) {
        return "Erro: Nenhuma chave de API fornecida ou configurada. Por favor, adicione uma chave nas configurações.";
    }
    try {
        const genAI = getGenAI(apiKey);
        const testModel = genAI.getGenerativeModel({ model: modelName });
        const prompt = "Você é o Mestre de um jogo de RPG de texto. Um jogador pergunta 'Mestre, você está aí?'. Responda de forma concisa e temática, em português do Brasil, confirmando que você está presente e pronto. Exemplo: 'Sim, estou aqui. O que você faz?'";
        
        const result = await testModel.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                ...generationConfig,
                responseMimeType: "text/plain",
            }
        });

        const response = result.response;
        const textResponse = response.text();
        return `Modelo: ${modelName}\n\n${textResponse}`;
    } catch (error: any) {
        console.error("Erro no teste de conexão com a IA:", error);
        return `Falha ao conectar com a IA (${modelName}). Detalhes: ${error.message}`;
    }
};
