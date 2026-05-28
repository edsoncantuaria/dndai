import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    shouldEmitNarrationStream,
    wrapNarrationStreamPayload,
    NARRATION_STREAM_CANONICAL,
} from '../ai-oss/core/streamPolicy.js';

describe('streamPolicy (P4.6)', () => {
    it('stream nunca é canônico', () => {
        assert.equal(NARRATION_STREAM_CANONICAL, false);
        const wrapped = wrapNarrationStreamPayload('act-1', 'preview', { text: '...' });
        assert.equal(wrapped.canonical, false);
        assert.equal(wrapped.kind, 'preview');
    });

    it('desliga stream quando fila assíncrona ativa', () => {
        assert.equal(
            shouldEmitNarrationStream({
                streamEnabled: true,
                actionId: 'x',
                asyncQueueActive: true,
            }),
            false,
        );
    });
});
