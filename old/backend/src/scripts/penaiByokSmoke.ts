/**
 * Smoke BYOK — persistência de chave no PenaiUser e resolução para inferência.
 *
 * Uso: npm run penai:smoke:byok --prefix backend
 */
import assert from 'node:assert/strict';

const sampleKey = `AIzaSyD${'x'.repeat(30)}`;

async function main() {
    if (!process.env.DATABASE_URL) {
        const { buildAiAccessStatus } = await import('../services/aiBillingService.js');
        const status = buildAiAccessStatus({ aiCreditsRemaining: 30, aiCreditsUsed: 0 }, sampleKey);
        assert.equal(status.canInfer, true);
        assert.equal(status.hasByok, true);
        console.log('[penai:smoke:byok] OK — buildAiAccessStatus BYOK (offline)');
        console.log('[penai:smoke:byok] DATABASE_URL ausente — pulando integração Postgres');
        return;
    }

    const { ensurePenaiTestDb } = await import('../__tests__/helpers/penaiTestDb.js');
    const ready = await ensurePenaiTestDb();
    if (!ready) {
        const { buildAiAccessStatus } = await import('../services/aiBillingService.js');
        const status = buildAiAccessStatus({ aiCreditsRemaining: 30, aiCreditsUsed: 0 }, sampleKey);
        assert.equal(status.canInfer, true);
        console.log('[penai:smoke:byok] OK — buildAiAccessStatus BYOK (Postgres indisponível)');
        return;
    }

    const { registerPenaiUser } = await import('../GameMaster/auth/penaiAuthService.js');
    const { updatePenaiUserSettings, getPenaiUserMe } = await import(
        '../GameMaster/auth/penaiUserService.js'
    );
    const { resolvePenaiInferenceApiKey } = await import(
        '../GameMaster/auth/penaiAiBillingService.js'
    );

    const suffix = Date.now();
    const user = await registerPenaiUser({
        username: `smoke${suffix}`,
        email: `smoke${suffix}@example.com`,
        password: 'secret123',
    });
    await updatePenaiUserSettings(user.id, { apiKey: sampleKey });
    const me = await getPenaiUserMe(user.id);
    assert.equal((me as { apiKey?: string }).apiKey, undefined);
    assert.equal(me.aiAccess?.canInfer, true);
    const resolved = await resolvePenaiInferenceApiKey(user.id);
    assert.equal(resolved, sampleKey);

    const { resolveGeminiApiKey } = await import('../GameMaster/adapters/gemini/apiKey.js');
    assert.equal(resolveGeminiApiKey(sampleKey), sampleKey);

    console.log(
        '[penai:smoke:byok] OK — BYOK persiste, /me omite chave, inferência e árbitro usam mesma resolução',
    );
}

main().catch(err => {
    console.error('[penai:smoke:byok] FALHOU:', err);
    process.exit(1);
});
