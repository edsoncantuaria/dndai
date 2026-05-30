import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    listEnglishAliases,
    parseLlmJsonText,
    translateLlmPayload,
} from '../GameMaster/ai/llmJsonTranslator.js';
import { ACTION_SENSE_LLM_DICTIONARY } from '../GameMaster/ai/llmJsonSchemas.js';

test('dicionário actionSense inclui aliases em inglês', () => {
    const en = listEnglishAliases(ACTION_SENSE_LLM_DICTIONARY);
    assert.ok(en.includes('acceptable'));
    assert.ok(en.includes('plausible'));
    assert.ok(en.includes('reason'));
    assert.ok(en.includes('explanation'));
});

test('translateLlmPayload — só inglês', () => {
    const { data, matches } = translateLlmPayload(
        { acceptable: false, reason: 'Meta-chat.' },
        ACTION_SENSE_LLM_DICTIONARY,
    );
    assert.equal(data.acceptable, false);
    assert.equal(data.reason, 'Meta-chat.');
    assert.ok(matches.some(m => m.canonical === 'acceptable' && m.viaEnglishAlias));
});

test('translateLlmPayload — português sem chave inglesa', () => {
    const { data, matches } = translateLlmPayload(
        { aceitavel: true, motivo: 'Plausível na taverna.' },
        ACTION_SENSE_LLM_DICTIONARY,
    );
    assert.equal(data.acceptable, true);
    assert.match(String(data.reason), /taverna/i);
    const acceptableMatch = matches.find(m => m.canonical === 'acceptable');
    assert.equal(acceptableMatch?.viaEnglishAlias, false);
});

test('translateLlmPayload — aninhado em result (inglês)', () => {
    const { data } = translateLlmPayload(
        { result: { plausible: true, explanation: 'Examinar a porta faz sentido.' } },
        ACTION_SENSE_LLM_DICTIONARY,
    );
    assert.equal(data.acceptable, true);
    assert.match(String(data.reason), /porta/i);
});

test('parseLlmJsonText — markdown fence', () => {
    const out = parseLlmJsonText(
        '```json\n{"allowed": false, "message": "OOC"}\n```',
        ACTION_SENSE_LLM_DICTIONARY,
    );
    assert.equal(out.ok, true);
    if (out.ok) {
        assert.equal(out.data.acceptable, false);
        assert.equal(out.data.reason, 'OOC');
    }
});
