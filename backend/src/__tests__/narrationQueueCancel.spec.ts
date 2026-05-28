import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldCancelNarrationJob } from '../queue/narrationQueueCancel.js';

describe('shouldCancelNarrationJob (P4.3)', () => {
    it('cancela job da mesma sessão com sequence menor', () => {
        assert.equal(
            shouldCancelNarrationJob(
                { sessionId: 1, actionSequence: 3 },
                1,
                5,
            ),
            true,
        );
    });

    it('não cancela job com sequence igual ou maior', () => {
        assert.equal(
            shouldCancelNarrationJob({ sessionId: 1, actionSequence: 5 }, 1, 5),
            false,
        );
        assert.equal(
            shouldCancelNarrationJob({ sessionId: 1, actionSequence: 6 }, 1, 5),
            false,
        );
    });

    it('não cancela outra sessão', () => {
        assert.equal(
            shouldCancelNarrationJob({ sessionId: 2, actionSequence: 1 }, 1, 10),
            false,
        );
    });

    it('não cancela job sem sequence', () => {
        assert.equal(
            shouldCancelNarrationJob({ sessionId: 1, actionSequence: undefined }, 1, 10),
            false,
        );
    });
});
