// backend/src/rules/attack.ts
import { getSrdResource } from '../services/srdCatalogService.js';
import { computeAbilityBonus, getAttackAbility } from './utils.js';
import type {
    RuleCheckResult,
    RulesCharacterSnapshot,
    WeaponAttackIntent,
} from './types.js';

export async function validateWeaponAttack(
    character: RulesCharacterSnapshot,
    intent: WeaponAttackIntent
): Promise<RuleCheckResult> {
    const weapon = await getSrdResource('equipment', intent.weaponIndex);
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
        },
        data: {
            weapon: {
                index: weapon.index,
                name: weapon.name,
                damage: weapon.damage,
                properties: weapon.properties?.map((prop: any) => prop.name) ?? [],
            },
            ability,
            proficient,
        },
        stateDelta: {
            pendingAttack: {
                weapon: weapon.name,
                damageFormula: weapon.damage?.damage_dice ?? '1d6',
                damageType: weapon.damage?.damage_type?.name ?? 'físico',
            },
        },
    };
}
