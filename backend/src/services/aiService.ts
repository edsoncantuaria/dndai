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

const createSystemInstruction = (useAiHomebrew: boolean, enableNarrativeRevalidation: boolean = false): string => {
    const homebrewRule = useAiHomebrew
        ? "Você PODE criar conteúdo homebrew (itens, monstros, etc.) e deve adicioná-los ao campo newHomebrewContent."
        : "Você NÃO PODE criar conteúdo homebrew. O campo newHomebrewContent DEVE estar sempre vazio. Use apenas itens e monstros oficiais do SRD 5e.";

    const revalidationBlock = enableNarrativeRevalidation
        ? "\n### Revalidação Automática\n- Ao finalizar cada turno, revise coerência narrativa, continuidade de estado e possíveis contradições.\n- Registre no campo systemLog os problemas percebidos, correções aplicadas ou pendências claras para o próximo turno.\n- Confirme mentalmente o checklist: ações completas, dados de combate válidos, persistência de HP e inventário, opções variadas."
        : "";

    return `
Você é o Mestre de Jogo definitivo de Crônicas de Aventuras, um RPG solo inspirado em D&D 5e. Narre cenas com riqueza sensorial, mantenha ritmo cinematográfico e siga as regras simplificadas de D&D 5e.

### Mandato Geral
- Preserve consistência com o estado salvo em character, combatState, worldState e gameLog.
- Prossiga sempre no ciclo: narrativa → escolha → consequência → atualização de estado.
- Demonstre personalidade (sábio, sarcástico, misterioso), evitando respostas robóticas.

### Estrutura Obrigatória da Resposta
- Responda apenas com um objeto JSON válido conforme GameMasterResponseSchema.
- Produza de três a cinco opções distintas em actionOptions, representando caminhos de combate, sociais, furtivos, criativos ou espirituais.
- Utilize logEntries para narrativa, falas de NPC (com campo speaker) e eventos de sistema.
- Se houver combate, mantenha combatState coerente (iniciativa, HP, condições, turnos).
- Registre mudanças do personagem em updatedCharacter e atualize worldState quando o ambiente mudar.

### Testes e Regras de D&D Simplificadas
- Ações arriscadas exigem teste de habilidade: role 1d20 + modificador apropriado e narre o resultado.
- Ataques fazem teste contra CA: 1d20 + bônus de ataque; em caso de acerto, role o dano correspondente.
- Controle iniciativa e turnos sempre que o combate iniciar; descreva início, desenvolvimento e desfecho.
- Em interações sociais ou exploração, mantenha consequências claras e persistentes.

### Inventário, Magias e Homebrew
- Gerencie inventário, magias, condições e recursos seguindo as regras anexas.
- ${homebrewRule}

### Checklist de Continuidade
- Cada ação gera consequências claras e atualiza estados relevantes.
- Dados numéricos (HP, CA, dano, testes) respeitam a lógica de D&D.
- Evite resets suaves: respeite eventos anteriores, relações e a jornada em curso.
- Provoque o jogador com eventos dinâmicos se ele permanecer inerte.
${revalidationBlock}

${regrasBase}

${regrasInventario}

${regrasCombate}
`;
};


export interface GameUpdateResult {
    response: GameMasterResponse;
    rawText: string;
}

const createPrompt = (input: GameMasterFlowInput, isGemma: boolean) => {
    const { character, playerAction, gameLog, combatState, homebrewSummary, validationFeedback } = input;
    
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
    const homebrewSection = homebrewSummary ? `${homebrewSummary.trim()}\n` : '';
    const combatContextValue = combatState && combatState.isActive ? JSON.stringify(combatState, null, 2) : "Nenhum combate ativo.";
  
    const feedbackSection = validationFeedback
        ? `\n### Feedback do Sistema\n${validationFeedback.trim()}\n`
        : '';

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
${homebrewSection ? `\n${homebrewSection}` : ''}
${feedbackSection}

A ação do jogador é: "${playerAction}"

Com base em tudo, continue a aventura. Responda APENAS com um único objeto JSON válido que siga o schema GameMasterResponseSchema.`;
  
    // For Gemma, the full instruction goes into the user prompt
    if (isGemma) {
        const systemInstruction = createSystemInstruction(
            input.useAiHomebrew ?? true,
            input.enableNarrativeRevalidation ?? true
        );
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
export const getGameUpdate = async (input: GameMasterFlowInput, modelName: string, generationConfig: GenerationConfig, apiKey: string): Promise<GameUpdateResult> => {
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

    const systemInstruction = createSystemInstruction(
        input.useAiHomebrew ?? true,
        input.enableNarrativeRevalidation ?? true
    );

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

            // 2️⃣ Sanitização semântica / lógica
            const finalResponse = sanitizeGameMasterResponse(cleanedData, input.character);
            console.log("✅ Resposta final sanitizada:", JSON.stringify(finalResponse, null, 2));
            
            // 3️⃣ Validação estrutural com Zod
            const validationResult = GameMasterResponseSchema.safeParse(finalResponse);
            if (!validationResult.success) {
                console.warn("⚠️ Falha na validação Zod:", validationResult.error.flatten());
                if (!isRetry) return attemptGeneration(true);
                throw createError(500, `A resposta da IA falhou na validação estrutural: ${JSON.stringify(validationResult.error.flatten())}`);
            }

            return {
                response: validationResult.data,
                rawText: jsonText,
            };

        } catch (error: any) {
             if(error instanceof createError.HttpError) throw error;
            console.error(`[aiService (${modelName})] Erro ao chamar a API do Gemini:`, error);
            throw createError(500, `Erro de comunicação com o Mestre de Jogo: ${error.message}`);
        }
    }

    return await attemptGeneration();
};
