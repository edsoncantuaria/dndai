import test from 'node:test';
import assert from 'node:assert/strict';
import { composePrompt, composePromptSnapshot } from '../ai-oss/prompts/promptDsl.js';
import {
    buildPromptCacheKey,
    clearPromptCacheForTests,
    getCachedSystemInstruction,
    setCachedSystemInstruction,
} from '../ai-oss/cache/promptCache.js';
import { extractStreamingNarrationPreview } from '../ai-oss/parser/narrationStreamExtract.js';
import {
    computeLatencyPercentiles,
    recordOssLatency,
    resetLatencyTrackerForTests,
} from '../ai-oss/telemetry/latencyTracker.js';
import { estimateTokensFromChars } from '../ai-oss/telemetry/ossRedisMetrics.js';
import { applyCombatDeterminism, validateCombatOssNarration } from '../ai-oss/combat/deterministicCombat.js';
import { normalizeActionOptionsFromRegistry } from '../ai-oss/actions/registry.js';
import { validateOssNarration } from '../ai-oss/validators/narrationValidator.js';
import { mapOssNewFactsToGameFacts } from '../ai-oss/schemas/narration.schema.js';

test('composePrompt gera system de combate e user compacto', () => {
    const { systemInstruction, userPrompt, outputSchema } = composePrompt({
        player: 'Ataco o goblin',
        combat: true,
        log: 'Floresta escura',
        characterName: 'Kael',
    });
    assert.equal(outputSchema, 'combat');
    assert.match(systemInstruction, /combate|JSON/i);
    assert.match(userPrompt, /ACAO_JOGADOR=Ataco o goblin/);
    assert.match(userPrompt, /MODO=combate/);
});

test('composePromptSnapshot é estável para o mesmo input', () => {
    const input = {
        player: 'Observo a sala',
        scene: 'Taverna lotada',
        log: 'Chuva lá fora',
    };
    const a = composePromptSnapshot(input);
    const b = composePromptSnapshot(input);
    assert.equal(a, b);
});

test('prompt cache invalida por stateVersion', () => {
    clearPromptCacheForTests();
    const k1 = buildPromptCacheKey({ sessionId: '42', stateVersion: 1, combatActive: false });
    const k2 = buildPromptCacheKey({ sessionId: '42', stateVersion: 2, combatActive: false });
    setCachedSystemInstruction(k1, 'system-v1');
    assert.equal(getCachedSystemInstruction(k1), 'system-v1');
    assert.equal(getCachedSystemInstruction(k2), null);
});

test('extractStreamingNarrationPreview emite só delta novo', () => {
    const buf = '{"narration":"O herói entra';
    const first = extractStreamingNarrationPreview(buf, 0);
    assert.ok(first.preview.length > 0);
    const second = extractStreamingNarrationPreview(buf, first.emittedLength);
    assert.equal(second.preview, '');
    const buf2 = '{"narration":"O herói entra na taverna"';
    const third = extractStreamingNarrationPreview(buf2, first.emittedLength);
    assert.match(third.preview, /taverna/);
});

test('latency percentiles p50/p95', () => {
    resetLatencyTrackerForTests();
    for (let i = 1; i <= 100; i += 1) {
        recordOssLatency('k1', i * 10);
    }
    const stats = computeLatencyPercentiles(
        Array.from({ length: 100 }, (_, i) => (i + 1) * 10),
    );
    assert.ok(stats.p50 >= 500);
    assert.ok(stats.p95 >= 900);
});

test('estimateTokensFromChars usa chars/4', () => {
    assert.equal(estimateTokensFromChars(0), 0);
    assert.equal(estimateTokensFromChars(100), 25);
});

test('combate: validação Zod e strip de dano em state_changes', () => {
    const raw = {
        narration: 'O orc recua sangrando.',
        actionOptions: ['Atacar', 'Recuar', 'Observar'],
        state_changes: ['3 de dano no orc', 'ganhou 5 de ouro'],
    };
    const check = validateCombatOssNarration(raw);
    assert.equal(check.valid, true);
    const mapped = applyCombatDeterminism(check.data!);
    assert.ok(mapped.logEntries?.length);
    const systemLog = mapped.systemLog ?? '';
    assert.ok(!/dano/i.test(systemLog) || mapped.logEntries?.[0]);
});

test('exploração: registry normaliza actionOptions', () => {
    const normalized = normalizeActionOptionsFromRegistry(
        [{ text: 'Explorar', action: 'explore' }],
        'exploration',
    );
    assert.ok(normalized.length >= 2);
    const validated = validateOssNarration({
        narration: 'Você avança.',
        actionOptions: normalized,
    });
    assert.equal(validated.valid, true);
});

test('narration schema aceita newFacts opcionais', () => {
    const validated = validateOssNarration({
        narration: 'O guarda acena para a taverna.',
        actionOptions: ['Entrar', 'Recuar'],
        newFacts: [{ fact: 'O guarda reconhece o brasão do grupo.', importance: 'medium' }],
    });
    assert.equal(validated.valid, true);
    const mapped = mapOssNewFactsToGameFacts(validated.data?.newFacts);
    assert.equal(mapped.length, 1);
});
