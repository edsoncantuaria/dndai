/**
 * Regressão alinhada a invariantes PENAI (motor × narração).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { stripMotorOwnedFields } from '../GameMaster/narration/motorStateBridge.js';
import { applyForkOverlay } from '../services/homebrewMergeService.js';
import { validateEquipItemIntent } from '../rules/inventoryMotor.js';

test('narration_only remove campos de estado da resposta', () => {
    const stripped = stripMotorOwnedFields({
        logEntries: [{ type: 'narration', content: 'Ok' }],
        actionOptions: [
            { text: 'A', action: 'a' },
            { text: 'B', action: 'b' },
            { text: 'C', action: 'c' },
        ],
        updatedCharacter: { xp: 100 },
        combatState: { isActive: true },
        worldState: { currentRegion: 'Floresta' },
    } as any);
    assert.equal(stripped.updatedCharacter, undefined);
    assert.equal(stripped.combatState, undefined);
    assert.equal(stripped.worldState, undefined);
});

test('fork homebrew mantém official_index', () => {
    const forked = applyForkOverlay(
        { index: 'fireball', name: 'Fireball', level: 3 },
        { name: 'Fireball Aprimorada', desc: ['Mais dano'] },
    );
    assert.equal(forked.official_index, 'fireball');
    assert.match(String(forked.name), /Aprimorada/i);
});

test('motor de inventário — equipar item', () => {
    assert.equal(validateEquipItemIntent({ itemId: 12, equipped: true }).status, 'accepted');
});
