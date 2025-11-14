import { promises as fs } from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs', 'deltas');
const LOG_FILE = path.join(LOG_DIR, 'applied.log');

export interface DeltaLogEntry {
    sessionId: number;
    actionId?: string;
    stateVersion?: number;
    delta?: Record<string, unknown>;
    metrics?: Record<string, unknown>;
}

export const logAppliedDelta = async (entry: DeltaLogEntry) => {
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
        const line = JSON.stringify({
            ts: new Date().toISOString(),
            ...entry,
        });
        await fs.appendFile(LOG_FILE, line + '\n', 'utf8');
    } catch (error) {
        console.error('[deltaLogger] Failed to persist delta log:', error);
    }
};
