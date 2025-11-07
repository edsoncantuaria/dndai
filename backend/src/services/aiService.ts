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

type AiInteractionMode = 'gameplay' | 'combat' | 'generation' | 'audit';


const getGenAI = (apiKey: string) => {
    return new GoogleGenerativeAI(apiKey);
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const estimateTokenCount = (text: string) => Math.ceil(text.length / 4);

const MIN_OUTPUT_TOKENS = 256;
const DEFAULT_OUTPUT_TOKENS = 1024;
const HARD_OUTPUT_CAP = 4096;

const TOKEN_LIMIT_PROFILES: Record<AiInteractionMode, { input: number; output: number; temperature: number }> = {
    gameplay: { input: 16000, output: 2048, temperature: 0.9 },
    combat: { input: 8000, output: 1000, temperature: 0.6 },
    generation: { input: 32000, output: 8192, temperature: 1.0 },
    audit: { input: 12000, output: 3000, temperature: 0.7 },
};

const buildGenerationConfig = (
    promptText: string,
    requestedConfig: GenerationConfig | undefined,
    mode: AiInteractionMode
) => {
    const profile = TOKEN_LIMIT_PROFILES[mode] ?? TOKEN_LIMIT_PROFILES.gameplay;
    const totalBudget = profile.input + profile.output;

    const base: GenerationConfig = {
        temperature: requestedConfig?.temperature ?? profile.temperature,
        topP: requestedConfig?.topP ?? 0.9,
        topK: requestedConfig?.topK ?? 64,
        maxOutputTokens: requestedConfig?.maxOutputTokens ?? profile.output,
    };

    const sanitized: Record<string, any> = {
        temperature: clamp(base.temperature, 0, 1),
        topP: clamp(base.topP, 0, 1),
        topK: Math.max(1, Math.min(base.topK, 128)),
    };

    const promptTokens = estimateTokenCount(promptText);
    if (promptTokens > profile.input) {
        console.warn(`[aiService] Prompt estimado em ${promptTokens} tokens excede o limite sugerido (${profile.input}) para o modo ${mode}. Considere resumir o contexto ou usar o cache.`);
    }

    const requestedMax = clamp(base.maxOutputTokens ?? DEFAULT_OUTPUT_TOKENS, MIN_OUTPUT_TOKENS, HARD_OUTPUT_CAP);
    const availableBudget = Math.max(
        MIN_OUTPUT_TOKENS,
        Math.min(HARD_OUTPUT_CAP, Math.max(totalBudget - promptTokens, MIN_OUTPUT_TOKENS))
    );
    const appliedMax = Math.max(MIN_OUTPUT_TOKENS, Math.min(requestedMax, availableBudget));

    sanitized.temperature = clamp(base.temperature ?? profile.temperature, 0, 1);
    sanitized.maxOutputTokens = appliedMax;
    sanitized.responseMimeType = "application/json";

    return {
        config: sanitized,
        promptTokens,
        requestedMax,
        appliedMax,
        budget: availableBudget,
        profile,
    };
};

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
- Não introduza itens, NPCs ou eventos que não estejam no estado, no resumo ou na timeline; se precisar de algo novo, solicite confirmação explícita do jogador antes.

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

const condenseCombatStateForPrompt = (combatState: any) => {
    if (!combatState || typeof combatState !== 'object' || !Array.isArray(combatState.combatants)) {
        return combatState;
    }

    const mapEffects = (effects: any[] | undefined, max: number) => {
        if (!Array.isArray(effects) || effects.length === 0) return [];
        return effects.slice(0, max).map(effect => ({
            name: effect?.name,
            remainingRounds: effect?.remainingRounds,
            severity: effect?.severity,
        }));
    };

    const mapCooldowns = (cooldowns: any[] | undefined, max: number) => {
        if (!Array.isArray(cooldowns) || cooldowns.length === 0) return [];
        return cooldowns.slice(0, max).map(entry => ({
            name: entry?.name,
            remainingRounds: entry?.remainingRounds,
            totalRounds: entry?.totalRounds,
        }));
    };

    const condensedCombatants = combatState.combatants.map((combatant: any) => ({
        id: combatant.id,
        name: combatant.name,
        attitude: combatant.attitude,
        hp: combatant.hp,
        ac: combatant.ac,
        actionPoints: combatant.actionPoints,
        bonusActionPoints: combatant.bonusActionPoints,
        isPlayer: combatant.isPlayer,
        isDead: combatant.isDead,
        hasMoved: combatant.hasMoved,
        hasActed: combatant.hasActed,
        distance: combatant.distance,
        zone: combatant.zone,
        conditions: combatant.conditions,
        statusEffects: mapEffects(combatant.statusEffects, 4),
        cooldowns: mapCooldowns(combatant.cooldowns, 4),
    }));

    const recentLog = Array.isArray(combatState.log)
        ? combatState.log.slice(-5)
        : undefined;

    return {
        isActive: combatState.isActive,
        round: combatState.round,
        turn: combatState.turn,
        initiativeOrder: combatState.initiativeOrder,
        combatants: condensedCombatants,
        recentLog,
    };
};

const createPrompt = (input: GameMasterFlowInput, isGemma: boolean) => {
    const { character, playerAction, gameLog, combatState, homebrewSummary, validationFeedback, storySummary, timelineFacts } = input;

    const simplifyInventoryItem = (item: any) => {
        if (!item) return null;
        const parsedQuantity = Number(item.quantity);
        const safeQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;

        const simplified: Record<string, any> = {
            id: item.id ?? null,
            index: item.index ?? null,
            name: item.name,
            quantity: safeQuantity,
            equipped: Boolean(item.equipped),
        };

        if (item.weight !== undefined) simplified.weight = item.weight;
        if (item.weapon_category) simplified.weapon_category = item.weapon_category;
        if (item.weapon_range) simplified.weapon_range = item.weapon_range;
        if (item.armor_category) simplified.armor_category = item.armor_category;
        if (item.armor_class) {
            simplified.armor_class = {
                base: item.armor_class.base ?? null,
                dex_bonus: item.armor_class.dex_bonus ?? false,
                max_bonus: item.armor_class.max_bonus ?? null,
            };
        }
        const equipmentCategoryIndex = item.equipment_category?.index || item.equipment_category;
        if (equipmentCategoryIndex) simplified.equipment_category = equipmentCategoryIndex;
        if (item.cost?.quantity && item.cost?.unit) {
            simplified.cost = { quantity: item.cost.quantity, unit: item.cost.unit };
        }
        if (item.damage?.damage_dice || item.damage?.damage_type?.name) {
            simplified.damage = {
                dice: item.damage?.damage_dice ?? null,
                type: item.damage?.damage_type?.name ?? null,
            };
        }
        if (item.two_handed_damage?.damage_dice || item.two_handed_damage?.damage_type?.name) {
            simplified.two_handed_damage = {
                dice: item.two_handed_damage?.damage_dice ?? null,
                type: item.two_handed_damage?.damage_type?.name ?? null,
            };
        }
        if (Array.isArray(item.properties) && item.properties.length > 0) {
            simplified.properties = item.properties
                .map((prop: any) => prop?.index || prop?.name)
                .filter(Boolean);
        }
        if (item.consumable) simplified.consumable = true;
        if (item.usable) simplified.usable = true;
        if (item.recoverable) simplified.recoverable = true;

        return simplified;
    };
    
    // Create a leaner character object for the prompt
    const characterForPrompt = character ? {
        name: character.name,
        race: character.race,
        characterClass: character.characterClass,
        level: character.level,
        attributes: character.attributes,
        proficiencies: character.proficiencies,
        inventory: character.inventory
            .map((item: any) => simplifyInventoryItem(item))
            .filter(Boolean),
        spells: character.spells,
        storySoFar: character.storySoFar,
        worldState: character.worldState,
        relationships: character.relationships.map((r: any) => ({ name: r.name, status: r.status, affinity: r.affinity })),
        journal: character.journal.map((j: any) => ({ name: j.name, region: j.region, status: j.looted ? 'looted' : 'unexplored' }))
    } : null;

    const characterContext = JSON.stringify(characterForPrompt, null, 2);
    const logContext = JSON.stringify(gameLog, null, 2); 
    const homebrewSection = homebrewSummary ? `${homebrewSummary.trim()}\n` : '';
    const combatContextValue = combatState && combatState.isActive
        ? JSON.stringify(condenseCombatStateForPrompt(combatState), null, 2)
        : "Nenhum combate ativo.";
  
    const feedbackSection = validationFeedback
        ? `\n### Feedback do Sistema\n${validationFeedback.trim()}\n`
        : '';

    const summarySection = storySummary
        ? `### Resumo da Jornada
${storySummary}

`
        : '';

    const timelineSection = timelineFacts
        ? `### Fatos Relevantes
${timelineFacts}

`
        : '';

    const mainPrompt = `${summarySection}${timelineSection}### Estado do Personagem
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

    const basePrompt = createPrompt(input, isGemma);

    const attemptGeneration = async (isRetry: boolean = false): Promise<GameMasterResponse> => {
        try {
            let prompt = basePrompt;
            if (isRetry) {
                prompt += "\n\nSua resposta anterior não era um objeto JSON válido ou falhou na validação do schema. Por favor, corrija o formato e forneça uma resposta estritamente no formato JSON solicitado, sem nenhum texto ou marcador extra e garantindo que todos os campos obrigatórios estejam presentes e com os tipos corretos.";
            }

            const mode = input.mode ?? 'gameplay';
            const { config: sanitizedGenerationConfig, requestedMax, appliedMax, promptTokens, profile } =
                buildGenerationConfig(prompt, generationConfig, mode);

            if (appliedMax !== requestedMax) {
                console.log(
                    `[aiService (${modelName})][${mode}] maxOutputTokens ajustado de ${requestedMax} para ${appliedMax} (prompt estimado em ${promptTokens} tokens, perfil sugere ${profile.output}).`
                );
            } else {
                console.log(
                    `[aiService (${modelName})][${mode}] maxOutputTokens=${appliedMax} (prompt estimado em ${promptTokens} tokens).`
                );
            }

            console.log(`[aiService (${modelName})] Gerando conteúdo com prompt...`);
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: sanitizedGenerationConfig,
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
