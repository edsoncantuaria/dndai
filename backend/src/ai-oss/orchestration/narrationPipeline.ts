/**
 * Pipeline narrativo OSS-120B — substitui getGameUpdate quando AI_ENGINE=oss.
 */
import type { GameMasterFlowInput, GameMasterResponse } from '../../schemas/gameSchemas.js';
import { GenerationConfigSchema } from '../../schemas/validationSchemas.js';
import type { z } from 'zod';
import { extractResponseText } from '../../ai/responseParser.js';
import { validateByPhaseFocus } from '../../ai/responseValidator.js';
import { generateFallbackResponse } from '../../services/gameOrchestrator.js';
import type { GameUpdateResult, GameUpdateWarning } from '../../services/aiService.js';
import { getGameUpdate } from '../../ai/gameUpdate.js';
import { OSS_120B_MODEL } from '../constants.js';
import { OSS_COMBAT_CONFIG } from '../configs/combat.js';
import { OSS_NARRATIVE_CONFIG } from '../configs/narrative.js';
import { isOssEngineEnabled } from '../core/engineSwitch.js';
import { buildOssSceneContext } from '../context/contextBuilder.js';
import { compressGameLogForOss } from '../memory/compressor.js';
import { detectNarrationLoop } from '../narrative/antiLoop.js';
import { parseOssJsonResponse, tryLocalOssFieldRepair } from '../parser/jsonRecovery.js';
import {
    buildPromptCacheKey,
    getCachedSystemInstruction,
    setCachedSystemInstruction,
} from '../cache/promptCache.js';
import { isOssStreamEnabled } from '../core/streamSwitch.js';
import { runOssJsonOnlyRepair } from '../parser/jsonOnlyRepair.js';
import { composePrompt } from '../prompts/promptDsl.js';
import type { PromptPhase } from '../prompts/phaseTemplates.js';
import { resolveOssTemperature } from '../tuning/temperatureProfile.js';
import { extractStreamingNarrationPreview } from '../parser/narrationStreamExtract.js';
import { createOssModelAdapter } from '../providers/openRouterClient.js';
import { streamOpenRouterChat } from '../providers/openRouterStream.js';
import { emitNarrationStream } from './narrationStream.js';
import { normalizeActionOptionsFromRegistry } from '../actions/registry.js';
import {
    applyCombatDeterminism,
    validateCombatOssNarration,
} from '../combat/deterministicCombat.js';
import { mapOssNarrationToGameMasterShape } from '../schemas/narration.schema.js';
import type { OssNarrationResponse } from '../schemas/narration.schema.js';
import { validateOssNarration } from '../validators/narrationValidator.js';
import { isOssMinimalNarrationEnabled } from '../../config/ossMinimalNarration.js';
import {
    OssMinimalNarrationSchema,
    mapMinimalToGameMasterShape,
} from '../schemas/minimalNarration.schema.js';
import type { ActionDomain } from '../actions/registry.js';
import {
    recordLocalRepairSuccess,
    recordOssGenerationAttempt,
} from '../telemetry/requestMetrics.js';
import { recordJsonRepairOutcome } from '../../telemetry/pipelineLatency.js';
import { logOssPromptBundle } from '../telemetry/ossPromptLog.js';

type GenerationConfig = z.infer<typeof GenerationConfigSchema>;

const DEFAULT_MAX_API_ATTEMPTS = 2;

function resolveMaxApiAttempts(): number {
    if (isOssMinimalNarrationEnabled()) {
        return 1;
    }
    const fromEnv = Number(process.env.OSS_MAX_API_ATTEMPTS ?? DEFAULT_MAX_API_ATTEMPTS);
    return Number.isFinite(fromEnv) && fromEnv >= 1 ? Math.min(fromEnv, 3) : DEFAULT_MAX_API_ATTEMPTS;
}

export type OssNarrationParams = {
    input: GameMasterFlowInput;
    apiKey: string;
    model?: string;
    generationConfig?: GenerationConfig;
    /** Correlação com actionId do WebSocket / telemetria. */
    actionId?: string;
    traceId?: string;
    stateVersion?: number;
};

function ossTraceLog(traceId: string | undefined, message: string, extra?: Record<string, unknown>): void {
    if (!traceId) return;
    const verbose = ['1', 'true', 'yes', 'on'].includes(
        (process.env.OSS_TRACE_LOG ?? 'false').trim().toLowerCase(),
    );
    if (!verbose) return;
    console.log(`[oss trace=${traceId}] ${message}`, extra ?? '');
}

