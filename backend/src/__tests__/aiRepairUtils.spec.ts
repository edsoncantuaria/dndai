import test from 'node:test';
import assert from 'node:assert/strict';
import {
    attemptJsonRepair,
    buildContinuationSnippet,
    softTailRepair,
    stripCodeFences,
    stripSuffix,
    trimAfterLastClosingBracket,
} from '../services/aiRepairUtils.js';

test('softTailRepair removes trailing fragments', () => {
    const input = '{"logEntries":[{"type":"narration","content":"Oi"}],"actionOptions":[{"text":"Aja"}]}FOOTER';
    const repaired = softTailRepair(input);
    assert.ok(repaired);
    assert.equal(repaired?.endsWith('}'), true);
    assert.equal(repaired?.includes('FOOTER'), false);
});

test('attemptJsonRepair fixes trailing commas and unbalanced braces', () => {
    const broken = '{ "logEntries": [ {"type":"narration","content":"Teste"}, ], ';
    const repaired = attemptJsonRepair(broken);
    assert.ok(repaired);
    assert.doesNotThrow(() => JSON.parse(repaired!));
    const parsed = JSON.parse(repaired!);
    assert.equal(parsed.logEntries.length, 1);
});

test('attemptJsonRepair quotes bare keys and closes arrays', () => {
    const broken = '{ logEntries: [ { type: "narration", content: "Oi" }, { type: "system" } ';
    const repaired = attemptJsonRepair(broken);
    assert.ok(repaired);
    const parsed = JSON.parse(repaired!);
    assert.ok(Array.isArray(parsed.logEntries));
    assert.equal(parsed.logEntries.length, 2);
    assert.equal(parsed.logEntries[0].type, 'narration');
});

test('trimAfterLastClosingBracket cuts incomplete tail safely', () => {
    const sample = '{"actionOptions":["a","b"]}<<<garbage';
    const trimmed = trimAfterLastClosingBracket(sample);
    assert.equal(trimmed, '{"actionOptions":["a","b"]}');
});

test('stripCodeFences removes markdown fences and prefixes only', () => {
    const sample = 'JSON: ```json\n{"hello":"world"}\n```\n';
    const stripped = stripCodeFences(sample);
    assert.equal(stripped, '{"hello":"world"}');
    const untouched = stripSuffix('{"hash":"[INCOMPLETE_END_FLAG] inside"}', '[INCOMPLETE_END_FLAG]');
    assert.equal(untouched.includes('[INCOMPLETE_END_FLAG]'), true);
});

test('buildContinuationSnippet limits payload to last 4000 characters', () => {
    const longText = 'x'.repeat(6000);
    const snippet = buildContinuationSnippet(longText);
    assert.equal(snippet.length, 4000);
    assert.equal(snippet.startsWith('x'), true);
});
