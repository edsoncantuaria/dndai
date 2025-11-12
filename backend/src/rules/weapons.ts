// backend/src/rules/weapons.ts
import { getSrdResource } from '../services/srdCatalogService.js';

export interface NormalizedWeapon {
    index: string;
    name: string;
    category: string;
    range?: { normal?: number; long?: number };
    damage?: { dice: string; type: string };
    versatileDamage?: string | null;
    properties: string[];
    weight?: number;
}

export async function getNormalizedWeapon(index: string): Promise<NormalizedWeapon | null> {
    const weapon = await getSrdResource('equipment', index);
    if (!weapon) return null;
    const properties = (weapon.properties ?? []).map((prop: any) => prop.name?.toLowerCase()).filter(Boolean);
    return {
        index: weapon.index,
        name: weapon.name,
        category: weapon.weapon_category ?? weapon.equipment_category?.name ?? 'unknown',
        range: weapon.range,
        damage: weapon.damage
            ? { dice: weapon.damage.damage_dice, type: weapon.damage.damage_type?.name }
            : undefined,
        versatileDamage: weapon.two_handed_damage?.damage_dice ?? null,
        properties,
        weight: weapon.weight,
    };
}
