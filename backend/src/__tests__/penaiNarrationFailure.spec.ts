import test from 'node:test';
import assert from 'node:assert/strict';
import { isNonRecoverableNarrationError } from '../GameMaster/ai/geminiStructured.js';

test('isNonRecoverableNarrationError detecta cota diária esgotada', () => {
    assert.equal(
        isNonRecoverableNarrationError(
            new Error(
                'Cota diária do Gemini esgotada (free tier ~20 req/dia por modelo). Aguarde reset ou use outra chave/modelo.',
            ),
        ),
        true,
    );
});

test('isNonRecoverableNarrationError ignora 429 temporário', () => {
    assert.equal(
        isNonRecoverableNarrationError(new Error('429 RESOURCE_EXHAUSTED — retry in 7s')),
        false,
    );
});
