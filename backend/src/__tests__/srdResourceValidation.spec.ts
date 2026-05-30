import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isClassDetailRequest,
    isValidResourceDetail,
} from '../services/srdResourceValidation.js';

test('isValidResourceDetail rejeita levels[] como detalhe de classe', () => {
    assert.equal(isClassDetailRequest('classes', 'fighter'), true);
    assert.equal(isValidResourceDetail('classes', 'fighter', { 0: { level: 1 } }), false);
    assert.equal(isValidResourceDetail('classes', 'fighter', [{ level: 1 }]), false);
    assert.equal(
        isValidResourceDetail('classes', 'fighter', {
            index: 'fighter',
            name: 'Fighter',
            hit_die: 10,
            saving_throws: [],
        }),
        true,
    );
    assert.equal(isValidResourceDetail('classes/fighter', 'levels', [{ level: 1 }]), true);
});
