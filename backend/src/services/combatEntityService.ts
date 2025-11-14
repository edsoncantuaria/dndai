import { AppDataSource } from '../database/data-source.js';
import { CombatEntity, ScheduledEffectPayload } from '../entities/CombatEntity.js';
import { recordActionLog } from './actionLogService.js';
import type { StateDeltaContext } from './characterStateService.js';

export interface CombatEntityInput {
    entityId: string;
    name: string;
    kind?: CombatEntity['kind'];
    hpMax: number;
    hpCurrent?: number;
    ac?: number | null;
    metadata?: Record<string, any>;
}

export interface CombatEntityDelta {
    hp?: {
        setTo?: number;
        delta?: number;
    };
    metadata?: Record<string, any>;
    activeConditions?: string[];
    pendingEffects?: ScheduledEffectPayload[];
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const DELTA_DEBUG = process.env.DELTA_DEBUG === 'true';
const debugLog = (...args: unknown[]) => {
    if (DELTA_DEBUG) {
        console.log('[EntityDelta]', ...args);
    }
};
const warnLog = (...args: unknown[]) => {
    console.warn('[EntityDelta]', ...args);
};

export async function upsertCombatEntity(encounterId: number, payload: CombatEntityInput): Promise<CombatEntity> {
    const repo = AppDataSource.getRepository(CombatEntity);
    let entity = await repo.findOne({ where: { encounterId, entityId: payload.entityId } });

    if (!entity) {
        entity = repo.create({
            encounterId,
            entityId: payload.entityId,
            name: payload.name,
            kind: payload.kind ?? 'npc',
            hpMax: payload.hpMax,
            hpCurrent: payload.hpCurrent ?? payload.hpMax,
            ac: payload.ac ?? null,
            metadata: payload.metadata ?? null,
            pendingEffects: [],
            activeConditions: [],
        });
    } else {
        entity.name = payload.name;
        entity.kind = payload.kind ?? entity.kind;
        entity.hpMax = payload.hpMax;
        entity.hpCurrent = clamp(payload.hpCurrent ?? entity.hpCurrent, 0, entity.hpMax);
        entity.ac = payload.ac ?? entity.ac;
        entity.metadata = payload.metadata ?? entity.metadata;
    }

    return repo.save(entity);
}

export async function applyEntityDelta(
    encounterId: number,
    entityId: string,
    delta: CombatEntityDelta
): Promise<CombatEntity | null> {
    const repo = AppDataSource.getRepository(CombatEntity);
    const entity = await repo.findOne({ where: { encounterId, entityId } });
    if (!entity) {
        warnLog('Entity not found for delta', { encounterId, entityId, delta });
        return null;
    }

    if (delta.hp) {
        if (typeof delta.hp.setTo === 'number') {
            entity.hpCurrent = clamp(delta.hp.setTo, 0, entity.hpMax);
        }
        if (typeof delta.hp.delta === 'number') {
            entity.hpCurrent = clamp(entity.hpCurrent + delta.hp.delta, 0, entity.hpMax);
        }
    }

    if (delta.metadata) {
        entity.metadata = {
            ...(entity.metadata ?? {}),
            ...delta.metadata,
        };
    }

    if (delta.activeConditions) {
        entity.activeConditions = delta.activeConditions;
    }

    if (delta.pendingEffects) {
        entity.pendingEffects = delta.pendingEffects;
    }

    return repo.save(entity);
}

export async function applyEntityDeltaWithLog(
    sessionId: number,
    encounterId: number,
    entityId: string,
    delta: CombatEntityDelta,
    context?: StateDeltaContext
): Promise<CombatEntity | null> {
    const updated = await applyEntityDelta(encounterId, entityId, delta);
    if (!updated) return null;
    debugLog('Entity updated', { sessionId, encounterId, entityId, delta });
    await recordActionLog({
        sessionId,
        encounterId,
        entityId,
        actionId: context?.actionId,
        actionType: context?.actionType ?? 'entity.delta',
        stateVersion: context?.stateVersion,
        delta: {
            entity: {
                encounterId,
                entityId,
                delta,
            },
        },
        metadata: context?.metadata,
    });
    return updated;
}

export async function scheduleEntityEffect(
    encounterId: number,
    entityId: string,
    effect: ScheduledEffectPayload
): Promise<CombatEntity | null> {
    const repo = AppDataSource.getRepository(CombatEntity);
    const entity = await repo.findOne({ where: { encounterId, entityId } });
    if (!entity) return null;

    entity.pendingEffects = [...(entity.pendingEffects ?? []), effect];
    return repo.save(entity);
}

export async function clearResolvedEffects(
    encounterId: number,
    entityId: string,
    effectIds: string[]
): Promise<CombatEntity | null> {
    const repo = AppDataSource.getRepository(CombatEntity);
    const entity = await repo.findOne({ where: { encounterId, entityId } });
    if (!entity || !entity.pendingEffects?.length) return entity;

    entity.pendingEffects = entity.pendingEffects.filter(effect => !effectIds.includes(effect.id));
    return repo.save(entity);
}
