import { v4 as uuidv4 } from 'uuid';
import type { PlayerRollRequest, CombatState } from '../../types.js';
import type { AutomatedRollResult } from './autoRollService.js';
import type { GameMasterResponse } from '../../schemas/gameSchemas.js';
import type { ActionIntent } from '../../rules/actionIntentService.js';
import type { RuleCheckResult } from '../../rules/types.js';
import { convertRollRequestToPlayerRoll } from '../../rules/rollRequestAdapter.js';
import { validateActionIntent } from '../../rules/actionIntentService.js';
import { executeAutomatedRoll, formatRollOutcomeForDm } from './autoRollService.js';
import { buildDmPlayerActionPrompt } from './dmPromptBuilder.js';
import { processPlayerTurn } from '../narrarService.js';
import { resolveStructuredRoll, type RollResolutionResult } from '../ruleResolutionService.js';
import { clearPendingRollRequest, savePendingRollRequest } from '../rollRequestService.js';
import { buildRollResolutionPrompt } from '../../websocket/utils.js';
import { computeRawRollFromValues } from '../../websocket/utils.js';
import { getCastSummaryForSession } from '../sessionCastService.js';
import { inferSkillCheckFromFreeText } from './freeActionClassifier.js';
import { classifyFreeActionWithLlm } from './freeActionLlmClassifier.js';
import { resolveSkillForPlayerAction } from './skillActionSemantics.js';
import { listNormalizedSkills } from '../../rules/skills.js';

/** Padrão: jogador rola no dado 3D (cliente). Auto-roll só se DM_AUTO_ROLL=true. */
export const isDmAutoRollEnabled = (): boolean =>
    ['1', 'true', 'yes', 'on'].includes(
        (process.env.DM_AUTO_ROLL ?? 'false').trim().toLowerCase(),
    );

export const isDmFreeActionClassificationEnabled = (): boolean => true;

/** Classificação LLM de texto livre (custo extra); desligar só com DM_LLM_CLASSIFY=false explícito. */
export const isDmLlmClassificationEnabled = (): boolean =>
    !['0', 'false', 'no', 'off'].includes((process.env.DM_LLM_CLASSIFY ?? 'true').trim().toLowerCase());

const ROLL_TYPE_MAP: Record<ActionIntent['type'], PlayerRollRequest['rollType']> = {
    'weapon-attack': 'attack',
    'skill-check': 'check',
    'spell-attack': 'attack',
    rest: 'check',
    damage: 'damage',
    healing: 'healing',
    'consume-item': 'check',
    travel: 'check',
    'equip-item': 'check',
    'drop-item': 'check',
    'claim-loot': 'check',
};

export function ruleResultToPlayerRoll(
    intent: ActionIntent,
    result: RuleCheckResult,
): PlayerRollRequest | null {
    if (result.status !== 'needs_roll' || !result.rollRequest) return null;
    const mergedMetadata = {
        ...(result.rollRequest.metadata ?? {}),
        ...(result.data ?? {}),
        ...(result.stateDelta?.pendingAttack ? { pendingAttack: result.stateDelta.pendingAttack } : {}),
    };
    return convertRollRequestToPlayerRoll(result.rollRequest, {
        rollType: ROLL_TYPE_MAP[intent.type] ?? 'check',
        reasonPrefix: 'Mestre',
        metadata: mergedMetadata,
    });
}

/** Resposta mínima: abre o dado 3D no cliente — sem narrar ainda. */
export async function issuePendingRollToPlayer(params: {
    sessionId: number;
    userId: number;
    rollRequest: PlayerRollRequest;
    actionId?: string;
    intentType?: string;
    intentPayload?: unknown;
    metadata?: Record<string, unknown>;
    playerAction?: string;
    /** Aviso quando perícia foi corrigida pela intenção (ex.: Acrobacia → Enganação). */
    skillResolutionNote?: string;
}): Promise<GameMasterResponse> {
    const requestId = params.rollRequest.requestId ?? uuidv4();
    const roll = { ...params.rollRequest, requestId };
    const meta = {
        ...(params.metadata ?? {}),
        playerAction: params.playerAction?.slice(0, 400) ?? params.rollRequest.reason,
    };

    await savePendingRollRequest(
        params.sessionId,
        params.userId,
        roll,
        {
            actionId: params.actionId ?? requestId,
            intentType: params.intentType ?? 'dm-roll',
            intentPayload: params.intentPayload,
            metadata: meta,
        },
    );

    const correctionLine = params.skillResolutionNote?.trim();
    const logContent = correctionLine
        ? `Rolagem necessária: ${roll.reason}. ${correctionLine} Use os dados 3D quando estiver pronto.`
        : `Rolagem necessária: ${roll.reason}. Use os dados 3D quando estiver pronto.`;

    return {
        logEntries: [
            {
                id: uuidv4(),
                type: 'system',
                content: logContent,
            },
        ],
        actionOptions: [],
        playerRollRequest: roll,
        systemLog: correctionLine
            ? `[DM] Aguardando rolagem (dados 3D). ${correctionLine}`
            : '[DM] Aguardando rolagem do jogador (dados 3D).',
    };
}

