import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLlmJsonText } from '../GameMaster/ai/llmJsonTranslator.js';
import {
    parseWorldNpcBatchJson,
    WORLD_NPC_BATCH_LLM_DICTIONARY,
    WORLD_FACTION_BOOTSTRAP_LLM_DICTIONARY,
    WORLD_ECONOMY_BOOTSTRAP_LLM_DICTIONARY,
    WORLD_PULSE_NARRATOR_LLM_DICTIONARY,
    WORLD_QUEST_SEED_LLM_DICTIONARY,
} from '../GameMaster/ai/llmJsonSchemas.js';

test('parseWorldNpcBatchJson aceita JSON structured direto', () => {
    const raw = JSON.stringify({
        npcs: [
            {
                givenName: 'A',
                roleTitle: 'B',
                role: 'guarda',
                description: 'Descrição longa o suficiente para validar.',
                maxHp: 10,
                atributos: {
                    forca: 10,
                    destreza: 10,
                    constituicao: 10,
                    inteligencia: 10,
                    sabedoria: 10,
                    carisma: 10,
                },
                characterClass: 'fighter',
                isSpellcaster: false,
            },
        ],
    });
    const parsed = parseWorldNpcBatchJson(raw);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal((parsed.data.npcs as unknown[]).length, 1);
});

test('WORLD_NPC_BATCH traduz resposta com chaves em português', () => {
    const raw = JSON.stringify({
        personagens: [
            {
                givenName: 'Bruna',
                roleTitle: 'Ferreira do Portão',
                role: 'ferreira',
                description: 'Mãos calejadas e olhar atento ao portão leste.',
                goal: 'Vender lâminas confiáveis.',
                maxHp: 14,
            },
            {
                givenName: 'Tomas',
                roleTitle: 'Guarda do Mercado',
                role: 'guarda',
                description: 'Patrulha o mercado ao amanhecer.',
                maxHp: 12,
            },
            {
                givenName: 'Lia',
                roleTitle: 'Mercadora de Especiarias',
                role: 'mercador',
                description: 'Importa especiarias do sul.',
                maxHp: 10,
            },
            {
                givenName: 'Orin',
                roleTitle: 'Escriba da Guilda',
                role: 'escriba',
                description: 'Registra dívidas da guilda.',
                maxHp: 8,
            },
        ],
        clima: 'Fumaça das forjas paira sobre os telhados.',
    });
    const parsed = parseWorldNpcBatchJson(raw);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
        assert.ok(Array.isArray(parsed.data.npcs));
        assert.equal((parsed.data.npcs as unknown[]).length, 4);
    }
});

test('WORLD_FACTION_BOOTSTRAP traduz factionBeats', () => {
    const raw = JSON.stringify({
        faccoes: [
            {
                factionSlug: 'guilda-aventureiros',
                localHeadline: 'Contratos no mural',
                rumor: 'A guilda exige registro antes do pôr do sol.',
            },
        ],
    });
    const parsed = parseLlmJsonText(raw, WORLD_FACTION_BOOTSTRAP_LLM_DICTIONARY);
    assert.equal(parsed.ok, true);
    assert.ok(Array.isArray(parsed.data.factionBeats));
});

test('WORLD_ECONOMY_BOOTSTRAP traduz marketSummary e items', () => {
    const raw = JSON.stringify({
        resumo: 'O mercado está tenso; peles escassas.',
        itens: [
            { itemSlug: 'wolf_pelt', priceNote: 'Caro por causa dos lobos.' },
            { itemSlug: 'iron_ingot', priceNote: 'Ferro abundante.' },
        ],
    });
    const parsed = parseLlmJsonText(raw, WORLD_ECONOMY_BOOTSTRAP_LLM_DICTIONARY);
    assert.equal(parsed.ok, true);
    assert.equal(typeof parsed.data.marketSummary, 'string');
    assert.ok(Array.isArray(parsed.data.items));
});

test('WORLD_PULSE_NARRATOR traduz headline e memoryFacts', () => {
    const raw = JSON.stringify({
        manchete: 'O mercado fecha cedo hoje.',
        batidas: ['Patrulhas dobram.', 'Um mercador sussurra sobre contrabando.'],
        tom: 'grim',
        fatos: ['O contrabando de ervas aumentou na região.'],
    });
    const parsed = parseLlmJsonText(raw, WORLD_PULSE_NARRATOR_LLM_DICTIONARY);
    assert.equal(parsed.ok, true);
    assert.equal(typeof parsed.data.headline, 'string');
    assert.ok(Array.isArray(parsed.data.memoryFacts));
});

test('WORLD_QUEST_SEED traduz quests', () => {
    const raw = JSON.stringify({
        missoes: [
            {
                title: 'Cartas perdidas',
                synopsis: 'Recuperar correspondência na estalagem.',
                questSlug: 'cartas-perdidas',
                regionSlug: 'cidadela-do-aco-luz',
                kind: 'local',
                stageLabel: 'Falar com o estalajadeiro',
            },
        ],
    });
    const parsed = parseLlmJsonText(raw, WORLD_QUEST_SEED_LLM_DICTIONARY);
    assert.equal(parsed.ok, true);
    assert.ok(Array.isArray(parsed.data.quests));
});
