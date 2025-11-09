import { promises as fs } from 'fs';
import path from 'path';
import type { GameMasterResponse } from '../schemas/gameSchemas.js';
import { GAME_MASTER_SCHEMA_HASH } from './schemaIntegrityService.js';

const CACHE_DIR = path.join(process.cwd(), 'logs', 'ai', 'session-cache');
const DEFAULT_SNAPSHOT_TTL_MS = Number(process.env.SESSION_SNAPSHOT_TTL_MS ?? 10 * 60 * 1000);
let snapshotTtlMs = Number.isFinite(DEFAULT_SNAPSHOT_TTL_MS) && DEFAULT_SNAPSHOT_TTL_MS > 0
    ? DEFAULT_SNAPSHOT_TTL_MS
    : 10 * 60 * 1000;

export interface SessionSnapshot {
    sessionId: string;
    timestamp: string;
    lastValidResponse: GameMasterResponse;
    lastPrompt: string;
    schemaHash: string;
}

type SnapshotPayload = {
    lastValidResponse: GameMasterResponse;
    lastPrompt: string;
    schemaHash?: string;
};

const failureState = new Map<string, number>();

export const normalizeSessionId = (sessionId?: string | number | null): string => {
    if (sessionId === null || sessionId === undefined) return 'anonymous-session';
    return String(sessionId).replace(/[^a-z0-9_-]+/gi, '-').slice(0, 64) || 'anonymous-session';
};

const getSessionFile = (sessionId: string) => path.join(CACHE_DIR, `${sessionId}.json`);

export const registerFailure = (sessionId: string): number => {
    const normalized = normalizeSessionId(sessionId);
    const failures = (failureState.get(normalized) ?? 0) + 1;
    failureState.set(normalized, failures);
    return failures;
};

export const resetFailures = (sessionId: string): void => {
    failureState.delete(normalizeSessionId(sessionId));
};

export const setSessionSnapshotTTL = (milliseconds: number) => {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
    snapshotTtlMs = milliseconds;
};

export const saveSessionSnapshot = async (sessionId: string, snapshot: SnapshotPayload) => {
    const normalized = normalizeSessionId(sessionId);
    const payload: SessionSnapshot = {
        sessionId: normalized,
        timestamp: new Date().toISOString(),
        schemaHash: snapshot.schemaHash || GAME_MASTER_SCHEMA_HASH,
        lastPrompt: snapshot.lastPrompt,
        lastValidResponse: snapshot.lastValidResponse,
    };
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
        await fs.writeFile(getSessionFile(normalized), JSON.stringify(payload, null, 2), 'utf8');
    } catch (error) {
        console.warn('[sessionRecoveryCache] Falha ao salvar snapshot:', error);
    }
};

export const loadSessionSnapshot = async (sessionId: string): Promise<SessionSnapshot | null> => {
    const normalized = normalizeSessionId(sessionId);
    const filePath = getSessionFile(normalized);
    try {
        const file = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(file) as SessionSnapshot;
        const timestamp = new Date(parsed.timestamp).getTime();
        if (Number.isFinite(timestamp) && snapshotTtlMs > 0) {
            const age = Date.now() - timestamp;
            if (age > snapshotTtlMs) {
                await fs.unlink(filePath).catch(() => {});
                failureState.delete(normalized);
                return null;
            }
        }
        return parsed;
    } catch {
        return null;
    }
};
