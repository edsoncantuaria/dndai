import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { registerLocalSocket, publishWsToUser } from './wsPubSub.js';
import { allocateActionSequence, getGameSession } from '../sessions/sessionService.js';
import { appendWorldEvent } from '../events/store.js';
import { startNarrationWorkflow } from '../../temporal/client.js';
import { GAME_MOTOR } from '../motor/index.js';
import { runPostMechanicalEntityLifecycle } from '../world/entityLifecycle.js';
import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { formatMechanicalPack } from '../character/formatMechanicalPack.js';
import { resolveStructuredIntentType } from '../motor/structuredApply.js';
import { verifyWsToken } from '../../app/plugins/auth.js';
import {
    penaiPipelineLog,
    penaiPipelineWait,
    penaiPipelineWsIn,
} from '../infra/pipelineLog.js';
import { isSessionOpeningRequest } from '../ai/promptComposer.js';

const CURRENT_CONTRACT_VERSION = 2;

function resolveWsUserId(
    app: FastifyInstance,
    query: { token?: string },
): number | null {
    if (query.token) {
        return verifyWsToken(app, query.token);
    }
    return null;
}

export async function registerGameMasterWebSocket(app: FastifyInstance): Promise<void> {
    app.get('/ws', { websocket: true }, (socket, request) => {
        const query = request.query as { token?: string };
        const userId = resolveWsUserId(app, query);
        if (!userId) {
            socket.send(JSON.stringify({ type: 'error', message: 'Autenticação WS requerida (token JWT).' }));
            socket.close();
            return;
        }
        registerLocalSocket(userId, socket);
        penaiPipelineLog('WS', `cliente conectado userId=${userId}`);

        socket.send(
            JSON.stringify({
                type: 'connected',
                contractVersion: CURRENT_CONTRACT_VERSION,
                locale: 'pt-BR',
                engine: 'penai',
                message: 'Conectado ao GameMaster PENAI',
            }),
        );

        socket.on('message', raw => {
            void handleWsMessage(userId, raw.toString(), socket);
        });
    });
}

async function handleWsMessage(
    userId: number,
    raw: string,
    socket: import('ws').WebSocket,
): Promise<void> {
    let msg: { type?: string; sessionId?: number; payload?: Record<string, unknown> };
    try {
        msg = JSON.parse(raw) as typeof msg;
    } catch {
        socket.send(JSON.stringify({ type: 'error', message: 'JSON inválido' }));
        return;
    }

    if (msg.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', locale: 'pt-BR' }));
        return;
    }

    const wsCtx = {
        userId,
        sessionId: msg.sessionId,
        actionId: typeof msg.payload?.actionId === 'string' ? msg.payload.actionId : undefined,
        actionSequence:
            typeof msg.payload?.actionSequence === 'number' ? msg.payload.actionSequence : undefined,
    };

    if (msg.type && msg.type !== 'ping') {
        penaiPipelineWsIn(msg.type, wsCtx, msg.payload);
    }

    if (msg.type === 'processAction' && msg.sessionId) {
        try {
            await handleProcessAction(userId, msg.sessionId, msg.payload ?? {});
        } catch (err) {
            console.error('[PENAI][WS] processAction falhou:', err);
            await publishWsToUser(userId, {
                type: 'error',
                message: err instanceof Error ? err.message : 'Falha ao processar ação',
                sessionId: msg.sessionId,
                locale: 'pt-BR',
            });
        }
        return;
    }

    if (msg.type === 'submitRollResult' && msg.sessionId) {
        await handleSubmitRollResult(userId, msg.sessionId, msg.payload ?? {});
        return;
    }

    if (msg.type === 'syncPendingRoll' && msg.sessionId) {
        const sessionId = msg.sessionId;
        const pending = await import('../motor/rollStore.js').then(m =>
            m.getPendingPenaiRoll(sessionId),
        );
        if (pending) {
            await publishWsToUser(userId, {
                type: 'pendingRollState',
                contractVersion: CURRENT_CONTRACT_VERSION,
                sessionId,
                locale: 'pt-BR',
                playerRollRequest: pending,
            });
        }

        const feed = await replayStoryFeedToUser(userId, sessionId, 'sync_idle');

        const { loadSessionUiState } = await import('../sessions/sessionUiState.js');
        const ui = await loadSessionUiState(sessionId);
        if (ui.actionOptions.length || ui.worldPulse) {
            await publishWsToUser(userId, {
                type: 'uiStateReplay',
                contractVersion: CURRENT_CONTRACT_VERSION,
                sessionId,
                locale: 'pt-BR',
                actionOptions: ui.actionOptions,
                worldPulse: ui.worldPulse?.events ?? [],
                worldPulseHeadline: ui.worldPulse?.headline ?? null,
            });
            if (ui.actionOptions.length) {
                const mechanical = await formatMechanicalPack(sessionId);
                await publishWsToUser(userId, {
                    type: 'gameStateUpdate',
                    contractVersion: CURRENT_CONTRACT_VERSION,
                    sessionId,
                    locale: 'pt-BR',
                    mechanical: { ...mechanical, actionOptions: ui.actionOptions },
                    actionOptions: ui.actionOptions,
                });
            }
        }

        penaiPipelineLog(
            'WS',
            'syncPendingRoll',
            {
                entries: feed.entries.length,
                pendingNarration: feed.pendingNarration,
                spawnBriefing: feed.spawnBriefing,
            },
            { sessionId, userId },
        );
        return;
    }

    socket.send(JSON.stringify({ type: 'error', message: `Tipo WS desconhecido: ${msg.type}` }));
}

