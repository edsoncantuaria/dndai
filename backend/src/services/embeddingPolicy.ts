/**
 * Política de cota para embeddings OpenRouter (~50 req/dia).
 * Recall/store de turno são limitados; journal novo sempre pode embedar.
 */
import { AppDataSource } from '../database/data-source.js';
import { SessionFact } from '../entities/SessionFact.js';

export type EmbeddingOperation = 'recall' | 'store_turn' | 'store_journal';

function envInt(name: string, fallback: number): number {
    const n = Number(process.env[name]);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function embeddingPolicyConfig() {
    return {
        recallEveryTurns: Math.max(1, envInt('OSS_EMBED_RECALL_EVERY_TURNS', 2)),
        storeEveryTurns: Math.max(1, envInt('OSS_EMBED_STORE_EVERY_TURNS', 2)),
        skipRecallIfFactsAtLeast: envInt('OSS_EMBED_SKIP_RECALL_IF_FACTS_GE', 8),
        enabled: !['0', 'false', 'no', 'off'].includes(
            (process.env.OSS_EMBED_POLICY_ENABLED ?? 'true').trim().toLowerCase(),
        ),
    };
}

export async function countActiveSessionFacts(sessaoId: number): Promise<number> {
    if (!AppDataSource.isInitialized) return 0;
    try {
        return AppDataSource.getRepository(SessionFact).count({
            where: { sessaoId, isActive: true },
        });
    } catch {
        return 0;
    }
}

/** Turno N do stateVersion (0 = primeiro turno após carga). */
export function shouldEmbedForOperation(
    operation: EmbeddingOperation,
    stateVersion: number,
    activeFactCount: number,
): boolean {
    const cfg = embeddingPolicyConfig();
    if (!cfg.enabled) return true;
    if (operation === 'store_journal') return true;

    const version = Math.max(0, Math.floor(stateVersion));
    if (operation === 'recall') {
        if (activeFactCount >= cfg.skipRecallIfFactsAtLeast) return false;
        return version % cfg.recallEveryTurns === 0;
    }
    if (operation === 'store_turn') {
        return version % cfg.storeEveryTurns === 0;
    }
    return true;
}

export function embeddingPolicyNote(
    operation: EmbeddingOperation,
    stateVersion: number,
    activeFactCount: number,
): string | null {
    if (shouldEmbedForOperation(operation, stateVersion, activeFactCount)) return null;
    if (operation === 'recall') {
        if (activeFactCount >= embeddingPolicyConfig().skipRecallIfFactsAtLeast) {
            return `[Memória] Recall vetorial omitido (${activeFactCount} fatos SQL ativos).`;
        }
        return `[Memória] Recall vetorial neste turno (política a cada ${embeddingPolicyConfig().recallEveryTurns} turnos).`;
    }
    return `[Memória] Indexação vetorial do turno adiada (política a cada ${embeddingPolicyConfig().storeEveryTurns} turnos).`;
}
