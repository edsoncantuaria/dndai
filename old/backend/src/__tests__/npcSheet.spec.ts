import test from 'node:test';
import assert from 'node:assert/strict';
import {
    archetypeFromRole,
    buildNpcCombatSheet,
    npcLevelForTier,
    resolveMainWeapon,
} from '../GameMaster/world/npcSheet.js';

test('npcLevelForTier escala com herói e tier', () => {
    assert.equal(npcLevelForTier(5, 'INCIDENTAL'), 3);
    assert.equal(npcLevelForTier(5, 'SECONDARY'), 5);
    assert.equal(npcLevelForTier(5, 'MAJOR'), 7);
});

test('ferreiro recebe maça; guarda lança', () => {
    const smith = resolveMainWeapon('artesão ferreiro', 'SECONDARY');
    assert.equal(smith.itemKey, 'mace');
    const guard = resolveMainWeapon('guarda do portão', 'SECONDARY');
    assert.equal(guard.itemKey, 'spear');
});

test('MAJOR pode ganhar arma mágica +1', () => {
    const w = resolveMainWeapon('capitão da guarda', 'MAJOR');
    assert.equal(w.itemData.magical, true);
    assert.match(w.itemKey, /plus1$/);
});

test('buildNpcCombatSheet aplica ficha gerada pela IA', () => {
    const sheet = buildNpcCombatSheet({
        role: 'sacerdote',
        tier: 'SECONDARY',
        heroLevel: 3,
        givenName: 'Elara',
        roleTitle: 'Curandeira do Templo',
        suggestedMaxHp: 16,
        aiSheet: {
            atributos: {
                forca: 10,
                destreza: 12,
                constituicao: 14,
                inteligencia: 11,
                sabedoria: 16,
                carisma: 13,
            },
            level: 3,
            armorClass: 14,
            characterClass: 'cleric',
            isSpellcaster: true,
            spells: ['sacred-flame', 'cure-wounds'],
            mainWeaponSlug: 'mace',
        },
    });
    assert.equal(sheet.worldStats.srdBuild.characterClass, 'cleric');
    assert.equal(sheet.worldStats.srdBuild.atributos.sabedoria, 16);
    assert.deepEqual(sheet.worldStats.srdBuild.spells, ['sacred-flame', 'cure-wounds']);
    assert.equal(sheet.worldStats.mainWeapon.itemKey, 'mace');
    assert.equal(sheet.worldStats.srdBuild.ac, 14);
});

test('buildNpcCombatSheet persiste srdBuild e inventário bootstrap', () => {
    const sheet = buildNpcCombatSheet({
        role: 'artesão',
        tier: 'SECONDARY',
        heroLevel: 4,
        homeRegion: 'cidadela-do-acoluz',
        givenName: 'Uldric',
        roleTitle: 'Mestre da Forja',
        suggestedMaxHp: 18,
    });
    assert.equal(sheet.worldStats.level, 4);
    assert.equal(sheet.worldStats.givenName, 'Uldric');
    assert.equal(sheet.worldStats.vidaMax, 18);
    assert.equal(sheet.worldStats.vida, 18);
    assert.equal(sheet.sessionSnapshot.displayName, 'Uldric, Mestre da Forja');
    assert.equal(sheet.worldStats.srdBuild.atributos.forca, sheet.worldStats.srdBuild.attributes.strength);
    assert.equal(sheet.initialOverlay.inventory[0].equipped, true);
    assert.equal(archetypeFromRole('guarda'), 'guard');
});
