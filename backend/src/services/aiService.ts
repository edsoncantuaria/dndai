// backend/src/services/aiService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { GameMasterFlowInput } from '../schemas/gameSchemas.js';
import { GameMasterResponse, GameMasterResponseSchema } from "../schemas/gameSchemas.js";
import type { GenerationConfig } from "@/contexts/SettingsContext.js";
import { regrasBase } from '../game/prompts/regrasBase.js';
import { regrasCombate } from '../game/prompts/regrasCombate.js';
import { regrasInventario } from '../game/prompts/regrasInventario.js';


// Esta função agora aceita a chave de API como um argumento.
const getGenAI = (apiKey: string) => {
    return new GoogleGenerativeAI(apiKey);
}

const systemInstruction = `
${regrasBase}

${regrasInventario}

${regrasCombate}
`;

const createPrompt = (input: GameMasterFlowInput, isGemma: boolean) => {
    const { character, playerAction, gameLog, combatState, installedHomebrew } = input;
    
    const characterContext = JSON.stringify(character, null, 2);
    const logContext = JSON.stringify(gameLog, null, 2); 
    const combatContextValue = combatState ? JSON.stringify(combatState, null, 2) : "Nenhum combate ativo.";
    const homebrewContext = installedHomebrew && installedHomebrew.length > 0 ? JSON.stringify(installedHomebrew, null, 2) : "Nenhum conteúdo homebrew instalado.";
  
    const mainPrompt = `Contexto da Sessão:
Você DEVE usar o seguinte contexto para informar sua resposta.

### Estado Atual do Personagem (JSON)
\`\`\`json
${characterContext}
\`\`\`

### Estado de Combate (JSON)
\`\`\`json
${combatContextValue}
\`\`\`

### Últimos Eventos do Jogo (JSON)
${logContext}

### Conteúdo Homebrew Instalado (JSON)
\`\`\`json
${homebrewContext}
\`\`\`

A ação do jogador é: "${playerAction}"

Com base no estado atual do personagem, do combate, do conteúdo homebrew e no histórico, continue a aventura. 
Responda APENAS com um objeto JSON válido que siga o schema GameMasterResponseSchema.`;
  
    if (isGemma) {
        return `${systemInstruction}\n\n${mainPrompt}`;
    }
  
    return mainPrompt;
}
  


export const getGameUpdate = async (input: GameMasterFlowInput, modelName: string, generationConfig: GenerationConfig, apiKey: string): Promise<GameMasterResponse | null> => {
    if (!apiKey) {
      throw new Error("Chave de API do Google não configurada. Por favor, adicione sua chave nas configurações.");
    }
    const genAI = getGenAI(apiKey);
    const isGemma = modelName.toLowerCase().includes('gemma');

    const model = genAI.getGenerativeModel({
        model: modelName,
        ...(!isGemma && {
            systemInstruction: {
                role: "model",
                parts: [{ text: systemInstruction }],
            },
        })
    });
    
    // Convert Zod schema to plain JSON schema
    const jsonSchema = zodToJsonSchema(GameMasterResponseSchema, "GameMasterResponseSchema");

    const finalGenerationConfig: any = {
        ...generationConfig,
        ...(!isGemma && { 
            responseMimeType: "application/json", 
            responseSchema: jsonSchema 
        }),
    };


    const attemptGeneration = async (retry: boolean = false): Promise<GameMasterResponse | null> => {
        try {
            let prompt = createPrompt(input, isGemma);
            if (retry) {
                prompt += "\n\nSua resposta anterior não era um objeto JSON válido. Por favor, corrija o formato e forneça uma resposta estritamente no formato JSON solicitado, sem nenhum texto ou marcador extra."
            }

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: finalGenerationConfig,
            });

            const response = result.response;
            const jsonText = response.text();
            console.log(`[geminiService (${modelName})] Resposta da IA (Tentativa ${retry ? 2 : 1}):`, jsonText); 

            try {
                let textToParse = jsonText;
                if (isGemma) {
                    const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
                    if (match) {
                        textToParse = match[1];
                    }
                }

                const responseData = JSON.parse(textToParse);
                
                // Zod validation is useful for debugging but let's trust the API for now if it returns JSON
                const validationResult = GameMasterResponseSchema.safeParse(responseData);
                if (!validationResult.success) {
                    console.warn("[geminiService] Zod validation failed, but proceeding with API response.", validationResult.error.flatten());
                }

                return responseData as GameMasterResponse;

            } catch(e) {
                console.error(`[geminiService] Falha ao analisar o JSON na tentativa ${retry ? 2 : 1}:`, e);
                if (!retry) {
                    console.log("[geminiService] Tentando novamente com prompt de correção...");
                    return await attemptGeneration(true);
                }
                throw new Error("O Mestre de Jogo forneceu uma resposta em um formato inválido, mesmo após a correção.");
            }

        } catch (error: any) {
            console.error(`[geminiService (${modelName})] Erro ao chamar a API do Gemini:`, error);
            throw new Error(`Erro de comunicação com o Mestre de Jogo: ${error.message}`);
        }
    }

    return await attemptGeneration();
};

export const testAiConnection = async (modelName: string, generationConfig: GenerationConfig, apiKey: string): Promise<string | null> => {
     if (!apiKey) {
        return "Erro: Nenhuma chave de API fornecida ou configurada. Por favor, adicione uma chave nas configurações.";
    }
    try {
        const genAI = getGenAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });
        const prompt = "Você é o Mestre de um jogo de RPG de texto. Um jogador pergunta 'Mestre, você está aí?'. Responda de forma concisa e temática, em português do Brasil, confirmando que você está presente e pronto. Exemplo: 'Sim, estou aqui. O que você faz?'";
        
        const result = await model.generateContent({
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
