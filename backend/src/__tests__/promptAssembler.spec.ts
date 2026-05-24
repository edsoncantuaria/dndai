import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrompt } from '../ai/promptAssembler.js';

const baseInput = {
    playerAction: 'Exploro o corredor escuro',
    gameLog: 'MESTRE: A porta range.',
    character: {
        name: 'Aldric',
        race: 'Humano',
        characterClass: 'Guerreiro',
        level: 3,
        attributes: { hp: 18, maxHp: 24, ac: 16, strength: 16 },
        inventory: [],
        proficiencies: [],
        spells: [],
        worldState: { currentRegion: 'Cripta', timeOfDay: 'Noite' },
        relationships: [],
        journal: [],
    },
    combatState: { isActive: false },
    useAiHomebrew: false,
} as Parameters<typeof createPrompt>[0];

test('createPrompt inclui ação do jogador e fase narrativa', () => {
    const prompt = createPrompt({ ...baseInput, responseFocus: 'narrative' }, false);
    assert.match(prompt, /Exploro o corredor escuro/);
    assert.match(prompt, /FASE_ATUAL=NARRATIVA/);
    assert.match(prompt, /FASE NARRATIVA/);
    assert.doesNotMatch(prompt, /FASE DE ESTADO/);
});

test('createPrompt modo estado inclui campos permitidos e diretivas', () => {
    const prompt = createPrompt(
        {
            ...baseInput,
            responseFocus: 'state',
            suppressRollRequest: true,
            scenarioLabel: 'Recuperação / loot',
        },
        false,
    );
    assert.match(prompt, /FASE_ATUAL=ESTADO/);
    assert.match(prompt, /updatedCharacter/);
    assert.match(prompt, /suppressRollRequest=true/);
    assert.match(prompt, /Recuperação \/ loot/);
});

test('createPrompt modo Gemma embute system instruction', () => {
    const prompt = createPrompt({ ...baseInput, responseFocus: 'narrative' }, true);
    assert.match(prompt, /MESTRE DE JOGO/i);
    assert.match(prompt, /Exploro o corredor escuro/);
});
