import test from 'node:test';
import assert from 'node:assert/strict';
import {
    computeCoinWeightLb,
    computeInventoryTotalWeightLb,
    unitWeightFromSrdEntry,
} from '../GameMaster/character/inventoryWeight.js';

test('unitWeightFromSrdEntry divide peso do pacote SRD', () => {
    assert.equal(unitWeightFromSrdEntry({ weight: 1, quantity: 20 }), 0.05);
    assert.equal(unitWeightFromSrdEntry({ weight: 1 }), 1);
});

test('computeCoinWeightLb — 50 moedas = 1 lb', () => {
    assert.equal(computeCoinWeightLb({ pp: 0, gp: 50, ep: 0, sp: 0, cp: 0 }), 1);
});

test('duas adagas e 20 flechas somam corretamente', async () => {
    const total = await computeInventoryTotalWeightLb(
        [
            {
                itemKey: 'dagger',
                name: 'Adaga',
                quantity: 2,
                itemData: { unitWeightLb: 1 },
            },
            {
                itemKey: 'arrow',
                name: 'Flecha',
                quantity: 20,
                itemData: { unitWeightLb: 0.05 },
            },
        ],
        { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    );
    assert.equal(total, 3);
});
