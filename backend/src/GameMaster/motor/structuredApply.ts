import { randomUUID } from 'crypto';
import { validateRestIntent } from '../../rules/rest.js';
import {
    validateEquipItemIntent,
    validateDropItemIntent,
    validateClaimLootIntent,
} from '../../rules/inventoryMotor.js';
import type { RestIntentPayload } from '../../rules/types.js';
import { loadPenaiCharacterSnapshot } from '../character/loadSnapshot.js';
import { applyResultingStateDeltaPenai } from '../character/applyStateDelta.js';
import { formatMechanicalPack } from '../character/formatMechanicalPack.js';
import { getPenaiCombatState, startPenaiCombat, advancePenaiCombatTurnFromIntent } from '../combat/engine.js';
import { claimPendingLootPenai } from '../loot/lootService.js';
import {
    openShopPenai,
    buyFromShopPenai,
    sellToShopPenai,
    closeShopPenai,
    defaultShopCatalogForRegion,
} from '../shop/shopService.js';
import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { listHeroInventory, setHeroItemEquipped } from '../character/heroInventory.js';
import { getSessionHeroEntityId } from '../character/heroStats.js';
import { appendWorldEvent } from '../events/store.js';
import type { PenaiActionIntent, PenaiMotorResult } from './types.js';

export function resolveStructuredIntentType(
    payload: Record<string, unknown>,
): string | null {
    const structured = payload.structuredIntent as { type?: string } | undefined;
    if (structured?.type) return structured.type;
    const intent = payload.intent as string | undefined;
    if (intent && intent !== 'free') return intent;
    return null;
}

export function resolveStructuredPayload(payload: Record<string, unknown>): Record<string, unknown> {
    const structured = payload.structuredIntent as { payload?: Record<string, unknown> } | undefined;
    if (structured?.payload) return structured.payload;
    const { intent: _i, structuredIntent: _s, playerAction: _p, ...rest } = payload;
    return rest;
}

async function mechanicalResult(
    sessionId: number,
    intent: PenaiActionIntent,
    ruleCheck: PenaiMotorResult['ruleCheck'],
    intentType: string,
    extra?: Record<string, unknown>,
): Promise<PenaiMotorResult> {
    const pack = await formatMechanicalPack(sessionId);
    return {
        intent,
        ruleCheck,
        mechanical: { intentType, ...pack, ...extra },
        blocked: ruleCheck.status === 'rejected',
        awaitingRoll: ruleCheck.status === 'needs_roll',
    };
}

