import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validateClaimLootIntent,
    validateDropItemIntent,
    validateEquipItemIntent,
    resolveEquipItemKey,
} from '../rules/inventoryMotor.js';
import { computeCarryingCapacity, reconcileCurrency } from '../services/inventoryService.js';

test('validateEquipItemIntent aceita equipar item legado numérico', () => {
    const result = validateEquipItemIntent({ itemId: 12, equipped: true });
    assert.equal(result.status, 'accepted');
    assert.equal(result.authoritativeSignature, 'equip:12:true');
});

test('validateEquipItemIntent aceita UUID PENAI', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const result = validateEquipItemIntent({ inventoryItemId: uuid, equipped: false });
    assert.equal(result.status, 'accepted');
    assert.equal(result.authoritativeSignature, `equip:${uuid}:false`);
});

test('validateEquipItemIntent aceita itemKey', () => {
    const result = validateEquipItemIntent({ itemKey: 'longsword', equipped: true });
    assert.equal(result.status, 'accepted');
    assert.equal(resolveEquipItemKey({ itemKey: 'longsword', equipped: true }), 'longsword');
});

test('validateEquipItemIntent rejeita payload vazio', () => {
    const result = validateEquipItemIntent({ equipped: true });
    assert.equal(result.status, 'rejected');
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
