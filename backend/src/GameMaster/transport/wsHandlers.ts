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

const CURRENT_CONTRACT_VERSION = 2;

function resolveWsUserId(
    app: FastifyInstance,
    query: { userId?: string; token?: string },
): number | null {
    if (query.token) {
        return verifyWsToken(app, query.token);
    }
    if (query.userId) {
        const n = Number(query.userId);
        return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
}

export async function registerGameMasterWebSocket(app: FastifyInstance): Promise<void> {
    app.get('/ws', { websocket: true }, (socket, request) => {
        const query = request.query as { userId?: string; token?: string };
        const userId = resolveWsUserId(app, query);
        if (!userId) {
            socket.send(JSON.stringify({ type: 'error', message: 'Autenticação WS requerida (token JWT).' }));
            socket.close();
            return;
        }
        registerLocalSocket(userId, socket);

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

    if (msg.type === 'processAction' && msg.sessionId) {
        await handleProcessAction(userId, msg.sessionId, msg.payload ?? {});
        return;
    }

    if (msg.type === 'submitRollResult' && msg.sessionId) {
        await handleSubmitRollResult(userId, msg.sessionId, msg.payload ?? {});
        return;
    }

    if (msg.type === 'syncPendingRoll' && msg.sessionId) {
        const pending = await import('../motor/rollStore.js').then(m =>
            m.getPendingPenaiRoll(msg.sessionId!),
        );
        if (pending) {
            await publishWsToUser(userId, {
                type: 'pendingRollState',
                contractVersion: CURRENT_CONTRACT_VERSION,
                sessionId: msg.sessionId,
                locale: 'pt-BR',
                playerRollRequest: pending,
            });
        }
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

async function queueNarration(opts: {
    userId: number;
    sessionId: number;
    playerAction: string;
    actionSequence: number;
    actionId: string;
    rollSummary?: string;
}): Promise<void> {
    const wf = await startNarrationWorkflow({
        sessionId: opts.sessionId,
        userId: opts.userId,
        playerAction: opts.playerAction,
        actionSequence: opts.actionSequence,
        actionId: opts.actionId,
        rollSummary: opts.rollSummary,
    });

    await publishWsToUser(opts.userId, {
        type: 'narrationQueued',
        contractVersion: CURRENT_CONTRACT_VERSION,
        sessionId: opts.sessionId,
        actionId: opts.actionId,
        actionSequence: opts.actionSequence,
        workflowId: wf.workflowId,
        sync: wf.sync ?? false,
        locale: 'pt-BR',
    });
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

    const lock = await GAME_MOTOR.isTurnLocked(sessionId);
    if (lock.locked) {
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

    const actionSequence = await allocateActionSequence(sessionId);
    const actionId = String(payload.actionId ?? randomUUID());

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

    const motor = await GAME_MOTOR.validateAndApply({
        sessionId,
        userId,
        playerAction,
        actionId,
        actionSequence,
        payload,
    });

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
        actionOptions: mechanicalPack.actionOptions ?? [],
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

    await queueNarration({
        userId,
        sessionId,
        playerAction,
        actionSequence,
        actionId,
    });
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

    if (resolved.deferNarration) {
        return;
    }

    if (resolved.playerAction && resolved.actionId && resolved.actionSequence != null) {
        await queueNarration({
            userId,
            sessionId,
            playerAction: resolved.playerAction,
            actionSequence: resolved.actionSequence,
            actionId: resolved.actionId,
            rollSummary: resolved.rollSummary,
        });
    }
}
