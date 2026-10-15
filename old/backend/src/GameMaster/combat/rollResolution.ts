import type { PlayerRollRequest } from '../../types.js';
import type { CharacterStateDelta, RollTargetDescriptor } from '../../rules/types.js';
import {
    buildDamageFollowUp,
    describeRollTarget,
    resolveAttackRollCore,
    resolveEffectAmount,
    rollResolutionShouldNarrate,
} from '../../rules/rollResolutionCore.js';
import { applyCharacterStateDeltaPenai } from '../character/applyStateDelta.js';
import { syncHeroHpPenai, syncHeroHpToCanonical } from '../character/syncHeroHp.js';
import { ammoDisplayName } from '../../rules/ammunition.js';
import { applyCombatEntityDeltaPenai } from './engine.js';
import type { StoredPenaiRoll } from '../motor/rollStore.js';

export interface PenaiRollResolutionResult {
    updatedCharacter?: Awaited<ReturnType<typeof applyCharacterStateDeltaPenai>>;
    updatedEntity?: {
        encounterId: number;
        entityId: string;
        hp: number;
        hpMax: number;
    };
    shouldNarrate?: boolean;
    attackOutcome?: {
        hit: boolean;
        armorClass?: number;
        total: number;
        targetName?: string;
    };
    nextRollRequest?: {
        request: PlayerRollRequest;
        context?: { actionId?: string; intentType?: string; metadata?: Record<string, unknown> };
    };
    hints?: string[];
    permanentlyDead?: boolean;
}

type RollResolutionInput = {
    total: number;
    rawRoll: number;
    diceValues: number[];
};

const mergeCharacterUpdates = (
    base: Awaited<ReturnType<typeof applyCharacterStateDeltaPenai>> | null,
    incoming: Awaited<ReturnType<typeof applyCharacterStateDeltaPenai>> | null,
) => {
    if (!incoming) return base;
    if (!base) return incoming;
    return incoming;
};

export async function resolvePenaiStructuredRoll(
    sessionId: number,
    pending: StoredPenaiRoll,
    input: RollResolutionInput,
): Promise<PenaiRollResolutionResult | null> {
    const { total, rawRoll } = input;
    const metadata = pending.metadata;

    if (metadata?.deathSave) {
        return resolvePenaiDeathSave(sessionId, pending, input);
    }

    const targets = metadata?.targets;
    const effect =
        metadata?.effect ??
        (pending.rollType === 'damage'
            ? 'damage'
            : pending.rollType === 'healing'
              ? 'healing'
              : pending.rollType === 'attack'
                ? 'attack'
                : undefined);

    if (!effect) return null;

    const target = targets?.[0];
    const amount = resolveEffectAmount(total);
    let cumulativeCharacterDelta: Awaited<ReturnType<typeof applyCharacterStateDeltaPenai>> | null =
        null;
    const hints: string[] = [];

    if (metadata?.resourceCosts?.length) {
        const resourceDelta: NonNullable<CharacterStateDelta['resources']> = [];
        const inventoryDelta: NonNullable<CharacterStateDelta['inventory']> = [];

        for (const cost of metadata.resourceCosts) {
            if (cost.kind === 'spell-slot') {
                const key = cost.resourceKey ?? (cost.level ? `level-${cost.level}` : 'level-1');
                resourceDelta.push({
                    type: 'spell-slot',
                    key,
                    delta: -(cost.amount ?? 1),
                });
            } else if (cost.kind === 'class-resource') {
                if (!cost.resourceKey) continue;
                resourceDelta.push({
                    type: 'class-feature',
                    key: cost.resourceKey,
                    delta: -(cost.amount ?? 1),
                });
            } else if (cost.kind === 'item') {
                inventoryDelta.push({
                    itemId: cost.itemId,
                    itemIndex: cost.itemIndex,
                    quantityDelta: -(cost.amount ?? 1),
                });
            }
        }

        if (resourceDelta.length || inventoryDelta.length) {
            const applied = await applyCharacterStateDeltaPenai(sessionId, {
                resources: resourceDelta.length ? resourceDelta : undefined,
                inventory: inventoryDelta.length ? inventoryDelta : undefined,
            });
            cumulativeCharacterDelta = mergeCharacterUpdates(cumulativeCharacterDelta, applied);
            await syncHeroHpPenai(sessionId);
            for (const cost of metadata.resourceCosts) {
                if (cost.kind === 'item' && cost.itemIndex) {
                    hints.push(`Gasta 1× ${ammoDisplayName(cost.itemIndex)}.`);
                }
            }
        }
        if (pending.metadata) pending.metadata.resourceCosts = undefined;
    }

    if (effect === 'attack') {
        const core = resolveAttackRollCore(
            { context: { actionId: pending.actionId, intentType: 'attack' }, requestId: pending.requestId },
            metadata,
            total,
        );
        hints.push(...core.hints);
        const nextRollRequest = core.nextRollRequest
            ? {
                  request: core.nextRollRequest.request as PlayerRollRequest,
                  context: core.nextRollRequest.context,
              }
            : undefined;
        return {
            attackOutcome: {
                hit: core.hit,
                armorClass: core.armorClass,
                total: core.total,
                targetName: core.targetName,
            },
            shouldNarrate: core.shouldNarrate,
            updatedCharacter: cumulativeCharacterDelta ?? undefined,
            nextRollRequest,
            hints,
        };
    }

    if (!target) return null;
    if (!Number.isFinite(amount)) return null;

    if (effect === 'damage') {
        return applyPenaiDamage(sessionId, target, amount, metadata, cumulativeCharacterDelta, hints);
    }

    if (effect === 'healing') {
        return applyPenaiHealing(sessionId, target, amount, metadata, cumulativeCharacterDelta, hints);
    }

    return cumulativeCharacterDelta ? { updatedCharacter: cumulativeCharacterDelta, hints } : hints.length ? { hints } : null;
}

