import { PlayerRollRequest } from '../types.js';
import type { RollRequestContext } from './rollRequestService.js';
import { applyCharacterStateDelta, type StateDeltaContext } from './characterStateService.js';
import { applyEntityDeltaWithLog } from './combatEntityService.js';
import type { CharacterStateDelta, RollTargetDescriptor } from '../rules/types.js';

const RULE_RESOLUTION_DEBUG = process.env.RULE_RESOLUTION_DEBUG !== 'false';
const logRuleResolution = (stage: string, details: Record<string, unknown>) => {
    if (!RULE_RESOLUTION_DEBUG) return;
    console.log(`[RuleResolution] ${stage}`, details);
};

const SIMPLE_DAMAGE_REGEX = /^\s*([+-]?\d+d\d+)([+-]\d+)?\s*$/i;
const describeTarget = (target?: RollTargetDescriptor) => {
    if (!target) return 'o alvo';
    if (target.kind === 'character') return 'você';
    return target.name ?? 'o alvo';
};

interface PendingRollPayload extends PlayerRollRequest {
    context?: RollRequestContext;
}

interface RollResolutionInput {
    total: number;
    rawRoll: number;
    diceValues: number[];
}

export interface RollResolutionResult {
    updatedCharacter?: Awaited<ReturnType<typeof applyCharacterStateDelta>>;
    updatedEntity?: {
        encounterId: number;
        entityId: string;
        hp: number;
        hpMax: number;
    };
    metadata?: Record<string, any>;
    shouldNarrate?: boolean;
    attackOutcome?: {
        hit: boolean;
        armorClass?: number;
        total: number;
        targetName?: string;
    };
    nextRollRequest?: {
        request: PlayerRollRequest;
        context?: RollRequestContext;
    };
    hints?: string[];
}

const sanitizeFormulaNotation = (formula?: string, modifier = 0) => {
    if (!formula) return { dice: '1d6', modifier: Math.max(0, modifier) };
    const compact = formula.replace(/\s+/g, '');
    const match = SIMPLE_DAMAGE_REGEX.exec(compact);
    if (!match) {
        return { dice: '1d6', modifier: Math.max(0, modifier) };
    }
    const dice = match[1];
    const mod = match[2] ? Number(match[2]) : 0;
    return { dice, modifier: mod + modifier };
};

const cloneWithoutResourceCosts = (metadata?: PlayerRollRequest['metadata']) => {
    if (!metadata) return undefined;
    const { resourceCosts, ...rest } = metadata;
    return rest;
};

const buildDamageFollowUp = (
    pending: PendingRollPayload,
    metadata: PlayerRollRequest['metadata']
): RollResolutionResult['nextRollRequest'] | undefined => {
    if (!metadata?.damageFormula) return undefined;
    const { dice, modifier } = sanitizeFormulaNotation(metadata.damageFormula);
    const reason = `Motor de Regras - Dano (${metadata.source?.name || 'Ataque'})`;
    const sanitizedMetadata = {
        ...cloneWithoutResourceCosts(metadata),
        effect: 'damage' as const,
    };
    return {
        request: {
            reason,
            dice,
            modifier,
            rollType: 'damage',
            metadata: sanitizedMetadata,
        },
        context: {
            actionId: pending.context?.actionId ?? pending.requestId,
            intentType: 'damage',
            metadata: sanitizedMetadata as Record<string, any>,
        },
    };
};

/** P0.4.3/4 — contrato de narração por efeito (testável sem DB). */
export function rollResolutionShouldNarrate(
    effect: 'attack' | 'damage' | 'healing',
    opts: { hasDamageFollowUp?: boolean },
): boolean {
    if (effect === 'attack') {
        return opts.hasDamageFollowUp ? false : true;
    }
    return true;
}

const mergeCharacterUpdates = (
    base: Awaited<ReturnType<typeof applyCharacterStateDelta>> | null,
    incoming: Awaited<ReturnType<typeof applyCharacterStateDelta>> | null
) => {
    if (!incoming) return base;
    if (!base) return incoming;
    return {
        characterId: incoming.characterId,
        attributes: incoming.attributes ?? base.attributes,
        resources:
            incoming.resources && base.resources
                ? [...incoming.resources, ...base.resources]
                : incoming.resources ?? base.resources,
    };
};