async function emitMechanicalUpdate(
    userId: number,
    sessionId: number,
    actionId: string,
    actionSequence: number,
    motor: Awaited<ReturnType<typeof GAME_MOTOR.validateAndApply>>,
    extra?: Record<string, unknown>,
): Promise<void> {
    const session = await getGameSession(sessionId);
    await publishWsToUser(userId, {
        type: 'mechanicalStateUpdate',
        contractVersion: CURRENT_CONTRACT_VERSION,
        sessionId,
        actionId,
        actionSequence,
        stateVersion: (session?.stateVersion as number) ?? 0,
        locale: 'pt-BR',
        intentType: motor.intent.type,
        ruleCheck: motor.ruleCheck,
        mechanical: motor.mechanical,
        currentRegionSlug: session?.currentRegionSlug,
        playerRollRequest: motor.playerRollRequest ?? motor.mechanical.playerRollRequest,
        ...extra,
    });
}

function buildNarrationMotorHints(motor: {
    intent: { type: string };
    ruleCheck: { reason?: string; status?: string };
    mechanical?: Record<string, unknown>;
}): string[] {
    const hints = [`intent:${motor.intent.type}`];
    if (motor.mechanical?.intentType === 'opening') {
        hints.push('scene:opening', 'tone:cinematic');
    }
    if (motor.ruleCheck.reason?.trim()) {
        hints.push(`motor:${motor.ruleCheck.reason.trim().slice(0, 120)}`);
    }
    return hints;
}

async function queueNarration(opts: {
    userId: number;
    sessionId: number;
    playerAction: string;
    actionSequence: number;
    actionId: string;
    rollSummary?: string;
    motorHints?: string[];
    intentType?: string;
}): Promise<void> {
    const ctx = {
        sessionId: opts.sessionId,
        userId: opts.userId,
        actionId: opts.actionId,
        actionSequence: opts.actionSequence,
    };
    penaiPipelineWait('NARRATION', 'enfileirando narração (Temporal ou síncrono)…', ctx);

    const wf = await startNarrationWorkflow({
        sessionId: opts.sessionId,
        userId: opts.userId,
        playerAction: opts.playerAction,
        actionSequence: opts.actionSequence,
        actionId: opts.actionId,
        rollSummary: opts.rollSummary,
    });

    penaiPipelineLog(
        'NARRATION',
        wf.started ? 'workflow Temporal iniciado' : 'narração síncrona no processo',
        { workflowId: wf.workflowId, sync: wf.sync ?? false, started: wf.started },
        ctx,
    );

    /** Narração síncrona já emitiu storyFeed + narrationComplete — não re-travar o cliente. */
    if (wf.sync) {
        penaiPipelineLog('NARRATION', 'sync concluído — narrationQueued omitido', undefined, ctx);
        return;
    }

    await publishWsToUser(opts.userId, {
        type: 'narrationQueued',
        contractVersion: CURRENT_CONTRACT_VERSION,
        sessionId: opts.sessionId,
        actionId: opts.actionId,
        actionSequence: opts.actionSequence,
        workflowId: wf.workflowId,
        sync: false,
        locale: 'pt-BR',
    });
}

async function replayStoryFeedToUser(
    userId: number,
    sessionId: number,
    completeReason: 'replay_idle' | 'sync_idle' = 'replay_idle',
) {
    const { listSessionStoryFeed } = await import('../sessions/sessionStoryFeed.js');
    const feed = await listSessionStoryFeed(sessionId, userId);
    await publishWsToUser(userId, {
        type: 'storyFeedReplay',
        contractVersion: CURRENT_CONTRACT_VERSION,
        sessionId,
        locale: 'pt-BR',
        entries: feed.entries,
        spawnBriefing: feed.spawnBriefing,
        pendingNarration: feed.pendingNarration,
        pendingReason: feed.pendingReason,
    });
    if (!feed.pendingNarration) {
        await publishWsToUser(userId, {
            type: 'narrationComplete',
            contractVersion: CURRENT_CONTRACT_VERSION,
            sessionId,
            locale: 'pt-BR',
            reason: completeReason,
        });
    }
    return feed;
}

