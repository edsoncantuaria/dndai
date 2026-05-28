import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    isStaleNarrationSequence,
    setCachedActionSequence,
} from '../services/actionSequenceService.js';
describe('actionSequence (P4.1)', () => {
    it('job com sequence menor que latest é stale', async () => {
        setCachedActionSequence(42, 5);
        assert.equal(await isStaleNarrationSequence(42, 4), true);
        assert.equal(await isStaleNarrationSequence(42, 5), false);
        assert.equal(await isStaleNarrationSequence(42, 6), false);
    });

    it('sequence ausente no job não é stale', async () => {
        setCachedActionSequence(99, 3);
        assert.equal(await isStaleNarrationSequence(99, undefined), false);
    });
});
