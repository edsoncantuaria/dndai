import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeActionSensePayload,
    parseActionSenseGeminiText,
} from '../GameMaster/adapters/gemini/actionSense.js';

test('normalizeActionSensePayload — chaves em português e acceptable ausente', () => {
    const out = normalizeActionSensePayload({
        aceitavel: false,
        motivo: 'Teletransporte instantâneo não é plausível.',
        dica: 'Use viagem ou magia conhecida.',
    }) as { acceptable: boolean; reason: string; playerFacingHint?: string };
    assert.equal(out.acceptable, false);
    assert.match(out.reason, /teletransporte/i);
    assert.equal(out.playerFacingHint, 'Use viagem ou magia conhecida.');
});

test('parseActionSenseGeminiText — acceptable como string', () => {
    const out = parseActionSenseGeminiText('{"acceptable":"false","reason":"Meta-chat."}');
    assert.equal(out.acceptable, false);
    assert.equal(out.reason, 'Meta-chat.');
});

test('parseActionSenseGeminiText — objeto aninhado em result', () => {
    const out = parseActionSenseGeminiText(
        '{"result":{"plausible":true,"explanation":"Faz sentido examinar a porta."}}',
    );
    assert.equal(out.acceptable, true);
    assert.match(out.reason, /porta/i);
});

test('parseActionSenseGeminiText — JSON inválido é permissivo', () => {
    const out = parseActionSenseGeminiText('not json');
    assert.equal(out.acceptable, true);
    assert.match(out.reason, /inválido/i);
});
