import type { PlayerRollRequest } from '../../types.js';
import type { CharacterStateDelta, RollTargetDescriptor } from '../../rules/types.js';
import {
    buildDamageFollowUp,
    describeRollTarget,
    resolveAttackRollCore,
    resolveEffectAmount,
    rollResolutionShouldNarrate,
} from '../../rules/rollResolutionCore.js';
import { applyCharacterStateDeltaPenai } from '../character/applyStateDeltaPenai.js';
import { syncHeroHpPenai, syncHeroHpToCanonical } from '../character/syncHeroHpPenai.js';
import { applyCombatEntityDeltaPenai } from './combatPenai.js';
import type { StoredPenaiRoll } from '../motor/penaiRollStore.js';

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
    { total }: RollResolutionInput,
): Promise<PenaiRollResolutionResult | null> {
    const metadata = pending.metadata;
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
        const applied = await applyCharacterStateDeltaPenai(sessionId, {
            hp: { delta: -dmg },
        });
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
        const { getPenaiCombatState } = await import('./combatPenai.js');
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
        const { getPenaiCombatState } = await import('./combatPenai.js');
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

export { buildDamageFollowUp, rollResolutionShouldNarrate };
