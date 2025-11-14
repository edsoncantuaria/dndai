// backend/src/rules/spellAttack.ts
import { getNormalizedSpell, ensureSpellSlotAvailability, buildSpellSlotCost } from './spells.js';
import { computeAbilityBonus } from './utils.js';
import { deriveAttackModifiers } from './combat.js';
import type { RulesCharacterSnapshot, SpellAttackIntentPayload, RuleCheckResult } from './types.js';

export async function validateSpellAttack(
    character: RulesCharacterSnapshot,
    payload: SpellAttackIntentPayload
): Promise<RuleCheckResult> {
    const spell = await getNormalizedSpell(payload.spellIndex);
    if (!spell) {
        throw new Error(`Magia ${payload.spellIndex} não encontrada no SRD.`);
    }

    const { total, breakdown } = computeAbilityBonus({
        character,
        ability: payload.ability,
        proficiency: payload.proficiency ?? true,
    });

    const rollFormula = total >= 0 ? `1d20+${total}` : `1d20${total}`;
    const damageFormula =
        payload.damageOverride ||
        spell.damage?.dice ||
        Object.values(spell.damage?.scaling ?? {})[0] ||
        null;

    const inferredSlotLevel = payload.slotLevel ?? spell.level ?? undefined;
    if (inferredSlotLevel) {
        const availability = ensureSpellSlotAvailability(character, inferredSlotLevel);
        if (!availability.available) {
            return {
                status: 'rejected',
                reason: `Sem slots de magia de nível ${inferredSlotLevel} disponíveis.`,
            };
        }
    }

    const attackModifierReport = deriveAttackModifiers(character.conditions, payload.targetConditions);
    const advantage = attackModifierReport.advantage && !attackModifierReport.disadvantage;
    const disadvantage = attackModifierReport.disadvantage && !attackModifierReport.advantage;
    if (attackModifierReport.reasons.length) {
        breakdown.push(...attackModifierReport.reasons);
    }

    return {
        status: 'needs_roll',
        rollRequest: {
            formula: rollFormula,
            modifierBreakdown: [...breakdown, `Magia: ${spell.name}`],
            context: `Jogada de ataque para ${spell.name}`,
            targetDc: payload.targetArmorClass,
            advantage,
            disadvantage,
            metadata: {
                source: {
                    kind: 'spell',
                    index: spell.index,
                    name: spell.name,
                    damageDice: damageFormula ?? undefined,
                    damageType: spell.damage?.type ?? undefined,
                },
                targets: payload.targetArmorClass
                    ? [
                          {
                              kind: payload.targetKind ?? 'entity',
                              id: payload.targetId,
                              name: payload.targetName,
                              armorClass: payload.targetArmorClass,
                          },
                      ]
                    : undefined,
                damageFormula: damageFormula ?? undefined,
                damageType: spell.damage?.type ?? undefined,
                resourceCosts: inferredSlotLevel ? [buildSpellSlotCost(inferredSlotLevel)] : undefined,
                effect: 'attack',
            },
        },
        data: {
            spell: spell.name,
            ability: payload.ability,
            details: spell.components,
        },
        stateDelta: damageFormula
            ? {
                  pendingAttack: {
                      spell: spell.name,
                      damageFormula,
                      damageType: spell.damage?.type ?? 'mágico',
                  },
              }
            : undefined,
    };
}
