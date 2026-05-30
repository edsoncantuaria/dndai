export type NarrationResult = {
    narration: string;
    tone?: string;
    beat?: string;
};

export interface NarrationProvider {
    render(contextPack: Record<string, unknown>, opts?: { userApiKey?: string; model?: string }): Promise<NarrationResult>;
}

export interface EmbeddingProvider {
    embed(text: string, userApiKey?: string): Promise<number[]>;
    isEnabled(): boolean;
}

export type PlausibilityResult = {
    acceptable: boolean;
    reason: string;
    playerFacingHint?: string;
};

export interface ActionSenseProvider {
    checkPlausibility(opts: {
        playerAction: string;
        regionSlug: string | null;
        intentType: string;
        sessionFacts?: string[];
    }): Promise<PlausibilityResult>;
}

export type VectorSearchHit = {
    id: string;
    score: number;
    payload: Record<string, unknown>;
};

export interface VectorStore {
    isReady(): boolean;
    ensureCollections(): Promise<void>;
    upsert(
        collection: string,
        pointId: string,
        vector: number[],
        payload: Record<string, unknown>,
    ): Promise<void>;
    search(
        collection: string,
        vector: number[],
        limit: number,
        filter?: Record<string, string | number>,
    ): Promise<VectorSearchHit[]>;
}
