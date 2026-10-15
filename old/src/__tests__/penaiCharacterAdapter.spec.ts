import test from 'node:test';
import assert from 'node:assert/strict';
import { mechanicalPackToCharacter } from '../lib/penaiCharacterAdapter.js';

test('mechanicalPackToCharacter preserva spells do pack', () => {
    const character = mechanicalPackToCharacter(42, 1, {
        character: {
            id: 'hero-uuid',
            name: 'Elara',
            level: 1,
            hp: 8,
            maxHp: 8,
            ac: 14,
            spells: ['fire-bolt', 'mage-hand'],
            race: 'Elf',
            subrace: 'High Elf',
            characterClass: 'Wizard',
            attributes: {
                strength: 8,
                dexterity: 14,
                constitution: 12,
                intelligence: 16,
                wisdom: 10,
                charisma: 10,
            },
            inventory: [],
        },
        worldState: { currentRegion: 'Torre' },
    });

    assert.deepEqual(character.spells, ['fire-bolt', 'mage-hand']);
    assert.equal(character.race, 'Elf');
    assert.equal(character.subrace, 'High Elf');
    assert.equal(character.characterClass, 'Wizard');
    assert.equal(character.attributes.intelligence, 16);
    assert.equal(character.modifiers.intelligence, 3);
});

test('mechanicalPackToCharacter não zera spells quando array vazio explícito', () => {
    const character = mechanicalPackToCharacter(1, 1, {
        character: { name: 'Test', spells: [], hp: 10, maxHp: 10, ac: 10 },
    });
    assert.deepEqual(character.spells, []);
});
