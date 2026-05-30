export type {
    NarrationProvider,
    NarrationResult,
    EmbeddingProvider,
    ActionSenseProvider,
    PlausibilityResult,
    VectorStore,
    VectorSearchHit,
} from './contracts.js';

export { geminiNarrationProvider, renderNarrationPtBr } from './gemini/narration.js';
export { geminiEmbeddingProvider, embedText, embedTextGemini, isGeminiEmbeddingEnabled } from './gemini/embeddings.js';
export { geminiActionSenseProvider, checkActionPlausibilityGemini } from './gemini/actionSense.js';
export { resolveGeminiApiKey, hasResolvableGeminiKey, isGoogleApiKey } from './gemini/apiKey.js';
export {
    qdrantVectorStore,
    COLLECTIONS,
    isPenaiQdrantReady,
    ensurePenaiQdrantCollections,
    upsertPenaiVector,
    searchPenaiVectors,
} from './qdrant/vectorStore.js';

import { geminiNarrationProvider } from './gemini/narration.js';
import { geminiEmbeddingProvider } from './gemini/embeddings.js';
import { geminiActionSenseProvider } from './gemini/actionSense.js';
import { qdrantVectorStore } from './qdrant/vectorStore.js';

export const defaultProviders = {
    narration: geminiNarrationProvider,
    embedding: geminiEmbeddingProvider,
    actionSense: geminiActionSenseProvider,
    vectorStore: qdrantVectorStore,
} as const;
