import test from 'node:test';
import assert from 'node:assert/strict';
import {
    detectPromptPhase,
    buildPhaseTemplateHint,
} from '../ai-oss/prompts/phaseTemplates.js';
import {
    resolveOssTemperature,
    suggestProfileFromBenchmarkReport,
    resetTemperatureProfileCacheForTests,
} from '../ai-oss/tuning/temperatureProfile.js';
import { isOssJsonOnlyRepairEnabled } from '../ai-oss/parser/jsonOnlyRepair.js';
import {
    isOpenRouterEmbeddingEnabled,
    resolveOpenRouterEmbeddingModel,
} from '../ai-oss/providers/openRouterEmbeddings.js';
import { OSS_EMBEDDING_DIMENSION, OSS_EMBEDDING_MODEL } from '../ai-oss/constants.js';
import { defaultInferenceProviderId } from '../ai-oss/providers/providerRegistry.js';

test('detectPromptPhase identifica combate e social', () => {
    assert.equal(
        detectPromptPhase({ playerAction: 'Ataco o goblin', combatActive: true }),
        'combat',
    );
    assert.equal(
        detectPromptPhase({ playerAction: 'Tento convencer o guarda a nos deixar passar' }),
        'social',
    );
    assert.equal(detectPromptPhase({ playerAction: 'Exploro o corredor' }), 'exploration');
});

test('buildPhaseTemplateHint cobre as três fases', () => {
    assert.match(buildPhaseTemplateHint('exploration'), /exploração/i);
    assert.match(buildPhaseTemplateHint('combat'), /combate/i);
    assert.match(buildPhaseTemplateHint('social'), /social|diálogo/i);
});

test('resolveOssTemperature usa defaults por fase', () => {
    resetTemperatureProfileCacheForTests();
    const combat = resolveOssTemperature('combat');
    const social = resolveOssTemperature('social');
    assert.ok(combat.temperature < social.temperature);
});

test('suggestProfileFromBenchmarkReport reduz temp quando pass rate baixo', () => {
    const high = suggestProfileFromBenchmarkReport({
        passRatePercent: 95,
        results: [{ id: 'a', ok: true }],
    });
    const low = suggestProfileFromBenchmarkReport({
        passRatePercent: 50,
        results: [{ id: 'a', ok: false }],
    });
    assert.ok(
        (low.exploration?.temperature ?? 1) <= (high.exploration?.temperature ?? 0),
    );
});

test('embedding model e dimensão padrão nemotron', () => {
    const prev = process.env.OPENROUTER_EMBEDDING_MODEL;
    delete process.env.OPENROUTER_EMBEDDING_MODEL;
    assert.equal(resolveOpenRouterEmbeddingModel(), OSS_EMBEDDING_MODEL);
    assert.equal(OSS_EMBEDDING_DIMENSION, 2048);
    if (prev) process.env.OPENROUTER_EMBEDDING_MODEL = prev;
});

test('json-only repair habilitado por padrão', () => {
    const prev = process.env.OSS_JSON_ONLY_REPAIR;
    delete process.env.OSS_JSON_ONLY_REPAIR;
    assert.equal(isOssJsonOnlyRepairEnabled(), true);
    if (prev !== undefined) process.env.OSS_JSON_ONLY_REPAIR = prev;
});

test('defaultInferenceProviderId respeita AI_PROVIDER', () => {
    const prev = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = 'openrouter';
    assert.equal(defaultInferenceProviderId(), 'openrouter');
    if (prev !== undefined) process.env.AI_PROVIDER = prev;
    else delete process.env.AI_PROVIDER;
});

test('isOpenRouterEmbeddingEnabled com OPENROUTER_KEY_EMBEDDING', () => {
    const prev = [
        process.env.OPENROUTER_KEY_EMBEDDING,
        process.env.AI_EMBEDDING_PROVIDER,
        process.env.AI_OPENROUTER_ONLY,
    ];
    process.env.OPENROUTER_KEY_EMBEDDING = 'sk-test';
    process.env.AI_EMBEDDING_PROVIDER = 'openrouter';
    assert.equal(isOpenRouterEmbeddingEnabled(), true);
    for (let i = 0; i < prev.length; i += 1) {
        const key = ['OPENROUTER_KEY_EMBEDDING', 'AI_EMBEDDING_PROVIDER', 'AI_OPENROUTER_ONLY'][i];
        const val = prev[i];
        if (val === undefined) delete process.env[key];
        else process.env[key] = val;
    }
});
