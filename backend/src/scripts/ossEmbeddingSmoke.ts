/**
 * Smoke: embeddings OpenRouter (nemotron) + dimensão Qdrant.
 * Uso: npm run ai:oss-embedding-smoke
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../.env') });
config({ path: resolve(process.cwd(), '.env') });
import { embedText } from '../services/embeddingService.js';
import { isOpenRouterEmbeddingEnabled } from '../ai-oss/providers/openRouterEmbeddings.js';
import { OSS_EMBEDDING_DIMENSION } from '../ai-oss/constants.js';

const run = async () => {
    if (!isOpenRouterEmbeddingEnabled()) {
        console.error('[oss-embedding-smoke] AI_EMBEDDING_PROVIDER ou chaves OR ausentes.');
        process.exit(1);
    }

    const vector = await embedText('O herói entra na taverna e observa o salão.');
    const expected = Number(process.env.QDRANT_VECTOR_SIZE) || OSS_EMBEDDING_DIMENSION;

    console.log('[oss-embedding-smoke] dimensão:', vector.length);
    console.log('[oss-embedding-smoke] esperado:', expected);
    console.log('[oss-embedding-smoke] preview:', vector.slice(0, 4).map(n => n.toFixed(4)));

    if (vector.length !== expected) {
        console.warn(
            `[oss-embedding-smoke] AVISO: ajuste QDRANT_VECTOR_SIZE=${vector.length} no .env se usar Qdrant.`,
        );
    }

    if (!vector.length) {
        process.exit(1);
    }
};

run().catch(err => {
    console.error(err);
    process.exit(1);
});
