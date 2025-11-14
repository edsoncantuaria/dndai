import createError from 'http-errors';
import { applyCharacterStateDelta, type StateDeltaContext } from './characterStateService.js';
import { applyEntityDeltaWithLog } from './combatEntityService.js';
import type { RuleCheckResult } from '../rules/types.js';
import { loadStateVersion } from './stateVersionService.js';
import { recordActionLog } from './actionLogService.js';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { CombatEntity } from '../entities/CombatEntity.js';

export interface DeltaApplicationSummary {
    updatedCharacter: Awaited<ReturnType<typeof applyCharacterStateDelta>> | null;
    updatedEntities: Array<{
        encounterId: number;
        entityId: string;
        hp: number;
        hpMax: number;
    }>;
    appliedDelta?: RuleCheckResult['stateDelta'];
    metrics: {
        damage?: number;
        healing?: number;
        spellSlotsUsed?: number;
        restType?: 'short' | 'long';
    };
}

type CompactSnapshot = {
    stateVersion: number;
    character?: {
        id: number;
        hp?: number | null;
        maxHp?: number | null;
    };
    entities?: Array<{
        encounterId: number;
        entityId: string;
        hp?: number | null;
        hpMax?: number | null;
    }>;
};

const STRICT_AUTHORITATIVE_DELTAS = process.env.STRICT_AUTHORITATIVE_DELTAS === 'true';
const warn = (...args: unknown[]) => console.warn('[stateDelta]', ...args);
const error = (...args: unknown[]) => console.error('[stateDelta]', ...args);

const isMeaningfulDelta = (delta?: RuleCheckResult['stateDelta']) => {
    if (!delta) return false;
    if (delta.character) return true;
    if (Array.isArray(delta.entities) && delta.entities.length) return true;
    return false;
};

const captureSnapshot = async (
    sessionId: number,
    delta?: RuleCheckResult['stateDelta']
): Promise<CompactSnapshot> => {
    const sessionRepo = AppDataSource.getRepository(SessaoIA);
    const session = await sessionRepo.findOne({
        where: { id: sessionId },
        relations: ['character', 'character.attributes'],
    });

    const snapshot: CompactSnapshot = {
        stateVersion: session?.stateVersion ?? 0,
    };

    if (session?.character?.id) {
        const attrs = session.character.attributes;
        snapshot.character = {
            id: session.character.id,
            hp: attrs?.hp ?? null,
            maxHp: attrs?.maxHp ?? null,
        };
    }

    if (delta?.entities?.length) {
        const entityRepo = AppDataSource.getRepository(CombatEntity);
        const entities: NonNullable<CompactSnapshot['entities']> = [];
        for (const entityDescriptor of delta.entities) {
            const entity = await entityRepo.findOne({
                where: {
                    encounterId: entityDescriptor.encounterId,
                    entityId: entityDescriptor.entityId,
                },
                select: ['encounterId', 'entityId', 'hpCurrent', 'hpMax'],
            });
            if (entity) {
                entities.push({
                    encounterId: entity.encounterId,
                    entityId: entity.entityId,
                    hp: entity.hpCurrent,
                    hpMax: entity.hpMax,
                });
            }
        }
        if (entities.length) {
            snapshot.entities = entities;
        }
    }

    return snapshot;
};

export const applyResultingStateDelta = async (
    sessionId: number,
    delta: RuleCheckResult['stateDelta'],
    context: StateDeltaContext
): Promise<DeltaApplicationSummary> => {
    if (!isMeaningfulDelta(delta)) {
        throw createError(422, 'STATE_DELTA_EMPTY');
    }

    if (STRICT_AUTHORITATIVE_DELTAS && !context.authoritativeSignature) {
        throw createError(403, 'STATE_DELTA_UNAUTHORIZED');
    }

    const persistedVersion = await loadStateVersion(sessionId);
    if (typeof context.expectedStateVersion === 'number') {
        if (context.expectedStateVersion < persistedVersion) {
            warn('delta fora de ordem detectada; ignorando aplicação', {
                sessionId,
                expectedStateVersion: context.expectedStateVersion,
                currentStateVersion: persistedVersion,
                actionId: context.actionId,
            });
            throw createError(409, 'STATE_VERSION_STALE');
        }
        if (context.expectedStateVersion > persistedVersion) {
            error('conflito de stateVersion detectado; bloqueando ação', {
                sessionId,
                expectedStateVersion: context.expectedStateVersion,
                currentStateVersion: persistedVersion,
                actionId: context.actionId,
            });
            throw createError(409, 'STATE_VERSION_CONFLICT');
        }
    }

    const contextWithVersion: StateDeltaContext = {
        ...context,
        stateVersion: context.stateVersion ?? persistedVersion,
    };

    const beforeSnapshot = await captureSnapshot(sessionId, delta);

    let updatedCharacter: Awaited<ReturnType<typeof applyCharacterStateDelta>> | null = null;
    const updatedEntities: {
        encounterId: number;
        entityId: string;
        hp: number;
        hpMax: number;
    }[] = [];

    let damage = 0;
    let healing = 0;
    let spellSlotsUsed = 0;
    let restType: 'short' | 'long' | undefined;

    const recordHpDelta = (value?: { delta?: number }) => {
        if (!value || typeof value.delta !== 'number') return;
        if (value.delta < 0) damage += Math.abs(value.delta);
        if (value.delta > 0) healing += value.delta;
    };

    if (delta?.character) {
        updatedCharacter = await applyCharacterStateDelta(sessionId, delta.character, contextWithVersion);
        if (delta.character.hp) {
            recordHpDelta(delta.character.hp);
        }
        if (Array.isArray(delta.character.resources)) {
            delta.character.resources.forEach(resource => {
                if (resource.type === 'spell-slot' && resource.delta < 0) {
                    spellSlotsUsed += Math.abs(resource.delta);
                }
            });
        }
        restType = delta.rest?.type ?? restType;
    }

    if (delta?.entities) {
        for (const entityDelta of delta.entities) {
            recordHpDelta(entityDelta.delta?.hp);
            const entity = await applyEntityDeltaWithLog(
                sessionId,
                entityDelta.encounterId,
                entityDelta.entityId,
                entityDelta.delta,
                contextWithVersion
            );
            if (entity) {
                updatedEntities.push({
                    encounterId: entityDelta.encounterId,
                    entityId: entityDelta.entityId,
                    hp: entity.hpCurrent,
                    hpMax: entity.hpMax,
                });
            }
        }
    }

    const afterSnapshot = await captureSnapshot(sessionId, delta);

    await recordActionLog({
        sessionId,
        actionId: contextWithVersion.actionId,
        actionType: contextWithVersion.actionType ?? 'state.delta',
        stateVersion: persistedVersion,
        delta: delta as Record<string, unknown>,
        metadata: {
            ...(contextWithVersion.metadata ?? {}),
            authoritativeSignature: contextWithVersion.authoritativeSignature ?? null,
            snapshots: {
                before: beforeSnapshot,
                after: afterSnapshot,
            },
        },
    });

    return {
        updatedCharacter,
        updatedEntities,
        appliedDelta: delta,
        metrics: {
            damage: damage || undefined,
            healing: healing || undefined,
            spellSlotsUsed: spellSlotsUsed || undefined,
            restType,
        },
    };
};
