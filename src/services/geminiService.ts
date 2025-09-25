'use server';

import { GoogleGenerativeAI, Content, GenerationConfig, GenerativeModel } from "@google/generative-ai";
import { GameMasterResponse, GameMasterFlowInput, GameMasterResponseSchema } from "./gameSchemas";

// Cache para o cliente GenAI e para os modelos
let genAI: GoogleGenerativeAI | null = null;
const modelCache = new Map<string, GenerativeModel>();

/**
 * Obtém uma instância singleton do GoogleGenerativeAI.
 */
const getGenAI = (apiKey: string): GoogleGenerativeAI => {
    if (!genAI || genAI.apiKey !== apiKey) {
        genAI = new GoogleGenerativeAI(apiKey);
    }
    return genAI;
};

/**
 * Obtém um modelo generativo do cache ou o cria se não existir.
 * Configura o modelo para sempre esperar uma resposta JSON baseada no nosso schema.
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
        systemInstruction: systemInstruction, // Define a instrução do sistema diretamente no modelo
    });
    
    modelCache.set(cacheKey, model);
    return model;
};

// A instrução do sistema, agora mais direta.
const systemInstruction = `Você é um Mestre de Jogo criativo e justo para um RPG de texto solo de Dungeons & Dragons 5ª Edição. Seu papel é narrar a aventura, gerenciar o estado do personagem e controlar os elementos do mundo.

### Diretrizes de Resposta (JSON OBRIGATÓRIO)
Sua resposta DEVE ser um objeto JSON válido que corresponda ao schema fornecido.

1.  **Narração e Ações ('logEntries', 'actionOptions')**:
    *   Use 'logEntries' para descrever o que acontece. O campo principal é 'content'. Use 'type: "narration"' para descrições e 'type: "system"' para mensagens de jogo (ex: "Você ganhou 25 XP.").
    *   Sempre forneça 2 a 4 opções claras de ação em 'actionOptions' para guiar o jogador.

2.  **Atualizações do Personagem ('updatedCharacter')**:
    *   Este é o campo mais importante. Retorne **apenas** as propriedades do personagem que mudaram.
    *   Exemplos: Se o jogador sofrer dano, retorne \`"updatedCharacter": { "hp": { "current": 5 } }\`. Se ele encontrar um item, retorne \`"updatedCharacter": { "inventory": [...] }\` com o inventário completo e atualizado. Se ele descobrir uma nova localização, adicione a entrada em \`"updatedCharacter": { "journal": [...] }\`.

3.  **Regras de D&D 5e**:
    *   Você é o mestre dos dados. Role todos os dados (testes de perícia, ataques, dano) e descreva os resultados em 'logEntries' com 'type: "roll"'.
    *   Quando um combate começar, preencha o objeto 'combatState'.

4.  **Imersão**:
    *   Para cenas importantes, forneça um prompt detalhado em inglês no campo 'imagePrompt' para gerar uma ilustração. Exemplo: "dungeons and dragons 5e style art, digital painting: a tiefling man in a dark cloak watches you from across a tavern, while blurry dwarves dance in the foreground".
    *   Toda a sua narrativa e texto para o jogador devem ser em **português do Brasil**.`;


/**
 * Cria o prompt do usuário a ser enviado para o modelo.
 */
const createPrompt = (input: GameMasterFlowInput): Content[] => {
    const { character, playerAction, gameLog } = input;
    
    const characterContext = JSON.stringify(character, null, 2);
    const logContext = JSON.stringify(gameLog.slice(-15), null, 2); // Mantém o log recente para contexto

    const promptText = `
### Estado Atual do Personagem (JSON)
${characterContext}

### Últimos Eventos do Jogo (JSON)
${logContext}
---
A ação do jogador é: "${playerAction}"

Com base no estado atual do personagem e no histórico do jogo, continue a aventura como o Mestre de Jogo. Forneça sua resposta como um objeto JSON válido.
    `;
    
    // A instrução do sistema já está no modelo, então só precisamos enviar o prompt do usuário.
    return [{ role: "user", parts: [{ text: promptText }] }];
}

/**
 * Função principal para obter a atualização do estado do jogo da IA.
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
        
        // Validação básica para garantir que não estamos tentando analisar uma string vazia
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
 * Testa a conexão com a IA.
 */
export const testAiConnection = async (modelName: string, generationConfig: GenerationConfig, apiKey: string): Promise<string | null> => {
     if (!apiKey) {
        return "Erro: Nenhuma chave de API fornecida ou configurada. Por favor, adicione uma chave nas configurações.";
    }
    try {
        const genAI = getGenAI(apiKey);
        const testModel = genAI.getGenerativeModel({ model: modelName }); // Não precisa de schema JSON aqui
        const prompt = "Você é o Mestre de um jogo de RPG de texto. Um jogador pergunta 'Mestre, você está aí?'. Responda de forma concisa e temática, em português do Brasil, confirmando que você está presente e pronto. Exemplo: 'Sim, estou aqui. O que você faz?'";
        
        const result = await testModel.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                ...generationConfig,
                // Garantir que a resposta seja de texto simples para este teste
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
