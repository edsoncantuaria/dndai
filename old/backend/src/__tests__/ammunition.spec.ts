import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ammoDisplayName,
    countAmmoInInventory,
    resolveAmmoIndexForWeapon,
    resolveWeaponAmmunitionCost,
    weaponUsesAmmunition,
} from '../rules/ammunition.js';
import type { RulesCharacterSnapshot } from '../rules/types.js';

const longbow = {
    index: 'longbow',
    name: 'Longbow',
    properties: [{ index: 'ammunition', name: 'Ammunition' }, { index: 'heavy', name: 'Heavy' }],
    weapon_category: 'Martial Ranged',
};

const longsword = {
    index: 'longsword',
    name: 'Longsword',
    properties: [{ index: 'versatile', name: 'Versatile' }],
    weapon_category: 'Martial Melee',
};

test('weaponUsesAmmunition detects ammunition property', () => {
    assert.equal(weaponUsesAmmunition(longbow), true);
    assert.equal(weaponUsesAmmunition(longsword), false);
});

test('resolveAmmoIndexForWeapon maps bows to arrow', () => {
    assert.equal(resolveAmmoIndexForWeapon('longbow', longbow), 'arrow');
    assert.equal(resolveAmmoIndexForWeapon('shortbow', { ...longbow, index: 'shortbow' }), 'arrow');
    assert.equal(resolveAmmoIndexForWeapon('light-crossbow', { ...longbow, index: 'light-crossbow' }), 'crossbow-bolt');
    assert.equal(resolveAmmoIndexForWeapon('sling', { ...longbow, index: 'sling', name: 'Sling' }), 'sling-bullet');
    assert.equal(resolveAmmoIndexForWeapon('longsword', longsword), null);
});

test('countAmmoInInventory sums stacks by index', () => {
    const character: RulesCharacterSnapshot = {
        id: '1',
        name: 'Archer',
        level: 1,
        proficiencyBonus: 2,
        abilities: {},
        inventory: [
            { index: 'arrow', name: 'Arrow', quantity: 15 },
            { index: 'arrow', name: 'Arrow', quantity: 5 },
            { index: 'longbow', name: 'Longbow', equipped: true },
        ],
    };
    assert.equal(countAmmoInInventory(character, 'arrow'), 20);
});

test('resolveWeaponAmmunitionCost rejects when out of ammo', () => {
    const character: RulesCharacterSnapshot = {
        id: '1',
        name: 'Archer',
        level: 1,
        proficiencyBonus: 2,
        abilities: {},
        inventory: [{ index: 'longbow', equipped: true }],
    };
    const result = resolveWeaponAmmunitionCost(character, 'longbow', longbow);
    assert.ok(result && 'error' in result);
    assert.match(result.error, /flecha/i);
});

test('resolveWeaponAmmunitionCost builds item cost when ammo available', () => {
    const character: RulesCharacterSnapshot = {
        id: '1',
        name: 'Archer',
        level: 1,
        proficiencyBonus: 2,
        abilities: {},
        inventory: [{ index: 'arrow', quantity: 20 }],
    };
    const result = resolveWeaponAmmunitionCost(character, 'longbow', longbow);
    assert.ok(result && 'cost' in result);
    assert.deepEqual(result.cost, { kind: 'item', itemIndex: 'arrow', amount: 1 });
    assert.equal(result.label, ammoDisplayName('arrow'));
});
