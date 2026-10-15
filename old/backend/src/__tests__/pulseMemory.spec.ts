import test from 'node:test';
import assert from 'node:assert/strict';
import { PULSE_MEMORY_TAG, BOOTSTRAP_MEMORY_TAG } from '../GameMaster/memory/bootstrapMemory.js';

test('tags de memória do mundo são distintos', () => {
    assert.notEqual(PULSE_MEMORY_TAG, BOOTSTRAP_MEMORY_TAG);
    assert.match(PULSE_MEMORY_TAG, /PULSO/);
});
