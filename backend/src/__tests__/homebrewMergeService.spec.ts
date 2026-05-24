import test from 'node:test';
import assert from 'node:assert/strict';
import {
    applyTranslationOverlay,
    applyForkOverlay,
    mergeOfficialWithHomebrew,
    resolveOfficialIndex,
    deepMergeSrd,
} from '../services/homebrewMergeService.js';

const officialSpell = {
    index: 'fireball',
    name: 'Fireball',
    desc: ['A bright streak flashes.'],
    level: 3,
    school: { index: 'evocation', name: 'Evocation' },
    casting_time: '1 action',
    range: '150 feet',
    duration: 'Instantaneous',
    components: ['V', 'S', 'M'],
};

test('applyTranslationOverlay mantém mecânicas e traduz name/desc', () => {
    const translation = {
        name: 'Bola de Fogo',
        desc: ['Um clarão luminoso.'],
        locale: 'pt-BR',
    };
    const merged = applyTranslationOverlay(officialSpell, translation, 'spells');
    assert.equal(merged.name, 'Bola de Fogo');
    assert.equal(merged.level, 3);
    assert.equal(merged.index, 'fireball');
    assert.equal(merged.official_index, 'fireball');
    assert.equal(merged._source, 'translation');
});

test('applyForkOverlay permite index novo e merge profundo', () => {
    const fork = {
        index: 'fireball-supreme',
        name: 'Supreme Fireball',
        level: 4,
    };
    const merged = applyForkOverlay(officialSpell, fork);
    assert.equal(merged.index, 'fireball-supreme');
    assert.equal(merged.level, 4);
    assert.equal(merged.official_index, 'fireball');
    assert.equal(merged._forkedFrom, 'fireball');
    assert.equal(merged._source, 'fork');
});

test('mergeOfficialWithHomebrew original não mescla com oficial', () => {
    const original = { index: 'solar-blade', name: 'Solar Blade' };
    const merged = mergeOfficialWithHomebrew(officialSpell, original, 'original', 'spells');
    assert.equal(merged.name, 'Solar Blade');
    assert.equal(merged._source, 'original');
});

test('resolveOfficialIndex usa sourceIndex e official_index', () => {
    assert.equal(resolveOfficialIndex({ index: 'x' }, { sourceIndex: 'Elf' }), 'elf');
    assert.equal(resolveOfficialIndex({ official_index: 'Fireball' }), 'fireball');
    assert.equal(resolveOfficialIndex({ index: 'custom-race' }, { sourceKind: 'original' }), 'custom-race');
});

test('deepMergeSrd mescla objetos aninhados', () => {
    const base = { a: 1, nested: { x: 1, y: 2 } };
    const patch = { nested: { y: 9, z: 3 } };
    const merged = deepMergeSrd(base, patch);
    assert.deepEqual(merged, { a: 1, nested: { x: 1, y: 9, z: 3 } });
});
