import assert from 'node:assert/strict';
import test from 'node:test';
import { checkNarrationConsistency } from '../GameMaster/narration/consistencyCheck.js';

test('consistencyCheck: ok quando prosa alinhada', () => {
    const result = checkNarrationConsistency({
        narration: 'Você avança pela taverna escura, espada em punho.',
        mechanical: {
            character: { hp: { current: 12, max: 20 } },
        },
    });
    assert.equal(result.ok, true);
    assert.equal(result.issues.length, 0);
});

test('consistencyCheck: detecta HP divergente', () => {
    const result = checkNarrationConsistency({
        narration: 'Com 50/50 PV restantes, você corre.',
        mechanical: {
            character: { hp: { current: 12, max: 20 } },
        },
    });
    assert.equal(result.ok, false);
    assert.ok(result.issues.some(i => i.includes('PV')));
    assert.ok(result.remediatedText?.includes('[Mesa:'));
});

test('consistencyCheck: detecta grant mecânico', () => {
    const result = checkNarrationConsistency({
        narration: 'Você encontra 100 po de ouro brilhando no chão.',
        mechanical: { character: { hp: { current: 10, max: 10 } } },
    });
    assert.equal(result.ok, false);
    assert.ok(result.issues.some(i => i.includes('mecânico')));
});
