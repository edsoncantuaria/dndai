import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGeminiNarrationText } from '../GameMaster/adapters/gemini/narration.js';

test('parseGeminiNarrationText — chave narrative (Gemini comum)', () => {
    const out = parseGeminiNarrationText(
        '{"narrative":"O porto acorda sob névoa densa e gritos de marinheiros."}',
    );
    assert.match(out.narration, /porto/i);
});

test('parseGeminiNarrationText — chave narracao PT', () => {
    const out = parseGeminiNarrationText('{"narracao":"Você está na ponte."}');
    assert.match(out.narration, /ponte/i);
});
