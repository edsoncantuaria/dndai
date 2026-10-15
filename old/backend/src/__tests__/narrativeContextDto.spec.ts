import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSessionFactsWithMandate } from '../GameMaster/memory/narrativeContextDto.js';

test('mergeSessionFactsWithMandate prioriza mandatos e deduplica', () => {
    const merged = mergeSessionFactsWithMandate(
        ['[MUNDO] rumor antigo', 'fato rag'],
        ['[FATO] Missão urgente', '[MUNDO] rumor antigo'],
        4,
    );
    assert.equal(merged[0], '[FATO] Missão urgente');
    assert.equal(merged.length, 3);
});
