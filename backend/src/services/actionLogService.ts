import { AppDataSource } from '../database/data-source.js';
import { ActionLog } from '../entities/ActionLog.js';

export interface ActionLogPayload {
    sessionId: number;
    characterId?: number;
    encounterId?: number;
    entityId?: string;
    actionId?: string;
    actionType?: string;
    stateVersion?: number;
    delta?: Record<string, any>;
    metadata?: Record<string, any>;
}

const DELTA_DEBUG = process.env.DELTA_DEBUG === 'true';

export async function recordActionLog(payload: ActionLogPayload): Promise<ActionLog> {
    const repo = AppDataSource.getRepository(ActionLog);
    const log = repo.create({
        sessionId: payload.sessionId,
        characterId: payload.characterId ?? null,
        encounterId: payload.encounterId ?? null,
        entityId: payload.entityId ?? null,
        actionId: payload.actionId ?? null,
        actionType: payload.actionType ?? null,
        stateVersion: payload.stateVersion ?? null,
        delta: payload.delta ?? null,
        metadata: payload.metadata ?? null,
    });
    const saved = await repo.save(log);
    if (DELTA_DEBUG) {
        console.log('[ActionLog] recorded', {
            id: saved.id,
            sessionId: saved.sessionId,
            actionId: saved.actionId,
            actionType: saved.actionType,
            hasDelta: Boolean(saved.delta),
        });
    }
    return saved;
}
