import assert from 'node:assert/strict';
import test from 'node:test';

/** Espelha a lógica em narrationJobProcessor.ts */
function shouldRejectDuplicatePersistence(stage: string): boolean {
    return stage === 'pre_run' || stage.startsWith('pre_llm');
}

test('narration worker: não rejeita duplicata na entrega pós-persist', () => {
    assert.equal(shouldRejectDuplicatePersistence('pre_run'), true);
    assert.equal(shouldRejectDuplicatePersistence('pre_llm_action'), true);
    assert.equal(shouldRejectDuplicatePersistence('pre_deliver_action'), false);
    assert.equal(shouldRejectDuplicatePersistence('pre_deliver_roll'), false);
});
