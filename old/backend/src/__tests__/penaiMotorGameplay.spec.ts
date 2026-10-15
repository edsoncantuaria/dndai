import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRestIntent } from '../rules/rest.js';
import type { RulesCharacterSnapshot } from '../rules/types.js';

const hero: RulesCharacterSnapshot = {
    id: 'hero-1',
    name: 'Test',
    level: 1,
    proficiencyBonus: 2,
    abilities: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
    },
    resources: [
        {
            type: 'class-resource',
            key: 'action-surge',
            current: 0,
            max: 1,
            refresh: 'short-rest',
        },
    ],
};

test('validateRestIntent rejeita descanso em combate', () => {
    const r = validateRestIntent(hero, { restType: 'short' }, { isActive: true } as { isActive: boolean });
    assert.equal(r.status, 'rejected');
});

test('validateRestIntent aceita descanso longo fora de combate', () => {
    const r = validateRestIntent(hero, { restType: 'long' }, null);
    assert.equal(r.status, 'accepted');
    assert.ok(r.stateDelta?.character?.hp?.setToMax);
});
