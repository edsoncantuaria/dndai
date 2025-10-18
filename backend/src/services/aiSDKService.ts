// backend/src/services/aiSDKService.ts
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from 'ai';
import { GameMasterResponse, GameMasterFlowInput, GameMasterResponseSchema, GameMasterFlowInputSchema } from "../schemas/gameSchemas.js";
import { GenerationConfig } from '../schemas/validationSchemas.js';
import { regrasBase } from '../game/prompts/regrasBase.js';
import { regrasCombate } from '../game/prompts/regrasCombate.js';
import { regrasInventario } from '../game/prompts/regrasInventario.js';
import { sanitizeGameMasterResponse } from './aiSanitizer.js';
import createError from 'http-errors';

const createSystemInstruction = (useAiHomebrew: boolean): string => {
    const homebrewRule = useAiHomebrew
        ? "Você PODE criar conteúdo homebrew (itens, monstros, etc.) e deve adicioná-los ao campo `newHomebrewContent`."
        : "Você NÃO PODE criar conteúdo homebrew. O campo `newHomebrewContent` DEVE estar sempre vazio. Use apenas itens e monstros oficiais do SRD 5e.";

    return `
${regrasBase}

${regrasInventario}

${regrasCombate}

---
## Regra Especial: Conteúdo Homebrew
- ${homebrewRule}
---
`;
};


const createPrompt = (input: GameMasterFlowInput) => {
    const { character, playerAction, gameLog, combatState } = input;
    
    const characterForPrompt = character ? {
        name: character.name,
        race: character.race,
        characterClass: character.characterClass,
        level: character.level,
        attributes: character.attributes,
        proficiencies: character.proficiencies,
        inventory: character.inventory.map((item: any) => ({ name: item.name, equipped: item.equipped })),
        spells: character.spells,
        storySoFar: character.storySoFar,
        worldState: character.worldState,
        relationships: character.relationships.map((r: any) => ({ name: r.name, status: r.status, affinity: r.affinity })),
        journal: character.journal.map((j: any) => ({ name: j.name, region: j.region, status: j.looted ? 'looted' : 'unexplored' }))
    } : null;

    const characterContext = JSON.stringify(characterForPrompt, null, 2);
    const logContext = JSON.stringify(gameLog, null, 2); 
    const combatContextValue = combatState && combatState.isActive ? JSON.stringify(combatState, null, 2) : "Nenhum combate ativo.";
  
    return `### Estado do Personagem
\`\`\`json
${characterContext}
\`\`\`

### Estado de Combate
\`\`\`json
${combatContextValue}
\`\`\`

### Histórico Recente
${logContext}

A ação do jogador é: "${playerAction}"

Com base em tudo, continue a aventura. Responda APENAS com um único objeto JSON válido que siga o schema GameMasterResponseSchema.`;
}
  

export const getGameUpdate = async (input: GameMasterFlowInput, modelName: string, generationConfig: GenerationConfig, apiKey: string): Promise<GameMasterResponse> => {
    const inputValidation = GameMasterFlowInputSchema.safeParse(input);
    if (!inputValidation.success) {
        console.error("Entrada para a IA é inválida:", inputValidation.error.flatten());
        throw createError(400, "Dados de entrada para o Mestre de Jogo estão corrompidos.");
    }
    
    if (!apiKey) {
      throw createError(401, "Chave de API do Google não configurada.");
    }
    
    // Cria uma instância dinâmica do provedor com a chave de API do usuário
    const google = createGoogleGenerativeAI({ apiKey });
    
    const systemInstruction = createSystemInstruction(input.useAiHomebrew ?? true);
    
    const attemptGeneration = async (isRetry: boolean = false): Promise<GameMasterResponse> => {
        try {
            let prompt = createPrompt(input);
            if (isRetry) {
                prompt += "\n\nSua resposta anterior não era um objeto JSON válido ou falhou na validação do schema. Por favor, corrija o formato e forneça uma resposta estritamente no formato JSON solicitado, sem nenhum texto ou marcador extra e garantindo que todos os campos obrigatórios estejam presentes e com os tipos corretos.";
            }

            console.log(`[aiSDKService (${modelName})] Gerando conteúdo com prompt...`);
            
            const { object } = await generateObject({
                model: google(modelName as any),
                system: systemInstruction,
                prompt,
                schema: GameMasterResponseSchema,
                mode: 'json'
            });
            
            console.log("✅ Resposta da IA validada e analisada:", object);
            
            const finalResponse = sanitizeGameMasterResponse(object, input.character);
            console.log("🧹 Resposta final sanitizada:", JSON.stringify(finalResponse, null, 2));

            return finalResponse;

        } catch (error: any) {
             console.error(`[aiSDKService (${modelName})] Erro ao chamar a API do Gemini:`, error);
             if (error.message && (error.message.includes('API key not valid') || error.message.includes('API key is missing'))) {
                 throw createError(401, 'Sua chave de API do Google não é válida. Verifique-a nas configurações.');
             }
             if (error.status === 429 || (error.message && error.message.includes('rate limit'))) {
                throw createError(429, 'Você excedeu seu limite de uso da API. Por favor, tente novamente mais tarde.');
            }
            if (error.message.includes("response schema is not supported")) {
                console.warn("[aiSDKService] O schema de resposta não é suportado, tentando novamente sem structured outputs.");
                 if (!isRetry) return attemptGeneration(true);
            }
             throw createError(502, `Falha na comunicação com o Mestre de Jogo: ${error.message}`);
        }
    }

    return await attemptGeneration();
};