export async function applyStructuredPenaiIntent(input: {
    sessionId: number;
    userId: number;
    playerAction: string;
    actionId: string;
    actionSequence: number;
    intentType: string;
    payload: Record<string, unknown>;
}): Promise<PenaiMotorResult | null> {
    const intent: PenaiActionIntent = {
        type: 'free',
        payload: { structuredIntent: input.intentType, ...input.payload },
    };
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: input.sessionId },
    });

    switch (input.intentType) {
        case 'rest': {
            const snapshot = await loadPenaiCharacterSnapshot(input.sessionId);
            if (!snapshot) {
                return mechanicalResult(input.sessionId, intent, {
                    status: 'rejected',
                    reason: 'Herói não encontrado.',
                }, 'rest');
            }
            const restType = (input.payload.restType as 'short' | 'long') ?? 'short';
            const combat = await getPenaiCombatState(input.sessionId);
            const check = validateRestIntent(
                snapshot,
                { restType } as RestIntentPayload,
                combat.isActive ? { isActive: true } : null,
            );
            if (check.status === 'accepted' && check.stateDelta) {
                await applyResultingStateDeltaPenai(input.sessionId, check.stateDelta);
                const { advanceSessionGameClock } = await import('../world/gameClock.js');
                await advanceSessionGameClock(input.sessionId, restType === 'long' ? 8 : 1);
                await appendWorldEvent({
                    type: 'REST_COMPLETED',
                    sessionId: input.sessionId,
                    payload: { restType },
                });
                if (restType === 'long') {
                    const { maybeScheduleWorldPulse } = await import('../world/simulation/pulseSchedule.js');
                    void maybeScheduleWorldPulse(input.sessionId, 'long-rest').catch(() => undefined);
                    const { startCampaignGcWorkflow } = await import('../../temporal/client.js');
                    void startCampaignGcWorkflow(input.sessionId).catch(() => undefined);
                    const { saveSessionAggregateSnapshot } = await import('../sessions/sessionAggregate.js');
                    const seq = input.actionSequence ?? 0;
                    void saveSessionAggregateSnapshot(input.sessionId, seq).catch(() => undefined);
                }
            }
            return mechanicalResult(input.sessionId, intent, check, 'rest');
        }

        case 'claim-loot': {
            const check = validateClaimLootIntent();
            if (check.status !== 'accepted') {
                return mechanicalResult(input.sessionId, intent, check, 'claim-loot');
            }
            try {
                await claimPendingLootPenai(input.sessionId);
                await appendWorldEvent({
                    type: 'LOOT_CLAIMED',
                    sessionId: input.sessionId,
                    payload: {},
                });
                return mechanicalResult(
                    input.sessionId,
                    intent,
                    { status: 'accepted', reason: 'Loot coletado.' },
                    'claim-loot',
                );
            } catch (e) {
                return mechanicalResult(input.sessionId, intent, {
                    status: 'rejected',
                    reason: e instanceof Error ? e.message : 'Loot indisponível.',
                }, 'claim-loot');
            }
        }

        case 'equip-item': {
            const check = validateEquipItemIntent(
                input.payload as {
                    inventoryItemId?: string;
                    itemKey?: string;
                    itemId?: number;
                    equipped: boolean;
                },
            );
            if (check.status !== 'accepted') {
                return mechanicalResult(input.sessionId, intent, check, 'equip-item');
            }
            const heroEntityId = await getSessionHeroEntityId(input.sessionId);
            const lookupKey =
                (input.payload as { inventoryItemId?: string; itemKey?: string; itemId?: number })
                    .inventoryItemId?.trim() ||
                (input.payload as { itemKey?: string }).itemKey?.trim() ||
                String((input.payload as { itemId?: number }).itemId ?? '');
            const items = heroEntityId
                ? await listHeroInventory(input.sessionId, heroEntityId)
                : [];
            const row = items.find(
                i => i.id === lookupKey || String(i.itemKey) === lookupKey,
            );
            if (!row || !heroEntityId) {
                return mechanicalResult(input.sessionId, intent, {
                    status: 'rejected',
                    reason: 'Item não encontrado.',
                }, 'equip-item');
            }
            await setHeroItemEquipped({
                sessionId: input.sessionId,
                heroEntityId,
                itemKey: row.itemKey,
                equipped: Boolean(input.payload.equipped),
            });
            await appendWorldEvent({
                type: 'ITEM_EQUIPPED',
                sessionId: input.sessionId,
                payload: { itemKey: row.itemKey, equipped: input.payload.equipped },
            });
            return mechanicalResult(
                input.sessionId,
                intent,
                { status: 'accepted', reason: check.reason },
                'equip-item',
            );
        }

        case 'drop-item': {
            const check = validateDropItemIntent(input.payload as { itemId: number; quantity?: number });
            if (check.status === 'accepted' && check.stateDelta) {
                const heroEntityId = await getSessionHeroEntityId(input.sessionId);
                const items = heroEntityId
                    ? await listHeroInventory(input.sessionId, heroEntityId)
                    : [];
                const row = items.find(
                    i => i.id === String(input.payload.itemId) || i.itemKey === String(input.payload.itemId),
                );
                if (row && check.stateDelta.character?.inventory?.[0]) {
                    check.stateDelta.character.inventory[0].itemId = row.id as unknown as number;
                }
                await applyResultingStateDeltaPenai(input.sessionId, check.stateDelta);
            }
            return mechanicalResult(input.sessionId, intent, check, 'drop-item');
        }

        case 'open-shop': {
            let shopPayload = { ...input.payload };
            if (!Array.isArray(shopPayload.inventory) || !shopPayload.inventory.length) {
                shopPayload.inventory = await defaultShopCatalogForRegion(
                    session?.currentRegionSlug ?? null,
                );
            }
            const check = await openShopPenai(input.sessionId, shopPayload);
            return mechanicalResult(input.sessionId, intent, check, 'open-shop');
        }

        case 'buy-item': {
            const check = await buyFromShopPenai(input.sessionId, input.payload);
            return mechanicalResult(input.sessionId, intent, check, 'buy-item');
        }

        case 'sell-item': {
            const check = await sellToShopPenai(input.sessionId, input.payload);
            return mechanicalResult(input.sessionId, intent, check, 'sell-item');
        }

        case 'close-shop': {
            const check = await closeShopPenai(input.sessionId);
            return mechanicalResult(input.sessionId, intent, check, 'close-shop');
        }

        case 'start-encounter': {
            const combatants = Array.isArray(
                (input.payload as { combatants?: unknown[] }).combatants,
            )
                ? ((input.payload as { combatants: Array<Record<string, unknown>> }).combatants)
                : [];
            const hostiles = combatants
                .filter(c => !c.isPlayer)
                .map(c => ({
                    entityKey: String(c.id ?? randomUUID()),
                    displayName: String(c.name ?? 'Inimigo'),
                    hpMax: Number(c.maxHp ?? c.hp ?? 10),
                    armorClass: Number(c.ac ?? 12),
                }));
            if (!hostiles.length) {
                return mechanicalResult(input.sessionId, intent, {
                    status: 'rejected',
                    reason: 'Nenhum combatente hostil.',
                }, 'start-encounter');
            }
            await startPenaiCombat(input.sessionId, hostiles);
            await appendWorldEvent({
                type: 'COMBAT_STARTED',
                sessionId: input.sessionId,
                payload: { hostiles: hostiles.length },
            });
            return mechanicalResult(
                input.sessionId,
                intent,
                { status: 'accepted', reason: 'Combate iniciado.' },
                'start-encounter',
            );
        }

        case 'next-turn': {
            const combat = await getPenaiCombatState(input.sessionId);
            if (!combat.isActive) {
                return mechanicalResult(input.sessionId, intent, {
                    status: 'rejected',
                    reason: 'Não há combate ativo.',
                }, 'next-turn');
            }
            const after = await advancePenaiCombatTurnFromIntent(input.sessionId);
            return mechanicalResult(
                input.sessionId,
                intent,
                { status: 'accepted', reason: 'Turno avançado.' },
                'next-turn',
                { combatState: after },
            );
        }

        case 'advance-npc-turn': {
            const combat = await getPenaiCombatState(input.sessionId);
            if (!combat.isActive) {
                return mechanicalResult(input.sessionId, intent, {
                    status: 'rejected',
                    reason: 'Não há combate ativo.',
                }, 'advance-npc-turn');
            }
            const current = combat.combatants.find(c => c.entityKey === combat.currentEntityKey);
            if (current?.side === 'hero' || current?.side === 'ally') {
                return mechanicalResult(input.sessionId, intent, {
                    status: 'rejected',
                    reason: 'Turno atual é do grupo do jogador.',
                }, 'advance-npc-turn');
            }
            const { executeNpcTurnAttack } = await import('../sessions/sessionExtras.js');
            const attack = await executeNpcTurnAttack(input.sessionId);
            const after = await advancePenaiCombatTurnFromIntent(input.sessionId);
            return mechanicalResult(
                input.sessionId,
                intent,
                {
                    status: 'accepted',
                    reason: attack
                        ? `${attack.attackerName} ${attack.hit ? `acertou ${attack.targetName} (${attack.damage} dano)` : `errou ${attack.targetName}`}`
                        : 'Turno NPC concluído.',
                },
                'advance-npc-turn',
                { combatState: after, npcAttack: attack },
            );
        }

        case 'apply-level-up': {
            const session = await PenaiDataSource.getRepository(GameSession).findOne({
                where: { id: input.sessionId },
            });
            if (!session?.heroWorldEntityId) {
                return mechanicalResult(input.sessionId, intent, {
                    status: 'rejected',
                    reason: 'Herói não encontrado.',
                }, 'apply-level-up');
            }
            const { applyLevelUpPenai } = await import('../character/applyLevelUp.js');
            const levelPayload = resolveStructuredPayload(input.payload) as import('../character/applyLevelUp.js').ApplyLevelUpPayload;
            const result = await applyLevelUpPenai({
                sessionId: input.sessionId,
                userId: input.userId,
                payload: levelPayload,
            });
            if (!result.ok) {
                return mechanicalResult(input.sessionId, intent, {
                    status: 'rejected',
                    reason: result.reason ?? 'Falha ao aplicar level-up.',
                }, 'apply-level-up');
            }
            return mechanicalResult(
                input.sessionId,
                intent,
                { status: 'accepted', reason: `Nível ${result.newLevel} confirmado.` },
                'apply-level-up',
                { levelUpState: null, newLevel: result.newLevel },
            );
        }

        case 'summon-spell': {
            const payload = resolveStructuredPayload(input.payload);
            const spellIndex = String(payload.spellIndex ?? payload.spell ?? '').trim().toLowerCase();
            const { validateSummonSpellIntent, executeSummonSpell } = await import(
                '../combat/summonService.js'
            );
            const check = await validateSummonSpellIntent({
                sessionId: input.sessionId,
                spellIndex,
                slotLevel: typeof payload.slotLevel === 'number' ? payload.slotLevel : undefined,
            });
            if (check.status === 'rejected') {
                return mechanicalResult(input.sessionId, intent, check, 'summon-spell');
            }
            const result = await executeSummonSpell({
                sessionId: input.sessionId,
                spellIndex,
                slotLevel: typeof payload.slotLevel === 'number' ? payload.slotLevel : undefined,
            });
            const combatState = await getPenaiCombatState(input.sessionId);
            await appendWorldEvent({
                type: 'SUMMON_CREATED',
                sessionId: input.sessionId,
                payload: {
                    spellIndex: result.spellIndex,
                    count: result.companions.length,
                    names: result.companions.map(c => c.name),
                },
            });
            return mechanicalResult(
                input.sessionId,
                intent,
                {
                    status: 'accepted',
                    reason: `${result.companions.map(c => c.name).join(', ')} entra${result.companions.length > 1 ? 'm' : ''} em cena.`,
                },
                'summon-spell',
                { combatState, companions: result.companions },
            );
        }

        case 'grant-xp': {
            const session = await PenaiDataSource.getRepository(GameSession).findOne({
                where: { id: input.sessionId },
            });
            const heroId = session?.heroWorldEntityId;
            if (!heroId) {
                return mechanicalResult(input.sessionId, intent, {
                    status: 'rejected',
                    reason: 'Herói não encontrado.',
                }, 'grant-xp');
            }
            const amount = Number(intent.payload?.amount ?? 50);
            const { grantHeroXp, buildPenaiLevelUpState } = await import('../character/xp.js');
            const result = await grantHeroXp(input.sessionId, heroId, amount);
            const hero = await PenaiDataSource.getRepository(
                (await import('../database/entities/WorldEntity.js')).WorldEntity,
            ).findOne({ where: { id: heroId } });
            const srdBuild = (hero?.stats?.srdBuild ?? {}) as Record<string, unknown>;
            const extra: Record<string, unknown> = { xp: result };
            if (result.leveledUp) {
                extra.levelUpState = await buildPenaiLevelUpState(result.level, srdBuild);
            }
            return mechanicalResult(
                input.sessionId,
                intent,
                {
                    status: 'accepted',
                    reason: result.leveledUp
                        ? `+${amount} XP — subiu para nível ${result.level}!`
                        : `+${amount} XP (total ${result.xp}).`,
                },
                'grant-xp',
                extra,
            );
        }

        default:
            return null;
    }
}
