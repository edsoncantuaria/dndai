// backend/src/services/aiService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import JSON5 from 'json5';
import { Buffer } from 'buffer';
import { GameMasterResponse, GameMasterFlowInput, GameMasterResponseSchema, GameMasterFlowInputSchema } from "../schemas/gameSchemas.js";
import { GenerationConfig } from '../schemas/validationSchemas.js';
import { regrasBase } from '../game/prompts/regrasBase.js';
import { regrasCombate } from '../game/prompts/regrasCombate.js';
import { regrasInventario } from '../game/prompts/regrasInventario.js';
import { sanitizeGameMasterResponse } from './aiSanitizer.js';
import { generateFallbackResponse } from './gameOrchestrator.js';
import createError from 'http-errors';
import type { AiInteractionMode } from '../types/ai.js';
import { recordTokenUsageSample } from './tokenMetricsService.js';
import { env } from '../config/env.js';
import { promises as fs } from 'fs';
import path from 'path';


const getGenAI = (apiKey: string) => {
    return new GoogleGenerativeAI(apiKey);
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const estimateTokenCount = (text: string) => Math.ceil(text.length / 4);

const MIN_OUTPUT_TOKENS = 256;
const DEFAULT_OUTPUT_TOKENS = 1024;
const HARD_OUTPUT_CAP = 4096;
const MAX_MODEL_ATTEMPTS = 3;
const RETRY_OUTPUT_LIMITS = [undefined, 768, 512] as const;
const RETRY_PROMPT_HINTS = [
    '',
    "\n\nSua resposta anterior não era um objeto JSON válido ou falhou na validação do schema. Por favor, corrija o formato e forneça uma resposta estritamente no formato JSON solicitado, sem nenhum texto ou marcador extra e garantindo que todos os campos obrigatórios estejam presentes e com os tipos corretos.",
    "\n\nATENÇÃO: Ainda não recebemos um JSON válido. Produza um JSON mínimo com 1-2 'logEntries' e pelo menos 2 'actionOptions', mantendo-se dentro do schema e sem qualquer texto fora do objeto.",
] as const;
const MAX_PROMPT_TOKENS_BEFORE_SUMMARY = 9500;
const MAX_GAMELOG_CHARS = 6000;
const MAX_JOURNAL_ENTRIES = 12;
const MAX_RELATIONSHIP_ENTRIES = 15;
const HEALTHCHECK_PROMPT_TOKENS = 9000;

const extractResponseText = (response: any): string => {
    if (!response) return '';

    try {
        const primary = typeof response.text === 'function' ? response.text() : response.text;
        if (typeof primary === 'string' && primary.trim()) {
            return primary.trim();
        }
    } catch (err) {
        console.warn('[aiService] Falha ao ler response.text():', err);
    }

    const collectFromParts = (parts: any[] | undefined): string[] => {
        if (!Array.isArray(parts) || !parts.length) return [];
        const chunks: string[] = [];
        for (const part of parts) {
            if (!part || typeof part !== 'object') continue;
            if (typeof part.text === 'string' && part.text.trim()) {
                chunks.push(part.text.trim());
                continue;
            }
            if (part.functionCall) {
                const args = part.functionCall.args;
                if (typeof args === 'string' && args.trim()) {
                    chunks.push(args.trim());
                    continue;
                }
                if (args && typeof args === 'object') {
                    chunks.push(JSON.stringify(args));
                    continue;
                }
            }
            if (part.inlineData?.data) {
                try {
                    const decoded = Buffer.from(part.inlineData.data, 'base64').toString('utf8').trim();
                    if (decoded) {
                        chunks.push(decoded);
                    }
                } catch (decodeErr) {
                    console.warn('[aiService] Falha ao decodificar inlineData:', decodeErr);
                }
            }
        }
        return chunks;
    };

    if (Array.isArray(response?.candidates)) {
        const buffer: string[] = [];
        for (const candidate of response.candidates) {
            const parts = candidate?.content?.parts;
            buffer.push(...collectFromParts(parts));
            if (candidate?.finishReason === 'STOP' && buffer.length) break;
        }
        const fallback = buffer.join('').trim();
        if (fallback) {
            return fallback;
        }
    }

    const promptFeedbackText = response?.promptFeedback?.blockReason
        ? `{"error":"${response.promptFeedback.blockReason}","details":${JSON.stringify(response.promptFeedback)}}`
        : '';
    if (promptFeedbackText) {
        return promptFeedbackText;
    }

    if (response?.cachedContent) {
        return extractResponseText(response.cachedContent);
    }

    return '';
};

const cloneInput = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const debugLogAiStage = async (stage: string, payload: unknown) => {
    if (!env.AI_DEBUG_LOGS) return;
    try {
        const dir = path.join(process.cwd(), 'logs', 'ai');
        await fs.mkdir(dir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = path.join(dir, `${stamp}-${stage}.json`);
        await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (error) {
        console.error('[aiService][debugLog] Falha ao salvar log de debug:', error);
    }
};

const condenseGameMasterInput = (input: GameMasterFlowInput, wasAutoCondensed: { value: boolean }): GameMasterFlowInput => {
    const clone = cloneInput(input);

    if (typeof clone.gameLog === 'string' && clone.gameLog.length > MAX_GAMELOG_CHARS) {
        clone.gameLog = `[...] (Trecho anterior resumido)\n${clone.gameLog.slice(-MAX_GAMELOG_CHARS)}`;
        wasAutoCondensed.value = true;
    }

    if (clone.character) {
        const journal = Array.isArray(clone.character.journal) ? clone.character.journal : [];
        if (journal.length > MAX_JOURNAL_ENTRIES) {
            clone.character.journal = [
                { type: 'system', summary: `(${journal.length - MAX_JOURNAL_ENTRIES} entradas antigas resumidas)` },
                ...journal.slice(-MAX_JOURNAL_ENTRIES),
            ];
            wasAutoCondensed.value = true;
        }

        const relationships = Array.isArray(clone.character.relationships) ? clone.character.relationships : [];
        if (relationships.length > MAX_RELATIONSHIP_ENTRIES) {
            clone.character.relationships = [
                ...relationships.slice(0, 5),
                { name: `+${relationships.length - MAX_RELATIONSHIP_ENTRIES} NPCs`, status: 'summarized' },
                ...relationships.slice(-5),
            ];
            wasAutoCondensed.value = true;
        }
    }

    return clone;
};

const attemptJsonRepair = (input: string): string | null => {
    if (!input || typeof input !== 'string') return null;
    let result = input.trim();
    if (!result) return null;

    // Remove trailing NULL/EOF-like characters
    result = result.replace(/[\u0000]+$/g, '').trimEnd();
    result = result.replace(/,\s*([\]}])/g, '$1');

    // Track braces/brackets to append missing closures
    const stack: string[] = [];
    let inString = false;
    let escape = false;

    for (let i = 0; i < result.length; i++) {
        const char = result[i];
        if (inString) {
            if (escape) {
                escape = false;
                continue;
            }
            if (char === '\\') {
                escape = true;
                continue;
            }
            if (char === '"') {
                inString = false;
            }
            continue;
        }

        switch (char) {
            case '"':
                inString = true;
                break;
            case '{':
            case '[':
                stack.push(char);
                break;
            case '}':
            case ']':
                if (stack.length === 0) {
                    // Remove stray closing brace
                    result = result.slice(0, i) + result.slice(i + 1);
                    i -= 1;
                } else {
                    const last = stack[stack.length - 1];
                    const isMatch = (last === '{' && char === '}') || (last === '[' && char === ']');
                    if (isMatch) {
                        stack.pop();
                    } else {
                        result = result.slice(0, i) + result.slice(i + 1);
                        i -= 1;
                    }
                }
                break;
            case ',':
                // Remove trailing comma fragments like ",\n}"
                const tail = result.slice(i);
                const trailingMatch = tail.match(/^,\s*([}\]])/);
                if (trailingMatch) {
                    result = result.slice(0, i) + trailingMatch[1] + result.slice(i + trailingMatch[0].length);
                    i -= 1;
                }
                break;
            default:
                break;
        }
    }

    if (inString) {
        result += '"';
        inString = false;
    }

    while (stack.length) {
        const opener = stack.pop();
        result += opener === '{' ? '}' : ']';
    }
    result = result.replace(/,\s*([\]}])/g, '$1');
    result = result.replace(/,\s*$/g, '');

    return result;
};

