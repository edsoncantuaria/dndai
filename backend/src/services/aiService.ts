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
import { runGmValidator, ValidatorContext } from './gmValidator.js';
import createError from 'http-errors';
import type { AiInteractionMode } from '../types/ai.js';
import { recordTokenUsageSample } from './tokenMetricsService.js';
import { env } from '../config/env.js';
import { promises as fs } from 'fs';
import path from 'path';
import { GAME_MASTER_RESPONSE_JSON_SCHEMA, GAME_MASTER_SCHEMA_HASH, markSchemaDrift, migrateLegacyResponse, normalizeResponseSchema, responseMatchesCurrentSchema } from './schemaIntegrityService.js';
import { GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA } from '../schemas/gameMasterResponseGenerativeSchema.js';
import { reconstructSemanticIntent } from './semanticRecoveryService.js';
import { attemptJsonRepair, buildContinuationSnippet, softTailRepair, stripCodeFences, stripSuffix, trimAfterLastClosingBracket } from './aiRepairUtils.js';
import { buildFailSoftResponse } from './failSoftService.js';
import { loadSessionSnapshot, normalizeSessionId, registerFailure, resetFailures, saveSessionSnapshot } from './sessionRecoveryCache.js';


const getGenAI = (apiKey: string) => {
    return new GoogleGenerativeAI(apiKey);
}

const allowResponseSchemaForModel = (modelName: string): boolean => {
    if (!RESPONSE_SCHEMA_GLOBAL_ENABLED) return false;
    const lower = modelName.toLowerCase();
    if (!lower.includes('gemini')) return false;
    if (RESPONSE_SCHEMA_MODEL_BLOCKLIST.some(token => token && lower.includes(token))) {
        return false;
    }
    if (RESPONSE_SCHEMA_MODEL_ALLOWLIST.length === 0) {
        return true;
    }
    return RESPONSE_SCHEMA_MODEL_ALLOWLIST.some(token => token && lower.includes(token));
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const estimateTokenCount = (text: string) => Math.ceil(text.length / 4);

const MIN_OUTPUT_TOKENS = 256;
const DEFAULT_OUTPUT_TOKENS = 1024;
const HARD_OUTPUT_CAP = 4096;
const MAX_MODEL_ATTEMPTS = 3;
const RETRY_OUTPUT_LIMITS = [undefined, undefined, undefined] as const;
const RETRY_PROMPT_HINTS = [
    '',
    "\n\nSua resposta anterior não era um objeto JSON válido ou falhou na validação do schema. Por favor, corrija o formato e forneça uma resposta estritamente no formato JSON solicitado, sem nenhum texto ou marcador extra e garantindo que todos os campos obrigatórios estejam presentes e com os tipos corretos.",
    "\n\nATENÇÃO FINAL: Reescreva o GameMasterResponse COMPLETO, obedecendo o schema integralmente e sem repetir texto fora do JSON. Priorize fechar todas as chaves e inclua, no mínimo, logEntries, actionOptions, updatedCharacter, worldState e combatState (mesmo vazios).",
] as const;
const MODEL_FAILOVER_CHAIN = ['gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'];
const TRANSIENT_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const TRANSIENT_ERROR_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ENOTFOUND']);
const MAX_PROMPT_TOKENS_BEFORE_SUMMARY = 9500;
const MAX_GAMELOG_CHARS = 3000;
const MAX_JOURNAL_ENTRIES = 8;
const MAX_RELATIONSHIP_ENTRIES = 10;
const HEALTHCHECK_PROMPT_TOKENS = 9000;
const GM_VALIDATOR_FALLBACK_SNIPPET = 1200;
const GM_FALLBACK_META_NOTE = 'Reinício do turno detectado; resposta restaurada após erro do modelo.';
const MAX_PROMPT_INVENTORY_ITEMS = 12;
const INCOMPLETE_END_FLAG = '[INCOMPLETE_END_FLAG]';
const RESPONSE_SCHEMA_GLOBAL_ENABLED = ['1', 'true', 'yes', 'on'].includes(
    (process.env.AI_ENABLE_RESPONSE_SCHEMA ?? 'false').toString().trim().toLowerCase()
);
const RESPONSE_SCHEMA_MODEL_BLOCKLIST = (process.env.AI_RESPONSE_SCHEMA_BLOCKLIST ?? '')
    .split(',')
    .map(token => token.trim().toLowerCase())
    .filter(Boolean);
const RESPONSE_SCHEMA_MODEL_ALLOWLIST = (process.env.AI_RESPONSE_SCHEMA_MODELS ?? '')
    .split(',')
    .map(token => token.trim().toLowerCase())
    .filter(Boolean);
const FORCE_JSON_MIME = ['1', 'true', 'yes', 'on'].includes(
    (process.env.AI_FORCE_JSON_MIME ?? 'true').toString().trim().toLowerCase()
);

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

const debugLogAiStage = async (stage: string, payload: unknown, context?: { mode?: string }) => {
    if (!env.AI_DEBUG_LOGS) return;
    try {
        const dir = path.join(process.cwd(), 'logs', 'ai');
        await fs.mkdir(dir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = path.join(dir, `${stamp}-${stage}.json`);
        const entry = {
            stage,
            mode: context?.mode ?? 'unknown',
            schemaHash: GAME_MASTER_SCHEMA_HASH,
            payload,
        };
        await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf8');
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const computeBackoffDelay = (attempt: number) => 250 * Math.pow(2, attempt) + Math.floor(Math.random() * 150);
const resolveFailoverModel = (current: string): string | null => {
    const normalized = current.toLowerCase();
    const index = MODEL_FAILOVER_CHAIN.findIndex(entry => entry === normalized || entry === current);
    if (index !== -1 && index + 1 < MODEL_FAILOVER_CHAIN.length) {
        return MODEL_FAILOVER_CHAIN[index + 1];
    }
    if (index === -1 && MODEL_FAILOVER_CHAIN.length) {
        return MODEL_FAILOVER_CHAIN[MODEL_FAILOVER_CHAIN.length - 1];
    }
    return null;
};

const attemptSemanticMirrorRecovery = async (
    partialJson: string,
    model: any
): Promise<any | null> => {
    if (!partialJson) return null;
    const snippet = buildContinuationSnippet(partialJson);
    const mirrorPrompt = `Você gerou um JSON truncado. Reescreva o mesmo conteúdo em um único objeto GameMasterResponse COMPLETO e válido. Não explique nada, apenas retorne o JSON final. Se faltarem campos, use objetos ou arrays vazios.\nTRECHO=${snippet}`;
    try {
        const mirrorResult = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: mirrorPrompt }] }],
            generationConfig: {
                maxOutputTokens: 512,
                temperature: 0,
                topP: 0.8,
                responseMimeType: 'application/json',
            },
        });
        const mirrorText = extractResponseText(mirrorResult.response);
        if (!mirrorText) return null;
        const repaired = softTailRepair(mirrorText) ?? mirrorText;
        return JSON.parse(repaired);
    } catch (error) {
        console.warn('[aiService] Reflexive mirror recovery falhou:', error);
        return null;
    }
};

