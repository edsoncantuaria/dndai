// backend/src/services/aiService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GameMasterResponse, GameMasterFlowInput, GameMasterResponseSchema } from "../schemas/gameSchemas.js";
import { GenerationConfig } from '../schemas/validationSchemas.js'; // Ajustado para importar do backend
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
  
    const mainPrompt = `### Estado Atual do Personagem (JSON)
\`\`\`json
${characterContext}
\`\`\`

### Estado de Combate (JSON)
\`\`\`json
${combatContextValue}
\`\`\`

### Últimos Eventos do Jogo (JSON)
${logContext}

### Resumo do Conteúdo Homebrew Instalado (JSON)
\`\`\`json
${homebrewContext}
\`\`\`

A ação do jogador é: "${playerAction}"

Com base no estado atual do personagem, do combate, do conteúdo homebrew e no histórico, continue a aventura. 
Responda APENAS com um único objeto JSON válido que siga o schema GameMasterResponseSchema.`;
  
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
    
    // Convert Zod schema to plain JSON schema and remove unsupported properties
    const jsonSchema = zodToJsonSchema(GameMasterResponseSchema, "GameMasterResponseSchema");
    delete (jsonSchema as any).$ref;
    delete (jsonSchema as any).definitions;
    delete (jsonSchema as any).$schema;


    const finalGenerationConfig: any = {
        ...generationConfig,
        ...(!isGemma && { 
            responseMimeType: "application/json", 
            responseSchema: jsonSchema 
        }),
    };
    
    const attemptGeneration = async (isRetry: boolean = false): Promise<GameMasterResponse | null> => {
        try {
            let prompt = createPrompt(input, isGemma);
            if (isRetry) {
                prompt += "\n\nSua resposta anterior não era um objeto JSON válido ou falhou na validação do schema. Por favor, corrija o formato e forneça uma resposta estritamente no formato JSON solicitado, sem nenhum texto ou marcador extra e garantindo que todos os campos obrigatórios estejam presentes e com os tipos corretos.";
            }

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: finalGenerationConfig,
            });

            const response = result.response;
            const jsonText = response.text();
            
            if (!jsonText) {
                 console.error(`[geminiService] Resposta da IA vazia na tentativa ${isRetry ? 2 : 1}.`);
                 if (!isRetry) return attemptGeneration(true);
                 throw new Error("O Mestre de Jogo não respondeu, mesmo após a correção.");
            }
            
            console.log(`[geminiService (${modelName})] Resposta da IA (Tentativa ${isRetry ? 2 : 1}):`, jsonText); 

            let responseData: any;
            try {
                let textToParse = jsonText;
                if (isGemma) {
                    const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
                    if (match) {
                        textToParse = match[1];
                    }
                }
                responseData = JSON.parse(textToParse);
            } catch(e: any) {
                console.error(`[geminiService] Falha ao analisar o JSON na tentativa ${isRetry ? 2 : 1}:`, e);
                if (!isRetry) {
                    console.log("[geminiService] Tentando novamente com prompt de correção...");
                    return await attemptGeneration(true);
                }
                throw new Error(`O Mestre de Jogo forneceu uma resposta em um formato inválido, mesmo após a correção: ${e.message}`);
            }

            // Validação final com Zod
            const validationResult = GameMasterResponseSchema.safeParse(responseData);
            if (!validationResult.success) {
                console.error("[geminiService] Validação Zod falhou:", validationResult.error.flatten());
                if (!isRetry) {
                    console.warn("[geminiService] Tentando corrigir falha de validação...");
                    return await attemptGeneration(true);
                }
                 throw new Error(`A resposta da IA falhou na validação final: ${validationResult.error.message}`);
            }

            return validationResult.data;

        } catch (error: any) {
            console.error(`[geminiService (${modelName})] Erro ao chamar a API do Gemini:`, error);
            const errorMessage = error.details?.message || error.message;
            throw new Error(`Erro de comunicação com o Mestre de Jogo: ${errorMessage}`);
        }
    }

    return await attemptGeneration();
};
