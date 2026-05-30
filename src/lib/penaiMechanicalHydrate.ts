import type { CombatState, LootOffer } from '@/types';

/** Converte `combatState` do pack PENAI para `CombatState` do cliente. */
export function mapPenaiCombatPack(
    combatRaw: Record<string, unknown> | undefined | null,
): CombatState | null {
    if (!combatRaw || typeof combatRaw !== 'object') return null;

    const combatants = Array.isArray(combatRaw.combatants)
        ? (combatRaw.combatants as Array<Record<string, unknown>>)
        : [];
    const order = Array.isArray(combatRaw.initiativeOrder)
        ? (combatRaw.initiativeOrder as string[])
        : combatants.map(c => String(c.entityKey ?? ''));

    return {
        isActive: Boolean(combatRaw.isActive),
        round: Number(combatRaw.round ?? 1),
        turn: Number(combatRaw.turn ?? 0),
        initiativeOrder: order,
        combatants: combatants.map(c => {
            const hp = Number(c.hp ?? 0);
            return {
                id: String(c.entityKey ?? c.id ?? ''),
                name: String(c.displayName ?? c.name ?? 'Combatente'),
                isPlayer: c.side === 'hero',
                hp: { current: hp, max: Number(c.hpMax ?? 1) },
                ac: Number(c.armorClass ?? 10),
                initiative: Number(c.initiative ?? 10),
                isDead: Boolean(c.isDead ?? hp <= 0),
                hasMoved: false,
                hasActed: false,
                actionPoints: 3,
                bonusActionPoints: 1,
                conditions: [],
                rollHistory: [],
            };
        }),
    } as CombatState;
}

export function applyPenaiMechanicalInteractionSlice(
    mechanical: Record<string, unknown>,
    handlers: {
        setCombatState: (state: CombatState) => void;
        setRequest: (args: { type: 'loot' | 'shop'; request: unknown }) => void;
    },
): void {
    const combat = mapPenaiCombatPack(mechanical.combatState as Record<string, unknown>);
    if (combat) {
        handlers.setCombatState(combat);
    }

    const loot = mechanical.pendingLootOffer as LootOffer | null | undefined;
    if (loot && typeof loot === 'object') {
        handlers.setRequest({ type: 'loot', request: loot });
    }

    const shop = mechanical.shopState as Record<string, unknown> | null | undefined;
    if (shop && typeof shop === 'object' && Array.isArray(shop.inventory)) {
        handlers.setRequest({
            type: 'shop',
            request: {
                isOpen: true,
                isHaggling: false,
                name: String(shop.name ?? 'Loja'),
                inventory: shop.inventory,
                sellPrices: {},
            },
        });
    }
}

/** Mescla campos de topo do WS v2 (`currentRegionSlug`, `actionOptions`, …) no slice mecânico. */
export function mergePenaiMechanicalMessage(msg: Record<string, unknown>): Record<string, unknown> {
    const mechanical = (msg.mechanical as Record<string, unknown> | undefined) ?? {};
    const mech: Record<string, unknown> = { ...mechanical };

    if (typeof msg.currentRegionSlug === 'string') {
        mech.currentRegionSlug = msg.currentRegionSlug;
    }
    if (msg.levelUpState != null) {
        mech.levelUpState = msg.levelUpState;
    }
    if (Array.isArray(msg.actionOptions)) {
        mech.actionOptions = msg.actionOptions;
    }

    const payload = msg.payload as Record<string, unknown> | undefined;
    if (Array.isArray(payload?.actionOptions)) {
        mech.actionOptions = payload.actionOptions;
    }

    return mech;
}
