import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNpcPersonality } from '../GameMaster/schemas/npcPersonality.js';

test('npcPersonality valida goals', () => {
    const p = parseNpcPersonality({
        goals: [{ id: 'g1', description: 'Proteger a ponte sul', priority: 'high' }],
    });
    assert.equal(p.goals.length, 1);
    assert.equal(p.goals[0].description, 'Proteger a ponte sul');
});
