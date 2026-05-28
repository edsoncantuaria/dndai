import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    shouldSkipMechanicalPersistence,
} from '../narration/workerPersistencePolicy.js';

describe('workerPersistencePolicy (P5.2)', () => {
    it('worker + motorOwnsState pula persistência mecânica', () => {
        assert.equal(shouldSkipMechanicalPersistence(true, 'worker'), true);
        assert.equal(shouldSkipMechanicalPersistence(true, 'sync'), false);
        assert.equal(shouldSkipMechanicalPersistence(false, 'worker'), false);
    });
});
