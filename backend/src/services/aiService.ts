// backend/src/services/aiService.ts
import { GoogleGenAI, type Content } from "@google/genai";
import { randomUUID } from 'crypto';
import JSON5 from 'json5';
import { Buffer } from 'buffer';
import { GameMasterResponse, GameMasterFlowInput, GameMasterResponseSchema, GameMasterFlowInputSchema, NarrativePhaseResponseSchema, StatePhaseResponseSchema } from "../schemas/gameSchemas.js";
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
import { attachResponseMetadata, CURRENT_SCHEMA_VERSION, GAME_MASTER_RESPONSE_JSON_SCHEMA, GAME_MASTER_SCHEMA_HASH, markSchemaDrift, migrateLegacyResponse, normalizeResponseSchema, responseMatchesCurrentSchema, ensureResponseSchemaHash } from './schemaIntegrityService.js';
import { GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA, NARRATIVE_PHASE_GENERATIVE_SCHEMA, STATE_PHASE_GENERATIVE_SCHEMA } from '../schemas/gameMasterResponseGenerativeSchema.js';
import { reconstructSemanticIntent } from './semanticRecoveryService.js';
import { attemptJsonRepair, buildContinuationSnippet, softTailRepair, stripCodeFences, stripSuffix, trimAfterLastClosingBracket } from './aiRepairUtils.js';
import { buildFailSoftResponse } from './failSoftService.js';
import { loadSessionSnapshot, normalizeSessionId, registerFailure, resetFailures, saveSessionSnapshot } from './sessionRecoveryCache.js';
import { getEnemyTemplateByKey, type EnemyTemplateRecord } from './enemyTemplateRegistry.js';
import { evaluateScenarioStatePlaybook } from '../game/scenarioPlaybooks.js';
import { buildMemoryGraph, formatMemoryGraphSnippet } from '../game/memoryGraph.js';
import { evaluateSemanticConsistency } from './semanticValidator.js';
import { fetchScenarioExampleSnippet, recordScenarioExample } from './scenarioExampleService.js';
import { recordFeedbackWarning } from './aiFeedbackService.js';
import { trackWarningMetric } from './warningMetricsService.js';

type GeminiMessage = Content;

const buildUserContent = (text: string): GeminiMessage => ({
    role: 'user',
    parts: [{ text: (text ?? '').toString() }],
});

const buildSystemInstructionPayload = (instruction: string): GeminiMessage => ({
    role: 'system',
    parts: [{ text: (instruction ?? '').toString() }],
});

type ModelAdapter = {
    isGemma: boolean;
    supportsStructuredOutput: boolean;
    generateContent: (
        body: Record<string, any>,
        systemInstructionPayload?: GeminiMessage
    ) => ReturnType<GoogleGenAI['models']['generateContent']>;
    countTokens: (
        body: Record<string, any>,
        systemInstructionPayload?: GeminiMessage
    ) => ReturnType<GoogleGenAI['models']['countTokens']>;
};


