import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveAttackModifiers } from '../rules/combat.js';
import { validateRestIntent } from '../rules/rest.js';
import { validateWeaponAttack } from '../rules/attack.js';
import { convertRollRequestToPlayerRoll } from '../rules/rollRequestAdapter.js';
import {
    ensureSpellSlotAvailability,
    buildSpellSlotCost,
    getSpellSaveDc,
} from '../rules/spells.js';
import type { RulesCharacterSnapshot, WeaponAttackIntent } from '../rules/types.js';

const baseSnapshot: RulesCharacterSnapshot = {
    id: 'character-1',
    name: 'Test Hero',
    level: 5,
    proficiencyBonus: 3,
    abilities: {
        strength: 12,
        dexterity: 14,
        constitution: 16,
        intelligence: 10,
        wisdom: 13,
        charisma: 8,
    },
    weaponProficiencies: [],
    skillProficiencies: [],
    extraAttackBonus: 0,
    inventory: [],
    conditions: [],
    resources: [],
};

test('combat modifiers react to attacker/target conditions', () => {
    const report = deriveAttackModifiers(['poisoned'], ['paralyzed']);
    assert.equal(report.disadvantage, true);
    assert.equal(report.advantage, true);
    assert.ok(
        report.reasons.some(reason => reason.toLowerCase().includes('poisoned')),
        'Should mention attacker disadvantage',
    );
    assert.ok(
        report.reasons.some(reason => reason.toLowerCase().includes('paralyzed')),
        'Should mention target advantage',
    );
});

test('long rest restores HP and spell slots in delta', () => {
    const snapshot: RulesCharacterSnapshot = {
        ...baseSnapshot,
        resources: [
            { type: 'spell-slot', key: 'level-1', current: 1, max: 4, refresh: 'long-rest' },
            { type: 'class-feature', key: 'action-surge', current: 0, max: 1, refresh: 'short-rest' },
        ],
    };
    const result = validateRestIntent(snapshot, { restType: 'long' }, null);
    assert.equal(result.status, 'accepted');
    assert.equal(result.stateDelta?.rest?.type, 'long');
    assert.deepEqual(result.stateDelta?.character?.hp, { setToMax: true });
    const resourceDelta = result.stateDelta?.character?.resources;
    assert.ok(resourceDelta && resourceDelta.length === 2, 'should include resource deltas');
    const slotDelta = resourceDelta?.find(res => res.key === 'level-1');
    assert.equal(slotDelta?.delta, 3);
});

test('spell utilities verify slot availability and DC', () => {
    const snapshot: RulesCharacterSnapshot = {
        ...baseSnapshot,
        resources: [
            { type: 'spell-slot', key: 'level-2', current: 2, max: 2, refresh: 'long-rest' },
        ],
    };
    const availability = ensureSpellSlotAvailability(snapshot, 2);
    assert.equal(availability.available, true);
    const noSlots = ensureSpellSlotAvailability(snapshot, 3);
    assert.equal(noSlots.available, false);

    const slotCost = buildSpellSlotCost(2);
    assert.deepEqual(slotCost, { kind: 'spell-slot', level: 2, amount: 1, resourceKey: 'level-2' });

    const dc = getSpellSaveDc(snapshot, 'wisdom');
    assert.equal(dc, 8 + snapshot.proficiencyBonus + 1); // wisdom mod = +1
});

test('weapon attack intent produces a single roll request with matching delta', async () => {
    const snapshot: RulesCharacterSnapshot = {
        ...baseSnapshot,
        weaponProficiencies: ['longsword'],
    };
    const intent: WeaponAttackIntent = {
        type: 'weapon-attack',
        weaponIndex: 'longsword',
        targetArmorClass: 14,
        targetId: 'goblin-1',
        targetName: 'Goblin Vigia',
    };
    const result = await validateWeaponAttack(snapshot, intent);
    assert.equal(result.status, 'needs_roll');
    assert.ok(result.rollRequest, 'intent deve gerar um rollRequest único');
    assert.ok(result.stateDelta?.pendingAttack, 'delta deve registrar pendingAttack');
    const damageFromDelta = result.stateDelta?.pendingAttack?.damageFormula;
    assert.ok(damageFromDelta, 'delta precisa indicar fórmula de dano');
    assert.equal(
        result.rollRequest?.metadata?.damageFormula,
        damageFromDelta,
        'rollRequest e delta devem concordar sobre a fórmula de dano'
    );
    assert.equal(
        result.rollRequest?.metadata?.targets?.[0]?.armorClass,
        intent.targetArmorClass
    );
});

test('roll request adapter preserves metadata for player-facing rolls', () => {
    const baseRequest = {
        formula: '1d20+5',
        context: 'Ataque com espada longa',
        targetDc: 15,
        advantage: false,
        disadvantage: false,
        modifierBreakdown: ['FOR +3', 'Proficiência +2'],
        metadata: {
            damageFormula: '1d8+3',
            effect: 'attack',
        },
    };
    const converted = convertRollRequestToPlayerRoll(baseRequest, {
        rollType: 'attack',
        reasonPrefix: 'Motor de Regras',
    });
    assert.equal(converted.dice, '1d20');
    assert.equal(converted.modifier, 5);
    assert.match(converted.reason, /Motor de Regras/);
    assert.equal(converted.metadata?.damageFormula, '1d8+3');
});