function pickDomainConfig(
    input: GameMasterFlowInput,
    phase: PromptPhase,
    requested?: GenerationConfig,
): GenerationConfig {
    const base = phase === 'combat' ? OSS_COMBAT_CONFIG : OSS_NARRATIVE_CONFIG;
    const tuned = resolveOssTemperature(phase, {
        temperature: requested?.temperature,
        topP: requested?.topP,
    });
    return {
        temperature: tuned.temperature,
        topP: tuned.topP,
        topK: requested?.topK ?? base.topK,
        maxOutputTokens: requested?.maxOutputTokens ?? base.maxOutputTokens,
    };
}

function ossRepairHint(
    parseError?: string,
    zodIssues?: string[],
    legacyIssues?: string[],
    extra?: string,
): string {
    const parts = [
        extra ?? null,
        parseError ? `Parse: ${parseError}` : null,
        zodIssues?.length ? `Schema: ${zodIssues.join('; ')}` : null,
        legacyIssues?.length ? `Narrativa: ${legacyIssues.join('; ')}` : null,
    ].filter(Boolean);
    return parts.join(' | ') || 'JSON inválido; reescreva o objeto completo.';
}

function extractNarrationText(data: OssNarrationResponse): string {
    if (data.narration?.trim()) return data.narration.trim();
    const first = data.logEntries?.[0];
    if (!first) return '';
    const c = first.content;
    return typeof c === 'string' ? c : (c as { text?: string; content?: string })?.text ?? '';
}

function validateMinimalOssPayload(
    data: unknown,
    domain: ActionDomain,
): {
    ok: boolean;
    response?: GameMasterResponse;
    issues: string[];
} {
    const check = OssMinimalNarrationSchema.safeParse(data);
    if (!check.success) {
        return {
            ok: false,
            issues: check.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        };
    }
    const mapped = mapMinimalToGameMasterShape(check.data, domain);
    const candidate: GameMasterResponse = {
        logEntries: mapped.logEntries as GameMasterResponse['logEntries'],
        actionOptions: mapped.actionOptions,
        systemLog: mapped.systemLog ?? null,
        ...(mapped.newFacts?.length ? { newFacts: mapped.newFacts } : {}),
    } as GameMasterResponse;
    const legacyCheck = validateByPhaseFocus(candidate, 'narrative');
    if (!legacyCheck.valid) {
        return { ok: false, issues: legacyCheck.issues };
    }
    return { ok: true, response: legacyCheck.data ?? candidate, issues: [] };
}

function validateOssPayload(
    data: unknown,
    opts: { combatActive: boolean; playerAction: string },
): {
    ok: boolean;
    response?: GameMasterResponse;
    issues: string[];
    ossData?: OssNarrationResponse;
} {
    const domain: ActionDomain = opts.combatActive
        ? 'combat'
        : /falar|conversar|persuadir|intimidar|negociar/i.test(opts.playerAction)
          ? 'social'
          : 'exploration';

    if (isOssMinimalNarrationEnabled()) {
        const minimal = validateMinimalOssPayload(data, domain);
        return {
            ok: minimal.ok,
            response: minimal.response,
            issues: minimal.issues,
        };
    }

    let working = data;
    let ossCheck = validateOssNarration(working, {
        combatActive: opts.combatActive,
        domain,
    });
    if (!ossCheck.valid) {
        const local = tryLocalOssFieldRepair(working, {
            combatActive: opts.combatActive,
            playerAction: opts.playerAction,
            domain,
        });
        if (local) {
            recordLocalRepairSuccess();
            recordJsonRepairOutcome(true);
            working = local;
            ossCheck = validateOssNarration(local, {
                combatActive: opts.combatActive,
                domain,
            });
        } else {
            recordJsonRepairOutcome(false);
        }
    }
    if (!ossCheck.valid || !ossCheck.data) {
        return { ok: false, issues: ossCheck.issues, ossData: ossCheck.data };
    }

    let mapped: ReturnType<typeof mapOssNarrationToGameMasterShape>;
    if (opts.combatActive) {
        const combatCheck = validateCombatOssNarration(ossCheck.data);
        if (!combatCheck.valid || !combatCheck.data) {
            return { ok: false, issues: combatCheck.issues, ossData: ossCheck.data };
        }
        mapped = applyCombatDeterminism(combatCheck.data);
    } else {
        const normalized: OssNarrationResponse = {
            ...ossCheck.data,
            actionOptions: normalizeActionOptionsFromRegistry(
                ossCheck.data.actionOptions,
                'exploration',
            ),
        };
        mapped = mapOssNarrationToGameMasterShape(normalized);
    }

    const candidate: GameMasterResponse = {
        logEntries: mapped.logEntries as GameMasterResponse['logEntries'],
        actionOptions: mapped.actionOptions,
        systemLog: mapped.systemLog ?? null,
        ...((mapped as { newFacts?: unknown }).newFacts?.length
            ? { newFacts: (mapped as { newFacts: unknown }).newFacts }
            : {}),
    } as GameMasterResponse;
    const legacyCheck = validateByPhaseFocus(candidate, 'narrative');
    if (!legacyCheck.valid) {
        return { ok: false, issues: legacyCheck.issues, ossData: ossCheck.data };
    }
    return {
        ok: true,
        response: legacyCheck.data ?? candidate,
        issues: [],
        ossData: ossCheck.data,
    };
}