export type NarrateAfterPlayerRollParams = {
    sessionId: number;
    userId: number;
    apiKey: string;
    playerAction: string;
    rollRequest: PlayerRollRequest;
    preRolled: AutomatedRollResult;
    combatState?: CombatState | null;
    useAiHomebrew?: boolean;
    actionId?: string;
    resolutionResult?: RollResolutionResult | null;
    extraMotorHints?: string[];
    narrationTts?: NarrationTtsSettings | null;
    actionSequence?: number;
    executionSource?: import('../narration/workerPersistencePolicy.js').NarrationExecutionSource;
};

/** Jogador já rolou no 3D; motor já aplicou efeitos — só narrar desfecho. */
export async function narrateAfterPlayerRoll(
    params: NarrateAfterPlayerRollParams,
): Promise<GameMasterResponse> {
    const {
        sessionId,
        userId,
        apiKey,
        playerAction,
        rollRequest,
        preRolled,
        combatState,
        useAiHomebrew,
        actionId,
        resolutionResult,
        extraMotorHints = [],
    } = params;

    const motorHints: string[] = [
        formatRollOutcomeForDm(rollRequest, preRolled),
        ...extraMotorHints,
    ];

    if (resolutionResult?.attackOutcome) {
        motorHints.push(
            resolutionResult.attackOutcome.hit
                ? '[Motor] Ataque acertou o alvo.'
                : '[Motor] Ataque errou o alvo.',
        );
    }
    if (resolutionResult?.hints?.length) {
        motorHints.push(...resolutionResult.hints);
    }

    const castSummary = await getCastSummaryForSession(sessionId);
    const narratePrompt = buildDmPlayerActionPrompt({
        phase: combatState?.isActive ? 'combat' : 'roll_outcome',
        playerAction,
        rollRequest,
        automatedRoll: preRolled,
        motorHints,
        castSummary,
        combatActive: Boolean(combatState?.isActive),
    });

    const legacyRollLine = buildRollResolutionPrompt(
        rollRequest,
        preRolled.diceValues,
        preRolled.rawRoll,
        preRolled.total,
    );

    const { shouldAllowCombatNarration } = await import('../../combat/combatPhaseService.js');
    if (!(await shouldAllowCombatNarration(sessionId))) {
        return {
            logEntries: [],
            actionOptions: [],
            systemLog: '[Motor] Narração adiada — aguardando fase AWAITING_NARRATION do combate.',
        };
    }

    return processPlayerTurn(
        sessionId,
        userId,
        narratePrompt,
        apiKey,
        combatState ?? undefined,
        useAiHomebrew,
        [legacyRollLine, ...motorHints],
        actionId,
        params.narrationTts,
        params.actionSequence,
        params.executionSource ?? 'sync',
    );
}

export type CompleteRollAndNarrateParams = {
    sessionId: number;
    userId: number;
    apiKey: string;
    playerAction: string;
    rollRequest: PlayerRollRequest;
    combatState?: CombatState | null;
    useAiHomebrew?: boolean;
    actionId?: string;
    intentType?: string;
    intentPayload?: unknown;
    metadata?: Record<string, unknown>;
    preRolled?: AutomatedRollResult;
};