const buildFallbackLogSnippet = (text: string): string => {
    if (!text || typeof text !== 'string') {
        return 'O Mestre de Jogo respondeu com um texto ilegível, então o sistema manteve a narrativa estável.';
    }
    const compact = text
        .replace(/[\u0000]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!compact) {
        return 'O Mestre de Jogo respondeu com um texto ilegível, então o sistema manteve a narrativa estável.';
    }
    if (compact.length <= GM_VALIDATOR_FALLBACK_SNIPPET) {
        return compact;
    }
    return `${compact.slice(0, GM_VALIDATOR_FALLBACK_SNIPPET - 3)}...`;
};

const extractWorldStateSnapshot = (character: any) => {
    if (!character || typeof character !== 'object') return undefined;
    const worldState = character.worldState;
    if (!worldState || typeof worldState !== 'object') return undefined;
    const snapshot: Record<string, any> = {};
    if (typeof worldState.timeOfDay === 'string') snapshot.timeOfDay = worldState.timeOfDay;
    if (typeof worldState.weather === 'string') snapshot.weather = worldState.weather;
    if (typeof worldState.currentRegion === 'string') snapshot.currentRegion = worldState.currentRegion;
    return Object.keys(snapshot).length ? snapshot : undefined;
};

const buildValidatorContextFromInput = (input: GameMasterFlowInput): ValidatorContext => {
    const character = input.character ?? {};
    const context: ValidatorContext = {};
    const memoryContext = character?.memoryContext;

    if (memoryContext && typeof memoryContext === 'object') {
        if (typeof memoryContext.summary === 'string' && memoryContext.summary.trim()) {
            context.memorySummary = memoryContext.summary.trim();
        }
        if (Array.isArray(memoryContext.references)) {
            context.memoryReferences = memoryContext.references.filter((ref: unknown) => typeof ref === 'string') as string[];
        }
    }

    const gameClock = character?.gameClock;
    if (gameClock && typeof gameClock === 'object') {
        context.gameClock = {
            day: typeof gameClock.day === 'number' ? gameClock.day : undefined,
            hour: typeof gameClock.hour === 'number' ? gameClock.hour : undefined,
            weather: typeof gameClock.weather === 'string' ? gameClock.weather : undefined,
        };
    }

    return context;
};

const extractBalancedJsonSection = (text: string, fieldName: string): string | null => {
    if (!text) return null;
    const fieldToken = `"${fieldName}"`;
    const fieldIndex = text.indexOf(fieldToken);
    if (fieldIndex === -1) return null;
    const colonIndex = text.indexOf(':', fieldIndex + fieldToken.length);
    if (colonIndex === -1) return null;
    let cursor = colonIndex + 1;
    while (cursor < text.length && /\s/.test(text[cursor])) cursor++;
    const opener = text[cursor];
    const closer = opener === '[' ? ']' : opener === '{' ? '}' : null;
    if (!closer) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    const start = cursor;
    for (let i = cursor; i < text.length; i++) {
        const char = text[i];
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
        if (char === opener) {
            depth += 1;
        } else if (char === closer) {
            depth -= 1;
            if (depth === 0) {
                return text.slice(start, i + 1);
            }
        }
    }
    return null;
};

const extractArrayFieldFromRawJson = <T>(text: string, fieldName: string): T[] | undefined => {
    const section = extractBalancedJsonSection(text, fieldName);
    if (!section) return undefined;
    try {
        const parsed = JSON5.parse(section);
        return Array.isArray(parsed) ? parsed : undefined;
    } catch (err) {
        console.warn(`[aiService] Falha ao extrair campo de array "${fieldName}" do fallback:`, err);
        return undefined;
    }
};

const extractObjectFieldFromRawJson = (text: string, fieldName: string): Record<string, any> | undefined => {
    const section = extractBalancedJsonSection(text, fieldName);
    if (!section) return undefined;
    try {
        const parsed = JSON5.parse(section);
        return parsed && typeof parsed === 'object' ? parsed : undefined;
    } catch (err) {
        console.warn(`[aiService] Falha ao extrair campo de objeto "${fieldName}" do fallback:`, err);
        return undefined;
    }
};

const deriveBulletListFromText = (text: string): string[] => {
    if (!text || typeof text !== 'string') return [];
    const lines = text.split(/\r?\n/);
    const pattern = /^\s*(?:[-*•]|[0-9]+[\.)]|[A-Za-z][\.)])\s+(.*)$/;
    const results: string[] = [];
    for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue;
        const match = trimmed.match(pattern);
        if (match && match[1]) {
            const candidate = match[1].trim();
            if (candidate.length >= 4 && !results.includes(candidate)) {
                results.push(candidate);
            }
        }
    }
    return results;
};

const deriveActionOptionsFromSentences = (text: string): string[] => {
    if (!text || typeof text !== 'string') return [];
    const chunks = text
        .replace(/[\r\n]+/g, '\n')
        .split(/(?:\.|!|\?)(?:\s+|$)/)
        .map(sentence => sentence.trim())
        .filter(Boolean);
    const verbs = ['tente', 'tentar', 'investigue', 'investigar', 'observe', 'observar', 'ataque', 'atacar', 'fuja', 'responda', 'decida', 'pergunte', 'perguntar', 'procure', 'procurar', 'peça', 'pedir', 'use', 'usar', 'prepare', 'preparar'];
    const results: string[] = [];
    for (const chunk of chunks) {
        const lower = chunk.toLowerCase();
        if (verbs.some(verb => lower.startsWith(verb))) {
            results.push(chunk);
        }
    }
    return results.slice(0, 4);
};