const trimAfterLastClosingBracket = (input: string): string | null => {
    if (!input) return null;
    let inString = false;
    let escape = false;
    const stack: string[] = [];
    let lastClosingIndex = -1;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (inString) {
            if (escape) {
                escape = false;
                continue;
            }
            if (char === '\\') {
                escape = true;
                continue;
            }
            if (char === '"') {
                inString = false;
            }
            continue;
        }
        if (char === '"') {
            inString = true;
            continue;
        }
        if (char === '{' || char === '[') {
            stack.push(char);
            continue;
        }
        if (char === '}' || char === ']') {
            if (stack.length) {
                stack.pop();
            }
            lastClosingIndex = i;
        }
    }

    if (lastClosingIndex === -1) return null;
    return input.slice(0, lastClosingIndex + 1);
};

const TOKEN_LIMIT_PROFILES: Record<AiInteractionMode, { temperature: number; defaultMaxOutput: number }> = {
    gameplay: { temperature: 0.9, defaultMaxOutput: 2048 },
    combat: { temperature: 0.6, defaultMaxOutput: 1200 },
    generation: { temperature: 1.0, defaultMaxOutput: 8192 },
    audit: { temperature: 0.7, defaultMaxOutput: 3000 },
};

const buildGenerationConfig = (
    promptText: string,
    requestedConfig: GenerationConfig | undefined,
    mode: AiInteractionMode,
    measuredPromptTokens?: number
) => {
    const profile = TOKEN_LIMIT_PROFILES[mode] ?? TOKEN_LIMIT_PROFILES.gameplay;

    const base: GenerationConfig = {
        temperature: requestedConfig?.temperature ?? profile.temperature,
        topP: requestedConfig?.topP ?? 0.9,
        topK: requestedConfig?.topK ?? 64,
        maxOutputTokens: requestedConfig?.maxOutputTokens ?? profile.defaultMaxOutput,
    };

    const sanitized: Record<string, any> = {
        temperature: clamp(base.temperature, 0, 1),
        topP: clamp(base.topP, 0, 1),
        topK: Math.max(1, Math.min(base.topK, 128)),
    };

    const promptTokens = typeof measuredPromptTokens === 'number' && Number.isFinite(measuredPromptTokens)
        ? measuredPromptTokens
        : estimateTokenCount(promptText);

    const requestedMax = clamp(base.maxOutputTokens ?? DEFAULT_OUTPUT_TOKENS, MIN_OUTPUT_TOKENS, HARD_OUTPUT_CAP);
    sanitized.temperature = clamp(base.temperature ?? profile.temperature, 0, 1);
    sanitized.maxOutputTokens = requestedMax;
    sanitized.responseMimeType = "application/json";

    return {
        config: sanitized,
        promptTokens,
        requestedMax,
        appliedMax: sanitized.maxOutputTokens,
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

const instructionCache = new Map<string, string>();
const getCachedInstruction = (useAiHomebrew: boolean, enableNarrativeRevalidation: boolean) => {
    const cacheKey = `${useAiHomebrew ? '1' : '0'}-${enableNarrativeRevalidation ? '1' : '0'}`;
    if (!instructionCache.has(cacheKey)) {
        instructionCache.set(cacheKey, createSystemInstruction(useAiHomebrew, enableNarrativeRevalidation));
    }
    return instructionCache.get(cacheKey)!;
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

const safeArray = <T>(value: T[] | undefined | null): T[] => Array.isArray(value) ? value : [];

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
        proficiencies: safeArray(character.proficiencies),
        inventory: safeArray(character.inventory)
            .map((item: any) => simplifyInventoryItem(item))
            .filter(Boolean),
        spells: safeArray(character.spells),
        storySoFar: character.storySoFar,
        worldState: character.worldState,
        relationships: safeArray(character.relationships).map((r: any) => ({ name: r.name, status: r.status, affinity: r.affinity })),
        journal: safeArray(character.journal).map((j: any) => ({ name: j.name, region: j.region, status: j.looted ? 'looted' : 'unexplored' }))
    } : null;

    const characterContext = JSON.stringify(characterForPrompt);
    const homebrewSection = homebrewSummary ? `HOMEBREW=${homebrewSummary.trim()}\n` : '';
    const combatContextValue = combatState && combatState.isActive
        ? JSON.stringify(condenseCombatStateForPrompt(combatState))
        : '"Nenhum combate ativo."';
  
    const feedbackSection = validationFeedback
        ? `FEEDBACK=${validationFeedback.trim()}\n`
        : '';

    const summarySection = storySummary ? `RESUMO=${storySummary}\n` : '';
    const timelineSection = timelineFacts ? `FATOS=${timelineFacts}\n` : '';

    const mainPrompt = `${summarySection}${timelineSection}${homebrewSection}${feedbackSection}PERSONAGEM=${characterContext}
COMBATE=${combatContextValue}
LOG=${gameLog}
ACAO=${playerAction}

Responda APENAS com um único objeto JSON válido que siga o schema GameMasterResponseSchema.`;
  
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

    const systemInstruction = getCachedInstruction(
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

    const rawPromptPreview = createPrompt(input, isGemma);

    const wasCondensed = { value: false };
    const condensedInput = condenseGameMasterInput(input, wasCondensed);
    if (wasCondensed.value) {
        condensedInput.validationFeedback = condensedInput.validationFeedback
            ? `${condensedInput.validationFeedback}\n[Prompt] Histórico condensado automaticamente para caber no limite.`
            : '[Prompt] Histórico condensado automaticamente para caber no limite.';
    }
    
    const basePrompt = createPrompt(condensedInput, isGemma);
    const digestTelemetry: { before?: number; after?: number } = {};
    try {
        const baselineTokens = await model.countTokens({
            contents: [{ role: "user", parts: [{ text: rawPromptPreview }] }],
        });
        digestTelemetry.before = baselineTokens?.totalTokens ?? baselineTokens?.tokenCount ?? undefined;
        if (typeof digestTelemetry.before === 'number') {
            console.log(
                `[aiService (${modelName})][${input.mode ?? 'gameplay'}] countTokens (pré-digest) = ${digestTelemetry.before}`
            );
        }
    } catch (baselineError) {
        console.warn('[aiService] Falha ao medir tokens antes do digest:', baselineError);
    }

    let healthCheckPerformed = false;
    let healthCheckSucceeded = false;

    const runHealthCheck = async () => {
        if (healthCheckPerformed) {
            if (!healthCheckSucceeded) {
                throw new Error('Health check prévio falhou.');
            }
            return;
        }
        healthCheckPerformed = true;
        try {
            const pingResult = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: 'Responda apenas com "OK".' }] }],
                generationConfig: { maxOutputTokens: 4, temperature: 0.1 },
            });
            const pingText = extractResponseText(pingResult.response);
            if (!pingText || !/^ok\b/i.test(pingText)) {
                throw new Error(`Ping retornou "${pingText ?? '<vazio>'}"`);
            }
            healthCheckSucceeded = true;
        } catch (err) {
            console.error('[aiService] Health check do modelo falhou:', err);
            throw err;
        }
    };

    const attemptGeneration = async (attemptIndex: number = 0): Promise<GameUpdateResult> => {
        const isRetry = attemptIndex > 0;
        const createResilienceFallback = (issue: string): GameUpdateResult => {
            const fallback = generateFallbackResponse(
                { character: input.character },
                input.playerAction ?? 'ação anterior desconhecida',
                [issue]
            );
            const resilienceNote = `[Resiliência] O modelo falhou após ${MAX_MODEL_ATTEMPTS} tentativas. Motivo: ${issue}`;
            fallback.systemLog = fallback.systemLog
                ? `${fallback.systemLog}\n${resilienceNote}`
                : resilienceNote;
            return {
                response: fallback,
                rawText: '',
            };
        };

        const ensureRetryOrFallback = (issue: string): Promise<GameUpdateResult> => {
            if (attemptIndex + 1 < MAX_MODEL_ATTEMPTS) {
                console.warn(`[aiService] ${issue} | Repetindo (tentativa ${attemptIndex + 2}/${MAX_MODEL_ATTEMPTS}).`);
                return attemptGeneration(attemptIndex + 1);
            }
            console.error(`[aiService] ${issue} | Acionando fallback resiliente.`);
            return Promise.resolve(createResilienceFallback(issue));
        };

        try {
            const mode = input.mode ?? 'gameplay';
            let prompt = basePrompt + (RETRY_PROMPT_HINTS[attemptIndex] ?? '');
            if (attemptIndex === 0 && env.AI_DEBUG_LOGS) {
                void debugLogAiStage('prompt', {
                    mode,
                    attempt: attemptIndex + 1,
                    playerAction: input.playerAction,
                    characterId: input.character?.id,
                    prompt,
                });
            }
            let measuredTokens: number | undefined;
            try {
                const tokenCountResult = await model.countTokens({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                });
                measuredTokens = tokenCountResult?.totalTokens ?? tokenCountResult?.tokenCount ?? undefined;
                if (typeof measuredTokens === 'number') {
                    digestTelemetry.after = measuredTokens;
                    const baselineInfo = typeof digestTelemetry.before === 'number'
                        ? ` | baseline=${digestTelemetry.before}`
                        : '';
                    console.log(
                        `[aiService (${modelName})][${mode}] countTokens (compacto) = ${measuredTokens}${baselineInfo}`
                    );
                    if (attemptIndex === 0) {
                        try {
                            await recordTokenUsageSample(mode, digestTelemetry.before, measuredTokens);
                        } catch (metricError) {
                            console.error('[tokenMetrics] Falha ao registrar uso de tokens:', metricError);
                        }
                    }
                }
            } catch (countError) {
                console.warn('[aiService] Falha ao contar tokens com countTokens:', countError);
            }

            const { config: sanitizedGenerationConfig, requestedMax, appliedMax, promptTokens, profile } =
                buildGenerationConfig(prompt, generationConfig, mode, measuredTokens);

            const retryCap = RETRY_OUTPUT_LIMITS[attemptIndex];
            if (retryCap !== undefined) {
                const currentMax = sanitizedGenerationConfig.maxOutputTokens ?? appliedMax ?? DEFAULT_OUTPUT_TOKENS;
                sanitizedGenerationConfig.maxOutputTokens = clamp(
                    Math.min(currentMax, retryCap),
                    MIN_OUTPUT_TOKENS,
                    HARD_OUTPUT_CAP
                );
            }
            if (attemptIndex >= 2) {
                const currentTemp = typeof sanitizedGenerationConfig.temperature === 'number'
                    ? sanitizedGenerationConfig.temperature
                    : 0.7;
                sanitizedGenerationConfig.temperature = Math.min(currentTemp, 0.4);
            }

            const shouldPing = (promptTokens ?? measuredTokens ?? 0) >= HEALTHCHECK_PROMPT_TOKENS;
            if (shouldPing) {
                try {
                    await runHealthCheck();
                } catch (pingError) {
                    return ensureRetryOrFallback(`Falha no ping do modelo: ${pingError instanceof Error ? pingError.message : 'motivo desconhecido'}`);
                }
            }

            console.log(
                `[aiService (${modelName})][${mode}] maxOutputTokens=${appliedMax} (prompt real ${promptTokens} tokens, default perfil ${profile.defaultMaxOutput}).`
            );

            console.log(`[aiService (${modelName})] Gerando conteúdo com prompt...`);
            if (env.AI_DEBUG_LOGS) {
                void debugLogAiStage('prompt', {
                    mode,
                    attempt: attemptIndex + 1,
                    playerAction: input.playerAction,
                    characterId: input.character?.id,
                    prompt,
                    generationConfig: sanitizedGenerationConfig,
                });
            }
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

            const jsonText = extractResponseText(response);
            if (env.AI_DEBUG_LOGS) {
                console.log(`[aiService][raw-response][${mode}][attempt ${attemptIndex + 1}]`, jsonText);
                void debugLogAiStage('raw-response', {
                    mode,
                    attempt: attemptIndex + 1,
                    playerAction: input.playerAction,
                    characterId: input.character?.id,
                    text: jsonText,
                });
            }
            
            if (!jsonText) {
                 console.error(`[aiService] Resposta da IA vazia na tentativa ${attemptIndex + 1}.`);
                 return ensureRetryOrFallback("O Mestre de Jogo não respondeu com conteúdo.");
            }
            
            let responseData: any;
            try {
                let textToParse = jsonText.trim();
                if (!textToParse.startsWith('{') && !textToParse.startsWith('[')) {
                    const jsonMatch = textToParse.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        textToParse = jsonMatch[0];
                    }
                }
                responseData = JSON.parse(textToParse);
            } catch(e: any) {
                console.error(`[aiService] Falha ao analisar o JSON na tentativa ${isRetry ? 2 : 1}:`, e);
                let repairedData: any = null;
                const structurallyRepairedText = attemptJsonRepair(jsonText);
                if (structurallyRepairedText) {
                    try {
                        repairedData = JSON.parse(structurallyRepairedText);
                        console.warn('[aiService] attemptJsonRepair conseguiu reconstruir a resposta inválida.');
                    } catch (repairParseError: any) {
                        console.error('[aiService] attemptJsonRepair falhou ao gerar JSON válido:', repairParseError);
                    }
                }

                if (!repairedData) {
                    const trimmed = trimAfterLastClosingBracket(jsonText);
                    if (trimmed && trimmed.length < jsonText.length) {
                        try {
                            repairedData = JSON.parse(trimmed);
                            console.warn('[aiService] truncou fragmento final incompleto e conseguiu analisar o JSON.');
                        } catch (trimError: any) {
                            console.error('[aiService] Falha ao analisar JSON mesmo após truncar fragmento:', trimError);
                        }
                    }
                }

                if (!repairedData) {
                    try {
                        repairedData = JSON5.parse(jsonText);
                        console.warn('[aiService] JSON5 reparou a resposta parcialmente inválida.');
                    } catch (json5Error: any) {
                        console.error('[aiService] JSON5 também falhou ao interpretar a resposta:', json5Error);
                        return ensureRetryOrFallback(`Resposta em formato inválido: ${e.message}`);
                    }
                }

                responseData = repairedData;
            }

            // 1️⃣ Mini-sanitizer (limpeza pré-validação)
            const cleanedData = miniSanitize(responseData);

            // 2️⃣ Sanitização semântica / lógica
            const finalResponse = sanitizeGameMasterResponse(cleanedData, input.character);
            
            // 3️⃣ Validação estrutural com Zod
            const validationResult = GameMasterResponseSchema.safeParse(finalResponse);
            if (!validationResult.success) {
                console.warn("⚠️ Falha na validação Zod:", validationResult.error.flatten());
                if (!isRetry) return attemptGeneration(true);
                throw createError(500, `A resposta da IA falhou na validação estrutural: ${JSON.stringify(validationResult.error.flatten())}`);
            }

            if (env.AI_DEBUG_LOGS) {
                void debugLogAiStage('sanitized-response', {
                    mode,
                    attempt: attemptIndex + 1,
                    playerAction: input.playerAction,
                    characterId: input.character?.id,
                    response: validationResult.data,
                });
            }

            return {
                response: validationResult.data,
                rawText: jsonText,
            };

        } catch (error: any) {
            const message = String(error?.message || '');
            const status = error?.status || error?.response?.status;
            if (status === 400 && /api key not valid/i.test(message)) {
                throw createError(400, 'Sua chave da API do Google Gemini é inválida ou expirou. Abra as Configurações e atualize a chave para continuar a aventura.');
            }
            if (/não respondeu/i.test(message)) {
                return ensureRetryOrFallback('O Mestre de Jogo não respondeu.');
            }
            if (error instanceof createError.HttpError) throw error;
            console.error(`[aiService (${modelName})] Erro ao chamar a API do Gemini:`, error);
            return ensureRetryOrFallback(`Erro de comunicação com o Mestre de Jogo: ${error.message}`);
        }
    }

    return await attemptGeneration();
};
