import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNewFact, formatFactsForPrompt } from '../services/sessionFactService.js';
import { formatRegionGraphSummary } from '../narration/regionContext.js';
import { NarrativePhaseResponseSchema } from '../schemas/gameSchemas.js';

test('validateNewFact rejeita fato com alteração de HP', () => {
    const result = validateNewFact({
        category: 'general',
        fact: 'O goblin perdeu 5 HP.',
    });
    assert.equal(result.ok, false);
});

test('validateNewFact aceita fato narrativo válido', () => {
    const result = validateNewFact({
        category: 'npc',
        subject: 'Mira',
        fact: 'Mira confia no grupo após salvar a taverna.',
        npcId: 'mira-taverneira',
    });
    assert.equal(result.ok, true);
});

test('formatFactsForPrompt formata lista', () => {
    const text = formatFactsForPrompt([
        {
            id: '1',
            category: 'region',
            subject: 'Floresta',
            fact: 'Uma névoa permanente cobre os trilhos.',
            regionSlug: 'floresta',
            npcId: null,
            questId: null,
            source: 'ai',
            isActive: true,
            sessaoId: 1,
            characterId: null,
            createdAt: new Date(),
        } as any,
    ]);
    assert.match(text, /Floresta/);
});

test('formatRegionGraphSummary inclui POIs conhecidos e ocultos', () => {
    const summary = formatRegionGraphSummary({
        slug: 'vila',
        name: 'Vila Norte',
        type: 'settlement',
        summary: 'Uma vila pacata.',
        pointsOfInterest: [
            { slug: 'taverna', name: 'Taverna', type: 'social', isLocked: false, isDiscovered: true },
            { slug: 'moinho', name: 'Moinho', type: 'landmark', isLocked: false, isDiscovered: false },
        ],
    });
    assert.match(summary, /POIs conhecidos/);
    assert.match(summary, /POIs não visitados/);
});

test('NarrativePhaseResponseSchema aceita newFacts opcionais', () => {
    const parsed = NarrativePhaseResponseSchema.parse({
        logEntries: [{ type: 'narration', content: 'Teste' }, { type: 'system', content: 'Ok' }],
        actionOptions: ['A', 'B', 'C'],
        newFacts: [{ category: 'general', fact: 'O taverneiro reconhece o herói.' }],
    });
    assert.equal(parsed.newFacts?.length, 1);
});