/** Modo legado: servidor rola sozinho (DM_AUTO_ROLL=true). */
export async function completeRollAndNarrate(
    params: CompleteRollAndNarrateParams,
): Promise<GameMasterResponse> {
    const {
        sessionId,
        userId,
        apiKey,
        playerAction,
        rollRequest,
        combatState,
        useAiHomebrew,
        actionId,
        intentType,
        intentPayload,
        metadata,
    } = params;

    const requestId = rollRequest.requestId ?? uuidv4();
    const pending = { ...rollRequest, requestId };
    const automated = params.preRolled ?? executeAutomatedRoll(pending);

    let resolutionResult: RollResolutionResult | null = null;
    try {
        resolutionResult = await resolveStructuredRoll(
            sessionId,
            {
                ...pending,
                sessionId,
                userId,
                createdAt: Date.now(),
                context: {
                    actionId: actionId ?? requestId,
                    intentType: intentType ?? 'dm-auto-roll',
                    intentPayload,
                    metadata,
                },
            },
            {
                total: automated.total,
                rawRoll: automated.rawRoll,
                diceValues: automated.diceValues,
            },
        );
        if (!resolutionResult?.nextRollRequest) {
            await clearPendingRollRequest(sessionId);
        }
    } catch (err) {
        console.warn('[dmTurn] Falha ao aplicar efeitos da rolagem:', err);
        await clearPendingRollRequest(sessionId);
    }

    return narrateAfterPlayerRoll({
        sessionId,
        userId,
        apiKey,
        playerAction,
        rollRequest: pending,
        preRolled: automated,
        combatState,
        useAiHomebrew,
        actionId,
        resolutionResult,
    });
}

export type NarrationTtsSettings = {
    narrationVoice?: unknown;
    narrationSpeed?: unknown;
};

export type ProcessFreeActionWithDmParams = {
    sessionId: number;
    userId: number;
    playerAction: string;
    apiKey: string;
    combatState?: CombatState | null;
    useAiHomebrew?: boolean;
    actionId?: string;
    narrationTts?: NarrationTtsSettings | null;
    /** Quando presente, narração vai para fila BullMQ (não bloqueia WS). */
    ws?: import('ws').WebSocket;
};

async function applySkillContextToIntent(
    playerAction: string,
    intent: ActionIntent | null,
): Promise<ActionIntent | null> {
    if (!intent || intent.type !== 'skill-check') return intent;
    const skills = await listNormalizedSkills();
    const resolution = resolveSkillForPlayerAction(playerAction, skills);
    if (!resolution) return intent;
    const payload = intent.payload as { skillIndex: string; resolutionNote?: string };
    return {
        type: 'skill-check',
        payload: {
            ...payload,
            skillIndex: resolution.skillIndex,
            ...(resolution.resolutionNote
                ? { resolutionNote: resolution.resolutionNote }
                : {}),
        },
    };
}

async function tryClassifyAndIssueRoll(params: ProcessFreeActionWithDmParams): Promise<GameMasterResponse | null> {
    const { sessionId, userId, playerAction, combatState, actionId } = params;

    let intent: ActionIntent | null = null;
    if (isDmFreeActionClassificationEnabled()) {
        intent = await inferSkillCheckFromFreeText(sessionId, userId, playerAction);
    }
    if (!intent && isDmLlmClassificationEnabled() && params.apiKey?.trim()) {
        intent = await classifyFreeActionWithLlm(playerAction, params.apiKey);
    }
    intent = await applySkillContextToIntent(playerAction, intent);
    if (!intent) return null;

    const { result, intent: validatedIntent } = await validateActionIntent(sessionId, userId, intent, {
        combatState: combatState ?? null,
    });

    if (result.status === 'needs_roll') {
        const roll = ruleResultToPlayerRoll(validatedIntent, result);
        if (!roll) return null;
        if (isDmAutoRollEnabled()) {
            return completeRollAndNarrate({
                ...params,
                rollRequest: roll,
                intentType: validatedIntent.type,
                intentPayload: validatedIntent.payload,
                metadata: { ...(result.data as object), playerAction },
            });
        }
        const resolutionNote =
            validatedIntent.type === 'skill-check' &&
            validatedIntent.payload &&
            typeof validatedIntent.payload === 'object' &&
            'resolutionNote' in validatedIntent.payload &&
            typeof (validatedIntent.payload as { resolutionNote?: string }).resolutionNote ===
                'string'
                ? (validatedIntent.payload as { resolutionNote: string }).resolutionNote
                : undefined;

        return issuePendingRollToPlayer({
            sessionId,
            userId,
            rollRequest: roll,
            actionId,
            intentType: validatedIntent.type,
            intentPayload: validatedIntent.payload,
            metadata: {
                ...(result.data as Record<string, unknown>),
                ...(resolutionNote ? { skillResolutionNote: resolutionNote } : {}),
            },
            playerAction,
            skillResolutionNote: resolutionNote,
        });
    }

    return null;
}

