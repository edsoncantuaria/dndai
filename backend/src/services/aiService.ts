// backend/src/services/aiService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GameMasterResponse, GameMasterFlowInput, GameMasterResponseSchema, GameMasterFlowInputSchema } from "../schemas/gameSchemas.js";
import { GenerationConfig } from '../schemas/validationSchemas.js';
import { regrasBase } from '../game/prompts/regrasBase.js';
import { regrasCombate } from '../game/prompts/regrasCombate.js';
import { regrasInventario } from '../game/prompts/regrasInventario.js';
import { sanitizeGameMasterResponse } from './aiSanitizer.js';
import createError from 'http-errors';


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
    
    // Create a leaner character object for the prompt
    const characterForPrompt = character ? {
        name: character.name,
        race: character.race,
        characterClass: character.characterClass,
        level: character.level,
        attributes: character.attributes,
        proficiencies: character.proficiencies,
        inventory: character.inventory.map((item: any) => ({ name: item.name, equipped: item.equipped })), // only name and equipped status
        spells: character.spells,
        storySoFar: character.storySoFar,
        worldState: character.worldState,
        relationships: character.relationships.map((r: any) => ({ name: r.name, status: r.status, affinity: r.affinity })),
        journal: character.journal.map((j: any) => ({ name: j.name, region: j.region, status: j.looted ? 'looted' : 'unexplored' }))
    } : null;

    const characterContext = JSON.stringify(characterForPrompt, null, 2);
    const logContext = JSON.stringify(gameLog, null, 2); 
    const combatContextValue = combatState && combatState.isActive ? JSON.stringify(combatState, null, 2) : "Nenhum combate ativo.";
    const homebrewContext = installedHomebrew && installedHomebrew.length > 0 ? JSON.stringify(installedHomebrew, null, 2) : "Nenhum conteúdo homebrew instalado.";
  
    const mainPrompt = `### Estado do Personagem
\`\`\`json
${characterContext}
\`\`\`

### Estado de Combate
\`\`\`json
${combatContextValue}
\`\`\`

### Histórico Recente
${logContext}

### Conteúdo Homebrew
\`\`\`json
${homebrewContext}
\`\`\`

A ação do jogador é: "${playerAction}"

Com base em tudo, continue a aventura. Responda APENAS com um único objeto JSON válido que siga o schema GameMasterResponseSchema.`;
  
    if (isGemma) {
        return `${systemInstruction}\n\n${mainPrompt}`;
    }
  
    return mainPrompt;
}

/**
 * 🔹 Mini-sanitizador inline (Pré-Zod):
 * Limpa a resposta bruta da IA, removendo nulls, strings inválidas e objetos vazios
 * para garantir que ela passe na validação estrutural do Zod.
 */
const miniSanitize = (raw: any): any => {
    if (!raw || typeof raw !== 'object') return {};
  
    const clean: { [key: string]: any } = { ...raw };
  
    for (const key of Object.keys(clean)) {
      const val = clean[key];
  
      // 🔸 Remove valores inválidos
      if (
        val === null ||
        val === undefined ||
        (typeof val === 'string' && ['null', 'undefined', 'nan'].includes(val.trim().toLowerCase()))
      ) {
        if (['actionOptions', 'logEntries', 'newHomebrewContent'].includes(key)) {
          clean[key] = [];
        } else {
          clean[key] = null;
        }
        continue;
      }
  
      // 🔸 Trata combatState e playerRollRequest especificamente
      if (['combatState', 'playerRollRequest'].includes(key)) {
        if (typeof val !== 'object' || Object.keys(val).length === 0) {
          clean[key] = null; // ✅ Envia null, conforme o schema
          continue;
        }
  
        if (key === 'combatState' && (!('isActive' in val) || !val.isActive)) {
          clean[key] = null; // ✅ combate não ativo → null
          continue;
        }
      }
    }
  
    return clean;
  };
  

/**
 * 🔸 AI Service: Main entry point for getting a game update from the AI.
 */