const deriveLogEntriesFromGameLog = (gameLog?: string, limit: number = 4) => {
    if (!gameLog || typeof gameLog !== 'string') return [];
    const lines = gameLog.split(/\n+/).filter(Boolean);
    const tail = lines.slice(-limit);
    return tail
        .map(line => {
            const [role, ...rest] = line.split(':');
            const content = rest.join(':').trim();
            if (!content) return null;
            const normalizedRole = (role || '').trim().toUpperCase();
            const type = normalizedRole === 'JOGADOR' ? 'action' : 'narration';
            return { type, content };
        })
        .filter(Boolean) as Array<{ type: string; content: string }>;
};

const gmValidatorFallbackFromRawResponse = (
    rawText: string,
    parseIssue: string,
    input: GameMasterFlowInput,
    telemetry?: { attempt?: number }
): GameMasterResponse => {
    const snippet = buildFallbackLogSnippet(rawText);
    const baseResponse = {
        logEntries: [{ type: 'narration', content: snippet }],
        actionOptions: [],
        updatedCharacter: {},
        systemLog: `[GM Validator Fallback] ${parseIssue}`,
    } as GameMasterResponse;

    const fallbackTelemetry = {
        parseIssue,
        recoveredSections: [] as string[],
        attempt: telemetry?.attempt ?? null,
    };

    const worldStateSnapshot = extractWorldStateSnapshot(input.character);
    if (worldStateSnapshot) {
        baseResponse.worldState = worldStateSnapshot;
    }
    const shouldSeedCombatSnapshot = Boolean(input.combatState && typeof input.combatState === 'object' && input.combatState.isActive);
    if (shouldSeedCombatSnapshot) {
        try {
            baseResponse.combatState = cloneInput(input.combatState);
        } catch (err) {
            console.warn('[aiService] Falha ao clonar combatState para o fallback:', err);
            baseResponse.combatState = input.combatState as any;
        }
    }

    const characterShopState = (input.character as any)?.shopState;
    const shouldSeedShopSnapshot = Boolean(characterShopState && typeof characterShopState === 'object' && characterShopState.isOpen);
    if (shouldSeedShopSnapshot) {
        try {
            baseResponse.shopState = cloneInput(characterShopState);
        } catch (err) {
            console.warn('[aiService] Falha ao clonar shopState do personagem para o fallback:', err);
            baseResponse.shopState = characterShopState;
        }
    }

    let recoveredLogsFromRaw = false;

    const recoveredLogEntries = extractArrayFieldFromRawJson(rawText, 'logEntries');
    if (recoveredLogEntries && recoveredLogEntries.length) {
        baseResponse.logEntries = recoveredLogEntries as any;
        recoveredLogsFromRaw = true;
        fallbackTelemetry.recoveredSections.push('logEntries');
    }

    const recoveredActions = extractArrayFieldFromRawJson(rawText, 'actionOptions');
    if (recoveredActions && recoveredActions.length) {
        baseResponse.actionOptions = recoveredActions as any;
        fallbackTelemetry.recoveredSections.push('actionOptions');
    }

    if ((!baseResponse.actionOptions || baseResponse.actionOptions.length === 0) && rawText) {
        const bulletActions = deriveBulletListFromText(rawText);
        const sentenceActions = deriveActionOptionsFromSentences(rawText);
        const heuristicActions = [...bulletActions, ...sentenceActions].filter(Boolean);
        if (heuristicActions.length) {
            baseResponse.actionOptions = heuristicActions;
            fallbackTelemetry.recoveredSections.push('actionOptions-heuristic');
        }
    }

    const recoveredWorldState = extractObjectFieldFromRawJson(rawText, 'worldState');
    if (recoveredWorldState) {
        baseResponse.worldState = recoveredWorldState as any;
        fallbackTelemetry.recoveredSections.push('worldState');
    }

    const recoveredPlayerRoll = extractObjectFieldFromRawJson(rawText, 'playerRollRequest');
    if (recoveredPlayerRoll) {
        baseResponse.playerRollRequest = recoveredPlayerRoll as any;
        fallbackTelemetry.recoveredSections.push('playerRollRequest');
    }

    const recoveredCombatState = extractObjectFieldFromRawJson(rawText, 'combatState');
    if (recoveredCombatState) {
        baseResponse.combatState = recoveredCombatState as any;
        fallbackTelemetry.recoveredSections.push('combatState');
    }

    const recoveredGameClock = extractObjectFieldFromRawJson(rawText, 'gameClock');
    if (recoveredGameClock) {
        baseResponse.gameClock = recoveredGameClock as any;
        fallbackTelemetry.recoveredSections.push('gameClock');
    }

    const recoveredMemory = extractObjectFieldFromRawJson(rawText, 'memoryContext');
    if (recoveredMemory) {
        baseResponse.memoryContext = recoveredMemory as any;
        fallbackTelemetry.recoveredSections.push('memoryContext');
    }

    const recoveredUpdatedCharacter = extractObjectFieldFromRawJson(rawText, 'updatedCharacter');
    if (recoveredUpdatedCharacter) {
        baseResponse.updatedCharacter = recoveredUpdatedCharacter as any;
        fallbackTelemetry.recoveredSections.push('updatedCharacter');
    }

    const recoveredXpEvents = extractArrayFieldFromRawJson(rawText, 'xpEvents');
    if (recoveredXpEvents && recoveredXpEvents.length) {
        baseResponse.xpEvents = recoveredXpEvents as any;
        fallbackTelemetry.recoveredSections.push('xpEvents');
    }

    const recoveredProgression = extractArrayFieldFromRawJson(rawText, 'progressionFeed');
    if (recoveredProgression && recoveredProgression.length) {
        baseResponse.progressionFeed = recoveredProgression as any;
        fallbackTelemetry.recoveredSections.push('progressionFeed');
    }

    const recoveredHomebrew = extractArrayFieldFromRawJson(rawText, 'newHomebrewContent');
    if (recoveredHomebrew && recoveredHomebrew.length) {
        baseResponse.newHomebrewContent = recoveredHomebrew as any;
        fallbackTelemetry.recoveredSections.push('newHomebrewContent');
    }

    const recoveredShopState = extractObjectFieldFromRawJson(rawText, 'shopState');
    if (recoveredShopState) {
        baseResponse.shopState = recoveredShopState as any;
        fallbackTelemetry.recoveredSections.push('shopState');
    }

    const recoveredLootOffer = extractObjectFieldFromRawJson(rawText, 'lootOffer');
    if (recoveredLootOffer) {
        baseResponse.lootOffer = recoveredLootOffer as any;
        fallbackTelemetry.recoveredSections.push('lootOffer');
    }

    const recoveredHitDiceRequest = extractObjectFieldFromRawJson(rawText, 'useHitDiceRequest');
    if (recoveredHitDiceRequest) {
        baseResponse.useHitDiceRequest = recoveredHitDiceRequest as any;
        fallbackTelemetry.recoveredSections.push('useHitDiceRequest');
    }

    const recoveredLevelUpState = extractObjectFieldFromRawJson(rawText, 'levelUpState');
    if (recoveredLevelUpState) {
        baseResponse.levelUpState = recoveredLevelUpState as any;
        fallbackTelemetry.recoveredSections.push('levelUpState');
    }

    const deriveLogEntriesFromCombat = () => {
        if (!shouldSeedCombatSnapshot || recoveredLogsFromRaw) return;
        const combatLog = baseResponse.combatState?.log;
        if (!Array.isArray(combatLog) || combatLog.length === 0) return;
        const mapped = combatLog
            .slice(-4)
            .map(entry => {
                if (!entry) return null;
                if (typeof entry === 'string') return { type: 'combat', content: entry };
                if (typeof entry === 'object') {
                    const entryType = typeof entry.type === 'string' ? entry.type : 'combat';
                    const content = typeof entry.content === 'string'
                        ? entry.content
                        : JSON.stringify(entry);
                    const next: any = { type: entryType, content };
                    if (entry.rollResult) next.rollResult = entry.rollResult;
                    return next;
                }
                return null;
            })
            .filter(Boolean);
        if (mapped.length) {
            baseResponse.logEntries = mapped as any;
            recoveredLogsFromRaw = true;
            fallbackTelemetry.recoveredSections.push('combat-log');
        }
    };

    const ensureShopNarration = () => {
        if (recoveredLogsFromRaw || !shouldSeedShopSnapshot || !baseResponse.shopState) return;
        const shopName = typeof baseResponse.shopState.name === 'string' ? baseResponse.shopState.name : 'a loja';
        const descriptor = baseResponse.shopState.isHaggling ? 'negociando preços' : 'avaliando o estoque';
        baseResponse.logEntries = [
            { type: 'narration', content: `Você permanece em ${shopName}, ${descriptor} antes de decidir o próximo passo.` },
        ];
        recoveredLogsFromRaw = true;
        fallbackTelemetry.recoveredSections.push('shop-narration');
    };

    const deriveLogsFromPromptHistory = () => {
        if (recoveredLogsFromRaw) return;
        const fromGameLog = deriveLogEntriesFromGameLog(input.gameLog);
        if (fromGameLog.length) {
            baseResponse.logEntries = fromGameLog as any;
            recoveredLogsFromRaw = true;
            fallbackTelemetry.recoveredSections.push('gameLog');
        }
    };

    deriveLogEntriesFromCombat();
    ensureShopNarration();
    deriveLogsFromPromptHistory();

    if (!Array.isArray(baseResponse.logEntries)) {
        baseResponse.logEntries = [{ type: 'narration', content: snippet }];
    }
    const hasMetaNote = baseResponse.logEntries.some(entry => entry && typeof entry === 'object' && typeof entry.content === 'string' && entry.content.includes(GM_FALLBACK_META_NOTE));
    if (!hasMetaNote) {
        baseResponse.logEntries.push({ type: 'system', content: GM_FALLBACK_META_NOTE });
    }

    const validatorResult = runGmValidator(baseResponse, buildValidatorContextFromInput(input));
    if (validatorResult.issues.length) {
        const serializedIssues = validatorResult.issues
            .map(issue => `${issue.path}: ${issue.problem}${issue.fixed ? ' (fixed)' : ''}`)
            .join(' | ');
        validatorResult.validatedResponse.systemLog = validatorResult.validatedResponse.systemLog
            ? `${validatorResult.validatedResponse.systemLog}\n[GM Validator] ${serializedIssues}`
            : `[GM Validator] ${serializedIssues}`;
    }

    if (env.AI_DEBUG_LOGS) {
        void debugLogAiStage('gm-validator-fallback', {
            ...fallbackTelemetry,
            finalIssues: validatorResult.issues,
        }, { mode: input.mode ?? 'gameplay' });
    }
    console.warn('[gmValidatorFallback]', {
        attempt: fallbackTelemetry.attempt,
        parseIssue: fallbackTelemetry.parseIssue,
        recoveredSections: fallbackTelemetry.recoveredSections,
        issueCount: validatorResult.issues.length,
    });

    return validatorResult.validatedResponse;
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
    measuredPromptTokens?: number,
    attachResponseSchema: boolean = false,
    forceJsonMimeType: boolean = true
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
        stopSequences: ["```", "[FIM_JSON]"],
    };

    const promptTokens = typeof measuredPromptTokens === 'number' && Number.isFinite(measuredPromptTokens)
        ? measuredPromptTokens
        : estimateTokenCount(promptText);

    const remainingBudget = Math.max(0, HARD_OUTPUT_CAP - promptTokens);
    const safeBudget = Math.max(MIN_OUTPUT_TOKENS, Math.floor(0.85 * remainingBudget));
    const requestedMax = clamp(base.maxOutputTokens ?? DEFAULT_OUTPUT_TOKENS, MIN_OUTPUT_TOKENS, HARD_OUTPUT_CAP);
    const safeMax = clamp(safeBudget || requestedMax, MIN_OUTPUT_TOKENS, HARD_OUTPUT_CAP);
    sanitized.temperature = clamp(base.temperature ?? profile.temperature, 0, 1);
    sanitized.maxOutputTokens = Math.min(requestedMax, safeMax);
    if (attachResponseSchema) {
        sanitized.responseMimeType = "application/json";
        sanitized.responseSchema = GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA;
    } else if (forceJsonMimeType) {
        sanitized.responseMimeType = "application/json";
    }

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
Você é o MESTRE DE JOGO do sistema Crônicas de Aventuras. Sua resposta PRECISA ser um objeto JSON único, válido e completo, sempre obedecendo ao GameMasterResponseSchema.

