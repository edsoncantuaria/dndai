import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCompactPromptSections } from '../ai/promptSections.js';

test('buildCompactPromptSections inclui modo combate', () => {
    const text = buildCompactPromptSections({
        playerAction: 'Ataco o goblin',
        character: {
            attributes: { hp: 20, maxHp: 24, ac: 16 },
            conditions: [],
            currentRegion: 'Caverna',
        },
        combatState: { isActive: true, round: 2 },
        stateHints: ['Ataque autorizado pelo motor'],
    } as Parameters<typeof buildCompactPromptSections>[0]);

    assert.match(text, /Combate=ativo/);
    assert.match(text, /Modo=combate/);
    assert.match(text, /Ação=/);
});

test('buildCompactPromptSections inclui memória em camadas', () => {
    const text = buildCompactPromptSections({
        playerAction: 'Exploro a sala',
        character: { attributes: { hp: 10, maxHp: 10 } },
        layeredMemorySummary: 'O grupo encontrou um altar antigo.',
        storySummary: 'Aventura na masmorra.',
    } as Parameters<typeof buildCompactPromptSections>[0]);

    assert.match(text, /MEMÓRIA/);
    assert.match(text, /altar antigo/);
});
