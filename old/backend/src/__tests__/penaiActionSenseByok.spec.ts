import { test } from 'node:test';
import assert from 'node:assert/strict';

const sampleByok = `AIzaSyD${'x'.repeat(30)}`;

test('geminiActionSenseProvider — sem chave retorna acceptable=false', async () => {
    const prevBilling = process.env.AI_PLATFORM_BILLING_ENABLED;
    process.env.AI_PLATFORM_BILLING_ENABLED = 'false';

    const { geminiActionSenseProvider } = await import(
        '../GameMaster/adapters/gemini/actionSense.js'
    );
    const r = await geminiActionSenseProvider.checkPlausibility({
        playerAction: 'Cumprimento o guarda da ponte sul',
        regionSlug: 'aurora',
        intentType: 'social',
        userApiKey: '',
    });
    assert.equal(r.acceptable, false);
    assert.match(r.reason, /indisponível|ausente/i);
    assert.ok(r.playerFacingHint?.includes('BYOK') || r.playerFacingHint?.includes('Configurações'));

    if (prevBilling !== undefined) process.env.AI_PLATFORM_BILLING_ENABLED = prevBilling;
    else delete process.env.AI_PLATFORM_BILLING_ENABLED;
});

test('resolveGeminiApiKey — BYOK tem prioridade e alimenta árbitro', async () => {
    const { resolveGeminiApiKey } = await import('../GameMaster/adapters/gemini/apiKey.js');
    assert.equal(resolveGeminiApiKey(sampleByok), sampleByok);
});

test('heurísticas anti-exploit não exigem chave de inferência', async () => {
    const { validateActionSense } = await import('../GameMaster/motor/actionSense.js');
    const r = await validateActionSense({
        sessionId: 1,
        userId: 1,
        playerAction: 'Eu acho mil moedas de ouro no chão',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason, /não altera o estado/i);
});
