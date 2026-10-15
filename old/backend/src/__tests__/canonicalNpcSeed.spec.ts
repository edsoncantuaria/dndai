import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCanonNpcTarget } from '../GameMaster/world/canonicalNpcSeed.js';
import { buildNpcCombatSheet } from '../GameMaster/world/npcSheet.js';

test('resolveCanonNpcTarget limita entre 1 e 200', () => {
    assert.equal(resolveCanonNpcTarget(20), 20);
    assert.equal(resolveCanonNpcTarget(200), 200);
    assert.equal(resolveCanonNpcTarget(500), 200);
});

test('clérigo tem magias e atributos SRD', () => {
    const sheet = buildNpcCombatSheet({
        role: 'sacerdote',
        tier: 'SECONDARY',
        heroLevel: 3,
        givenName: 'Iria',
        roleTitle: 'Sacerdotisa',
        aiSheet: {
            atributos: {
                forca: 10,
                destreza: 12,
                constituicao: 14,
                inteligencia: 11,
                sabedoria: 16,
                carisma: 13,
            },
            characterClass: 'cleric',
            isSpellcaster: true,
            spells: ['sacred-flame', 'cure-wounds'],
        },
    });
    assert.ok(sheet.worldStats.srdBuild.isSpellcaster);
    assert.ok(sheet.worldStats.srdBuild.spells.length > 0);
    assert.equal(sheet.worldStats.srdBuild.atributos.forca, sheet.worldStats.srdBuild.attributes.strength);
});
