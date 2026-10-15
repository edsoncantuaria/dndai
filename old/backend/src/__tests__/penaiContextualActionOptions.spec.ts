import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContextualActionOptions } from '../GameMaster/motor/contextualActionOptions.js';

test('contextualActionOptions inclui combate e level-up', () => {
    const combat = buildContextualActionOptions({ combatActive: true, knownSpells: ['fire-bolt'] });
    assert.ok(combat.some(o => o.action === 'attack'));
    assert.ok(combat.some(o => o.action === 'spell-attack'));

    const level = buildContextualActionOptions({ levelUpPending: true });
    assert.ok(level.some(o => o.action === 'level-up'));
});