export async function resolveStructuredRoll(
    sessionId: number,
    pending: PendingRollPayload,
    { total }: RollResolutionInput
): Promise<RollResolutionResult | null> {
    logRuleResolution('start', {
        sessionId,
        requestId: pending.requestId,
        rollType: pending.rollType,
        effectHint: pending.metadata?.effect ?? null,
        total,
    });
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

    if (!effect) {
        logRuleResolution('skip:noEffect', { sessionId, requestId: pending.requestId });
        return null;
    }

    const target = targets?.[0];
    const amount = total;
    const ctx: StateDeltaContext = {
        actionId: pending.context?.actionId,
        actionType: pending.context?.intentType ?? 'roll-resolution',
        metadata: {
            effect,
            source: metadata?.source,
        },
    };

    let cumulativeCharacterDelta: Awaited<ReturnType<typeof applyCharacterStateDelta>> | null = null;
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
                hints.push(
                    `Slot de magia nível ${cost.level ?? '?'} consumido (${cost.amount ?? 1}).`
                );
            } else if (cost.kind === 'class-resource') {
                if (!cost.resourceKey) continue;
                resourceDelta.push({
                    type: 'class-feature',
                    key: cost.resourceKey,
                    delta: -(cost.amount ?? 1),
                });
                hints.push(
                    `Recurso ${cost.resourceKey} consumido (${cost.amount ?? 1}).`
                );
            } else if (cost.kind === 'item') {
                inventoryDelta.push({
                    itemId: cost.itemId,
                    itemIndex: cost.itemIndex,
                    quantityDelta: -(cost.amount ?? 1),
                });
                hints.push(
                    `Consumiu ${cost.amount ?? 1}x ${cost.itemIndex ?? 'item'}.`
                );
            }
        }

        if (resourceDelta.length || inventoryDelta.length) {
            logRuleResolution('apply:resourceCosts', {
                sessionId,
                requestId: pending.requestId,
                resourceOps: resourceDelta.length,
                inventoryOps: inventoryDelta.length,
            });
            const applied = await applyCharacterStateDelta(
                sessionId,
                {
                    resources: resourceDelta.length ? resourceDelta : undefined,
                    inventory: inventoryDelta.length ? inventoryDelta : undefined,
                },
                ctx
            );
            cumulativeCharacterDelta = mergeCharacterUpdates(cumulativeCharacterDelta, applied);
        }
        metadata.resourceCosts = undefined;
        if (pending.metadata) {
            pending.metadata.resourceCosts = undefined;
        }
    }

    if (effect === 'attack') {
        const armorClass = target?.armorClass;
        const hit = typeof armorClass === 'number' ? total >= armorClass : true;
        const nextRollRequest = hit ? buildDamageFollowUp(pending, metadata) : undefined;
        logRuleResolution('attackResolved', {
            sessionId,
            requestId: pending.requestId,
            target: target?.name ?? target?.id ?? 'unknown',
            hit,
            armorClass,
            followUp: Boolean(nextRollRequest),
        });
        hints.push(
            hit
                ? `Ataque acertou ${describeTarget(target)}${typeof armorClass === 'number' ? ` (CA ${armorClass})` : ''}.`
                : `Ataque falhou contra ${describeTarget(target)}${typeof armorClass === 'number' ? ` (CA ${armorClass})` : ''}.`
        );
        return {
            attackOutcome: {
                hit,
                armorClass,
                total,
                targetName: target?.name,
            },
            shouldNarrate: rollResolutionShouldNarrate('attack', {
                hasDamageFollowUp: Boolean(nextRollRequest),
            }),
            updatedCharacter: cumulativeCharacterDelta ?? undefined,
            nextRollRequest,
            hints,
        };
    }

    if (!target) {
        logRuleResolution('skip:noTarget', { sessionId, requestId: pending.requestId, effect });
        return null;
    }
    if (!Number.isFinite(amount)) {
        logRuleResolution('skip:invalidAmount', { sessionId, requestId: pending.requestId, amount });
        return null;
    }

    if (effect === 'damage') {
        if (target.kind === 'character') {
            const delta = { hp: { delta: -Math.max(amount, 0) } };
            const applied = await applyCharacterStateDelta(sessionId, delta, ctx);
            cumulativeCharacterDelta = mergeCharacterUpdates(cumulativeCharacterDelta, applied);
            logRuleResolution('damage:character', {
                sessionId,
                requestId: pending.requestId,
                amount,
            });
            hints.push(
                `${describeTarget(target)} perde ${Math.max(amount, 0)} HP${metadata?.source?.name ? ` (${metadata.source.name})` : ''}.`
            );
            try {
                const attrs = applied?.attributes;
                if (attrs && typeof attrs.hp === 'number') {
                    const { syncPlayerHpToSessionCombat } = await import('./combatHpBridge.js');
                    await syncPlayerHpToSessionCombat({
                        sessaoId: sessionId,
                        hpCurrent: attrs.hp,
                        hpMax: attrs.maxHp,
                        characterId: applied.characterId,
                    });
                    hints.push('[Motor] PV do jogador sincronizado com o combate.');
                }
            } catch (syncErr) {
                console.warn('[ruleResolution] syncPlayerHp:', syncErr);
            }
            return { updatedCharacter: cumulativeCharacterDelta ?? undefined, shouldNarrate: true, hints };
        }
        const entityId = target.id;
        if (target.kind === 'entity' && target.encounterId && entityId) {
            const entity = await applyEntityDeltaWithLog(
                sessionId,
                target.encounterId,
                entityId,
                { hp: { delta: -Math.max(amount, 0) } },
                ctx
            );
            if (entity) {
                logRuleResolution('damage:entity', {
                    sessionId,
                    requestId: pending.requestId,
                    encounterId: target.encounterId,
                    entityId,
                    amount,
                });
                hints.push(
                    `${target.name ?? 'Inimigo'} perde ${Math.max(amount, 0)} HP${metadata?.source?.name ? ` (${metadata.source.name})` : ''}.`
                );
                try {
                    const { syncEntityHpToSessionCombat } = await import('./combatHpBridge.js');
                    await syncEntityHpToSessionCombat({
                        sessaoId: sessionId,
                        entityId,
                        hpCurrent: entity.hpCurrent,
                        entityName: target.name,
                    });
                    hints.push('[Motor] PV do combatente sincronizado com o encontro.');
                } catch (syncErr) {
                    console.warn('[ruleResolution] combatHpBridge:', syncErr);
                }
                return {
                    updatedCharacter: cumulativeCharacterDelta ?? undefined,
                    updatedEntity: {
                        encounterId: target.encounterId,
                        entityId,
                        hp: entity.hpCurrent,
                        hpMax: entity.hpMax,
                    },
                    shouldNarrate: true,
                    hints,
                };
            }
        }
    }

    if (effect === 'healing') {
        if (target.kind === 'character') {
            const delta = { hp: { delta: Math.max(amount, 0) } };
            const applied = await applyCharacterStateDelta(sessionId, delta, ctx);
            cumulativeCharacterDelta = mergeCharacterUpdates(cumulativeCharacterDelta, applied);
            logRuleResolution('healing:character', {
                sessionId,
                requestId: pending.requestId,
                amount,
            });
            hints.push(
                `${describeTarget(target)} recupera ${Math.max(amount, 0)} HP${metadata?.source?.name ? ` (${metadata.source.name})` : ''}.`
            );
            try {
                const attrs = applied?.attributes;
                if (attrs && typeof attrs.hp === 'number') {
                    const { syncPlayerHpToSessionCombat } = await import('./combatHpBridge.js');
                    await syncPlayerHpToSessionCombat({
                        sessaoId: sessionId,
                        hpCurrent: attrs.hp,
                        hpMax: attrs.maxHp,
                        characterId: applied.characterId,
                    });
                }
            } catch (syncErr) {
                console.warn('[ruleResolution] syncPlayerHp heal:', syncErr);
            }
            return { updatedCharacter: cumulativeCharacterDelta ?? undefined, shouldNarrate: true, hints };
        }
        const entityId = target.id;
        if (target.kind === 'entity' && target.encounterId && entityId) {
            const entity = await applyEntityDeltaWithLog(
                sessionId,
                target.encounterId,
                entityId,
                { hp: { delta: Math.max(amount, 0) } },
                ctx
            );
            if (entity) {
                logRuleResolution('healing:entity', {
                    sessionId,
                    requestId: pending.requestId,
                    encounterId: target.encounterId,
                    entityId,
                    amount,
                });
                hints.push(
                    `${target.name ?? 'Inimigo'} recupera ${Math.max(amount, 0)} HP${metadata?.source?.name ? ` (${metadata.source.name})` : ''}.`
                );
                try {
                    const { syncEntityHpToSessionCombat } = await import('./combatHpBridge.js');
                    await syncEntityHpToSessionCombat({
                        sessaoId: sessionId,
                        entityId,
                        hpCurrent: entity.hpCurrent,
                        entityName: target.name,
                    });
                } catch (syncErr) {
                    console.warn('[ruleResolution] combatHpBridge heal:', syncErr);
                }
                return {
                    updatedCharacter: cumulativeCharacterDelta ?? undefined,
                    updatedEntity: {
                        encounterId: target.encounterId,
                        entityId,
                        hp: entity.hpCurrent,
                        hpMax: entity.hpMax,
                    },
                    shouldNarrate: true,
                    hints,
                };
            }
        }
    }

    return cumulativeCharacterDelta
        ? { updatedCharacter: cumulativeCharacterDelta, hints }
        : hints.length
            ? { hints }
            : null;
}
