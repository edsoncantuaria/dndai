import test from 'node:test';
import assert from 'node:assert/strict';
import { penaiEnv } from '../config/penaiEnv.js';

test('PENAI default: uma tentativa Gemini por chamada (sem empilhar tokens)', () => {
    assert.equal(penaiEnv.GEMINI_MAX_ATTEMPTS, 1);
    assert.equal(penaiEnv.PENAI_NARRATION_MAX_ATTEMPTS, 1);
    assert.equal(penaiEnv.PENAI_ACTION_OPTIONS_LLM, false);
});
