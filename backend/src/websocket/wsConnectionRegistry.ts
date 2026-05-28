import type { WebSocket } from 'ws';

type TrackedSocket = WebSocket & { userId?: number };

const socketsByUser = new Map<number, Set<TrackedSocket>>();

export function registerWsConnection(ws: TrackedSocket): void {
    if (!ws.userId) return;
    let set = socketsByUser.get(ws.userId);
    if (!set) {
        set = new Set();
        socketsByUser.set(ws.userId, set);
    }
    set.add(ws);
}

export function unregisterWsConnection(ws: TrackedSocket): void {
    if (!ws.userId) return;
    const set = socketsByUser.get(ws.userId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) socketsByUser.delete(ws.userId);
}

export function sendToUser(userId: number, message: Record<string, unknown>): void {
    const set = socketsByUser.get(userId);
    if (!set?.size) return;
    const raw = JSON.stringify(message);
    for (const ws of set) {
        if (ws.readyState === ws.OPEN) {
            ws.send(raw);
        }
    }
}