async function runOssNarrationCore(params: OssNarrationParams): Promise<GameUpdateResult> {
    const model = ensureOssModel(params.model);
    const initialPhase: PromptPhase = params.input.combatState?.isActive
        ? 'combat'
        : 'exploration';
    let activePhase = initialPhase;
    let config = pickDomainConfig(params.input, activePhase, params.generationConfig);
    const adapter = createOssModelAdapter(params.apiKey, model);
    const warnings: GameUpdateWarning[] = [];
    const maxAttempts = resolveMaxApiAttempts();
    const combatActive = Boolean(params.input.combatState?.isActive);
    const traceId = params.traceId ?? params.actionId;
    const useStream = isOssStreamEnabled() && Boolean(params.actionId);

    const characterRecord = params.input.character as Record<string, unknown> | undefined;
    const characterName =
        typeof characterRecord?.name === 'string' ? characterRecord.name : undefined;

    const sceneSummary = buildOssSceneContext(params.input);
    const compressedLog = compressGameLogForOss(params.input.gameLog ?? '');

    let validationFeedback = params.input.validationFeedback?.trim() ?? '';
    let antiLoopHint = '';
    let lastRaw = '';
    let apiCalls = 0;
    let jsonOnlyRepairUsed = false;

    const promptCacheKey = buildPromptCacheKey({
        sessionId: params.input.sessionId,
        regionSlug: params.input.regionSlug,
        stateVersion: params.stateVersion,
        combatActive,
    });

    while (apiCalls < maxAttempts) {
        const composed = composePrompt({
            player: params.input.playerAction,
            log: compressedLog,
            combat: combatActive,
            characterName,
            scene: sceneSummary || undefined,
            memory: sceneSummary || undefined,
            antiLoopHint: antiLoopHint || undefined,
            flowInput: params.input,
            outputSchema: combatActive ? 'combat' : 'narration',
        });
        activePhase = composed.phase;
        config = pickDomainConfig(params.input, activePhase, params.generationConfig);

        let systemInstruction = composed.systemInstruction;
        if (validationFeedback) {
            /* repair: system fresco (sem cache) */
        } else {
            const cached = getCachedSystemInstruction(promptCacheKey);
            if (cached) {
                systemInstruction = cached;
            } else {
                setCachedSystemInstruction(promptCacheKey, systemInstruction);
            }
        }

        let userText = composed.userPrompt;
        if (validationFeedback) {
            userText += `\n\nCORRECAO: ${validationFeedback}\nReescreva só o JSON.`;
        }

        logOssPromptBundle({
            actionId: traceId,
            sessionId: params.input.sessionId,
            model,
            phase: activePhase,
            playerAction: params.input.playerAction,
            systemInstruction,
            userPrompt: userText,
            combatActive,
        });

        apiCalls += 1;
        ossTraceLog(traceId, 'generation_attempt', { attempt: apiCalls, stream: useStream });

        const requestBody = {
            contents: [{ role: 'user', parts: [{ text: userText }] }],
            config: {
                temperature: config.temperature,
                topP: config.topP,
                maxOutputTokens: config.maxOutputTokens,
                responseMimeType: 'application/json',
            },
        };
        const systemPayload = { role: 'system' as const, parts: [{ text: systemInstruction }] };

        if (useStream) {
            let streamBuffer = '';
            let emittedNarration = 0;
            const streamed = await streamOpenRouterChat({
                userApiKey: params.apiKey,
                model,
                body: requestBody,
                systemInstructionPayload: systemPayload,
                onDelta: delta => {
                    streamBuffer += delta;
                    const { preview, emittedLength } = extractStreamingNarrationPreview(
                        streamBuffer,
                        emittedNarration,
                    );
                    if (preview) {
                        emittedNarration = emittedLength;
                        emitNarrationStream(params.actionId, {
                            kind: 'preview',
                            text: preview,
                        });
                    }
                },
            });
            lastRaw = streamed.content;
            emitNarrationStream(params.actionId, { kind: 'structured', complete: true });
        } else {
            const rawResponse = await adapter.generateContent(requestBody, systemPayload);
            lastRaw = extractResponseText(rawResponse) ?? '';
        }
        let parsed = parseOssJsonResponse(lastRaw);

        if ((!parsed.ok || parsed.data === undefined) && !jsonOnlyRepairUsed) {
            jsonOnlyRepairUsed = true;
            const jsonFixed = await runOssJsonOnlyRepair(lastRaw, {
                apiKey: params.apiKey,
                playerAction: params.input.playerAction,
                repairHint: parsed.error ?? parsed.stages?.join('>'),
            });
            if (jsonFixed.ok && jsonFixed.data) {
                parsed = { ok: true, data: jsonFixed.data, stages: ['json-only-repair'] };
                lastRaw = jsonFixed.raw ?? lastRaw;
                warnings.push({ type: 'oss_json_only_repair', details: { attempt: apiCalls } });
                ossTraceLog(traceId, 'json_only_repair_ok');
            }
        }

        if (!parsed.ok || parsed.data === undefined) {
            validationFeedback = ossRepairHint(
                parsed.error ?? 'falha ao parsear',
                undefined,
                undefined,
                `Repair: ${parsed.stages?.join('>') ?? 'n/a'}`,
            );
            warnings.push({
                type: 'oss_json_parse',
                details: { attempt: apiCalls, strategy: parsed.strategy, stages: parsed.stages },
            });
            continue;
        }

        const validated = validateOssPayload(parsed.data, {
            combatActive,
            playerAction: params.input.playerAction,
        });

        if (!validated.ok || !validated.response) {
            validationFeedback = ossRepairHint(undefined, validated.issues);
            warnings.push({
                type: 'oss_validation',
                details: { attempt: apiCalls, issues: validated.issues },
            });
            continue;
        }

        const narrText = validated.ossData ? extractNarrationText(validated.ossData) : '';
        const loop = detectNarrationLoop(narrText, compressedLog);
        if (loop.repetitive && loop.hint && apiCalls < maxAttempts) {
            antiLoopHint = loop.hint;
            validationFeedback = loop.hint;
            warnings.push({ type: 'oss_anti_loop', details: { score: loop.score } });
            continue;
        }

        const response = validated.response;
        recordOssGenerationAttempt(apiCalls === 1);
        ossTraceLog(traceId, 'generation_ok', { attempt: apiCalls });
        if (useStream) {
            emitNarrationStream(params.actionId, { kind: 'done', complete: true });
        }
        if (apiCalls > 1 || parsed.stages?.includes('normalize-quotes')) {
            appendSystemLog(
                response,
                `[OSS] OK após ${apiCalls} chamada(s)${parsed.stages?.length ? ` (repair: ${parsed.stages.join('→')})` : ''}.`,
            );
        }

        return { response, rawText: lastRaw, warnings: warnings.length ? warnings : undefined };
    }

    const fallback = generateFallbackResponse(
        { character: params.input.character },
        params.input.playerAction,
        [validationFeedback],
    );
    appendSystemLog(fallback, '[OSS] Fallback local — JSON inválido após repair.');
    warnings.push({ type: 'oss_fallback', details: validationFeedback });

    return { response: fallback, rawText: lastRaw, warnings };
}

function appendSystemLog(response: GameMasterResponse, note: string): void {
    response.systemLog = response.systemLog ? `${response.systemLog}\n${note}` : note;
}

export async function runOssNarration(params: OssNarrationParams): Promise<GameUpdateResult> {
    const model = ensureOssModel(params.model);
    const initialPhase: PromptPhase = params.input.combatState?.isActive
        ? 'combat'
        : 'exploration';
    let activePhase = initialPhase;
    const config = pickDomainConfig(params.input, activePhase, params.generationConfig);

    if (!isOssEngineEnabled()) {
        return getGameUpdate(params.input, model, config, params.apiKey);
    }

    return runOssNarrationCore(params);
}

export function ensureOssModel(model?: string | null): string {
    const trimmed = model?.trim();
    if (!trimmed) {
        return process.env.AI_DEFAULT_MODEL?.trim() || OSS_120B_MODEL;
    }
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('gemini') || lower.startsWith('models/gemini')) {
        return process.env.AI_DEFAULT_MODEL?.trim() || OSS_120B_MODEL;
    }
    return trimmed;
}
