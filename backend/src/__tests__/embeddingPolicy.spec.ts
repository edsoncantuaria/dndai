import test from 'node:test';
import assert from 'node:assert/strict';
import {
    shouldEmbedForOperation,
    embeddingPolicyConfig,
} from '../services/embeddingPolicy.js';
import { mapOssNewFactsToGameFacts } from '../ai-oss/schemas/narration.schema.js';

test('embeddingPolicy — recall a cada 2 turnos', () => {
    const cfg = embeddingPolicyConfig();
    assert.equal(shouldEmbedForOperation('recall', 0, 0), true);
    assert.equal(shouldEmbedForOperation('recall', 1, 0), false);
    assert.equal(shouldEmbedForOperation('recall', 2, 0), true);
    assert.equal(cfg.recallEveryTurns, 2);
});

test('embeddingPolicy — omite recall com muitos fatos SQL', () => {
    const min = embeddingPolicyConfig().skipRecallIfFactsAtLeast;
    assert.equal(shouldEmbedForOperation('recall', 0, min), false);
    assert.equal(shouldEmbedForOperation('recall', 0, min - 1), true);
});

test('embeddingPolicy — journal sempre embeda', () => {
    assert.equal(shouldEmbedForOperation('store_journal', 1, 99), true);
});

test('mapOssNewFactsToGameFacts — converte para SQL', () => {
    const facts = mapOssNewFactsToGameFacts([
        { fact: 'O ferreiro prometeu consertar a espada amanhã.', importance: 'high' },
    ]);
    assert.equal(facts.length, 1);
    assert.equal(facts[0]?.category, 'general');
    assert.match(facts[0]?.fact ?? '', /ferreiro/i);
});
