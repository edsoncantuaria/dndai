import { applyCharacterStateDelta, type StateDeltaContext } from './characterStateService.js';
import { applyEntityDeltaWithLog } from './combatEntityService.js';
import type { RuleCheckResult } from '../rules/types.js';

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

export const applyResultingStateDelta = async (
    sessionId: number,
    delta: RuleCheckResult['stateDelta'],
    context: StateDeltaContext
): Promise<DeltaApplicationSummary> => {
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
        updatedCharacter = await applyCharacterStateDelta(sessionId, delta.character, context);
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
                context
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
