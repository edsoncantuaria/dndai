import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validateClaimLootIntent,
    validateDropItemIntent,
    validateEquipItemIntent,
} from '../rules/inventoryMotor.js';
import { computeCarryingCapacity, reconcileCurrency } from '../services/inventoryService.js';

test('validateEquipItemIntent aceita equipar item', () => {
    const result = validateEquipItemIntent({ itemId: 12, equipped: true });
    assert.equal(result.status, 'accepted');
});

test('validateDropItemIntent gera delta negativo', () => {
    const result = validateDropItemIntent({ itemId: 5, quantity: 2 });
    assert.equal(result.status, 'accepted');
    assert.equal(result.stateDelta?.character?.inventory?.[0]?.quantityDelta, -2);
});

test('validateClaimLootIntent autoriza coleta', () => {
    const result = validateClaimLootIntent();
    assert.equal(result.status, 'accepted');
});

test('computeCarryingCapacity usa força x 15', () => {
    assert.equal(computeCarryingCapacity(16), 240);
});

test('reconcileCurrency prioriza valores do servidor', () => {
    const merged = reconcileCurrency({ gp: 50 }, { gp: 10, sp: 5 });
    assert.equal(merged.gp, 50);
    assert.equal(merged.sp, 5);
});
