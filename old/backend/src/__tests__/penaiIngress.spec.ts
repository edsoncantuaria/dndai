import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPenaiIntent } from '../GameMaster/engine/actionIngress.js';

test('classifica viagem por intent estruturado', () => {
    const intent = classifyPenaiIntent('quero descansar', {
        intent: 'travel',
        targetRegionSlug: 'vales-do-norte',
        travelMode: 'horse',
    });
    assert.equal(intent.type, 'travel');
    if (intent.type === 'travel') {
        assert.equal(intent.payload.targetRegionSlug, 'vales-do-norte');
        assert.equal(intent.payload.travelMode, 'horse');
    }
});

test('classifica combate por palavra-chave', () => {
    const intent = classifyPenaiIntent('atacar o goblin com minha espada', {});
    assert.equal(intent.type, 'combat');
});