/**
 * Ação livre: classifica rolagem → dados 3D OU narra direto.
 */
export async function processFreeActionWithDmFlow(
    params: ProcessFreeActionWithDmParams,
): Promise<GameMasterResponse> {
    const { sessionId, userId, playerAction, apiKey, combatState, useAiHomebrew, actionId } =
        params;

    const rollIssued = await tryClassifyAndIssueRoll(params);
    if (rollIssued) return rollIssued;

    const castSummary = await getCastSummaryForSession(sessionId);
    const prompt = buildDmPlayerActionPrompt({
        phase: combatState?.isActive ? 'combat' : 'action',
        playerAction,
        castSummary,
        combatActive: Boolean(combatState?.isActive),
    });

    const resolvedId = actionId ?? uuidv4();
    const { isNarrationQueueAvailable } = await import('../../queue/narrationJobQueue.js');
    if (params.ws || isNarrationQueueAvailable()) {
        const { dispatchNarrationToQueue, buildQueuedNarrationAck } = await import(
            '../../queue/narrationDispatch.js'
        );
        const { getSessionStateVersion } = await import('../../action-pipeline/context.js');
        const queued = await dispatchNarrationToQueue({
            ws: params.ws,
            sessionId,
            userId,
            actionId: resolvedId,
            stateVersion: getSessionStateVersion(sessionId),
            job: {
                kind: 'action',
                playerAction: prompt,
                apiKey,
                combatState: combatState ?? undefined,
                useAiHomebrew,
                narrationVoice: params.narrationTts?.narrationVoice as string | undefined,
                narrationSpeed: params.narrationTts?.narrationSpeed as string | undefined,
            },
        });
        if (queued) return buildQueuedNarrationAck();
    }

    return processPlayerTurn(
        sessionId,
        userId,
        prompt,
        apiKey,
        combatState ?? undefined,
        useAiHomebrew,
        undefined,
        actionId,
        params.narrationTts,
    );
}

export async function narrateOpeningScene(params: {
    sessionId: number;
    userId: number;
    apiKey: string;
    useAiHomebrew?: boolean;
    actionId?: string;
}): Promise<GameMasterResponse> {
    const castSummary = await getCastSummaryForSession(params.sessionId);
    const prompt = buildDmPlayerActionPrompt({
        phase: 'scene',
        playerAction: 'A aventura continua. Apresente a cena atual.',
        castSummary,
    });
    return processPlayerTurn(
        params.sessionId,
        params.userId,
        prompt,
        params.apiKey,
        undefined,
        params.useAiHomebrew,
        ['[Mestre] Abertura de cena solicitada pelo fluxo DM.'],
        params.actionId,
    );
}

/** Após dados 3D: valida no motor e narra (websocket). */
export async function completeManualRollAndNarrate(params: {
    sessionId: number;
    userId: number;
    apiKey: string;
    pending: PlayerRollRequest & { requestId: string; userId: number };
    diceValues: number[];
    combatState?: CombatState | null;
    useAiHomebrew?: boolean;
    resolutionResult?: RollResolutionResult | null;
    narrationTts?: NarrationTtsSettings | null;
    actionSequence?: number;
    executionSource?: import('../narration/workerPersistencePolicy.js').NarrationExecutionSource;
}): Promise<GameMasterResponse> {
    const rawRoll = computeRawRollFromValues(params.pending, params.diceValues);
    const modifier = params.pending.modifier || 0;
    const total = rawRoll + modifier;
    const preRolled: AutomatedRollResult = {
        diceValues: params.diceValues,
        rawRoll,
        modifier,
        total,
        success:
            typeof params.pending.dc === 'number' ? total >= params.pending.dc : null,
        notation: (params.pending.dice || '1d20').toLowerCase(),
    };

    const meta = params.pending.context?.metadata as Record<string, unknown> | undefined;
    const playerAction =
        typeof meta?.playerAction === 'string' ? meta.playerAction : params.pending.reason;

    return narrateAfterPlayerRoll({
        sessionId: params.sessionId,
        userId: params.userId,
        apiKey: params.apiKey,
        playerAction,
        rollRequest: params.pending,
        preRolled,
        combatState: params.combatState,
        useAiHomebrew: params.useAiHomebrew,
        actionId: params.pending.context?.actionId,
        resolutionResult: params.resolutionResult ?? null,
        narrationTts: params.narrationTts,
        actionSequence: params.actionSequence,
        executionSource: params.executionSource ?? 'worker',
    });
}
