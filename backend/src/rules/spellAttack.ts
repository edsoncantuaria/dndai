// backend/src/rules/spellAttack.ts
import { getNormalizedSpell } from './spells.js';
import { computeAbilityBonus } from './utils.js';
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

    return {
        status: 'needs_roll',
        rollRequest: {
            formula: rollFormula,
            modifierBreakdown: [...breakdown, `Magia: ${spell.name}`],
            context: `Jogada de ataque para ${spell.name}`,
            targetDc: payload.targetArmorClass,
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
