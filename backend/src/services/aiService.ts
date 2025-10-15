// backend/src/services/aiService.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { GameMasterFlowInput } from '../schemas/gameSchemas';
import { GameMasterResponse, GameMasterResponseSchema } from "../schemas/gameSchemas.js";
import type { GenerationConfig } from "@/contexts/SettingsContext";
import { regrasBase } from '../game/prompts/regrasBase.js';
import { regrasCombate } from '../game/prompts/regrasCombate.js';
import { regrasInventario } from '../game/prompts/regrasInventario.js';

// Combina os prompts importados
const systemInstruction = `
${regrasBase}

${regrasInventario}

${regrasCombate}
`;

// Esta função agora aceita a chave de API como um argumento.
const getGenAI = (apiKey: string) => {
    return new GoogleGenerativeAI(apiKey);
}

const createPrompt = (input: GameMasterFlowInput, isGemma: boolean) => {
    const { character, playerAction, gameLog, combatState, installedHomebrew } = input;
    
    // Assegura que todos os objetos complexos sejam transformados em string JSON
    const characterContext = JSON.stringify(character, null, 2);
    const logContext = JSON.stringify(gameLog, null, 2); 
    const combatContextValue = combatState ? JSON.stringify(combatState, null, 2) : "Nenhum combate ativo.";
    const homebrewContext = installedHomebrew && installedHomebrew.length > 0 ? JSON.stringify(installedHomebrew, null, 2) : "Nenhum conteúdo homebrew instalado.";
  
    const mainPrompt = `
Contexto da Sessão:
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
\`\`\`json
${logContext}
\`\`\`

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
        }),
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
    });
    
    // O schema JSON é especificado no Gemini, não no Gemma
    const finalGenerationConfig: any = {
        ...generationConfig,
        ...(!isGemma && { responseMimeType: "application/json", responseSchema: GameMasterResponseSchema }),
    };


    const attemptGeneration = async (retry: boolean = false): Promise<GameMasterResponse | null> => {
        try {
            let prompt = createPrompt(input, isGemma);
            if (retry) {
                prompt += "\n\nAVISO: Sua resposta anterior não era um objeto JSON válido. Por favor, corrija o formato e forneça uma resposta estritamente no formato JSON solicitado, sem nenhum texto ou marcador de formatação como \`\`\`json."
            }

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: finalGenerationConfig,
            });

            const response = result.response;
            const jsonText = response.text();

            try {
                let textToParse = jsonText;
                // Gemma pode retornar o JSON dentro de um bloco de código
                if (isGemma) {
                    const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
                    if (match) {
                        textToParse = match[1];
                    }
                }
                
                const parsedJson = JSON.parse(textToParse);

                // Tenta validar com o Zod
                const validationResult = GameMasterResponseSchema.safeParse(parsedJson);

                if (!validationResult.success) {
                    console.error("[geminiService] Falha na validação do Zod:", validationResult.error.flatten());
                    if (!retry) {
                        console.log("[geminiService] Tentando novamente com prompt de correção...");
                        return await attemptGeneration(true);
                    }
                    throw new Error(`A resposta da IA falhou na validação do schema: ${validationResult.error.message}`);
                }
                
                return validationResult.data as GameMasterResponse;

            } catch(e: any) {
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

// ... (A função testAiConnection pode permanecer como estava ou ser adaptada se necessário)