async function applyPenaiDamage(
    sessionId: number,
    target: RollTargetDescriptor,
    amount: number,
    metadata: PlayerRollRequest['metadata'],
    cumulativeCharacterDelta: Awaited<ReturnType<typeof applyCharacterStateDeltaPenai>> | null,
    hints: string[],
): Promise<PenaiRollResolutionResult> {
    const dmg = Math.max(amount, 0);
    if (target.kind === 'character') {
        const applied = await applyCharacterStateDeltaPenai(
            sessionId,
            { hp: { delta: -dmg } },
            { isCriticalDamage: Boolean(metadata?.criticalHit), userId: undefined },
        );
        cumulativeCharacterDelta = mergeCharacterUpdates(cumulativeCharacterDelta, applied);
        await syncHeroHpPenai(sessionId);
        hints.push(
            `${describeRollTarget(target)} perde ${dmg} HP${metadata?.source?.name ? ` (${metadata.source.name})` : ''}.`,
        );
        return {
            updatedCharacter: cumulativeCharacterDelta ?? undefined,
            shouldNarrate: rollResolutionShouldNarrate('damage', {}),
            hints,
        };
    }

    const entityId = target.id;
    if (target.kind === 'entity' && target.encounterId && entityId) {
        await applyCombatEntityDeltaPenai(sessionId, {
            encounterId: target.encounterId,
            entityId,
            delta: { hp: { delta: -dmg } },
        });
        hints.push(
            `${target.name ?? 'Inimigo'} perde ${dmg} HP${metadata?.source?.name ? ` (${metadata.source.name})` : ''}.`,
        );
        const { getPenaiCombatState } = await import('./engine.js');
        const after = await getPenaiCombatState(sessionId);
        const entity = after.combatants.find(c => c.entityKey === entityId);
        return {
            updatedCharacter: cumulativeCharacterDelta ?? undefined,
            updatedEntity: entity
                ? {
                      encounterId: target.encounterId,
                      entityId,
                      hp: entity.hp,
                      hpMax: entity.hpMax,
                  }
                : undefined,
            shouldNarrate: rollResolutionShouldNarrate('damage', {}),
            hints,
        };
    }

    return { hints };
}

async function applyPenaiHealing(
    sessionId: number,
    target: RollTargetDescriptor,
    amount: number,
    metadata: PlayerRollRequest['metadata'],
    cumulativeCharacterDelta: Awaited<ReturnType<typeof applyCharacterStateDeltaPenai>> | null,
    hints: string[],
): Promise<PenaiRollResolutionResult> {
    const heal = Math.max(amount, 0);
    if (target.kind === 'character') {
        const applied = await applyCharacterStateDeltaPenai(sessionId, { hp: { delta: heal } });
        cumulativeCharacterDelta = mergeCharacterUpdates(cumulativeCharacterDelta, applied);
        await syncHeroHpPenai(sessionId);
        hints.push(
            `${describeRollTarget(target)} recupera ${heal} HP${metadata?.source?.name ? ` (${metadata.source.name})` : ''}.`,
        );
        return {
            updatedCharacter: cumulativeCharacterDelta ?? undefined,
            shouldNarrate: rollResolutionShouldNarrate('healing', {}),
            hints,
        };
    }

    const entityId = target.id;
    if (target.kind === 'entity' && target.encounterId && entityId) {
        await applyCombatEntityDeltaPenai(sessionId, {
            encounterId: target.encounterId,
            entityId,
            delta: { hp: { delta: heal } },
        });
        hints.push(
            `${target.name ?? 'Inimigo'} recupera ${heal} HP${metadata?.source?.name ? ` (${metadata.source.name})` : ''}.`,
        );
        const { getPenaiCombatState } = await import('./engine.js');
        const after = await getPenaiCombatState(sessionId);
        const entity = after.combatants.find(c => c.entityKey === entityId);
        return {
            updatedCharacter: cumulativeCharacterDelta ?? undefined,
            updatedEntity: entity
                ? {
                      encounterId: target.encounterId,
                      entityId,
                      hp: entity.hp,
                      hpMax: entity.hpMax,
                  }
                : undefined,
            shouldNarrate: rollResolutionShouldNarrate('healing', {}),
            hints,
        };
    }

    return { hints };
}

async function resolvePenaiDeathSave(
    sessionId: number,
    pending: StoredPenaiRoll,
    input: RollResolutionInput,
): Promise<PenaiRollResolutionResult> {
    const { resolveDeathSaveForSession } = await import('../character/heroVitalsService.js');
    const { getSessionHeroEntityId } = await import('../character/heroStats.js');
    const heroEntityId = await getSessionHeroEntityId(sessionId);

    const outcome = await resolveDeathSaveForSession(
        sessionId,
        input.total,
        input.rawRoll,
        pending.userId,
    );

    if (!outcome || !heroEntityId) {
        return { shouldNarrate: false, hints: ['Teste de morte inválido.'] };
    }

    const updatedCharacter = {
        heroEntityId,
        stats: outcome.stats,
        applied: true,
    };

    if (outcome.kind === 'dead') {
        return {
            shouldNarrate: false,
            permanentlyDead: true,
            hints: outcome.hints,
            updatedCharacter,
        };
    }

    return {
        shouldNarrate: true,
        hints: outcome.hints,
        updatedCharacter,
    };
}

export { buildDamageFollowUp, rollResolutionShouldNarrate };
