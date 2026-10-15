// backend/src/rules/weapons.ts
import { getSrdResource } from '../services/srdCatalogService.js';
import { asSrdRecord, type SrdRecord } from './srdRecord.js';

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
    const weapon = asSrdRecord(await getSrdResource('equipment', index));
    if (!weapon) return null;
    const w = weapon as SrdRecord & Record<string, unknown>;
    const properties = ((w.properties as Array<{ name?: string }> | undefined) ?? [])
        .map(prop => prop.name?.toLowerCase())
        .filter(Boolean) as string[];
    return {
        index: String(w.index ?? index),
        name: String(w.name ?? index),
        category: String(w.weapon_category ?? w.equipment_category?.name ?? 'unknown'),
        range: w.range as NormalizedWeapon['range'],
        damage: (w.damage as { damage_dice?: string; damage_type?: { name?: string } } | undefined)
            ? {
                  dice: String((w.damage as { damage_dice?: string }).damage_dice ?? ''),
                  type: String((w.damage as { damage_type?: { name?: string } }).damage_type?.name ?? ''),
              }
            : undefined,
        versatileDamage:
            (w.two_handed_damage as { damage_dice?: string } | undefined)?.damage_dice ?? null,
        properties,
        weight: typeof w.weight === 'number' ? w.weight : undefined,
    };
}