export const getGameUpdate = async (input: GameMasterFlowInput, modelName: string, generationConfig: GenerationConfig, apiKey: string): Promise<GameMasterResponse> => {
    const inputValidation = GameMasterFlowInputSchema.safeParse(input);
    if (!inputValidation.success) {
        console.error("Entrada para a IA é inválida:", inputValidation.error.flatten());
        throw createError(400, "Dados de entrada para o Mestre de Jogo estão corrompidos.");
    }
    
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
    
    const jsonSchema = zodToJsonSchema(GameMasterResponseSchema, "GameMasterResponseSchema");
    delete (jsonSchema as any).$ref;
    delete (jsonSchema as any).definitions;
    delete (jsonSchema as any).$schema;


    const finalGenerationConfig: any = { ...generationConfig };
    
    const attemptGeneration = async (isRetry: boolean = false): Promise<GameMasterResponse> => {
        try {
            let prompt = createPrompt(input, isGemma);
            if (isRetry) {
                prompt += "\n\nSua resposta anterior não era um objeto JSON válido ou falhou na validação do schema. Por favor, corrija o formato e forneça uma resposta estritamente no formato JSON solicitado, sem nenhum texto ou marcador extra e garantindo que todos os campos obrigatórios estejam presentes e com os tipos corretos.";
            }

            console.log(`[aiService (${modelName})] Gerando conteúdo com prompt...`);
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: finalGenerationConfig,
            });

            const response = result.response;

            if (!response || response.promptFeedback?.blockReason) {
                const reason = response.promptFeedback?.blockReason;
                const blockMessage = `A resposta da IA foi bloqueada. Motivo: ${reason}. Detalhes: ${JSON.stringify(response.promptFeedback)}`;
                if(reason === 'SAFETY') {
                     throw createError(400, `Sua ação foi bloqueada pelos filtros de segurança da IA. Tente reformular sua ação de uma maneira diferente.`);
                }
                console.error(`[aiService] ${blockMessage}`);
                throw createError(500, blockMessage);
            }

            const jsonText = response.text();
            
            console.log("📜 Resposta bruta da IA:", jsonText);
            
            if (!jsonText) {
                 console.error(`[aiService] Resposta da IA vazia na tentativa ${isRetry ? 2 : 1}.`);
                 if (!isRetry) return attemptGeneration(true);
                 throw new Error("O Mestre de Jogo não respondeu, mesmo após a correção.");
            }
            
            let responseData: any;
            try {
                let textToParse = jsonText.trim();
                 if (!textToParse.startsWith('{')) {
                    const jsonMatch = textToParse.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        textToParse = jsonMatch[0];
                    }
                }
                responseData = JSON.parse(textToParse);
            } catch(e: any) {
                console.error(`[aiService] Falha ao analisar o JSON na tentativa ${isRetry ? 2 : 1}:`, e);
                if (!isRetry) return attemptGeneration(true);
                throw createError(500, `O Mestre de Jogo forneceu uma resposta em um formato inválido: ${e.message}`);
            }

            // 1️⃣ Mini-sanitizer (limpeza pré-validação)
            const cleanedData = miniSanitize(responseData);
            console.log("🧹 Após mini-sanitizador:", JSON.stringify(cleanedData, null, 2));

            // 2️⃣ Validação estrutural com Zod
            const validationResult = GameMasterResponseSchema.safeParse(cleanedData);
            if (!validationResult.success) {
                console.warn("⚠️ Falha na validação Zod:", validationResult.error.flatten());
                if (!isRetry) return attemptGeneration(true);
                throw createError(500, `A resposta da IA falhou na validação estrutural: ${JSON.stringify(validationResult.error.flatten())}`);
            }
            
            // 3️⃣ Sanitização semântica / lógica
            const finalResponse = sanitizeGameMasterResponse(validationResult.data, input.character);
            console.log("✅ Resposta final sanitizada:", JSON.stringify(finalResponse, null, 2));

            return finalResponse;

        } catch (error: any) {
             if(error instanceof createError.HttpError) throw error;
            console.error(`[aiService (${modelName})] Erro ao chamar a API do Gemini:`, error);
            throw createError(500, `Erro de comunicação com o Mestre de Jogo: ${error.message}`);
        }
    }

    return await attemptGeneration();
};
