import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ensureNpcSpellCatalog,
    resolveNpcSpellRef,
    getNpcSpellDisplayName,
    filterValidNpcSpells,
} from '../GameMaster/world/npcSrdSpells.js';

test('resolveNpcSpellRef aceita index e nome da API', () => {
    ensureNpcSpellCatalog();
    assert.equal(resolveNpcSpellRef('cure-wounds'), 'cure-wounds');
    assert.equal(resolveNpcSpellRef('Cure Wounds'), 'cure-wounds');
    assert.equal(resolveNpcSpellRef('fire-bolt'), 'fire-bolt');
    assert.equal(resolveNpcSpellRef('invented-spell-xyz'), null);
});

test('filterValidNpcSpells deduplica e ignora inválidas', () => {
    const out = filterValidNpcSpells(['Cure Wounds', 'cure-wounds', 'nope']);
    assert.deepEqual(out, ['cure-wounds']);
});

test('getNpcSpellDisplayName retorna nome SRD', () => {
    ensureNpcSpellCatalog();
    const name = getNpcSpellDisplayName('cure-wounds');
    assert.match(name, /cure|wound/i);
});
