import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSummarizerGeminiText } from '../GameMaster/adapters/gemini/summarizer.js';

test('parseSummarizerGeminiText — summary canônico', () => {
    const out = parseSummarizerGeminiText(
        '{"summary":"O grupo chegou ao porto e ouviu rumores sobre o culto."}',
    );
    assert.match(out.summary, /porto/i);
});

test('parseSummarizerGeminiText — alias resumo PT', () => {
    const out = parseSummarizerGeminiText(
        '{"resumo":"Aerk bloqueou a ponte na Cidadela."}',
    );
    assert.match(out.summary, /Aerk|ponte/i);
});
