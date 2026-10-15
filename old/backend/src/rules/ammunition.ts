import type { RollResourceCost, RulesCharacterSnapshot } from './types.js';

/** Munição SRD padrão por index de arma (5e). */
const WEAPON_AMMO_INDEX: Record<string, string> = {
    longbow: 'arrow',
    shortbow: 'arrow',
    blowgun: 'blowgun-needle',
    'light-crossbow': 'crossbow-bolt',
    'heavy-crossbow': 'crossbow-bolt',
    'hand-crossbow': 'crossbow-bolt',
    sling: 'sling-bullet',
};

const AMMO_LABELS: Record<string, string> = {
    arrow: 'flecha',
    'crossbow-bolt': 'virote',
    'blowgun-needle': 'agulha de zarabatana',
    'sling-bullet': 'projétil de funda',
};

type SrdWeaponLike = {
    index?: string;
    name?: string;
    properties?: Array<{ index?: string; name?: string }>;
    category_range?: string;
    weapon_range?: string;
};

export function weaponUsesAmmunition(weapon: SrdWeaponLike): boolean {
    return (
        weapon.properties?.some(p => {
            const idx = (p.index ?? p.name ?? '').toLowerCase();
            return idx === 'ammunition';
        }) ?? false
    );
}

export function resolveAmmoIndexForWeapon(weaponIndex: string, weapon: SrdWeaponLike): string | null {
    if (!weaponUsesAmmunition(weapon)) return null;

    const key = weaponIndex.toLowerCase().trim();
    if (WEAPON_AMMO_INDEX[key]) return WEAPON_AMMO_INDEX[key];

    const cat = `${weapon.category_range ?? ''} ${weapon.weapon_range ?? ''} ${weapon.name ?? ''}`.toLowerCase();
    if (key.includes('crossbow') || cat.includes('crossbow')) return 'crossbow-bolt';
    if (key.includes('blowgun') || cat.includes('blowgun')) return 'blowgun-needle';
    if (key.includes('sling') || cat.includes('sling')) return 'sling-bullet';
    return 'arrow';
}

export function ammoDisplayName(ammoIndex: string): string {
    return AMMO_LABELS[ammoIndex] ?? ammoIndex.replace(/-/g, ' ');
}

export function countAmmoInInventory(
    character: RulesCharacterSnapshot,
    ammoIndex: string,
): number {
    const key = ammoIndex.toLowerCase();
    return (character.inventory ?? [])
        .filter(i => (i.index ?? '').toLowerCase() === key)
        .reduce((sum, i) => sum + Math.max(0, i.quantity ?? 1), 0);
}

export function buildAmmunitionCost(ammoIndex: string): RollResourceCost {
    return {
        kind: 'item',
        itemIndex: ammoIndex,
        amount: 1,
    };
}

export function resolveWeaponAmmunitionCost(
    character: RulesCharacterSnapshot,
    weaponIndex: string,
    weapon: SrdWeaponLike,
): { cost: RollResourceCost; ammoIndex: string; label: string } | { error: string } | null {
    const ammoIndex = resolveAmmoIndexForWeapon(weaponIndex, weapon);
    if (!ammoIndex) return null;

    const available = countAmmoInInventory(character, ammoIndex);
    const label = ammoDisplayName(ammoIndex);
    if (available < 1) {
        return {
            error: `Sem ${label} no inventário — é preciso munição para atacar com ${weapon.name ?? weaponIndex}.`,
        };
    }

    return {
        cost: buildAmmunitionCost(ammoIndex),
        ammoIndex,
        label,
    };
}
