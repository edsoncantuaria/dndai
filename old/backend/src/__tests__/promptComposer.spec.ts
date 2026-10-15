import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildArbiterUserPayload,
    composeSystemPrompt,
    estimatePromptChars,
    inferSceneMode,
    isSessionOpeningRequest,
    slimNarrationPack,
} from '../GameMaster/ai/promptComposer.js';

test('composeSystemPrompt permanece compacto', () => {
    const s = composeSystemPrompt({ role: 'narrator', sceneMode: 'combat' });
    assert.ok(s.length < 320, `system longo demais: ${s.length}`);
    assert.match(s, /Combate/);
});

test('isSessionOpeningRequest — bootstrap e frase canônica', () => {
    assert.equal(isSessionOpeningRequest('A aventura começa. Onde eu estou?'), true);
    assert.equal(
        isSessionOpeningRequest('Ataco o goblin', { bootstrap: true }),
        true,
    );
    assert.equal(isSessionOpeningRequest('Ataco o goblin'), false);
});

test('inferSceneMode — abertura e combate', () => {
    assert.equal(
        inferSceneMode({ playerAction: 'A aventura começa. Onde eu estou?' }),
        'opening',
    );
    assert.equal(inferSceneMode({ combatPhase: 'PLAYER_TURN' }), 'combat');
});

test('slimNarrationPack limita fatos', () => {
    const slim = slimNarrationPack({
        locale: 'pt-BR',
        playerAction: 'x'.repeat(500),
        regionSlug: 'porto',
        entities: Array.from({ length: 10 }, (_, i) => ({
            id: `id-${i}`,
            slug: `e${i}`,
            displayName: `NPC ${i}`,
            entityType: 'npc',
        })),
        npcCast: [],
        ambientWorld: ['Rumor nas redondezas: taverna cheia.'],
        sessionFacts: Array.from({ length: 8 }, (_, i) => `fato ${i} `.repeat(20)),
        canonFacts: [],
        motorHints: ['a', 'b', 'c', 'd'],
    });
    const json = JSON.stringify(slim);
    assert.ok(json.length < 3500, `payload grande: ${json.length}`);
    assert.equal((slim.fatosSessao as string[]).length, 4);
});

test('arbiter payload enxuto', () => {
    const p = buildArbiterUserPayload({
        playerAction: 'examino a porta',
        regionSlug: 'porto',
        intentType: 'free',
        sessionFacts: ['a', 'b', 'c', 'd', 'e'],
    });
    assert.equal((p.fatos as string[]).length, 4);
    assert.ok(estimatePromptChars(composeSystemPrompt({ role: 'arbiter' }), p) < 900);
});