## Estrutura obrigatória (não altere nomes de campos)
{
  "logEntries": [ { "type": "narration", "content": "..." } ],
  "actionOptions": [ { "text": "...", "action": "...", "skill": "..." } ],
  "updatedCharacter": { ... },
  "combatState": { ... },
  "worldState": { ... },
  "shopState": { ... },
  "xpEvents": [ ... ],
  "memoryContext": { "summary": "...", "references": ["..."] },
  "gameClock": { "day": 0, "hour": 12, "weather": "clear" }
}

### Regras de formatação e segurança
- Nunca coloque texto fora do JSON. Nada de markdown, reticências, avisos ou comentários.
- Feche TODAS as chaves e colchetes antes de concluir a resposta. Se precisar resumir algo, reduza a narrativa, não a estrutura.
- Se não houver dados para um campo, devolva um objeto/array vazio (ex.: \"combatState": {}), nunca null.
- Pelo menos 2 logEntries e 3 actionOptions em toda resposta.
- updatedCharacter deve listar apenas campos alterados; não replique inventário completo se nada mudou.
- Se faltar informação essencial, use o snapshot mais recente recebido.
- Priorize terminar o JSON antes de elaborar descrições longas.
- Se detectou que ficou sem espaço, resuma e finalize o objeto; NUNCA envie JSON aberto.
- Antes de enviar, execute uma verificação reflexiva: (1) todas as chaves estão fechadas? (2) Todas as aspas estão balanceadas? (3) O JSON é parseável? Se algo falhar, corrija silenciosamente e só então envie.
- Após gerar o JSON, inclua em systemLog uma linha com o texto "HASH_SCHEMA=${GAME_MASTER_SCHEMA_HASH}" para confirmar a integridade do schema.

