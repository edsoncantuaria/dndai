import type { WebSocket } from 'ws';
import { getRedis, WS_PUBSUB_CHANNEL } from '../infra/redis.js';
import { penaiPipelineWsOut } from '../infra/pipelineLog.js';

type WsEnvelope = { userId: number; payload: unknown };

const localSockets = new Map<number, Set<WebSocket>>();

export function registerLocalSocket(userId: number, socket: WebSocket): void {
    let set = localSockets.get(userId);
    if (!set) {
        set = new Set();
        localSockets.set(userId, set);
    }
    set.add(socket);
    socket.on('close', () => {
        set?.delete(socket);
        if (set?.size === 0) localSockets.delete(userId);
    });
}

function deliverLocal(userId: number, payload: unknown): void {
    const set = localSockets.get(userId);
    if (!set?.size) return;
    const raw = JSON.stringify(payload);
    for (const ws of set) {
        if (ws.readyState === ws.OPEN) ws.send(raw);
    }
}

export async function publishWsToUser(userId: number, payload: unknown): Promise<void> {
    const msg = payload as { type?: string; sessionId?: number; actionId?: string; actionSequence?: number };
    if (msg?.type) {
        penaiPipelineWsOut(msg.type, {
            userId,
            sessionId: msg.sessionId,
            actionId: msg.actionId,
            actionSequence: msg.actionSequence,
        });
    }

    const redis = getRedis();
    if (redis?.isOpen) {
        const envelope: WsEnvelope = { userId, payload };
        await redis.publish(WS_PUBSUB_CHANNEL, JSON.stringify(envelope));
        return;
    }
    deliverLocal(userId, payload);
}

export async function startWsPubSubSubscriber(): Promise<void> {
    const redis = getRedis();
    if (!redis?.isOpen) return;

    const sub = redis.duplicate();
    await sub.connect();
    await sub.subscribe(WS_PUBSUB_CHANNEL, message => {
        try {
            const envelope = JSON.parse(message) as WsEnvelope;
            deliverLocal(envelope.userId, envelope.payload);
        } catch {
            /* ignore */
        }
    });
    console.log('[PENAI] Redis pub/sub WS ativo.');
}