async function handleProcessAction(
    userId: number,
    sessionId: number,
    payload: Record<string, unknown>,
): Promise<void> {
    const structuredType = resolveStructuredIntentType(payload);
    const playerAction = String(payload.playerAction ?? payload.action ?? structuredType ?? '').trim();
    if (!playerAction && !structuredType) {
        await publishWsToUser(userId, {
            type: 'error',
            message: 'Ação do jogador vazia',
        });
        return;
    }

    const session = await getGameSession(sessionId);
    if (!session) {
        await publishWsToUser(userId, { type: 'error', message: 'Sessão não encontrada' });
        return;
    }
    if (Number(session.userId) !== userId) {
        await publishWsToUser(userId, {
            type: 'error',
            message: 'Sessão não pertence a este usuário.',
            locale: 'pt-BR',
        });
        return;
    }

    const earlyCtx = { sessionId, userId };

    const { isSessionEnded, isSessionHeroDead } = await import('../character/heroVitalsService.js');
    if (await isSessionEnded(sessionId) || (await isSessionHeroDead(sessionId))) {
        await publishWsToUser(userId, {
            type: 'actionRejected',
            contractVersion: CURRENT_CONTRACT_VERSION,
            sessionId,
            reason: 'O herói morreu — esta campanha terminou.',
            locale: 'pt-BR',
            code: 'HERO_DEAD',
        });
        return;
    }

    const isOpening = isSessionOpeningRequest(playerAction, payload);

    if (isOpening) {
        const { sessionHasPlayableNarration } = await import('../sessions/sessionStoryFeed.js');
        if (await sessionHasPlayableNarration(sessionId)) {
            penaiPipelineLog('TURN', 'opening ignorado — narração já persistida', undefined, earlyCtx);
            await replayStoryFeedToUser(userId, sessionId);
            return;
        }
        const openingLock = await GAME_MOTOR.isTurnLocked(sessionId);
        if (openingLock.locked) {
            penaiPipelineLog(
                'TURN',
                'opening ignorado — narração em andamento no backend',
                { reason: openingLock.reason },
                earlyCtx,
            );
            await replayStoryFeedToUser(userId, sessionId);
            return;
        }
    } else {
        const lock = await GAME_MOTOR.isTurnLocked(sessionId);
        if (lock.locked) {
            penaiPipelineLog('TURN', `bloqueado: ${lock.reason ?? 'TURN_LOCKED'}`, undefined, earlyCtx);
            await publishWsToUser(userId, {
                type: 'actionRejected',
                contractVersion: CURRENT_CONTRACT_VERSION,
                sessionId,
                reason: lock.reason ?? 'Turno bloqueado (BG3).',
                locale: 'pt-BR',
                code: 'TURN_LOCKED',
            });
            return;
        }
    }

    const actionSequence = await allocateActionSequence(sessionId);
    const actionId = String(payload.actionId ?? randomUUID());
    const turnCtx = { sessionId, userId, actionId, actionSequence };

    penaiPipelineLog(
        'TURN',
        'processAction aceito — iniciando motor',
        { playerAction: playerAction.slice(0, 160) },
        turnCtx,
    );

    const repo = PenaiDataSource.getRepository(GameSession);
    const row = await repo.findOne({ where: { id: sessionId } });
    if (row) {
        row.stateVersion += 1;
        await repo.save(row);
    }

    await appendWorldEvent({
        type: 'PLAYER_ACTION_SUBMITTED',
        sessionId,
        payload: { playerAction, actionId, actionSequence },
    });

    penaiPipelineWait('MOTOR', 'validateAndApply…', turnCtx);
    const motor = await GAME_MOTOR.validateAndApply({
        sessionId,
        userId,
        playerAction,
        actionId,
        actionSequence,
        payload,
    });
    penaiPipelineLog(
        'MOTOR',
        motor.blocked ? 'ação bloqueada' : motor.awaitingRoll ? 'aguardando rolagem' : 'mecânico ok',
        {
            intentType: motor.intent.type,
            ruleStatus: motor.ruleCheck.status,
            blocked: motor.blocked,
            awaitingRoll: motor.awaitingRoll,
        },
        turnCtx,
    );

    if (motor.blocked) {
        await publishWsToUser(userId, {
            type: 'actionRejected',
            contractVersion: CURRENT_CONTRACT_VERSION,
            sessionId,
            actionId,
            actionSequence,
            reason: motor.ruleCheck.reason ?? 'Ação rejeitada pelo motor.',
            hint: (motor.mechanical.hint as string | undefined) ?? undefined,
            locale: 'pt-BR',
        });
        return;
    }

    const mechanicalPack = await formatMechanicalPack(sessionId);
    await runPostMechanicalEntityLifecycle({ sessionId, userId, playerAction });

    const { runMicroWorldTick } = await import('../world/simulation/microPulse.js');
    void runMicroWorldTick(sessionId, turnCtx).catch(() => undefined);

    await emitMechanicalUpdate(userId, sessionId, actionId, actionSequence, motor, mechanicalPack);

    await publishWsToUser(userId, {
        type: 'gameStateUpdate',
        contractVersion: CURRENT_CONTRACT_VERSION,
        sessionId,
        actionId,
        actionSequence,
        locale: 'pt-BR',
        mechanical: mechanicalPack,
        levelUpState: (motor.mechanical as { levelUpState?: unknown }).levelUpState ?? null,
        /** Opções contextuais vêm com a narração (agente actionOptions) — evita flash genérico. */
        actionOptions: motor.awaitingRoll ? (mechanicalPack.actionOptions ?? []) : [],
    });

    if (motor.awaitingRoll) {
        await publishWsToUser(userId, {
            type: 'playerRollRequest',
            contractVersion: CURRENT_CONTRACT_VERSION,
            sessionId,
            actionId,
            actionSequence,
            locale: 'pt-BR',
            playerRollRequest: motor.playerRollRequest,
        });
        return;
    }

    try {
        await queueNarration({
            userId,
            sessionId,
            playerAction,
            actionSequence,
            actionId,
            motorHints: buildNarrationMotorHints(motor),
            intentType:
                motor.mechanical?.intentType === 'opening' ? 'opening' : motor.intent.type,
        });
    } catch (err) {
        console.error('[PENAI][WS] narração falhou:', err);
        penaiPipelineLog(
            'NARRATION',
            'falha ao narrar',
            { error: err instanceof Error ? err.message : String(err) },
            turnCtx,
        );
        await publishWsToUser(userId, {
            type: 'error',
            contractVersion: CURRENT_CONTRACT_VERSION,
            sessionId,
            actionId,
            actionSequence,
            message:
                err instanceof Error
                    ? err.message
                    : 'Falha na narração — verifique GEMINI_API_KEY / chave BYOK.',
            locale: 'pt-BR',
        });
    }
}