### Mandato Narrativo
- Mantenha consistência com character, combatState, worldState, gameLog e timeline.
- Cada turno segue o ciclo narrativa → escolhas → consequência → atualização de estado.
- Descreva o mundo em português do Brasil, com tom imersivo, porém conciso.
- ${homebrewRule}
${revalidationBlock}

### Regras adicionais
- Em combate, mantenha iniciativa, HP, condições e turnos coerentes.
- Toda ação arriscada exige playerRollRequest correspondente; o jogador SEMPRE rola seus testes.
- Atualize worldState sempre que tempo/clima mudarem.
- Use logEntries.type para diferenciar narrativa, sistema, combate, etc.
- Nunca invente NPCs/itens permanentes sem registrar em relationships/journal ou newHomebrewContent.

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
    let inventoryCondensedNote = '';
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

    if (characterForPrompt && Array.isArray(characterForPrompt.inventory)) {
        const totalItems = characterForPrompt.inventory.length;
        if (totalItems > MAX_PROMPT_INVENTORY_ITEMS) {
            characterForPrompt.inventory = characterForPrompt.inventory.slice(0, MAX_PROMPT_INVENTORY_ITEMS);
            const hiddenCount = totalItems - MAX_PROMPT_INVENTORY_ITEMS;
            inventoryCondensedNote = `INVENTARIO=Inventário condensado (${totalItems} itens; ${hiddenCount} estáveis e não alterados). Não replique itens inalterados em suas respostas.\n`;
            console.warn(`[aiService] Inventário do personagem condensado de ${totalItems} para ${MAX_PROMPT_INVENTORY_ITEMS} itens no prompt.`);
        }
    }

    const characterContext = JSON.stringify(characterForPrompt ?? {});
    const homebrewSection = homebrewSummary ? `HOMEBREW=${homebrewSummary.trim()}\n` : '';
    const combatContextValue = combatState && combatState.isActive
        ? JSON.stringify(condenseCombatStateForPrompt(combatState))
        : '{}';

    const feedbackSection = validationFeedback
        ? `FEEDBACK=${validationFeedback.trim()}\n`
        : '';

    const summarySection = storySummary ? `RESUMO=${storySummary}\n` : '';
    const timelineSection = timelineFacts ? `FATOS=${timelineFacts}\n` : '';
    const worldStateDigest = JSON.stringify(characterForPrompt?.worldState ?? { timeOfDay: 'Manhã', weather: 'Ensolarado', currentRegion: 'Desconhecida' });
    const metadataSection = `${inventoryCondensedNote}${summarySection}${timelineSection}${homebrewSection}${feedbackSection}`;
    const safeGameLog = typeof gameLog === 'string' && gameLog.trim().length ? gameLog : 'SEM_EVENTOS';

    const mainPrompt = `Responda estritamente com JSON válido. Nenhuma explicação fora do objeto.

${metadataSection ? `${metadataSection}\n` : ''}### CONTEXTO
${safeGameLog}

### ESTADO DO MUNDO
${worldStateDigest}

### PERSONAGEM
${characterContext}

### COMBATE ATUAL
${combatContextValue}

### INSTRUÇÃO
O jogador fez a seguinte ação:
"${playerAction}"

Gere o próximo estado seguindo o formato definido e todas as regras.`;
  
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
    const sessionId = normalizeSessionId(
        (input as any)?.sessionId ??
        (input.character as any)?.sessionId ??
        input.character?.id ??
        input.character?.name ??
        'session'
    );
    const genAI = getGenAI(apiKey);

    const systemInstruction = getCachedInstruction(
        input.useAiHomebrew ?? true,
        input.enableNarrativeRevalidation ?? true
    );

    const recoveryStrategies = new Set<string>();
    const failoverTrail: string[] = [];
    const registerRecoveryStrategy = (strategy?: string | null) => {
        if (strategy) recoveryStrategies.add(strategy);
    };

    const instantiateModel = (targetModel: string) => {
        const lower = targetModel.toLowerCase();
        const gemmaMode = lower.includes('gemma');
        const modelInstance = genAI.getGenerativeModel({
            model: targetModel,
            ...(!gemmaMode && {
                systemInstruction: {
                    role: "model",
                    parts: [{ text: systemInstruction }],
                },
            })
        });
        return {
            instance: modelInstance,
            isGemma: gemmaMode,
            supportsSchema: allowResponseSchemaForModel(targetModel),
        };
    };

    const wasCondensed = { value: false };
    const condensedInput = condenseGameMasterInput(input, wasCondensed);
    if (wasCondensed.value) {
        condensedInput.validationFeedback = condensedInput.validationFeedback
            ? `${condensedInput.validationFeedback}\n[Prompt] Histórico condensado automaticamente para caber no limite.`
            : '[Prompt] Histórico condensado automaticamente para caber no limite.';
    }
    
    const buildPrompts = (gemmaMode: boolean) => ({
        preview: createPrompt(input, gemmaMode),
        condensed: createPrompt(condensedInput, gemmaMode),
    });

    let activeModelName = modelName;
    let { instance: model, isGemma: isGemmaActive, supportsSchema: supportsResponseSchema } = instantiateModel(activeModelName);
    if (RESPONSE_SCHEMA_GLOBAL_ENABLED && !supportsResponseSchema) {
        console.warn(`[aiService] responseSchema não permitido para o modelo ${activeModelName}; continuando sem schema.`);
    }
    let { preview: rawPromptPreview, condensed: basePrompt } = buildPrompts(isGemmaActive);
    let lastPromptSent = '';
    let forceJsonMimeTypeForSession = FORCE_JSON_MIME;
    let responseSchemaDisabledReason: string | null = supportsResponseSchema ? null : 'not-enabled';
    const disableResponseSchemaForSession = (reason: string) => {
        if (!supportsResponseSchema) return;
        supportsResponseSchema = false;
        responseSchemaDisabledReason = reason;
        if (reason === 'empty-response' || reason === 'schema-rejected') {
            forceJsonMimeTypeForSession = false;
        }
        registerRecoveryStrategy('response-schema-disabled');
        console.warn(`[aiService] responseSchema desativado para o modelo ${activeModelName} (${reason}).`);
    };
    const rebuildModel = (targetModel: string) => {
        const instantiated = instantiateModel(targetModel);
        model = instantiated.instance;
        isGemmaActive = instantiated.isGemma;
        supportsResponseSchema = instantiated.supportsSchema;
        if (RESPONSE_SCHEMA_GLOBAL_ENABLED && !supportsResponseSchema) {
            console.warn(`[aiService] responseSchema não permitido para o modelo ${targetModel}; continuando sem schema.`);
        }
        const prompts = buildPrompts(isGemmaActive);
        rawPromptPreview = prompts.preview;
        basePrompt = prompts.condensed;
        activeModelName = targetModel;
        responseSchemaDisabledReason = supportsResponseSchema ? null : 'not-enabled';
    };

    const digestTelemetry: { before?: number; after?: number } = {};
    try {
        const baselineTokens = await model.countTokens({
            contents: [{ role: "user", parts: [{ text: rawPromptPreview }] }],
        });
        digestTelemetry.before = baselineTokens?.totalTokens ?? baselineTokens?.tokenCount ?? undefined;
        if (typeof digestTelemetry.before === 'number') {
            console.log(
                `[aiService (${activeModelName})][${input.mode ?? 'gameplay'}] countTokens (pré-digest) = ${digestTelemetry.before}`
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

    const attemptGeneration = async (
        attemptIndex: number = 0,
        retryOptions: { continuationRaw?: string } = {}
    ): Promise<GameUpdateResult> => {
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
            registerRecoveryStrategy('resilience-fallback');
            return {
                response: fallback,
                rawText: '',
            };
        };

        const attemptFailover = (): boolean => {
            const nextModel = resolveFailoverModel(activeModelName);
            if (!nextModel || nextModel === activeModelName) {
                return false;
            }
            console.warn(`[aiService] Failover automático: ${activeModelName} -> ${nextModel}`);
            failoverTrail.push(`${activeModelName}->${nextModel}`);
            rebuildModel(nextModel);
            healthCheckPerformed = false;
            healthCheckSucceeded = false;
            registerRecoveryStrategy('model-failover');
            return true;
        };

        const ensureRetryOrFallback = async (issue: string): Promise<GameUpdateResult> => {
            if (attemptIndex + 1 < MAX_MODEL_ATTEMPTS) {
                console.warn(`[aiService] ${issue} | Repetindo (tentativa ${attemptIndex + 2}/${MAX_MODEL_ATTEMPTS}).`);
                return attemptGeneration(attemptIndex + 1);
            }
            const failureCount = registerFailure(sessionId);
            if (failureCount >= 3) {
                const snapshot = await loadSessionSnapshot(sessionId);
                if (snapshot) {
                    console.warn('[aiService] Falhas consecutivas detectadas; aplicando fail-soft com snapshot persistido.');
                    const failSoftResponse = buildFailSoftResponse(input, snapshot, issue);
                    registerRecoveryStrategy('fail-soft');
                    return { response: failSoftResponse, rawText: snapshot.lastPrompt };
                }
            }
            console.error(`[aiService] ${issue} | Acionando fallback resiliente.`);
            return createResilienceFallback(issue);
        };

        try {
            const mode = input.mode ?? 'gameplay';
            let prompt = basePrompt;
            if (retryOptions.continuationRaw) {
                prompt = `${basePrompt}

ATENÇÃO: A resposta JSON anterior foi truncada. Reescreva o objeto completo, seguindo estritamente o GameMasterResponseSchema, sem adicionar texto fora do JSON. Use o trecho abaixo apenas como referência e gere o JSON inteiro novamente de forma coerente.
TRECHO_INCOMPLETO=${retryOptions.continuationRaw}`;
            }
            prompt += (RETRY_PROMPT_HINTS[attemptIndex] ?? '');
            if (attemptIndex === 0 && env.AI_DEBUG_LOGS) {
                void debugLogAiStage('prompt', {
                    attempt: attemptIndex + 1,
                    playerAction: input.playerAction,
                    characterId: input.character?.id,
                    prompt,
                }, { mode });
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
                        `[aiService (${activeModelName})][${mode}] countTokens (compacto) = ${measuredTokens}${baselineInfo}`
                    );
                    if (attemptIndex === 0 && failoverTrail.length === 0) {
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

            const isFlashModel = activeModelName.toLowerCase().includes('flash');
            const shouldForceJsonMimeType = forceJsonMimeTypeForSession && !isFlashModel;
            const { config: sanitizedGenerationConfig, requestedMax, appliedMax, promptTokens, profile } =
                buildGenerationConfig(prompt, generationConfig, mode, measuredTokens, supportsResponseSchema, shouldForceJsonMimeType);

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
                `[aiService (${activeModelName})][${mode}] maxOutputTokens=${appliedMax} (prompt real ${promptTokens} tokens, default perfil ${profile.defaultMaxOutput}).`
            );

            console.log(`[aiService (${activeModelName})] Gerando conteúdo com prompt...`);
            if (env.AI_DEBUG_LOGS) {
                void debugLogAiStage('prompt', {
                    attempt: attemptIndex + 1,
                    playerAction: input.playerAction,
                    characterId: input.character?.id,
                    prompt,
                    generationConfig: sanitizedGenerationConfig,
                }, { mode });
            }
            lastPromptSent = prompt;
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

            const rawExtract = extractResponseText(response);
            let jsonText = rawExtract;
            let hadIncompleteFlag = false;
            if (rawExtract && rawExtract.trim() && !rawExtract.trim().endsWith('}')) {
                jsonText = `${rawExtract}${/\n$/.test(rawExtract) ? '' : '\n'}${INCOMPLETE_END_FLAG}`;
                hadIncompleteFlag = true;
            }
            if (jsonText.includes(INCOMPLETE_END_FLAG)) {
                jsonText = stripSuffix(jsonText, INCOMPLETE_END_FLAG);
            }
            if (hadIncompleteFlag) {
                console.warn('[aiService] Resposta do modelo recebida sem fechamento completo; acionando reparo antecipado.');
            }
            if (env.AI_DEBUG_LOGS) {
                console.log(`[aiService][raw-response][${mode}][attempt ${attemptIndex + 1}]`, jsonText);
                void debugLogAiStage('raw-response', {
                    attempt: attemptIndex + 1,
                    playerAction: input.playerAction,
                    characterId: input.character?.id,
                    text: jsonText,
                }, { mode });
            }
            
            if (!jsonText) {
                console.error(`[aiService] Resposta da IA vazia na tentativa ${attemptIndex + 1}.`);
                if (supportsResponseSchema && RESPONSE_SCHEMA_GLOBAL_ENABLED) {
                    disableResponseSchemaForSession('empty-response');
                    return attemptGeneration(attemptIndex, retryOptions);
                }
                return ensureRetryOrFallback("O Mestre de Jogo não respondeu com conteúdo.");
            }
            
            let responseData: any;
            let recoveryStrategyUsed: string | null = null;
            let shouldRetryAfterRepair = false;
            try {
                let textToParse = stripCodeFences(jsonText.trim());
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
                const softTail = softTailRepair(jsonText);
                if (softTail && softTail.length && softTail !== jsonText.trim()) {
                    try {
                        repairedData = JSON.parse(softTail);
                        console.warn('[aiService] softTailRepair conseguiu reconstruir a resposta inválida.');
                        recoveryStrategyUsed = 'soft-tail';
                        registerRecoveryStrategy('soft-tail');
                        shouldRetryAfterRepair = true;
                    } catch (softError: any) {
                        console.error('[aiService] softTailRepair falhou ao gerar JSON válido:', softError);
                    }
                }

                const structurallyRepairedText = attemptJsonRepair(jsonText);
                if (!repairedData && structurallyRepairedText) {
                    try {
                        repairedData = JSON.parse(structurallyRepairedText);
                        console.warn('[aiService] attemptJsonRepair conseguiu reconstruir a resposta inválida.');
                        recoveryStrategyUsed = 'structure-repair';
                        registerRecoveryStrategy('structure-repair');
                        shouldRetryAfterRepair = true;
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
                            recoveryStrategyUsed = 'trim-after-last-bracket';
                            registerRecoveryStrategy('trim-after-last-bracket');
                            shouldRetryAfterRepair = true;
                        } catch (trimError: any) {
                            console.error('[aiService] Falha ao analisar JSON mesmo após truncar fragmento:', trimError);
                        }
                    }
                }

                if (!repairedData) {
                    try {
                        repairedData = JSON5.parse(jsonText);
                        console.warn('[aiService] JSON5 reparou a resposta parcialmente inválida.');
                        recoveryStrategyUsed = 'json5';
                        registerRecoveryStrategy('json5');
                        shouldRetryAfterRepair = true;
                    } catch (json5Error: any) {
                        console.error('[aiService] JSON5 também falhou ao interpretar a resposta:', json5Error);
                        console.warn('[aiService] Aplicando recuperação reflexiva antes do fallback.');
                        const mirrored = await attemptSemanticMirrorRecovery(jsonText, model);
                        if (mirrored) {
                            responseData = mirrored;
                            recoveryStrategyUsed = 'semantic-mirror';
                            registerRecoveryStrategy('semantic-mirror');
                            shouldRetryAfterRepair = true;
                        } else {
                            responseData = gmValidatorFallbackFromRawResponse(
                                jsonText,
                                e?.message ?? 'Resposta em formato inválido',
                                input,
                                { attempt: attemptIndex + 1 }
                            );
                            registerRecoveryStrategy('gm-validator-fallback');
                        }
                    }
                }
                if (!responseData) {
                    responseData = repairedData;
                }
                if ((!responseData || typeof responseData !== 'object') && jsonText) {
                    const semantic = reconstructSemanticIntent(jsonText, input);
                    if (semantic) {
                        responseData = semantic;
                        recoveryStrategyUsed = 'semantic-recovery';
                        registerRecoveryStrategy('semantic-recovery');
                        shouldRetryAfterRepair = false;
                        console.warn('[aiService] semantic recovery reconstruiu uma resposta coerente a partir do texto bruto.');
                    }
                }
                if (!responseData) {
                    console.warn('[aiService] GM Validator fallback acionado após falha generalizada de parsing.');
                    responseData = gmValidatorFallbackFromRawResponse(
                        jsonText,
                        e?.message ?? 'Resposta em formato inválido',
                        input,
                        { attempt: attemptIndex + 1 }
                    );
                    registerRecoveryStrategy('gm-validator-fallback');
                }
            }

            if (shouldRetryAfterRepair && recoveryStrategyUsed) {
                if (attemptIndex + 1 < MAX_MODEL_ATTEMPTS) {
                    console.warn(`[aiService] Resposta reparada via ${recoveryStrategyUsed}; solicitando nova tentativa para garantir continuidade.`);
                    const shouldUseContinuation = attemptIndex + 2 === MAX_MODEL_ATTEMPTS;
                    const continuationRaw = shouldUseContinuation
                        ? buildContinuationSnippet(softTailRepair(jsonText) ?? jsonText)
                        : undefined;
                    return attemptGeneration(attemptIndex + 1, { continuationRaw });
                }
                console.warn('[aiService] Resposta reparada porém limite de tentativas atingido; acionando fallback resiliente.');
                return ensureRetryOrFallback('A IA enviou JSON inválido após múltiplas tentativas.');
            }

            if (responseData && typeof responseData === 'object' && !responseMatchesCurrentSchema(responseData)) {
                console.warn('[aiService] Hash de schema divergente detectado; aplicando migração defensiva.');
                responseData = migrateLegacyResponse(responseData, { input, rawText: jsonText });
                markSchemaDrift(responseData);
                registerRecoveryStrategy('schema-migration');
            }

            // 1️⃣ Mini-sanitizer (limpeza pré-validação)
            const cleanedData = miniSanitize(responseData);

            // 2️⃣ Sanitização semântica / lógica
            const finalResponse = sanitizeGameMasterResponse(cleanedData, input.character);
            
            // 3️⃣ Validação estrutural com Zod
            const validationResult = GameMasterResponseSchema.safeParse(finalResponse);
            if (!validationResult.success) {
                console.warn("⚠️ Falha na validação Zod:", validationResult.error.flatten());
                if (!isRetry) return attemptGeneration(1);
                throw createError(500, `A resposta da IA falhou na validação estrutural: ${JSON.stringify(validationResult.error.flatten())}`);
            }

            const validatedResponse = normalizeResponseSchema(validationResult.data, {
                recoveryStrategies: Array.from(recoveryStrategies),
                integrityNotes: [
                    ...(failoverTrail.length ? [`Failover aplicado: ${failoverTrail.join(' -> ')}`] : []),
                    ...(responseSchemaDisabledReason && responseSchemaDisabledReason !== 'not-enabled'
                        ? [`responseSchema desativado (${responseSchemaDisabledReason}).`]
                        : []),
                ],
            });
            if (failoverTrail.length) {
                const failoverNote = `[Failover] Modelo alternado: ${failoverTrail.join(' -> ')}`;
                validatedResponse.systemLog = validatedResponse.systemLog
                    ? `${validatedResponse.systemLog}\n${failoverNote}`
                    : failoverNote;
            }

            if (env.AI_DEBUG_LOGS) {
                void debugLogAiStage('sanitized-response', {
                    attempt: attemptIndex + 1,
                    playerAction: input.playerAction,
                    characterId: input.character?.id,
                    response: validatedResponse,
                }, { mode });
                void debugLogAiStage('integrity', {
                    attempt: attemptIndex + 1,
                    playerAction: input.playerAction,
                    recoveryStrategies: Array.from(recoveryStrategies),
                    failoverTrail,
                    promptTokens,
                    appliedMax,
                    model: activeModelName,
                }, { mode });
            }

            try {
                await saveSessionSnapshot(sessionId, {
                    lastValidResponse: validatedResponse,
                    lastPrompt: lastPromptSent || basePrompt,
                });
                resetFailures(sessionId);
            } catch (snapshotError) {
                console.warn('[sessionRecoveryCache] Falha ao persistir snapshot:', snapshotError);
            }

            return {
                response: validatedResponse,
                rawText: jsonText,
            };

        } catch (error: any) {
            const message = String(error?.message || '');
            const status = error?.status || error?.response?.status;
            const code = error?.code;
            const isTransientStatus = typeof status === 'number' && TRANSIENT_STATUS_CODES.has(status);
            const isTransientCode = typeof code === 'string' && TRANSIENT_ERROR_CODES.has(code);
            const transientMessage = /timeout|temporarily unavailable|socket hang up/i.test(message);
            const shouldBackoff = isTransientStatus || isTransientCode || transientMessage;
            if (status === 400 && /api key not valid/i.test(message)) {
                throw createError(400, 'Sua chave da API do Google Gemini é inválida ou expirou. Abra as Configurações e atualize a chave para continuar a aventura.');
            }
            if (/não respondeu/i.test(message)) {
                return ensureRetryOrFallback('O Mestre de Jogo não respondeu.');
            }
            if (/response_schema/i.test(message) && supportsResponseSchema) {
                disableResponseSchemaForSession('schema-rejected');
                return attemptGeneration(attemptIndex, retryOptions);
            }
            if (shouldBackoff) {
                if (attemptIndex + 1 < MAX_MODEL_ATTEMPTS) {
                    const waitMs = computeBackoffDelay(attemptIndex);
                    console.warn(`[aiService] Erro transitório (${status ?? code ?? 'desconhecido'}). Aguardando ${waitMs}ms antes de tentar novamente.`);
                    await sleep(waitMs);
                    return attemptGeneration(attemptIndex + 1, retryOptions);
                }
                if (attemptFailover()) {
                    await sleep(150);
                    return attemptGeneration(0, retryOptions);
                }
                console.error('[aiService] Erro transitório persistiu até o limite de tentativas.');
                return ensureRetryOrFallback('Erro transitório do modelo persistiu após múltiplas tentativas.');
            }
            if (error instanceof createError.HttpError) throw error;
            console.error(`[aiService (${activeModelName})] Erro ao chamar a API do Gemini:`, error);
            return ensureRetryOrFallback(`Erro de comunicação com o Mestre de Jogo: ${error.message}`);
        }
    }

    return await attemptGeneration();
};
