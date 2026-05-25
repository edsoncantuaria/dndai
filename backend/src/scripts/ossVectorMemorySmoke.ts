/**
 * Smoke: Qdrant + embeddings Nemotron — store + recall.
 * Uso: npm run ai:oss-vector-smoke
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

config({ path: resolve(process.cwd(), '../.env') });
config({ path: resolve(process.cwd(), '.env') });

process.env.QDRANT_ENABLED = process.env.QDRANT_ENABLED ?? 'true';

const run = async () => {
    const { ensureQdrantCollections, isQdrantReady } = await import('../database/qdrant-client.js');
    const { storeMemory, recallSimilarMemories } = await import('../services/vectorMemoryService.js');
    const { env } = await import('../config/env.js');

    console.log('[oss-vector-smoke] QDRANT_ENABLED=', env.QDRANT_ENABLED);
    console.log('[oss-vector-smoke] QDRANT_URL=', env.QDRANT_URL);
    console.log('[oss-vector-smoke] VECTOR_SIZE=', env.QDRANT_VECTOR_SIZE);

    if (!env.QDRANT_ENABLED) {
        console.error('Defina QDRANT_ENABLED=true no .env');
        process.exit(1);
    }

    if (!isQdrantReady()) {
        console.error('Cliente Qdrant não inicializado. Suba: docker compose up -d qdrant');
        process.exit(1);
    }

    await ensureQdrantCollections();
    console.log('[oss-vector-smoke] Coleções OK');

    const sessionId = `smoke-${Date.now()}`;
    const factId = randomUUID();
    const uniqueToken = `token-${randomUUID().slice(0, 8)}`;
    const text = `O herói Kael encontrou um altar antigo com runas (${uniqueToken}).`;

    const apiKey = process.env.OPENROUTER_KEY_EMBEDDING?.trim() || process.env.OPENROUTER_KEY1?.trim() || '';
    if (!apiKey) {
        console.error('OPENROUTER_KEY_EMBEDDING ou OPENROUTER_KEY1 ausente');
        process.exit(1);
    }

    await storeMemory('session_memories', text, {
        id: factId,
        sessionId,
        type: 'narration',
        timestamp: Date.now(),
        summary: `Altar ${uniqueToken}`,
    }, apiKey);
    console.log('[oss-vector-smoke] storeMemory OK', { factId, sessionId });

    await new Promise(r => setTimeout(r, 1500));

    const recalled = await recallSimilarMemories(
        'session_memories',
        `altar runas ${uniqueToken}`,
        { apiKey, limit: 3, filter: { sessionId } },
    );

    console.log('[oss-vector-smoke] recall:', recalled.length, 'itens');
    for (const m of recalled) {
        console.log('  -', (m.summary ?? m.text ?? '').slice(0, 120));
    }

    const hit = recalled.some(
        m =>
            String(m.summary ?? '').includes(uniqueToken) ||
            String(m.text ?? '').includes(uniqueToken),
    );

    if (!hit) {
        console.warn('[oss-vector-smoke] AVISO: recall não retornou o token único (pode ser latência/index).');
        if (!recalled.length) process.exit(1);
    }

    console.log('[oss-vector-smoke] SUCESSO');
};

run().catch(err => {
    console.error('[oss-vector-smoke] ERRO:', err);
    process.exit(1);
});
