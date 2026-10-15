import { PenaiDataSource } from '../database/data-source.js';
import { SessionEntityState } from '../database/entities/SessionEntityState.js';
import type { NpcWeaponDef } from './npcSheet.js';

export type NpcInventoryEntry = {
    itemKey: string;
    name: string;
    quantity: number;
    equipped?: boolean;
    itemData?: Record<string, unknown>;
    source: 'bootstrap' | 'narration' | 'loot' | 'economy';
};

export type NpcSessionOverlay = {
    inventory: NpcInventoryEntry[];
    hpCurrent?: number;
    attitude?: 'friendly' | 'neutral' | 'hostile' | 'wary';
};

const KNOWN_ITEM_KEYS = new Set([
    'shortsword',
    'dagger',
    'mace',
    'spear',
    'shortbow',
    'quarterstaff',
    'longsword',
    'healing-potion',
    'healing_potion',
    'wolf_pelt',
    'iron_ingot',
    'grain',
    'ale',
]);

export function parseNpcSessionOverlay(raw: unknown): NpcSessionOverlay {
    if (!raw || typeof raw !== 'object') {
        return { inventory: [], attitude: 'neutral' };
    }
    const o = raw as Record<string, unknown>;
    const inventory = Array.isArray(o.inventory)
        ? (o.inventory as NpcInventoryEntry[]).filter(
              e => e && typeof e.itemKey === 'string' && typeof e.name === 'string',
          )
        : [];
    const attitude =
        o.attitude === 'friendly' ||
        o.attitude === 'hostile' ||
        o.attitude === 'wary' ||
        o.attitude === 'neutral'
            ? o.attitude
            : 'neutral';
    return {
        inventory,
        hpCurrent: typeof o.hpCurrent === 'number' ? o.hpCurrent : undefined,
        attitude,
    };
}

export async function getNpcSessionOverlay(
    sessionId: number,
    worldEntityId: string,
): Promise<NpcSessionOverlay | null> {
    const row = await PenaiDataSource.getRepository(SessionEntityState).findOne({
        where: { sessionId, worldEntityId },
    });
    if (!row?.sessionOverlay) return null;
    return parseNpcSessionOverlay(row.sessionOverlay);
}

/** Inventário lazy — narração/combate/loot chama isto (não persiste em hero_inventory). */
export async function appendNpcSessionInventoryItem(opts: {
    sessionId: number;
    worldEntityId: string;
    itemKey: string;
    name: string;
    quantity?: number;
    itemData?: Record<string, unknown>;
    equipped?: boolean;
    source: NpcInventoryEntry['source'];
}): Promise<NpcSessionOverlay> {
    const key = opts.itemKey.trim().toLowerCase();
    if (!KNOWN_ITEM_KEYS.has(key) && opts.source !== 'narration') {
        throw new Error(`itemKey desconhecido: ${opts.itemKey}`);
    }

    const repo = PenaiDataSource.getRepository(SessionEntityState);
    let row = await repo.findOne({
        where: { sessionId: opts.sessionId, worldEntityId: opts.worldEntityId },
    });
    if (!row) {
        row = repo.create({
            sessionId: opts.sessionId,
            worldEntityId: opts.worldEntityId,
            appeared: true,
            sessionAlive: true,
            canAppear: true,
            relationshipToHero: {},
        });
    }

    const overlay = parseNpcSessionOverlay(row.sessionOverlay);
    const existing = overlay.inventory.find(i => i.itemKey === key);
    const qty = Math.max(1, opts.quantity ?? 1);
    if (existing) {
        existing.quantity += qty;
        if (opts.itemData) existing.itemData = { ...existing.itemData, ...opts.itemData };
        if (opts.equipped != null) existing.equipped = opts.equipped;
    } else {
        overlay.inventory.push({
            itemKey: key,
            name: opts.name,
            quantity: qty,
            equipped: opts.equipped,
            itemData: opts.itemData,
            source: opts.source,
        });
    }

    row.sessionOverlay = overlay;
    await repo.save(row);
    return overlay;
}

export function overlayInventoryFromMainWeapon(weapon: NpcWeaponDef): NpcInventoryEntry[] {
    return [
        {
            itemKey: weapon.itemKey,
            name: weapon.name,
            quantity: weapon.quantity,
            equipped: weapon.equipped,
            itemData: weapon.itemData,
            source: 'bootstrap',
        },
    ];
}