const allowStructuredOutputForModel = (modelName: string): boolean => {
    if (!RESPONSE_SCHEMA_GLOBAL_ENABLED) return false;
    const lower = modelName.toLowerCase();
    if (!lower.includes('gemini-2.5')) return false;
    if (lower.includes('vision') || lower.includes('flash-thinking')) return false;
    return true;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const estimateTokenCount = (text: string) => Math.ceil(text.length / 4);

const MIN_OUTPUT_TOKENS = 1024;
const DEFAULT_OUTPUT_TOKENS = 8192;
const HARD_OUTPUT_CAP = 8192;
const MAX_MODEL_ATTEMPTS = 3;
const RETRY_OUTPUT_LIMITS = [undefined, undefined, undefined] as const;
const RETRY_PROMPT_HINTS = [
    '',
    "\n\nSua resposta anterior não era um objeto JSON válido ou falhou na validação do schema. Por favor, corrija o formato e forneça uma resposta estritamente no formato JSON solicitado, sem nenhum texto ou marcador extra e garantindo que todos os campos obrigatórios estejam presentes e com os tipos corretos.",
    "\n\nATENÇÃO FINAL: Reescreva o GameMasterResponse COMPLETO, obedecendo o schema integralmente e sem repetir texto fora do JSON. Priorize fechar todas as chaves e inclua, no mínimo, logEntries, actionOptions, updatedCharacter, worldState e combatState (mesmo vazios).",
] as const;
const DEFAULT_FAILOVER_CHAIN = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];
const MODEL_FAILOVER_CHAIN = (
    process.env.AI_FAILOVER_CHAIN ?? DEFAULT_FAILOVER_CHAIN.join(',')
)
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
const FAILOVER_ENABLED = !['1', 'true', 'yes', 'on'].includes(
    (process.env.AI_DISABLE_AUTO_FAILOVER ?? 'false').toString().trim().toLowerCase()
);
const normalizeModelKey = (model?: string | null) => {
    if (!model) return '';
    return model.replace(/^models\//i, '').trim().toLowerCase();
};

const toProviderModelName = (model: string) => {
    if (!model) return model;
    const trimmed = model.trim();
    if (!trimmed || trimmed.startsWith('models/')) return trimmed;
    if (trimmed.includes('/')) return trimmed;
    return `models/${trimmed}`;
};

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
const MAX_PROMPT_PROFICIENCIES = 8;
const MAX_PROMPT_RELATIONSHIPS = 6;
const STORY_SO_FAR_CHAR_LIMIT = 800;
const INCOMPLETE_END_FLAG = '[INCOMPLETE_END_FLAG]';
const RESPONSE_SCHEMA_GLOBAL_ENABLED = true;
const RESPONSE_SCHEMA_MODEL_BLOCKLIST: string[] = [];
const RESPONSE_SCHEMA_MODEL_ALLOWLIST: string[] = [];
const STATE_PHASE_ALLOWED_FIELDS = [
    'updatedCharacter',
    'worldState',
    'combatState',
    'playerRollRequest',
    'xpEvents',
    'progressionFeed',
    'newHomebrewContent',
    'levelUpState',
    'shopState',
    'lootOffer',
    'useHitDiceRequest',
    'gameClock',
    'memoryContext',
    'systemLog',
    '_meta',
];
const STATE_PHASE_ALLOWED_FIELDS_LABEL = STATE_PHASE_ALLOWED_FIELDS.join(', ');
const STATE_PHASE_HASH_LINE = `HASH_SCHEMA=${GAME_MASTER_SCHEMA_HASH}`;
const STATE_SCHEMA_DRIFT_HINT = `ATENÇÃO: Gere novamente a fase de estado apenas com os campos permitidos (${STATE_PHASE_ALLOWED_FIELDS_LABEL}) e somente com deltas reais.`;
const GENERIC_SCHEMA_DRIFT_HINT = `ATENÇÃO: Reescreva o GameMasterResponse obedecendo ao schema v${CURRENT_SCHEMA_VERSION}, mantendo apenas campos válidos e atualizados.`;
const STATE_GUARD_MODE = (process.env.AI_STATE_GUARD_MODE ?? process.env.NEXT_PUBLIC_AI_STATE_GUARD_MODE ?? 'tests').toLowerCase();
const FORCE_JSON_MIME = ['1', 'true', 'yes', 'on'].includes(
    (process.env.AI_FORCE_JSON_MIME ?? 'true').toString().trim().toLowerCase()
);
const VALIDATION_FAILURE_LOG_DIR = path.join(process.cwd(), 'logs', 'validation-failures');
const parsePositiveIntEnv = (name: string, fallback: number): number => {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
};
const GAMEPLAY_DEFAULT_MAX_OUTPUT = parsePositiveIntEnv('AI_GAMEPLAY_MAX_OUTPUT', 4096);

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
            if (typeof part === 'string') {
                const trimmed = part.trim();
                if (trimmed) chunks.push(trimmed);
                continue;
            }
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

type ValidationFailureLogPayload = {
    attempt: number;
    model: string;
    sessionId?: string;
    scenarioLabel?: string;
    inputSnapshot: GameMasterFlowInput;
    rawText: string;
    zodError: unknown;
};

const slugifyForLog = (value?: string) => {
    if (!value) return 'sem-rotulo';
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'sem-rotulo';
};

const logZodValidationFailure = async (payload: ValidationFailureLogPayload) => {
    try {
        await fs.mkdir(VALIDATION_FAILURE_LOG_DIR, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const slug = slugifyForLog(payload.scenarioLabel ?? payload.sessionId);
        const filePath = path.join(VALIDATION_FAILURE_LOG_DIR, `${stamp}-${slug}.json`);
        const serialized = {
            ...payload,
            createdAt: new Date().toISOString(),
        };
        await fs.writeFile(filePath, JSON.stringify(serialized, null, 2), 'utf8');
        console.warn(`[aiService] Registro detalhado da falha Zod salvo em ${filePath}`);
    } catch (error) {
        console.error('[aiService] Falha ao salvar log de validação Zod:', error);
    }
};

const debugLogAiStage = async (stage: string, payload: unknown, context?: { mode?: string, systemInstruction?: string }) => {
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
            systemInstruction: context?.systemInstruction,
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
const computeBackoffDelay = (attempt: number) => {
    if (attempt === 0) return 10000;
    if (attempt === 1) return 30000;
    if (attempt === 2) return 60000;
    return 250 * Math.pow(2, attempt) + Math.floor(Math.random() * 150);
};
const resolveFailoverModel = (current: string): string | null => {
    const normalized = normalizeModelKey(current);
    const index = MODEL_FAILOVER_CHAIN.findIndex(entry => normalizeModelKey(entry) === normalized);
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
    model: ModelAdapter,
    systemInstructionContent?: GeminiMessage
): Promise<any | null> => {
    if (!partialJson) return null;
    const snippet = buildContinuationSnippet(partialJson);
    const mirrorPrompt = `Você gerou um JSON truncado. Reescreva o mesmo conteúdo em um único objeto GameMasterResponse COMPLETO e válido. Não explique nada, apenas retorne o JSON final. Se faltarem campos, use objetos ou arrays vazios.\nTRECHO=${snippet}`;
    try {
        const mirrorResult = await model.generateContent({
            contents: [buildUserContent(mirrorPrompt)],
            config: {
                maxOutputTokens: 512,
                temperature: 0,
                topP: 0.8,
                responseMimeType: 'application/json',
            },
        }, systemInstructionContent);
        const mirrorText = extractResponseText(mirrorResult);
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
    const lastWorld = extractWorldStateSnapshot(character);
    if (lastWorld) {
        context.lastWorldState = lastWorld;
    }
    if (input.mode) {
        context.mode = input.mode;
    }
    if (typeof input.useAiHomebrew === 'boolean') {
        context.useAiHomebrew = input.useAiHomebrew;
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

    const allowPlayerRoll = input.responseFocus !== 'narrative';
    const recoveredPlayerRoll = allowPlayerRoll
        ? extractObjectFieldFromRawJson(rawText, 'playerRollRequest')
        : undefined;
    if (allowPlayerRoll && recoveredPlayerRoll) {
        baseResponse.playerRollRequest = recoveredPlayerRoll as any;
        fallbackTelemetry.recoveredSections.push('playerRollRequest');
    } else if (!allowPlayerRoll) {
        baseResponse.playerRollRequest = undefined;
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
    gameplay: { temperature: 0.9, defaultMaxOutput: GAMEPLAY_DEFAULT_MAX_OUTPUT },
    combat: { temperature: 0.6, defaultMaxOutput: 1200 },
    generation: { temperature: 1.0, defaultMaxOutput: 8192 },
    audit: { temperature: 0.7, defaultMaxOutput: 3000 },
};
const MODE_MIN_OUTPUT_TOKENS: Partial<Record<AiInteractionMode, number>> = {
    gameplay: 2048,
};

const DEFAULT_STOP_SEQUENCES = ["```", "[FIM_JSON]"];

const buildGenerationConfig = (
    promptText: string,
    requestedConfig: GenerationConfig | undefined,
    mode: AiInteractionMode,
    measuredPromptTokens?: number,
    attachStructuredOutput: boolean = false,
    forceJsonMimeType: boolean = true,
    overrideResponseSchema?: Record<string, any>
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
    if (!attachStructuredOutput) {
        sanitized.stopSequences = DEFAULT_STOP_SEQUENCES;
    }

    const promptTokens = typeof measuredPromptTokens === 'number' && Number.isFinite(measuredPromptTokens)
        ? measuredPromptTokens
        : estimateTokenCount(promptText);

    const minOutputForMode = MODE_MIN_OUTPUT_TOKENS[mode] ?? MIN_OUTPUT_TOKENS;
    const requestedMax = clamp(
        Math.max(base.maxOutputTokens ?? DEFAULT_OUTPUT_TOKENS, profile.defaultMaxOutput, minOutputForMode),
        minOutputForMode,
        HARD_OUTPUT_CAP
    );
    sanitized.temperature = clamp(base.temperature ?? profile.temperature, 0, 1);
    sanitized.maxOutputTokens = requestedMax;
    if (attachStructuredOutput) {
        sanitized.responseMimeType = "application/json";
        sanitized.responseJsonSchema = overrideResponseSchema ?? GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA;
        sanitized.responseModalities = ['TEXT'];
        sanitized.temperature = clamp(base.temperature, 0, 1);
        sanitized.maxOutputTokens = requestedMax;
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


export interface GameUpdateWarning {
    type: string;
    details?: Record<string, any> | string | null;
}

export interface GameUpdateResult {
    response: GameMasterResponse;
    rawText: string;
    warnings?: GameUpdateWarning[];
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
const COIN_INDICES = new Set(['pp', 'gp', 'ep', 'sp', 'cp']);
const toPositiveInteger = (value: any, fallback = 1): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.floor(parsed));
};
const isCurrencyItem = (item: any): boolean => {
    if (!item || typeof item !== 'object') return false;
    const index = typeof item.index === 'string' ? item.index.toLowerCase() : '';
    return COIN_INDICES.has(index);
};
const expandInventoryForPrompt = (items: any[]): any[] => {
    const collapsed: any[] = [];
    for (const entry of items) {
        if (!entry || typeof entry !== 'object') continue;
        const safeQuantity = toPositiveInteger(entry.quantity ?? 1);
        const normalized = { ...entry, quantity: safeQuantity };
        if ('stackInstance' in normalized) {
            delete normalized.stackInstance;
        }
        if (safeQuantity > 1 && !isCurrencyItem(entry)) {
            normalized.stackSize = safeQuantity;
        } else if ('stackSize' in normalized) {
            delete normalized.stackSize;
        }
        collapsed.push(normalized);
    }
    return collapsed;
};

const isPlainObject = (value: unknown): value is Record<string, any> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value));

const deepEqual = (a: any, b: any): boolean => {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i += 1) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }
    if (isPlainObject(a) && isPlainObject(b)) {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        for (const key of keysA) {
            if (!deepEqual(a[key], (b as Record<string, any>)[key])) {
                return false;
            }
        }
        return true;
    }
    return false;
};

const pruneUnchangedFields = (
    partial: Record<string, any> | undefined,
    baseline: Record<string, any> | undefined
): Record<string, any> | undefined => {
    if (!partial || !isPlainObject(partial)) return partial;
    if (!baseline || !isPlainObject(baseline)) return partial;
    const delta: Record<string, any> = {};
    for (const [key, value] of Object.entries(partial)) {
        if (!deepEqual(value, baseline[key])) {
            delta[key] = value;
        }
    }
    return Object.keys(delta).length ? delta : undefined;
};

const buildNarrativeDecisionTags = (character: any, playerAction?: string): string[] => {
    const tags = new Set<string>();
    const normalize = (value?: string | null) =>
        typeof value === 'string' ? value.toLowerCase().replace(/\s+/g, '-') : null;

    const world = character?.worldState;
    const normalizedRegion = normalize(world?.currentRegion);
    if (normalizedRegion) tags.add(`reg:${normalizedRegion}`);
    const normalizedPoi = normalize(world?.poiSlug);
    if (normalizedPoi) tags.add(`poi:${normalizedPoi}`);
    if (Array.isArray(world?.visitedRegions) && world.visitedRegions.length) {
        tags.add(`visited:${world.visitedRegions.length}`);
    }

    if (Array.isArray(character?.journal) && character.journal.length) {
        const activeQuest = character.journal.find((entry: any) => entry?.status && entry.status !== 'completed') ?? character.journal[0];
        const questName = normalize(activeQuest?.name);
        if (questName) tags.add(`quest:${questName}`);
        const questStatus = normalize(activeQuest?.status);
        if (questStatus) tags.add(`quest-status:${questStatus}`);
    }

    if (Array.isArray(character?.relationships) && character.relationships.length) {
        const ally = character.relationships.find((rel: any) => rel?.status === 'ally') ?? character.relationships[0];
        const allyName = normalize(ally?.name);
        if (allyName) tags.add(`npc:${allyName}`);
    }

    const actionText = (playerAction ?? '').toLowerCase();
    if (/investig|procur/.test(actionText)) tags.add('intent:investigate');
    if (/combate|atac|defes|luta/.test(actionText)) tags.add('intent:combat');
    if (/loot|saque|recompensa/.test(actionText)) tags.add('intent:loot');
    if (/convers|dialog|social/.test(actionText)) tags.add('intent:social');
    if (/recuper|descans|curar/.test(actionText)) tags.add('intent:recover');

    return Array.from(tags).slice(0, 6);
};

const narrativeExampleSnippet = `{"logEntries":[{"type":"narration","content":"Visão breve do cenário."},{"type":"system","content":"Observação objetiva."}],"actionOptions":[{"text":"Explorar o arco violeta","action":"explore","skill":"perception"},{"text":"Investigar o beco estreito","action":"investigate","skill":"stealth"},{"text":"Recuperar fôlego e observar","action":"wait"}],"systemLog":"Notas concisas sobre verificações e ganchos."}`;
const stateExampleSnippet = `{"logEntries":[],"actionOptions":[],"updatedCharacter":{"worldState":{"currentRegion":"biblioteca-arcana","timeOfDay":"Manhã"}},"worldState":{"currentRegion":"biblioteca-arcana","poiSlug":"arco-violeta"},"playerRollRequest":{"reason":"Teste de Arcana para purificar a relíquia","dice":"1d20","dc":15,"rollType":"check"},"systemLog":"Estado consolidado após a ação.","_meta":{"version":${CURRENT_SCHEMA_VERSION},"hash":"${GAME_MASTER_SCHEMA_HASH}"}}`;

type StatePhaseGuardIssue = { reason: string; hint: string };

const STATE_PHASE_GUARD_HINTS: Record<string, string> = {
    logEntries: `ATENÇÃO: a fase de estado só pode retornar ${STATE_PHASE_ALLOWED_FIELDS_LABEL}. NÃO retorne logEntries/actionOptions nem texto narrativo.`,
    actionOptions: `ATENÇÃO: a fase de estado só pode retornar ${STATE_PHASE_ALLOWED_FIELDS_LABEL}. NÃO retorne logEntries/actionOptions nem texto narrativo.`,
    snapshot: 'ATENÇÃO: updatedCharacter/worldState devem conter apenas campos alterados; não replique o personagem completo ou inventário inteiro.',
    suppressRoll: 'Se suppressRollRequest=true, não retorne playerRollRequest. Apenas sinalize deltas de estado.',
    hash: `Inclua "_meta":{"version":${CURRENT_SCHEMA_VERSION},"hash":"${GAME_MASTER_SCHEMA_HASH}"} e registre "${STATE_PHASE_HASH_LINE}" no systemLog.`,
};

const SCENARIO_STATE_DIRECTIVES: Record<string, string[]> = {
    'Recuperação / loot': [
        'Forneça lootOffer com moedas ou itens coerentes OU inclua updatedCharacter.inventory/currency refletindo o saque.',
        'Se houve descanso ou cura, atualize useHitDiceRequest e HP/conditions relevantes.',
        'Forneça lootOffer com moedas ou itens coerentes OU inclua updatedCharacter.inventory/currency refletindo o saque.',
        'Se houve descanso ou cura, atualize useHitDiceRequest e HP/conditions relevantes.',
        'Atualize currency do personagem quando ganhar GP; não deixe lootOffer desconectado do inventário.',
    ],
    'Visita à loja': [
        'Inclua shopState com isOpen=true, lista de itens e preços, além de limites de compra/venda.',
        'Ao registrar compras/vendas, atualize apenas os deltas em updatedCharacter.inventory/currency.',
        'Se a loja permanecer aberta, persista shopState para o próximo turno (não remova sem motivo).',
    ],
    'Revisão de progresso': [
        'Liste xpEvents e progressionFeed descrevendo XP ganhos e marcos recentes.',
        'Se o nível mudou, retorne levelUpState detalhando a evolução.',
        'Mesmo sem evolução, registre progresso planejado (xpEvents vazia não é aceita).',
    ],
    'Combate prolongado': [
        'Mantenha combatState.isActive=true e atualize combatants, turno, rodada e condições persistentes.',
        'Aplique deltas de HP/status nos combatentes que agiram neste turno.',
        'Não encerre o combate enquanto hostis estiverem em campo; mantenha lootOffer vazio até o fim.',
        'Se solicitar rolagem, use playerRollRequest.rollType="check" e coloque a perícia no reason (ex.: "Teste de Atletismo para resistir à investida").',
    ],
    'Desafio multi-rolagem': [
        'Inclua playerRollRequest com requestId único (ex.: "rollreq_multiskill_01"), rollType apropriado, DC explícito e razão da rolagem.',
        'Cite as skills/atributos envolvidos nas rolagens encadeadas deste desafio.',
    ],
    'Registro de NPCs e quests': [
        'Atualize updatedCharacter.relationships/journal somente com entradas que mudaram desde o turno anterior.',
        'Registre reputações/missões em progressionFeed ou memoryContext quando houver novidades relevantes.',
    ],
    'Queda e recuperação': [
        'Atualize HP/conditions do personagem; se usar dados de vida, preencha useHitDiceRequest com maxDice/hitDieValue.',
        'Registre efeitos persistentes (exaustão, penalidades) em updatedCharacter ou memoryContext.',
    ],
    'Resumo final controlado': [
        'Consolide progressionFeed com XP, lootOffer, shopState e localização final antes de encerrar.',
        'Inclua xpEvents resumindo a XP total deste ciclo (mesmo que nenhum ganho tenha ocorrido).',
    ],
};

const buildScenarioStateDirectiveBlock = (label?: string): string => {
    if (!label) return '';
    const directives = SCENARIO_STATE_DIRECTIVES[label];
    if (!directives || !directives.length) return '';
    const bulletList = directives.map(entry => `- ${entry}`).join('\n');
    return `Diretivas específicas para "${label}":\n${bulletList}`;
};

const detectStatePhaseGuardIssue = (
    response: any,
    input: GameMasterFlowInput
): StatePhaseGuardIssue | null => {
    if (input.responseFocus !== 'state' || !response || typeof response !== 'object') {
        return null;
    }
    if (Array.isArray(response.logEntries) && response.logEntries.length) {
        return { reason: 'log_entries_present', hint: STATE_PHASE_GUARD_HINTS.logEntries };
    }
    if (Array.isArray(response.actionOptions) && response.actionOptions.length) {
        return { reason: 'action_options_present', hint: STATE_PHASE_GUARD_HINTS.actionOptions };
    }
    const baselineCharacter = isPlainObject(input.character) ? input.character : undefined;
    if (
        baselineCharacter &&
        isPlainObject(response.updatedCharacter) &&
        deepEqual(response.updatedCharacter, baselineCharacter)
    ) {
        return { reason: 'updated_character_snapshot', hint: STATE_PHASE_GUARD_HINTS.snapshot };
    }
    const suppressRoll = Boolean(input.suppressRollRequest);
    if (suppressRoll && response.playerRollRequest) {
        return { reason: 'player_roll_present_on_suppressed_turn', hint: STATE_PHASE_GUARD_HINTS.suppressRoll };
    }
    const baselineCombat = input.combatState;
    const combatRequiresContinuation = Boolean(baselineCombat?.isActive && hasActiveHostiles(baselineCombat));
    if (combatRequiresContinuation) {
        if (!response.combatState || !response.combatState.isActive) {
            return {
                reason: 'combat_state_missing_during_active_encounter',
                hint: 'O combate permanece ativo; mantenha combatState.isActive=true com combatants completos até o término.',
            };
        }
        if (response.lootOffer) {
            return {
                reason: 'loot_offered_during_combat',
                hint: 'Não retorne lootOffer enquanto o combate estiver ativo; aguarde o término do encontro.',
            };
        }
        if (response.shopState?.isOpen) {
            return {
                reason: 'shop_open_during_combat',
                hint: 'Não abra shopState durante o combate; este campo só deve aparecer fora de combate.',
            };
        }
        if (response.useHitDiceRequest) {
            return {
                reason: 'rest_requested_during_combat',
                hint: 'Não solicite descanso/useHitDiceRequest enquanto o combate estiver ativo.',
            };
        }
    }
    if (!response._meta || response._meta.hash !== GAME_MASTER_SCHEMA_HASH) {
        return { reason: 'missing_schema_meta', hint: STATE_PHASE_GUARD_HINTS.hash };
    }
    if (typeof response.systemLog !== 'string' || !response.systemLog.includes(STATE_PHASE_HASH_LINE)) {
        return { reason: 'missing_schema_hash_line', hint: STATE_PHASE_GUARD_HINTS.hash };
    }
    if (combatRequiresContinuation) {
        if (!response.combatState || !response.combatState.isActive) {
            return {
                reason: 'combat_state_missing_during_active_encounter',
                hint: 'O combate segue ativo; responda com combatState.isActive=true, combatants completos e turn/round válidos.',
            };
        }
        if (!isFiniteNumber(response.combatState.round) || response.combatState.round <= 0 ||
            !isFiniteNumber(response.combatState.turn) || response.combatState.turn < 0) {
            return {
                reason: 'combat_round_turn_missing',
                hint: 'Durante combate ativo informe números válidos para combatState.round e combatState.turn.',
            };
        }
        if (response.shopState?.isOpen) {
            return {
                reason: 'shop_open_during_combat',
                hint: 'Não mantenha shopState.isOpen enquanto o combate estiver ativo; só abra a loja depois do encontro.',
            };
        }
        if (hasMeaningfulLoot(response.lootOffer)) {
            return {
                reason: 'loot_offer_during_combat',
                hint: 'Não distribua lootOffer durante o combate; espere o encerramento para conceder recompensas.',
            };
        }
    }
    const scenarioIssue = detectScenarioRequirementIssue(response, input, baselineCharacter);
    if (scenarioIssue) {
        return scenarioIssue;
    }
    return null;
};

const detectScenarioRequirementIssue = (
    response: any,
    input: GameMasterFlowInput,
    baselineCharacter?: Record<string, any>
): StatePhaseGuardIssue | null => {
    const baselineCombat = input.combatState;
    const baselineHasHostiles = Boolean(baselineCombat?.isActive && hasActiveHostiles(baselineCombat));
    const lootCurrency = response.lootOffer?.currency;
    const lootValue = lootCurrency && typeof lootCurrency === 'object'
        ? Object.values(lootCurrency).reduce((sum, value) => sum + (Number(value) || 0), 0)
        : 0;
    if (lootValue > 0) {
        const hasCurrencyDelta = isPlainObject(response.updatedCharacter?.currency)
            && Object.keys(response.updatedCharacter.currency).length > 0;
        if (!hasCurrencyDelta) {
            return {
                reason: 'loot_without_currency_delta',
                hint: 'Sempre que lootOffer conceder moedas, inclua updatedCharacter.currency apenas com os deltas correspondentes.',
            };
        }
    }

    const prevClock = baselineCharacter?.gameClock;
    const nextClock = response.gameClock ?? response.updatedCharacter?.gameClock;
    if (prevClock) {
        if (!nextClock) {
            return {
                reason: 'game_clock_missing',
                hint: 'Inclua gameClock (dia/hora) na fase de estado quando o relógio existir; não deixe implícito.',
            };
        }
        const prevDay = Number(prevClock.day ?? 0);
        const prevHour = Number(prevClock.hour ?? 0);
        const nextDay = Number(nextClock.day ?? prevDay);
        const nextHour = Number(nextClock.hour ?? prevHour);
        if (nextDay < prevDay || (nextDay === prevDay && nextHour < prevHour)) {
            return {
                reason: 'game_clock_regression',
                hint: 'Não retroceda o gameClock; mantenha dia/hora iguais ou avance apenas para frente.',
            };
        }
        if (nextHour < prevHour && nextDay === prevDay) {
            return {
                reason: 'game_clock_rollover_missing_day_increment',
                hint: 'Se a hora diminuir, incremente o dia ao mesmo tempo.',
            };
        }
    }

    const progressionFeed = Array.isArray(response.progressionFeed) ? response.progressionFeed : [];
    const xpEvents = Array.isArray(response.xpEvents) ? response.xpEvents : [];
    if (progressionFeed.length > 0 && xpEvents.length === 0) {
        return {
            reason: 'xp_events_missing_for_feed',
            hint: 'Sempre que progressionFeed tiver entradas, inclua xpEvents correspondentes descrevendo os ganhos de XP.',
        };
    }

    const playbookIssue = evaluateScenarioStatePlaybook(response, input, { combatShouldContinue: baselineHasHostiles });
    if (playbookIssue) {
        return playbookIssue;
    }

    const baselineLevel = Number(baselineCharacter?.level ?? baselineCharacter?.attributes?.level ?? NaN);
    if (response.levelUpState && Number.isFinite(baselineLevel)) {
        const declaredLevel = Number(response.levelUpState.level ?? response.levelUpState.levelReached ?? NaN);
        if (Number.isFinite(declaredLevel) && declaredLevel <= baselineLevel) {
            return {
                reason: 'spurious_level_up_state',
                hint: 'Só envie levelUpState quando o personagem realmente subir de nível; remova-o caso nada tenha evoluído.',
            };
        }
    }

    return null;
};

const mergeRetryHints = (existing: string[] | undefined, ...incoming: (string | undefined)[]): string[] => {
    const unique = new Set<string>();
    (existing ?? []).forEach(hint => {
        if (hint) unique.add(hint);
    });
    incoming.forEach(hint => {
        if (hint) unique.add(hint);
    });
    return Array.from(unique);
};

const shouldEnforceStateGuard = (input: GameMasterFlowInput): boolean => {
    switch (STATE_GUARD_MODE) {
        case 'strict':
        case 'on':
        case 'enabled':
            return true;
        case 'tests':
        case 'test':
            return Boolean(input.scenarioLabel);
        default:
            return false;
    }
};

const createPrompt = (input: GameMasterFlowInput, isGemma: boolean) => {
    const {
        character,
        playerAction,
        gameLog,
        combatState,
        homebrewSummary,
        validationFeedback,
        storySummary,
        timelineFacts,
        regionSlug,
        regionGraphSummary,
        responseFocus: providedFocus,
    } = input;
    const focus = providedFocus ?? 'full';
    const includeNarrativeBrief = focus !== 'state';
    const includeStateBrief = focus !== 'narrative';
    const phaseLabel = focus === 'narrative'
        ? 'FASE_ATUAL=NARRATIVA'
        : focus === 'state'
            ? 'FASE_ATUAL=ESTADO'
            : 'FASE_ATUAL=COMPLETA';
    const focusInstruction = (() => {
        if (focus === 'narrative') {
            return `### FASE NARRATIVA (APENAS STORY + OPÇÕES)
Estrutura obrigatória (JSON completo, sem campos extras):
${narrativeExampleSnippet}
- Gere pelo menos 2 logEntries e 3 actionOptions coerentes com o turno.
- Não replique inventário, proficiências ou listas extensas; a fase narrativa só precisa de contexto textual.
- NÃO inclua updatedCharacter, worldState, combatState, xpEvents, memoryContext, playerRollRequest ou qualquer outro campo de estado; mantenha-os omitidos.
- Não solicite rolagens aqui. Se perceber que uma rolagem será necessária, registre essa intenção em systemLog (texto curto) para a fase seguinte.
- Mantenha systemLog sucinto (ex.: “Verificação de Percepção necessária se o jogador seguir pelo beco”).`;
        }
        if (focus === 'state') {
            const suppressRollDirective = input.suppressRollRequest
                ? 'Se suppressRollRequest=true, NÃO retorne playerRollRequest (o backend registrará que nenhuma rolagem foi solicitada).'
                : 'Só gere playerRollRequest quando realmente necessário e descreva no systemLog o motivo da rolagem.';
            const scenarioDirectiveBlock = buildScenarioStateDirectiveBlock(input.scenarioLabel);
            return `### FASE DE ESTADO (APENAS DELTAS)
Campos permitidos: ${STATE_PHASE_ALLOWED_FIELDS_LABEL}.
Estrutura obrigatória (JSON completo, sem campos extras):
${stateExampleSnippet}
- ${scenarioDirectiveBlock || 'Sem diretivas adicionais específicas para este turno.'}
- NÃO retorne logEntries/actionOptions ou snapshots completos; envie apenas os deltas solicitados.
- logEntries e actionOptions DEVEM ser arrays vazios ( [] ).
- Atualize updatedCharacter e worldState somente com os campos que MUDARAM. Se nada mudou, devolva {}.
- Não aninhe worldState dentro de updatedCharacter se já estiver preenchendo o campo dedicado.
- Atualize combatState, xpEvents, progressionFeed, lootOffer etc. apenas se houver mudanças reais.
- ${suppressRollDirective}
- Sempre use playerRollRequest.rollType="check" e descreva a perícia/atributo em reason (ex.: "Teste de Arcana para purificar a relíquia").
- Sempre que lootOffer conceder moedas/itens, atualize updatedCharacter.currency/inventory apenas com os deltas correspondentes.
- Se o gameClock já existir, reporte o novo dia/hora sem retroceder valores.
- Mantenha systemLog como um resumo objetivo das atualizações aplicadas.`;
        }
        return '';
    })();

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
    let proficiencyCondensedNote = '';
    let relationshipCondensedNote = '';
    let storyCondensedNote = '';
    const expandedInventory = expandInventoryForPrompt(safeArray(character?.inventory));
    const characterForPrompt = character ? {
        name: character.name,
        race: character.race,
        characterClass: character.characterClass,
        level: character.level,
        attributes: character.attributes,
        proficiencies: safeArray(character.proficiencies),
        inventory: expandedInventory
            .map((item: any) => simplifyInventoryItem(item))
            .filter(Boolean),
        spells: safeArray(character.spells),
        storySoFar: character.storySoFar,
        worldState: character.worldState,
        gameClock: (character as any)?.gameClock,
        currency: (character as any)?.currency,
        relationships: safeArray(character.relationships).map((r: any) => ({
            name: r.name,
            status: r.status,
            affinity: r.affinity,
            regionSlug: r.regionSlug,
            poiSlug: r.poiSlug,
            description: r.description,
        })),
        journal: safeArray(character.journal).map((j: any) => ({ name: j.name, region: j.region, status: j.looted ? 'looted' : 'unexplored' }))
    } : null;

    if (characterForPrompt) {
        if (Array.isArray(characterForPrompt.inventory)) {
            const totalItems = characterForPrompt.inventory.length;
            if (totalItems > MAX_PROMPT_INVENTORY_ITEMS) {
                characterForPrompt.inventory = characterForPrompt.inventory.slice(0, MAX_PROMPT_INVENTORY_ITEMS);
                const hiddenCount = totalItems - MAX_PROMPT_INVENTORY_ITEMS;
                inventoryCondensedNote = `INVENTARIO=Inventário condensado (${totalItems} itens; ${hiddenCount} estáveis e não alterados). Não replique itens inalterados em suas respostas.\n`;
                console.warn(`[aiService] Inventário do personagem condensado de ${totalItems} para ${MAX_PROMPT_INVENTORY_ITEMS} itens no prompt.`);
            }
        }
        if (Array.isArray(characterForPrompt.proficiencies)) {
            const totalProfs = characterForPrompt.proficiencies.length;
            if (totalProfs > MAX_PROMPT_PROFICIENCIES) {
                characterForPrompt.proficiencies = characterForPrompt.proficiencies.slice(0, MAX_PROMPT_PROFICIENCIES);
                proficiencyCondensedNote = `PROFICIENCIAS=Lista condensada (${totalProfs} itens; mantenha consistência apenas com as ${MAX_PROMPT_PROFICIENCIES} exibidas).\n`;
                console.warn(`[aiService] Proficiencias condensadas de ${totalProfs} para ${MAX_PROMPT_PROFICIENCIES} itens no prompt.`);
            }
        }
        if (Array.isArray(characterForPrompt.relationships)) {
            const totalRelationships = characterForPrompt.relationships.length;
            if (totalRelationships > MAX_PROMPT_RELATIONSHIPS) {
                const hiddenCount = totalRelationships - (MAX_PROMPT_RELATIONSHIPS - 1);
                characterForPrompt.relationships = [
                    ...characterForPrompt.relationships.slice(0, MAX_PROMPT_RELATIONSHIPS - 1),
                    { name: `+${hiddenCount} aliados/npcs`, status: 'summarized', affinity: null },
                ];
                relationshipCondensedNote = `RELACIONAMENTOS=Lista resumida (${totalRelationships} registros; consulte banco interno para demais NPCs).\n`;
                console.warn(`[aiService] Relacionamentos condensados de ${totalRelationships} para ${MAX_PROMPT_RELATIONSHIPS} entradas no prompt.`);
            }
        }
        if (typeof characterForPrompt.storySoFar === 'string' && characterForPrompt.storySoFar.length > STORY_SO_FAR_CHAR_LIMIT) {
            characterForPrompt.storySoFar = `${characterForPrompt.storySoFar.slice(0, STORY_SO_FAR_CHAR_LIMIT)}...`;
            storyCondensedNote = `HISTORICO=Resumo truncado (texto completo com ${character.storySoFar.length} caracteres mantido no backend).\n`;
        }
    }

    let characterPayload = characterForPrompt ? { ...characterForPrompt } : null;
    const narrativeDecisionTags = buildNarrativeDecisionTags(character ?? {}, playerAction);
    if (characterPayload && focus === 'narrative') {
        characterPayload = {
            name: characterPayload.name,
            race: characterPayload.race,
            characterClass: characterPayload.characterClass,
            level: characterPayload.level,
            attributes: characterPayload.attributes,
            storySoFar: characterPayload.storySoFar,
            worldState: characterPayload.worldState,
            relationships: characterPayload.relationships?.slice(0, 2),
            ...(narrativeDecisionTags.length ? { decisionTags: narrativeDecisionTags } : {}),
        };
    }
    const characterContext = JSON.stringify(characterPayload ?? {});
    const homebrewSection = homebrewSummary ? `HOMEBREW=${homebrewSummary.trim()}\n` : '';
    const combatContextValue = combatState && combatState.isActive
        ? JSON.stringify(condenseCombatStateForPrompt(combatState))
        : '{}';

    const feedbackSection = validationFeedback
        ? `FEEDBACK=${validationFeedback.trim()}\n`
        : '';

    const summarySection = includeNarrativeBrief && storySummary ? `RESUMO=${storySummary}\n` : '';
    const timelineSection = includeNarrativeBrief && timelineFacts ? `FATOS=${timelineFacts}\n` : '';
    const regionSection = includeStateBrief
        ? (regionGraphSummary
            ? `MAPA_REGIAO=${regionSlug ?? 'desconhecida'}\n${regionGraphSummary.trim()}\n`
            : regionSlug
                ? `MAPA_REGIAO=${regionSlug}\n`
                : '')
        : '';
    const memoryGraph = buildMemoryGraph({
        character,
        world: characterForPrompt?.worldState,
        combatState,
    });
    const memoryGraphSnippet = formatMemoryGraphSnippet(memoryGraph);
    const memoryGraphSection = memoryGraphSnippet ? `${memoryGraphSnippet}\n` : '';
    const scenarioExampleSection = input.exampleSnippet && focus !== 'full'
        ? `EXEMPLO_${focus.toUpperCase()}=${input.exampleSnippet}\n`
        : '';
    const worldStateDigest = JSON.stringify(characterForPrompt?.worldState ?? { timeOfDay: 'Manhã', weather: 'Ensolarado', currentRegion: 'Desconhecida' });
    const climateKeyword = includeStateBrief && characterForPrompt?.worldState?.weather
        ? `CLIMA=${characterForPrompt.worldState.weather}\n`
        : '';
    const timeKeyword = includeStateBrief && characterForPrompt?.worldState?.timeOfDay
        ? `PERIODO=${characterForPrompt.worldState.timeOfDay}\n`
        : '';
    const prevClock = characterForPrompt?.gameClock ?? (character as any)?.gameClock ?? null;
    const gameClockNote = focus === 'state' && prevClock
        ? `RELOGIO_ATUAL=dia ${Number(prevClock.day ?? 0)}, hora ${Number(prevClock.hour ?? 0)}. Não retroceda o relógio; avance apenas quando o tempo passar.\n`
        : '';
    const currencyNote = focus === 'state' && characterForPrompt?.currency
        ? `TESOURO_ATUAL=gp ${Number((characterForPrompt.currency as any).gp ?? 0)} (não reduza sem motivo; adicione ganhos quando lootOffer conceder moedas).\n`
        : '';
    const stateDiffHint = focus === 'state'
        ? 'ESTADO_PARCIAL=Informe apenas campos que mudaram desde o último turno; valores omitidos serão interpretados como "sem alteração".\n'
        : '';
    const metadataSection = `${phaseLabel}\n${stateDiffHint}${gameClockNote}${currencyNote}${climateKeyword}${timeKeyword}${inventoryCondensedNote}${proficiencyCondensedNote}${relationshipCondensedNote}${storyCondensedNote}${summarySection}${timelineSection}${regionSection}${homebrewSection}${feedbackSection}`;
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

${memoryGraphSection ? `${memoryGraphSection}` : ''}${scenarioExampleSection ? `${scenarioExampleSection}` : ''}### INSTRUÇÃO
O jogador fez a seguinte ação:
"${playerAction}"

Gere o próximo estado seguindo o formato definido e todas as regras.`;
    const promptWithFocus = focusInstruction
        ? `${focusInstruction}\n\n${mainPrompt}`
        : mainPrompt;
  
    // For Gemma, the full instruction goes into the user prompt
    if (isGemma) {
        const systemInstruction = createSystemInstruction(
            input.useAiHomebrew ?? true,
            input.enableNarrativeRevalidation ?? true
        );
        return `${systemInstruction}\n\n${promptWithFocus}`;
    }

    return promptWithFocus;
}

/**
 * 🔹 Mini-sanitizador inline (Pré-Zod):
 * Limpa a resposta bruta da IA, removendo nulls, strings inválidas e objetos vazios
 * para garantir que ela passe na validação estrutural do Zod.
 */
const buildRollRequestId = (rollType?: string | null) => {
    const normalized = typeof rollType === 'string' && rollType.trim()
        ? rollType.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
        : 'roll';
    return `${normalized}_${randomUUID()}`;
};

const normalizeRollType = (rollType?: string | null) => {
    if (!rollType) return 'check';
    const allowed = new Set(['check', 'save', 'attack', 'damage', 'initiative']);
    const lowered = rollType.toLowerCase().trim();
    if (allowed.has(lowered)) return lowered;
    return 'check';
};

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const hasActiveHostiles = (combatState?: any): boolean => {
    if (!combatState || !Array.isArray(combatState.combatants)) return false;
    return combatState.combatants.some((combatant: any) => {
        if (!combatant) return false;
        if (combatant.attitude !== 'hostile') return false;
        if (combatant.isDead) return false;
        const hp = combatant.hp;
        if (hp && typeof hp.current === 'number') {
            return hp.current > 0;
        }
        if (typeof combatant.hpCurrent === 'number') {
            return combatant.hpCurrent > 0;
        }
        return true;
    });
};

const hasMeaningfulLoot = (lootOffer?: any): boolean => {
    if (!lootOffer || typeof lootOffer !== 'object') return false;
    const items = Array.isArray(lootOffer.items) ? lootOffer.items : [];
    const hasItems = items.length > 0;
    const currency = lootOffer.currency && typeof lootOffer.currency === 'object'
        ? Object.values(lootOffer.currency).some(value => Number(value) !== 0)
        : false;
    return hasItems || currency;
};

const isXpPlaceholder = (entry: any): boolean => {
    if (!entry || typeof entry !== 'object') return false;
    const description = typeof entry.description === 'string' ? entry.description.toLowerCase() : '';
    const summary = typeof entry.summary === 'string' ? entry.summary.toLowerCase() : '';
    return description.includes('placeholder') ||
        description.includes('substitua') ||
        summary.includes('placeholder') ||
        summary.includes('substitua');
};

const toTemplateKey = (value?: string | null): string | null => {
    if (!value || typeof value !== 'string') return null;
    const normalized = value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || null;
};

const mergeBaseStats = (
    existing: Record<string, number | undefined> | undefined,
    template: EnemyTemplateRecord | undefined
): Record<string, number | undefined> | undefined => {
    const templateStats = template?.stats ?? {};
    const merged: Record<string, number | undefined> = {
        str: existing?.str ?? templateStats.str,
        dex: existing?.dex ?? templateStats.dex,
        con: existing?.con ?? templateStats.con,
        int: existing?.int ?? templateStats.int,
        wis: existing?.wis ?? templateStats.wis,
        cha: existing?.cha ?? templateStats.cha,
    };
    const hasValue = Object.values(merged).some(value => typeof value === 'number');
    return hasValue ? merged : undefined;
};

const mergeDamageProfile = (
    existing: Record<string, any> | undefined,
    template: EnemyTemplateRecord | undefined
) => {
    const templateDamage = template?.damageProfile;
    if (!existing && !templateDamage) return undefined;
    return {
        dice: existing?.dice ?? templateDamage?.dice ?? '1d6',
        type: existing?.type ?? templateDamage?.type,
        average: existing?.average ?? templateDamage?.average,
        notes: existing?.notes ?? templateDamage?.notes,
    };
};

const attachTemplateMetadata = (combatant: any): any => {
    const candidates = [
        combatant?.templateId,
        combatant?.id,
        combatant?.name,
    ].map(value => toTemplateKey(value));
    let template: EnemyTemplateRecord | undefined;
    for (const candidate of candidates) {
        template = getEnemyTemplateByKey(candidate ?? undefined);
        if (template) break;
    }
    if (!template) return combatant;
    combatant.templateId = template.id;
    combatant.baseStats = mergeBaseStats(combatant.baseStats, template);
    const damageProfile = mergeDamageProfile(combatant.damageProfile, template);
    if (damageProfile) {
        combatant.damageProfile = damageProfile;
    }
    if (template.hitPoints) {
        if (!isFiniteNumber(combatant.hp?.max) || combatant.hp.max < template.hitPoints) {
            combatant.hp.max = template.hitPoints;
        }
        if (!isFiniteNumber(combatant.hp?.current)) {
            combatant.hp.current = combatant.hp.max ?? template.hitPoints;
        }
    }
    if (!isFiniteNumber(combatant.ac) && typeof template.armorClass === 'number') {
        combatant.ac = template.armorClass;
    }
    if ((!isFiniteNumber(combatant.actionPoints) || combatant.actionPoints <= 0) && typeof template.actionPoints === 'number') {
        combatant.actionPoints = template.actionPoints;
    }
    if ((!isFiniteNumber(combatant.bonusActionPoints) || combatant.bonusActionPoints < 0) && typeof template.bonusActionPoints === 'number') {
        combatant.bonusActionPoints = template.bonusActionPoints;
    }
    return combatant;
};

const normalizeXpEventType = (rawType?: string | null): 'quest' | 'skill' | 'combat' => {
    if (typeof rawType !== 'string') return 'quest';
    const lowered = rawType.trim().toLowerCase();
    if (lowered === 'skill') return 'skill';
    if (lowered === 'combat') return 'combat';
    return 'quest';
};

const normalizeCombatantSchema = (combatant: any, fallbackIndex: number) => {
    if (!combatant || typeof combatant !== 'object') return combatant;
    const patched: any = { ...combatant };
    if (typeof patched.id !== 'string' || !patched.id.trim()) {
        patched.id = `combatant_${fallbackIndex}`;
    }
    if (typeof patched.name !== 'string' || !patched.name.trim()) {
        patched.name = `Combatente ${fallbackIndex + 1}`;
    }
    if (typeof patched.hp === 'object') {
        if (typeof patched.hp.current !== 'number') {
            patched.hp.current = typeof patched.hp.max === 'number' ? patched.hp.max : 10;
        }
        if (typeof patched.hp.max !== 'number') {
            patched.hp.max = patched.hp.current;
        }
    } else {
        const current = typeof patched.hpCurrent === 'number' ? patched.hpCurrent : 10;
        const max = typeof patched.hpMax === 'number' ? patched.hpMax : current;
        patched.hp = { current, max };
    }
    delete patched.hpCurrent;
    delete patched.hpMax;
    if (typeof patched.ac !== 'number') {
        patched.ac = 12;
    }
    if (typeof patched.initiative !== 'number') {
        patched.initiative = fallbackIndex + 10;
    }
    if (typeof patched.attitude !== 'string' || !['ally', 'neutral', 'hostile'].includes(patched.attitude)) {
        patched.attitude = patched.isPlayer ? 'ally' : 'hostile';
    }
    if (typeof patched.zone === 'string' && !['perto', 'medio', 'longe', 'coberto'].includes(patched.zone)) {
        delete patched.zone;
    }
    return attachTemplateMetadata(patched);
};

const clampCombatantActionEconomy = (combatState: any) => {
    if (!combatState || !Array.isArray(combatState.combatants)) return;
    combatState.combatants = combatState.combatants.map((combatant: any, index: number) => {
        if (!combatant || typeof combatant !== 'object') return combatant;
        const patched = normalizeCombatantSchema(combatant, index);
        if (typeof patched.actionPoints === 'number' && patched.actionPoints > 1) {
            patched.actionPoints = 1;
        }
        if (typeof patched.bonusActionPoints === 'number' && patched.bonusActionPoints > 1) {
            patched.bonusActionPoints = 1;
        }
        return patched;
    });
};

const enforceCombatContinuity = (
    response: GameMasterResponse,
    input: GameMasterFlowInput
) => {
    const prevCombat = input.combatState;
    if (!prevCombat || !prevCombat.isActive || !hasActiveHostiles(prevCombat)) return;
    if (!response.combatState || !response.combatState.isActive) {
        response.combatState = cloneInput(prevCombat);
        if (Array.isArray(response.combatState?.combatants) && response.combatState.combatants.length) {
            response.combatState.combatants = response.combatState.combatants.map((combatant: any, index: number) =>
                normalizeCombatantSchema(combatant, index)
            );
        }
    } else {
        if (Array.isArray(response.combatState?.combatants)) {
            response.combatState.combatants = response.combatState.combatants.map((combatant: any, index: number) =>
                normalizeCombatantSchema(combatant, index)
            );
        }
    }
    response.combatState.isActive = true;
    clampCombatantActionEconomy(response.combatState);
    if (response.lootOffer) {
        delete response.lootOffer;
    }
    if (response.shopState?.isOpen) {
        delete response.shopState;
    }
    if (response.useHitDiceRequest) {
        delete response.useHitDiceRequest;
    }
};

const rebuildCombatStateFromBaseline = (
    response: GameMasterResponse,
    input: GameMasterFlowInput
): boolean => {
    const baseline = input.combatState;
    if (baseline && baseline.isActive) {
        response.combatState = cloneInput(baseline);
    } else {
        ensureScenarioCombatSeed(response, input);
    }
    if (!response.combatState) return false;

    const fallbackRound = Number(baseline?.round ?? response.combatState.round ?? 1);
    const fallbackTurn = Number(baseline?.turn ?? response.combatState.turn ?? 0);
    response.combatState.round = isFiniteNumber(response.combatState.round) && response.combatState.round > 0
        ? response.combatState.round
        : (isFiniteNumber(fallbackRound) && fallbackRound > 0 ? fallbackRound : 1);
    response.combatState.turn = isFiniteNumber(response.combatState.turn) && response.combatState.turn >= 0
        ? response.combatState.turn
        : (isFiniteNumber(fallbackTurn) && fallbackTurn >= 0 ? fallbackTurn : 0);
    response.combatState.isActive = true;

    if (Array.isArray(response.combatState.combatants)) {
        response.combatState.combatants = response.combatState.combatants.map((combatant: any, index: number) =>
            normalizeCombatantSchema(combatant, index)
        );
    }
    clampCombatantActionEconomy(response.combatState);
    if (
        !Array.isArray(response.combatState.initiativeOrder) ||
        response.combatState.initiativeOrder.length === 0
    ) {
        response.combatState.initiativeOrder = Array.isArray(response.combatState.combatants)
            ? response.combatState.combatants
                .map((combatant: any) => (combatant && typeof combatant.id === 'string' ? combatant.id : null))
                .filter(Boolean)
            : [];
    }
    return true;
};

const ensureLootCurrencyDelta = (
    response: GameMasterResponse,
    input: GameMasterFlowInput
) => {
    const lootCurrency = response.lootOffer?.currency;
    if (!lootCurrency || typeof lootCurrency !== 'object') return;
    const deltas = Object.entries(lootCurrency)
        .map(([key, value]) => [key, Number(value) || 0] as const)
        .filter(([, amount]) => amount !== 0);
    if (!deltas.length) return;
    const baselineCurrency = (input.character as any)?.currency ?? {};
    const nextCurrency = isPlainObject(response.updatedCharacter?.currency)
        ? { ...(response.updatedCharacter as any).currency }
        : {};
    let changed = false;
    deltas.forEach(([key, amount]) => {
        const prevValue = Number(baselineCurrency?.[key] ?? 0);
        nextCurrency[key] = prevValue + amount;
        changed = true;
    });
    if (!changed) return;
    response.updatedCharacter = {
        ...(isPlainObject(response.updatedCharacter) ? response.updatedCharacter : {}),
        currency: nextCurrency,
    };
};

const ensureScenarioXpArtifacts = (response: GameMasterResponse, input: GameMasterFlowInput) => {
    const scenarioLabel = input.scenarioLabel;
    const progressionFeed = Array.isArray(response.progressionFeed) ? response.progressionFeed : [];
    const existingXpEvents = Array.isArray(response.xpEvents) ? response.xpEvents : [];
    const feedWithXp = progressionFeed.filter(entry => Number(entry?.xp) > 0);
    const xpEventsWithValues = existingXpEvents.filter(event => Number(event?.xp) > 0);
    const nonPlaceholderXpEvents = existingXpEvents.filter(event => !isXpPlaceholder(event));

    if (feedWithXp.length && xpEventsWithValues.length === 0) {
        response.xpEvents = feedWithXp.map(entry => ({
            type: normalizeXpEventType(entry.type),
            xp: entry.xp ?? 0,
            description: entry.summary ?? entry.detail ?? 'XP espelhado do progressionFeed.',
        }));
    } else if (nonPlaceholderXpEvents.length && nonPlaceholderXpEvents.length !== existingXpEvents.length) {
        response.xpEvents = nonPlaceholderXpEvents.map(event => ({
            ...event,
            type: normalizeXpEventType(event.type),
        }));
    } else if (existingXpEvents.length) {
        response.xpEvents = existingXpEvents.map(event => ({
            ...event,
            type: normalizeXpEventType(event.type),
        }));
    }

    const scenarioRequiresXp =
        scenarioLabel === 'Revisão de progresso' ||
        scenarioLabel === 'Recuperação / loot';
    if ((!response.xpEvents || response.xpEvents.length === 0) && scenarioRequiresXp) {
        response.xpEvents = [
            {
                type: 'quest',
                xp: 0,
                description: `Registre XP ganho durante "${scenarioLabel}". Substitua este placeholder pelos dados reais.`,
            },
        ];
    }

    if (scenarioLabel === 'Revisão de progresso' && progressionFeed.length === 0) {
        response.progressionFeed = [
            {
                type: 'xp_gain',
                summary: 'Atualize progressionFeed com marcos e XP ganhos neste turno.',
                detail: 'Substitua este placeholder pelos eventos reais.',
                xp: 0,
            },
        ];
    }
    if (scenarioLabel === 'Recuperação / loot' && progressionFeed.length === 0) {
        response.progressionFeed = [
            {
                type: 'xp_gain',
                summary: 'Resuma recompensas/XP da recuperação/loot neste turno.',
                detail: 'Substitua este placeholder pelos eventos reais.',
                xp: 0,
            },
        ];
    }

    if (Array.isArray(response.xpEvents) && response.xpEvents.length) {
        response.xpEvents = response.xpEvents.map(event => ({
            ...event,
            type: normalizeXpEventType(event.type),
        }));
    }
};

const ensureGameClockProgression = (response: GameMasterResponse, input: GameMasterFlowInput) => {
    const baselineClock = (input.character as any)?.gameClock;
    if (!baselineClock) return;
    const targetClock =
        response.gameClock ??
        response.updatedCharacter?.gameClock ??
        null;
    if (!targetClock) {
        response.gameClock = cloneInput(baselineClock);
        return;
    }
    const prevDay = Number(baselineClock.day ?? 0);
    const prevHour = Number(baselineClock.hour ?? 0);
    if (typeof targetClock.day === 'number' && targetClock.day < prevDay) {
        targetClock.day = prevDay;
    }
    if (typeof targetClock.hour === 'number') {
        if (targetClock.day === prevDay && targetClock.hour < prevHour) {
            targetClock.hour = prevHour;
        }
        if (targetClock.hour < 0) {
            targetClock.hour = prevHour;
        }
    } else {
        targetClock.hour = prevHour;
    }
    if (typeof targetClock.day !== 'number') {
        targetClock.day = prevDay;
    }
    response.gameClock = targetClock;
};

const ensureLevelProgressConsistency = (response: GameMasterResponse, input: GameMasterFlowInput) => {
    const prevLevel = Number((input.character as any)?.level ?? (input.character as any)?.attributes?.level ?? 0);
    const updatedLevelRaw = Number(response.updatedCharacter?.level ?? response.updatedCharacter?.attributes?.level ?? prevLevel);
    const levelUpFeed = Array.isArray(response.progressionFeed)
        ? response.progressionFeed.find(entry => entry?.type === 'level_up')
        : undefined;
    const declaredLevel = Number(
        response.levelUpState?.level ??
        response.levelUpState?.levelReached ??
        levelUpFeed?.level ??
        updatedLevelRaw
    );
    const safeUpdatedLevel = Number.isFinite(updatedLevelRaw) ? updatedLevelRaw : prevLevel;
    const hasLevelIncrease = Number.isFinite(declaredLevel)
        ? declaredLevel > prevLevel
        : safeUpdatedLevel > prevLevel;

    if (!hasLevelIncrease) {
        if (response.levelUpState) {
            delete response.levelUpState;
        }
        if (levelUpFeed && (!Number.isFinite(levelUpFeed.level) || Number(levelUpFeed.level) <= prevLevel)) {
            response.progressionFeed = Array.isArray(response.progressionFeed)
                ? response.progressionFeed.filter(entry => entry !== levelUpFeed)
                : response.progressionFeed;
        }
        return;
    }

    const targetLevel = Number.isFinite(declaredLevel) && declaredLevel > prevLevel
        ? declaredLevel
        : Math.max(prevLevel + 1, safeUpdatedLevel);

    if (!response.levelUpState) {
        response.levelUpState = {
            level: targetLevel,
            levelReached: targetLevel,
            previousLevel: prevLevel,
            status: 'completed',
        } as any;
    } else {
        response.levelUpState.level = targetLevel;
        response.levelUpState.levelReached = targetLevel;
        response.levelUpState.previousLevel = prevLevel;
    }

    if (!response.updatedCharacter) response.updatedCharacter = {};
    response.updatedCharacter.level = targetLevel;
    response.updatedCharacter.attributes = {
        ...(isPlainObject(response.updatedCharacter.attributes) ? response.updatedCharacter.attributes : {}),
        level: targetLevel,
    };

    if (levelUpFeed) {
        levelUpFeed.level = targetLevel;
        if (
            typeof levelUpFeed.summary === 'string' &&
            !levelUpFeed.summary.toLowerCase().includes(`${targetLevel}`)
        ) {
            levelUpFeed.summary = `Você subiu para o nível ${targetLevel}!`;
        } else if (!levelUpFeed.summary) {
            levelUpFeed.summary = `Você subiu para o nível ${targetLevel}!`;
        }
    }
};

const ensureScenarioCombatSeed = (response: GameMasterResponse, input: GameMasterFlowInput) => {
    if (input.scenarioLabel !== 'Combate prolongado') return;
    if (response.combatState && response.combatState.isActive) return;
    const baseline = input.combatState;
    if (baseline && baseline.isActive && hasActiveHostiles(baseline)) {
        response.combatState = cloneInput(baseline);
        response.combatState.isActive = true;
        clampCombatantActionEconomy(response.combatState);
        return;
    }
    const character = input.character as any;
    response.combatState = {
        isActive: true,
        round: 1,
        turn: 0,
        combatants: [
            {
                id: character?.id ?? 'player',
                name: character?.name ?? 'Herói',
                attitude: 'ally',
                hp: character?.hp ? { current: character.hp, max: character.hp } : undefined,
                actionPoints: 1,
                bonusActionPoints: 1,
                initiative: 15,
            },
            {
                id: 'hostile_1',
                name: 'Hostil',
                attitude: 'hostile',
                hp: { current: 12, max: 12 },
                actionPoints: 1,
                bonusActionPoints: 1,
                initiative: 10,
            },
        ],
        initiativeOrder: ['player', 'hostile_1'],
    } as any;
};

const pruneFinishedCombatState = (response: GameMasterResponse) => {
    if (!response.combatState) return;
    if (response.combatState.isActive && hasActiveHostiles(response.combatState)) {
        return;
    }
    if (!response.combatState.isActive || !hasActiveHostiles(response.combatState)) {
        response.combatState = null;
    }
};

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
 
        if (key === 'combatState') {
          if (!('isActive' in val) || !val.isActive) {
            clean[key] = null; // ✅ combate não ativo → null
            continue;
          }
          clampCombatantActionEconomy(val);
        }
      }
    }

    if (clean.playerRollRequest && typeof clean.playerRollRequest === 'object') {
        if (typeof clean.playerRollRequest.requestId !== 'string' || !clean.playerRollRequest.requestId.trim()) {
            clean.playerRollRequest.requestId = buildRollRequestId(clean.playerRollRequest.rollType);
        }
        clean.playerRollRequest.rollType = normalizeRollType(clean.playerRollRequest.rollType);
        if (clean.playerRollRequest.rollType === 'check' && typeof clean.playerRollRequest.reason === 'string') {
            const originalReason = clean.playerRollRequest.reason;
            clean.playerRollRequest.reason = originalReason;
        }
    }

    return clean;
  };
  
const enforcePhaseCompliance = (
    response: GameMasterResponse,
    input: GameMasterFlowInput
): string[] => {
    const focus = input.responseFocus;
    const notes: string[] = [];
    if (focus === 'narrative') {
        const candidate = {
            logEntries: response.logEntries ?? [],
            actionOptions: response.actionOptions ?? [],
            systemLog: response.systemLog,
        };
        const phaseCheck = NarrativePhaseResponseSchema.safeParse(candidate);
        if (!phaseCheck.success) {
            throw createError(422, `Narrative phase schema violado: ${JSON.stringify(phaseCheck.error.flatten())}`);
        }
        const extraneousKeys = [
            'updatedCharacter',
            'worldState',
            'combatState',
            'playerRollRequest',
            'xpEvents',
            'progressionFeed',
            'newHomebrewContent',
            'levelUpState',
            'shopState',
            'lootOffer',
            'useHitDiceRequest',
            'gameClock',
            'memoryContext',
        ].filter(key => response[key as keyof GameMasterResponse] !== undefined);
        if (extraneousKeys.length) {
            notes.push(`Fase narrativa não deve enviar campos de estado (removidos: ${extraneousKeys.join(', ')}).`);
        }
        response.logEntries = phaseCheck.data.logEntries;
        response.actionOptions = phaseCheck.data.actionOptions;
        response.systemLog = phaseCheck.data.systemLog;
        delete response.updatedCharacter;
        delete response.worldState;
        delete response.combatState;
        delete response.playerRollRequest;
        delete response.xpEvents;
        delete response.progressionFeed;
        delete response.newHomebrewContent;
        delete response.levelUpState;
        delete response.shopState;
        delete response.lootOffer;
        delete response.useHitDiceRequest;
        delete response.gameClock;
        delete response.memoryContext;
        delete (response as any)._meta;
    } else if (focus === 'state') {
        if (Array.isArray(response.logEntries) && response.logEntries.length) {
            notes.push('logEntries descartados na fase de estado.');
        }
        if (Array.isArray(response.actionOptions) && response.actionOptions.length) {
            notes.push('actionOptions descartados na fase de estado.');
        }
        const suppressRoll = Boolean(input.suppressRollRequest);
        const playerRoll = suppressRoll ? null : (response.playerRollRequest ?? null);
        if (suppressRoll && response.playerRollRequest) {
            notes.push('playerRollRequest removida (turno não espera rolagem).');
        }
        const candidate: any = {
            updatedCharacter: response.updatedCharacter,
            worldState: response.worldState,
            combatState: response.combatState,
            xpEvents: response.xpEvents,
            progressionFeed: response.progressionFeed,
            newHomebrewContent: response.newHomebrewContent,
            levelUpState: response.levelUpState,
            shopState: response.shopState,
            lootOffer: response.lootOffer,
            useHitDiceRequest: response.useHitDiceRequest,
            gameClock: response.gameClock,
            memoryContext: response.memoryContext,
            systemLog: response.systemLog,
            logEntries: [],
            actionOptions: [],
            _meta: response._meta,
        };
        candidate.playerRollRequest = playerRoll;
        const phaseCheck = StatePhaseResponseSchema.safeParse(candidate);
        if (!phaseCheck.success) {
            throw createError(422, `State phase schema violado: ${JSON.stringify(phaseCheck.error.flatten())}`);
        }
        const baselineCharacter = isPlainObject(input.character) ? input.character : undefined;
        const prunedUpdatedCharacter = pruneUnchangedFields(
            phaseCheck.data.updatedCharacter as Record<string, any> | undefined,
            baselineCharacter
        );
        if (!prunedUpdatedCharacter && phaseCheck.data.updatedCharacter && Object.keys(phaseCheck.data.updatedCharacter).length) {
            notes.push('updatedCharacter sem alterações foi omitido.');
        }
        const baselineWorld = baselineCharacter?.worldState;
        const worldStateDelta = phaseCheck.data.worldState && baselineWorld
            ? (deepEqual(phaseCheck.data.worldState, baselineWorld) ? undefined : phaseCheck.data.worldState)
            : phaseCheck.data.worldState;
        if (!worldStateDelta && phaseCheck.data.worldState) {
            notes.push('worldState idêntico ao anterior removido.');
        }
        const baselineCombat = input.combatState ?? baselineCharacter?.combatState;
        let combatStateDelta = phaseCheck.data.combatState;
        if (combatStateDelta && baselineCombat && deepEqual(combatStateDelta, baselineCombat)) {
            notes.push('combatState inalterado ignorado.');
            combatStateDelta = null;
        }

        response.logEntries = [];
        response.actionOptions = [];
        response.updatedCharacter = prunedUpdatedCharacter;
        response.worldState = worldStateDelta;
        response.combatState = combatStateDelta;
        response.playerRollRequest = suppressRoll ? undefined : phaseCheck.data.playerRollRequest ?? undefined;
        response.xpEvents = phaseCheck.data.xpEvents;
        response.progressionFeed = phaseCheck.data.progressionFeed;
        response.newHomebrewContent = phaseCheck.data.newHomebrewContent;
        response.levelUpState = phaseCheck.data.levelUpState;
        response.shopState = phaseCheck.data.shopState;
        response.lootOffer = phaseCheck.data.lootOffer;
        response.useHitDiceRequest = phaseCheck.data.useHitDiceRequest;
        response.gameClock = phaseCheck.data.gameClock;
        response.memoryContext = phaseCheck.data.memoryContext;
        response.systemLog = phaseCheck.data.systemLog;

        if (notes.length) {
            const existingMeta = isPlainObject(response._meta) ? response._meta : {};
            const currentNotes = Array.isArray(existingMeta.integrityNotes)
                ? existingMeta.integrityNotes
                : existingMeta.integrityNotes
                    ? [existingMeta.integrityNotes]
                    : [];
            response._meta = {
                ...existingMeta,
                integrityNotes: [...currentNotes, ...notes],
            };
        }
    }
    return notes;
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
    const genAI = new GoogleGenAI({ apiKey });

    const systemInstruction = getCachedInstruction(
        input.useAiHomebrew ?? true,
        input.enableNarrativeRevalidation ?? true
    );
    const systemInstructionContent = buildSystemInstructionPayload(systemInstruction);

    const recoveryStrategies = new Set<string>();
    const failoverTrail: string[] = [];
    const aggregatedWarnings: GameUpdateWarning[] = [];
    const emitWarning = (type: string, details?: Record<string, any> | string | null) => {
        aggregatedWarnings.push({ type, details });
        recordFeedbackWarning(sessionId, input.scenarioLabel, (input.responseFocus ?? 'full') as 'narrative' | 'state' | 'full', type, typeof details === 'object' ? details : null)
            .catch(err => console.warn('[aiService] Falha ao registrar feedback:', err));
        trackWarningMetric(type, input.scenarioLabel).catch(err => console.warn('[aiService] Falha ao registrar métrica:', err));
    };
    const registerRecoveryStrategy = (strategy?: string | null) => {
        if (strategy) recoveryStrategies.add(strategy);
    };

    const instantiateModel = (targetModel: string): ModelAdapter => {
        const lower = targetModel.toLowerCase();
        const gemmaMode = lower.includes('gemma');
        const supportsStructuredOutput = allowStructuredOutputForModel(targetModel);
        const providerModelName = toProviderModelName(targetModel);

        const withSystemInstructionTopLevel = (body: Record<string, any>, systemInstructionPayload?: GeminiMessage) => {
            if (!systemInstructionPayload || gemmaMode) {
                return body;
            }
            return {
                ...body,
                systemInstruction: systemInstructionPayload,
            };
        };

        return {
            isGemma: gemmaMode,
            supportsStructuredOutput,
            generateContent: (body: Record<string, any>, systemInstructionPayload?: GeminiMessage) =>
                genAI.models.generateContent({
                    model: providerModelName,
                    ...withSystemInstructionTopLevel(body, systemInstructionPayload),
                }),
            countTokens: (body: Record<string, any>, systemInstructionPayload?: GeminiMessage) =>
                genAI.models.countTokens({
                    model: providerModelName,
                    ...withSystemInstructionTopLevel(body, systemInstructionPayload),
                }),
        };
    };

    const wasCondensed = { value: false };
    const condensedInput = condenseGameMasterInput(input, wasCondensed);
    if (wasCondensed.value) {
        condensedInput.validationFeedback = condensedInput.validationFeedback
            ? `${condensedInput.validationFeedback}\n[Prompt] Histórico condensado automaticamente para caber no limite.`
            : '[Prompt] Histórico condensado automaticamente para caber no limite.';
    }
    
    if (input.scenarioLabel) {
        const focusForExample = (input.responseFocus ?? 'full') === 'narrative' ? 'narrative' : 'state';
        const exampleSnippet = await fetchScenarioExampleSnippet(input.scenarioLabel, focusForExample);
        if (exampleSnippet) {
            input.exampleSnippet = exampleSnippet;
            condensedInput.exampleSnippet = exampleSnippet;
        }
    }

    const buildPrompts = (gemmaMode: boolean) => ({
        preview: createPrompt(input, gemmaMode),
        condensed: createPrompt(condensedInput, gemmaMode),
    });

    let activeModelName = modelName;
    let modelAdapter = instantiateModel(activeModelName);
    let isGemmaActive = modelAdapter.isGemma;
    let structuredOutputEnabled = modelAdapter.supportsStructuredOutput;
    if (RESPONSE_SCHEMA_GLOBAL_ENABLED && !structuredOutputEnabled) {
        console.warn(`[aiService] Structured output não permitido para o modelo ${activeModelName}; continuando sem schema.`);
    }
    let { preview: rawPromptPreview, condensed: basePrompt } = buildPrompts(isGemmaActive);
    let lastPromptSent = '';
    let forceJsonMimeTypeForSession = FORCE_JSON_MIME;
    let structuredOutputDisabledReason: string | null = structuredOutputEnabled ? null : 'not-enabled';
    const rebuildModel = (targetModel: string) => {
        const nextAdapter = instantiateModel(targetModel);
        modelAdapter = nextAdapter;
        isGemmaActive = nextAdapter.isGemma;
        structuredOutputEnabled = nextAdapter.supportsStructuredOutput;
        if (RESPONSE_SCHEMA_GLOBAL_ENABLED && !structuredOutputEnabled) {
            console.warn(`[aiService] Structured output não permitido para o modelo ${targetModel}; continuando sem schema.`);
        }
        const prompts = buildPrompts(isGemmaActive);
        rawPromptPreview = prompts.preview;
        basePrompt = prompts.condensed;
        activeModelName = targetModel;
        structuredOutputDisabledReason = structuredOutputEnabled ? null : 'not-enabled';
    };

    const digestTelemetry: { before?: number; after?: number } = {};
    try {
        const baselineTokens = await modelAdapter.countTokens({
            contents: [buildUserContent(rawPromptPreview)],
        }, systemInstructionContent);
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
            const pingResult = await modelAdapter.generateContent({
                contents: [buildUserContent('Responda apenas com "OK".')],
                config: { maxOutputTokens: 4, temperature: 0.1 },
            }, systemInstructionContent);
            const pingText = extractResponseText(pingResult);
            if (!pingText || !/^ok\b/i.test(pingText)) {
                throw new Error(`Ping retornou "${pingText ?? '<vazio>'}"`);
            }
            healthCheckSucceeded = true;
        } catch (err) {
            console.error('[aiService] Health check do modelo falhou:', err);
            throw err;
        }
    };

    type AttemptRetryOptions = {
        continuationRaw?: string;
        schemaRetryCount?: number;
        additionalHints?: string[];
        schemaDriftRetryCount?: number;
    };

    const attemptGeneration = async (
        attemptIndex: number = 0,
        retryOptions: AttemptRetryOptions = {}
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
                warnings: aggregatedWarnings.slice(),
            };
        };

        const attemptFailover = (): boolean => {
            if (!FAILOVER_ENABLED) {
                return false;
            }
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
                    return { response: failSoftResponse, rawText: snapshot.lastPrompt, warnings: aggregatedWarnings.slice() };
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
            const uniqueHints = Array.from(new Set(retryOptions.additionalHints ?? []));
            if (uniqueHints.length) {
                prompt = `${prompt}\n\n${uniqueHints.join('\n\n')}`;
            }
            prompt += (RETRY_PROMPT_HINTS[attemptIndex] ?? '');
            const contents = [buildUserContent(prompt)];
            if (attemptIndex === 0 && env.AI_DEBUG_LOGS) {
                void debugLogAiStage('prompt', {
                    attempt: attemptIndex + 1,
                    playerAction: input.playerAction,
                    characterId: input.character?.id,
                    prompt,
                    structuredOutput: structuredOutputEnabled,
                }, { mode, systemInstruction: isGemmaActive ? undefined : systemInstruction });
            }
            let measuredTokens: number | undefined;
            try {
                const tokenCountResult = await modelAdapter.countTokens({
                    contents,
                }, systemInstructionContent);
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
            const shouldForceJsonMimeType = forceJsonMimeTypeForSession;
            const phaseSchema =
                structuredOutputEnabled && input.responseFocus === 'narrative'
                    ? NARRATIVE_PHASE_GENERATIVE_SCHEMA
                    : structuredOutputEnabled && input.responseFocus === 'state'
                        ? STATE_PHASE_GENERATIVE_SCHEMA
                        : undefined;
            const { config: sanitizedGenerationConfig, requestedMax, appliedMax, promptTokens, profile } =
                buildGenerationConfig(
                    prompt,
                    generationConfig,
                    mode,
                    measuredTokens,
                    structuredOutputEnabled,
                    shouldForceJsonMimeType,
                    phaseSchema
                );

            const retryCap = RETRY_OUTPUT_LIMITS[attemptIndex];
            if (retryCap !== undefined) {
                const currentMax = sanitizedGenerationConfig.maxOutputTokens ?? appliedMax ?? DEFAULT_OUTPUT_TOKENS;
                sanitizedGenerationConfig.maxOutputTokens = clamp(
                    Math.min(currentMax, retryCap),
                    MODE_MIN_OUTPUT_TOKENS[mode] ?? MIN_OUTPUT_TOKENS,
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
                    structuredOutput: structuredOutputEnabled,
                }, { mode, systemInstruction: isGemmaActive ? undefined : systemInstruction });
            }
            lastPromptSent = prompt;
            const result = await modelAdapter.generateContent({
                contents,
                config: sanitizedGenerationConfig,
            }, systemInstructionContent);

            const response = result;

            if (env.AI_DEBUG_LOGS) {
                void debugLogAiStage('raw-response-full', response, { mode });
            }

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
                if (env.AI_DEBUG_LOGS) {
                    const candidateSummary = {
                        promptFeedback: response?.promptFeedback ?? null,
                        modelVersion: response?.modelVersion ?? null,
                        candidates: (response?.candidates ?? []).map((candidate: any, candidateIndex: number) => ({
                            index: candidateIndex,
                            finishReason: candidate?.finishReason ?? null,
                            hasParts: Array.isArray(candidate?.content?.parts) && candidate.content.parts.length > 0,
                            partKinds: Array.isArray(candidate?.content?.parts)
                                ? candidate.content.parts.map((part: any) => {
                                    if (typeof part === 'string') return 'string';
                                    if (!part || typeof part !== 'object') return typeof part;
                                    if (typeof part.text === 'string') return 'text';
                                    if (part.functionCall) return 'functionCall';
                                    if (part.inlineData) return 'inlineData';
                                    if (part.fileData) return 'fileData';
                                    return Object.keys(part)[0] ?? 'unknown';
                                })
                                : [],
                        })),
                    };
                    console.warn('[aiService] Resposta vazia recebida. Resumo do objeto bruto:', JSON.stringify(candidateSummary, null, 2));
                }
                console.error(`[aiService] Resposta da IA vazia na tentativa ${attemptIndex + 1}.`);
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
                        const mirrored = await attemptSemanticMirrorRecovery(jsonText, modelAdapter, systemInstructionContent);
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
                    if (attemptIndex + 1 < MAX_MODEL_ATTEMPTS) {
                        console.warn('[aiService] Resposta sem JSON válido; solicitando nova tentativa antes do fallback.');
                        registerRecoveryStrategy('non-json-retry');
                        return attemptGeneration(attemptIndex + 1, retryOptions);
                    }
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
                    return attemptGeneration(attemptIndex + 1, { ...retryOptions, continuationRaw });
                }
                console.warn('[aiService] Resposta reparada porém limite de tentativas atingido; acionando fallback resiliente.');
                return ensureRetryOrFallback('A IA enviou JSON inválido após múltiplas tentativas.');
            }

            if (responseData && typeof responseData === 'object') {
                const matchesBefore = responseMatchesCurrentSchema(responseData as any);
                ensureResponseSchemaHash(responseData as any);
                if (!matchesBefore && !responseMatchesCurrentSchema(responseData as any)) {
                    console.warn('[aiService] Hash de schema divergente; aplicando migração defensiva imediata.');
                    responseData = migrateLegacyResponse(responseData, { input, rawText: jsonText });
                    markSchemaDrift(responseData);
                    emitWarning('schema_migration', { focus: input.responseFocus ?? 'full' });
                    registerRecoveryStrategy('schema-migration');
                }
            }

            // 1️⃣ Mini-sanitizer (limpeza pré-validação)
            let cleanedData = miniSanitize(responseData);

            const guardIssue = shouldEnforceStateGuard(input)
                ? detectStatePhaseGuardIssue(cleanedData, input)
                : null;
            if (guardIssue) {
                emitWarning('state_guard_retry', { reason: guardIssue.reason });
                if (attemptIndex + 1 < MAX_MODEL_ATTEMPTS) {
                    registerRecoveryStrategy('state-guard');
                    return attemptGeneration(attemptIndex + 1, {
                        ...retryOptions,
                        additionalHints: mergeRetryHints(retryOptions.additionalHints, guardIssue.hint),
                    });
                }
                const autoPatched = guardIssue.reason.startsWith('combat_')
                    ? rebuildCombatStateFromBaseline(cleanedData as GameMasterResponse, input)
                    : false;
                if (autoPatched) {
                    console.warn('[aiService] Fase de estado inválida; combate reconstruído localmente após esgotar tentativas.');
                } else {
                    console.warn('[aiService] Fase de estado inválida até o limite de tentativas; acionando fallback.');
                    return ensureRetryOrFallback('A IA insistiu em responder a fase de estado com narrativa ou snapshot completo.');
                }
            }

            // 2️⃣ Sanitização semântica / lógica
            const finalResponse = sanitizeGameMasterResponse(cleanedData, input.character, input);
            ensureResponseSchemaHash(finalResponse);
            enforceCombatContinuity(finalResponse, input);
            ensureLootCurrencyDelta(finalResponse, input);
            ensureScenarioXpArtifacts(finalResponse, input);
            ensureGameClockProgression(finalResponse, input);
            ensureLevelProgressConsistency(finalResponse, input);
            ensureScenarioCombatSeed(finalResponse, input);
            pruneFinishedCombatState(finalResponse);
            const enforcementNotes = enforcePhaseCompliance(finalResponse, input);
            if (enforcementNotes.length) {
                emitWarning('phase_sanitization', {
                    focus: input.responseFocus ?? 'full',
                    notes: enforcementNotes,
                });
            }

            const semanticIssues = evaluateSemanticConsistency(finalResponse, input);
            if (semanticIssues.length) {
                emitWarning('semantic_validator', { issues: semanticIssues });
                if (attemptIndex + 1 < MAX_MODEL_ATTEMPTS) {
                    registerRecoveryStrategy('semantic-validator');
                    const semanticHints = semanticIssues.map(issue => issue.hint);
                    return attemptGeneration(attemptIndex + 1, {
                        ...retryOptions,
                        additionalHints: mergeRetryHints(retryOptions.additionalHints, ...semanticHints),
                    });
                }
                console.warn('[aiService] Semântica inconsistente; prosseguindo por falta de tentativas.');
            }
            
            // 3️⃣ Validação estrutural com Zod
            const validationSchema =
                input.responseFocus === 'narrative'
                    ? NarrativePhaseResponseSchema
                    : input.responseFocus === 'state'
                        ? StatePhaseResponseSchema
                        : GameMasterResponseSchema;
            const validationResult = validationSchema.safeParse(finalResponse);
            if (!validationResult.success) {
                const flattenedError = validationResult.error.flatten();
                emitWarning('zod_validation_failure', {
                    attempt: attemptIndex + 1,
                    scenarioLabel: input.scenarioLabel,
                    fieldErrors: flattenedError.fieldErrors,
                    formErrors: flattenedError.formErrors,
                });
                void logZodValidationFailure({
                    attempt: attemptIndex + 1,
                    model: activeModelName,
                    sessionId,
                    scenarioLabel: input.scenarioLabel,
                    inputSnapshot: cloneInput(input),
                    rawText: jsonText,
                    zodError: flattenedError,
                });
                console.warn("⚠️ Falha na validação Zod:", flattenedError);
                if (!isRetry) return attemptGeneration(1);
                throw createError(500, `A resposta da IA falhou na validação estrutural: ${JSON.stringify(flattenedError)}`);
            }

            const metadataExtras = {
                recoveryStrategies: Array.from(recoveryStrategies),
                integrityNotes: [
                    ...(structuredOutputDisabledReason && structuredOutputDisabledReason !== 'not-enabled'
                        ? [`structured output desativado (${structuredOutputDisabledReason}).`]
                        : []),
                ],
            };
            const validatedResponse = input.responseFocus
                ? attachResponseMetadata(validationResult.data as GameMasterResponse, metadataExtras)
                : normalizeResponseSchema(validationResult.data, metadataExtras);
            if (failoverTrail.length) {
                const failoverNote = `[Failover] Modelo alternado: ${failoverTrail.join(' -> ')}`;
                validatedResponse.systemLog = validatedResponse.systemLog
                    ? `${validatedResponse.systemLog}\n${failoverNote}`
                    : failoverNote;
            }

            if (input.scenarioLabel && (input.responseFocus === 'narrative' || input.responseFocus === 'state')) {
                void recordScenarioExample(input.scenarioLabel, input.responseFocus, validatedResponse);
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
                warnings: aggregatedWarnings.slice(),
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
            if (/(response_schema|response_json_schema)/i.test(message) && structuredOutputEnabled) {
                const schemaRetryCount = retryOptions.schemaRetryCount ?? 0;
                if (schemaRetryCount >= 1) {
                    console.error('[aiService] Schema estruturado rejeitado repetidamente; acionando fallback.');
                    return ensureRetryOrFallback('O modelo rejeitou o schema de resposta estruturado.');
                }
                console.warn('[aiService] Schema rejection detectado; repetindo tentativa com structured output.');
                return attemptGeneration(attemptIndex, { ...retryOptions, schemaRetryCount: schemaRetryCount + 1 });
            }
            if (shouldBackoff) {
                if (input.responseFocus === 'state' && attemptFailover()) {
                    console.warn('[aiService] Estado encontrou erro transitório; alternando para modelo de contingência.');
                    await sleep(200);
                    return attemptGeneration(0, retryOptions);
                }
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
