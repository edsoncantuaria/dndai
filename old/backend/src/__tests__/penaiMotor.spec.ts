import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPenaiIntent } from '../GameMaster/motor/classifyIntent.js';
import { PENAI_MOTOR } from '../GameMaster/motor/index.js';

test('PENAI_MOTOR exporta API pública', () => {
    assert.equal(typeof PENAI_MOTOR.validateAndApply, 'function');
    assert.equal(typeof PENAI_MOTOR.resolveRoll, 'function');
    assert.equal(typeof PENAI_MOTOR.isTurnLocked, 'function');
});

test('classifyPenaiIntent detecta combate', () => {
    const intent = classifyPenaiIntent('atacar o goblin', {});
    assert.equal(intent.type, 'combat');
});

test('resolveRoll falha sem rolagem pendente', async () => {
    const result = await PENAI_MOTOR.resolveRoll({
        sessionId: 99999,
        userId: 1,
        requestId: 'missing',
        rolls: [15],
    });
    assert.equal(result.ok, false);
});
