// backend/src/rules/attack.ts
import { getSrdResource } from '../services/srdCatalogService.js';
import { computeAbilityBonus, getAttackAbility } from './utils.js';
import { deriveAttackModifiers } from './combat.js';
import { resolveWeaponAmmunitionCost, countAmmoInInventory } from './ammunition.js';
import { asSrdRecord } from './srdRecord.js';
import type {
    RuleCheckResult,
    RulesCharacterSnapshot,
    WeaponAttackIntent,
} from './types.js';

export async function validateWeaponAttack(
    character: RulesCharacterSnapshot,
    intent: WeaponAttackIntent
): Promise<RuleCheckResult> {
    const weapon = asSrdRecord(await getSrdResource('equipment', intent.weaponIndex));
    if (!weapon) {
        return {
            status: 'rejected',
            reason: `Arma ${intent.weaponIndex} não está no catálogo SRD.`,
        };
    }

    if (weapon.weapon_category === 'Simple Ranged' || weapon.weapon_category === 'Martial Ranged') {
        if (!intent.ability) {
            intent.ability = 'dexterity';
        }
    }

    const ability = getAttackAbility(character, intent.ability);
    let proficient = false;
    if (typeof intent.proficiency === 'boolean') {
        proficient = intent.proficiency;
    } else if (character.weaponProficiencies?.length) {
        const normalizedWeaponIndex = (weapon.index || '').toLowerCase();
        const normalizedWeaponName = (weapon.name || '').toLowerCase();
        const normalizedWeaponCategory = (weapon.weapon_category || weapon.equipment_category?.name || '').toLowerCase();
        proficient = character.weaponProficiencies.some(prof => {
            const normalized = prof.toLowerCase();
            return (
                (normalizedWeaponIndex && normalized === normalizedWeaponIndex) ||
                (normalizedWeaponName && normalized === normalizedWeaponName) ||
                (normalizedWeaponCategory && normalized.includes(normalizedWeaponCategory)) ||
                (normalizedWeaponCategory && normalizedWeaponCategory.includes(normalized))
            );
        });
    }

    const { total: attackBonus, breakdown } = computeAbilityBonus({
        character,
        ability,
        proficiency: proficient,
    });

    const modifierBreakdown = [...breakdown];
    if (weapon.weapon_category) {
        modifierBreakdown.push(`Arma: ${weapon.name}`);
    }

    const attackModifierReport = deriveAttackModifiers(character.conditions, intent.targetConditions);
    const advantage = attackModifierReport.advantage && !attackModifierReport.disadvantage;
    const disadvantage = attackModifierReport.disadvantage && !attackModifierReport.advantage;

    if (attackModifierReport.reasons.length) {
        modifierBreakdown.push(...attackModifierReport.reasons);
    }

    const w = weapon;
    const damage = w.damage as { damage_dice?: string; damage_type?: { name?: string } } | undefined;
    const properties = (w.properties as Array<{ name?: string }> | undefined) ?? [];
    const ammo = resolveWeaponAmmunitionCost(character, intent.weaponIndex, weapon);
    if (ammo && 'error' in ammo) {
        return { status: 'rejected', reason: ammo.error };
    }

    const resourceCosts = ammo ? [ammo.cost] : undefined;
    if (ammo) {
        const remaining = countAmmoInInventory(character, ammo.ammoIndex) - 1;
        modifierBreakdown.push(`Munição: 1× ${ammo.label} (restam ${remaining})`);
    }

    const rollFormula = attackBonus >= 0 ? `1d20+${attackBonus}` : `1d20${attackBonus}`;
    const context =
        intent.context ??
        `Ataque com ${weapon.name} (${ability.toUpperCase()}${proficient ? ' + proficiência' : ''})`;

    return {
        status: 'needs_roll',
        rollRequest: {
            formula: rollFormula,
            modifierBreakdown,
            context,
            targetDc: intent.targetArmorClass,
            advantage,
            disadvantage,
            metadata: {
                source: {
                    kind: 'weapon',
                    index: weapon.index,
                    name: weapon.name,
                    damageDice: damage?.damage_dice,
                    damageType: damage?.damage_type?.name,
                },
                targets: intent.targetArmorClass
                    ? [
                          {
                              kind: intent.targetKind ?? 'entity',
                              id: intent.targetId,
                              name: intent.targetName,
                              armorClass: intent.targetArmorClass,
                          },
                      ]
                    : undefined,
                damageFormula: damage?.damage_dice ?? undefined,
                damageType: damage?.damage_type?.name ?? undefined,
                resourceCosts,
                effect: 'attack',
            },
        },
        data: {
            weapon: {
                index: weapon.index,
                name: weapon.name,
                damage: damage,
                properties: properties.map(prop => prop.name).filter(Boolean) as string[],
            },
            ability,
            proficient,
        },
        stateDelta: {
            pendingAttack: {
                weapon: weapon.name,
                damageFormula: damage?.damage_dice ?? '1d6',
                damageType: damage?.damage_type?.name ?? 'físico',
            },
        },
    };
}
