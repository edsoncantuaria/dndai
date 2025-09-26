'use server';

import { GoogleGenerativeAI, Content, GenerationConfig, GenerativeModel } from "@google/generative-ai";
import { GameMasterResponse, GameMasterFlowInput, GameMasterResponseSchema } from "./gameSchemas";
import { ambientSounds } from "@/data/ambient-sounds";

// Cache for the GenAI client and for the models
let genAI: GoogleGenerativeAI | null = null;
const modelCache = new Map<string, GenerativeModel>();

/**
 * Gets a singleton instance of GoogleGenerativeAI.
 */
const getGenAI = (apiKey: string): GoogleGenerativeAI => {
    if (!genAI || genAI.apiKey !== apiKey) {
        genAI = new GoogleGenerativeAI(apiKey);
    }
    return genAI;
};

/**
 * Gets a generative model from cache or creates it if it doesn't exist.
 * Configures the model to always expect a JSON response based on our schema.
 */
const getModel = (apiKey: string, modelName: string, config: GenerationConfig): GenerativeModel => {
    const cacheKey = `${apiKey}-${modelName}`;
    if (modelCache.has(cacheKey)) {
        return modelCache.get(cacheKey)!;
    }
    
    const ai = getGenAI(apiKey);
    const model = ai.getGenerativeModel({
        model: modelName,
        generationConfig: {
            ...config,
            responseMimeType: "application/json",
            responseSchema: GameMasterResponseSchema,
        },
        systemInstruction: systemInstruction, // Set the system instruction directly on the model
    });
    
    modelCache.set(cacheKey, model);
    return model;
};

const ambientSoundList = ambientSounds.map(s => `- ${s.id}: ${s.name}`).join('\n');

// The system instruction, now updated to request rolls instead of making them.
const systemInstruction = `Você é um Mestre de Jogo criativo e justo para um RPG de texto solo de Dungeons & Dragons 5ª Edição. Seu papel é narrar a aventura, gerenciar o estado do personagem e controlar os elementos do mundo.

### Diretrizes de Resposta (JSON OBRIGATÓRIO)
Sua resposta DEVE ser um objeto JSON válido que corresponda ao schema fornecido.

1.  **Rolagem de Dados pelo Jogador**:
    *   **NÃO ROLE DADOS PELO JOGADOR.** Quando uma ação incerta for tentada (ataque, teste de perícia, salvamento), responda com o objeto 'playerRollRequest'.
    *   Preencha 'playerRollRequest' com a 'reason', o 'dice' ("1d20"), e o 'modifier'. Se houver uma Classe de Dificuldade (CD) pública, inclua-a.
    *   O jogo irá pausar. Na próxima chamada, a 'playerAction' conterá o resultado do jogador. Use esse resultado para determinar o sucesso ou fracasso e narrar a consequência em 'logEntries'.

2.  **Transparência nas Rolagens do Mestre (NOVO!)**:
    *   Quando um NPC ou inimigo fizer uma rolagem contra o jogador (ataque, teste de resistência, etc.), você **deve** realizar a rolagem internamente.
    *   Na narração ('logEntries' com 'type: "roll"'), descreva a rolagem e o resultado claramente. Exemplo de descrição: "O goblin ataca você com a sua cimitarra! Ele tira 14 no dado (1d20 + 2), totalizando 16 para acertar." Isso gera confiança e imersão.

3.  **Narração e Ações ('logEntries', 'actionOptions')**:
    *   Use 'logEntries' para descrever o que acontece. Use 'type: "narration"' para descrições.
    *   Sempre forneça 2 a 4 opções claras de ação em 'actionOptions'.

4.  **Atualizações do Personagem ('updatedCharacter')**:
    *   Este é o campo mais importante. Retorne **apenas** as propriedades do personagem que mudaram.
    *   Exemplos: Dano -> \`"updatedCharacter": { "hp": { "current": 5 } }\`. Item -> \`"updatedCharacter": { "inventory": [...] }\` com o inventário completo.

5.  **Imersão**:
    *   Para cenas importantes, forneça um prompt detalhado em inglês no campo 'imagePrompt'.
    *   Quando a atmosfera mudar, defina 'ambientSound' para um dos IDs disponíveis. Não mude a cada turno. IDs:
        ${ambientSoundList}`;


/**
 * Creates the user prompt to be sent to the model.
 */
const createPrompt = (input: GameMasterFlowInput): Content[] => {
    const { character, playerAction, gameLog } = input;
    
    const characterContext = JSON.stringify(character, null, 2);
    const logContext = JSON.stringify(gameLog.slice(-15), null, 2); // Keep recent log for context

    const promptText = `
### Estado Atual do Personagem (JSON)
${characterContext}

### Últimos Eventos do Jogo (JSON)
${logContext}
---
A ação do jogador é: "${playerAction}"

Com base no estado atual do personagem e no histórico do jogo, continue a aventura como o Mestre de Jogo. Lembre-se, quando um teste for necessário, solicite uma rolagem ao jogador usando 'playerRollRequest'. Para suas próprias rolagens (NPCs), seja transparente. Forneça sua resposta como um objeto JSON válido.
    `;
    
    return [{ role: "user", parts: [{ text: promptText }] }];
}

/**
 * Main function to get the game state update from the AI.
 */
export const getGameUpdate = async (input: GameMasterFlowInput, modelName: string, generationConfig: GenerationConfig, apiKey: string): Promise<GameMasterResponse | null> => {
    if (!apiKey) {
      throw new Error("Chave de API do Google não configurada. Por favor, adicione sua chave nas configurações.");
    }
    
    try {
        const model = getModel(apiKey, modelName, generationConfig);
        const userPrompt = createPrompt(input);
        
        const result = await model.generateContent({
            contents: userPrompt,
        });

        const response = result.response;
        const jsonText = response.text();
        
        if (!jsonText) {
            throw new Error("A resposta da IA está vazia.");
        }

        const responseData = JSON.parse(jsonText);
        return responseData as GameMasterResponse;

    } catch (error: any) {
        console.error(`[geminiService (${modelName})] Erro ao chamar ou processar a resposta da API do Gemini:`, error);
        
        let errorMessage = `O Mestre está confuso e não pôde continuar. Erro: ${(error as Error).message}`;
        if (error.message.toLowerCase().includes('json')) {
             errorMessage = `O Mestre de Jogo tentou responder, mas a magia falhou (erro de formatação JSON). Verifique o console para mais detalhes.`;
        } else if (error.message.toLowerCase().includes('api key')) {
             errorMessage = `A conexão com o mundo arcano falhou. Verifique sua chave de API nas configurações. Detalhes: ${error.message}`;
        }
        
        throw new Error(errorMessage);
    }
};

/**
 * Tests the connection to the AI.
 */
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