async function handleSubmitRollResult(
    userId: number,
    sessionId: number,
    payload: Record<string, unknown>,
): Promise<void> {
    const requestId = String(payload.requestId ?? '');

    if (!requestId) {
        await publishWsToUser(userId, {
            type: 'error',
            message: 'requestId é obrigatório',
            locale: 'pt-BR',
        });
        return;
    }

    const session = await getGameSession(sessionId);
    if (!session) {
        await publishWsToUser(userId, { type: 'error', message: 'Sessão não encontrada', locale: 'pt-BR' });
        return;
    }
    if (Number(session.userId) !== userId) {
        await publishWsToUser(userId, {
            type: 'error',
            message: 'Sessão não pertence a este usuário.',
            locale: 'pt-BR',
        });
        return;
    }

    const resolved = await GAME_MOTOR.resolveRoll({
        sessionId,
        userId,
        requestId,
        rolls: [],
    });

    if (!resolved.ok) {
        await publishWsToUser(userId, {
            type: 'error',
            message: resolved.message ?? 'Falha ao resolver rolagem',
            locale: 'pt-BR',
        });
        return;
    }

    await publishWsToUser(userId, {
        type: 'mechanicalStateUpdate',
        contractVersion: CURRENT_CONTRACT_VERSION,
        sessionId,
        actionId: resolved.actionId,
        actionSequence: resolved.actionSequence,
        locale: 'pt-BR',
        ruleCheck: resolved.ruleCheck,
        mechanical: resolved.mechanical,
        rollResolved: true,
        playerRollRequest: resolved.playerRollRequest,
    });

    if (resolved.playerRollRequest) {
        await publishWsToUser(userId, {
            type: 'playerRollRequest',
            contractVersion: CURRENT_CONTRACT_VERSION,
            sessionId,
            actionId: resolved.actionId,
            actionSequence: resolved.actionSequence,
            locale: 'pt-BR',
            playerRollRequest: resolved.playerRollRequest,
        });
        return;
    }

    if (resolved.permanentlyDead) {
        return;
    }

    if (resolved.deferNarration) {
        return;
    }

    if (resolved.playerAction && resolved.actionId && resolved.actionSequence != null) {
        const mech = resolved.mechanical as { motorHints?: string[] } | undefined;
        const motorHints = Array.isArray(mech?.motorHints)
            ? mech.motorHints.map(String)
            : ['intent:combat'];
        await queueNarration({
            userId,
            sessionId,
            playerAction: resolved.playerAction,
            actionSequence: resolved.actionSequence,
            actionId: resolved.actionId,
            rollSummary: resolved.rollSummary,
            motorHints,
            intentType: 'combat',
        });
    }
}
