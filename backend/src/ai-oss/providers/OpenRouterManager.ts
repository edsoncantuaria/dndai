import {
    OPENROUTER_CIRCUIT_FAIL_THRESHOLD,
    OPENROUTER_COOLDOWN_MS,
} from '../constants.js';
import { recordOssLatency } from '../telemetry/latencyTracker.js';
import { estimateTokensFromChars } from '../telemetry/ossRedisMetrics.js';
import type { KeyMetricSnapshot } from '../telemetry/requestMetrics.js';

export type OpenRouterKeySlot = {
    id: string;
    apiKey: string;
    totalRequests: number;
    successes: number;
    failures: number;
    rateLimits: number;
    consecutiveFailures: number;
    latencySumMs: number;
    promptTokensTotal: number;
    completionTokensTotal: number;
    cooldownUntil: number;
    lastUsedAt: number;
};

function loadKeysFromEnv(): string[] {
    const keys: string[] = [];
    for (let i = 1; i <= 16; i += 1) {
        const v = process.env[`OPENROUTER_KEY${i}`]?.trim();
        if (v) keys.push(v);
    }
    const bulk = process.env.OPENROUTER_KEYS?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
    const legacy = process.env.OPENROUTER_API_KEYS?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
    return [...new Set([...keys, ...bulk, ...legacy])];
}

function maskKeyId(apiKey: string, index: number): string {
    const tail = apiKey.length >= 8 ? apiKey.slice(-4) : '????';
    return `or-key-${index + 1}-${tail}`;
}

export class OpenRouterManager {
    private slots: OpenRouterKeySlot[] = [];
    private roundRobinIndex = 0;

    constructor(keys?: string[]) {
        const loaded = keys?.length ? keys : loadKeysFromEnv();
        this.slots = loaded.map((apiKey, index) => ({
            id: maskKeyId(apiKey, index),
            apiKey,
            totalRequests: 0,
            successes: 0,
            failures: 0,
            rateLimits: 0,
            consecutiveFailures: 0,
            latencySumMs: 0,
            promptTokensTotal: 0,
            completionTokensTotal: 0,
            cooldownUntil: 0,
            lastUsedAt: 0,
        }));
    }

    get size(): number {
        return this.slots.length;
    }

    hasKeys(): boolean {
        return this.slots.length > 0;
    }

    /**
     * Preferência: pool do servidor se OPENROUTER_PREFER_SERVER_KEYS=true e há slots;
     * senão chave do jogador; senão round-robin do pool.
     */
    resolveApiKey(userKey?: string): string {
        const preferServer = ['1', 'true', 'yes', 'on'].includes(
            (process.env.OPENROUTER_PREFER_SERVER_KEYS ?? 'true').trim().toLowerCase(),
        );
        if (preferServer && this.slots.length) {
            return this.pickSlot().apiKey;
        }
        const trimmed = userKey?.trim();
        if (trimmed) return trimmed;
        if (!this.slots.length) {
            throw new Error(
                'Chave OpenRouter ausente. Defina OPENROUTER_KEY1..N no servidor ou nas Configurações.',
            );
        }
        return this.pickSlot().apiKey;
    }

    private isAvailable(slot: OpenRouterKeySlot, now: number): boolean {
        return slot.cooldownUntil <= now;
    }

    pickSlot(): OpenRouterKeySlot {
        if (!this.slots.length) {
            throw new Error('Nenhuma OPENROUTER_KEY configurada no servidor.');
        }
        const now = Date.now();
        const available = this.slots.filter(s => this.isAvailable(s, now));
        const pool = available.length ? available : this.slots;
        const slot = pool[this.roundRobinIndex % pool.length];
        this.roundRobinIndex = (this.roundRobinIndex + 1) % pool.length;
        return slot;
    }

    /** Próxima key para retry após falha (evita mesma key se houver alternativa). */
    pickAlternateKey(failedKeyId: string): string {
        const now = Date.now();
        const candidates = this.slots.filter(
            s => s.id !== failedKeyId && this.isAvailable(s, now),
        );
        if (!candidates.length) {
            return this.pickSlot().apiKey;
        }
        const slot = candidates[this.roundRobinIndex % candidates.length];
        this.roundRobinIndex += 1;
        return slot.apiKey;
    }

    recordSuccess(
        keyId: string,
        latencyMs: number,
        usage?: { promptTokens?: number; completionTokens?: number; promptChars?: number; completionChars?: number },
    ): void {
        const slot = this.slots.find(s => s.id === keyId);
        if (!slot) return;
        slot.totalRequests += 1;
        slot.successes += 1;
        slot.consecutiveFailures = 0;
        slot.latencySumMs += latencyMs;
        slot.lastUsedAt = Date.now();
        recordOssLatency(keyId, latencyMs);
        const promptTok =
            usage?.promptTokens ??
            (usage?.promptChars ? estimateTokensFromChars(usage.promptChars) : 0);
        const completionTok =
            usage?.completionTokens ??
            (usage?.completionChars ? estimateTokensFromChars(usage.completionChars) : 0);
        slot.promptTokensTotal += promptTok;
        slot.completionTokensTotal += completionTok;
        const tokenEstimate = promptTok + completionTok;
        void import('../telemetry/ossRedisMetrics.js').then(m =>
            m.recordOssRequestInRedis(keyId, true, tokenEstimate),
        );
    }

    recordFailure(
        keyId: string,
        opts: { rateLimit?: boolean; latencyMs?: number; promptChars?: number },
    ): void {
        const slot = this.slots.find(s => s.id === keyId);
        if (!slot) return;
        slot.totalRequests += 1;
        slot.failures += 1;
        slot.consecutiveFailures += 1;
        if (opts.latencyMs) {
            slot.latencySumMs += opts.latencyMs;
            recordOssLatency(keyId, opts.latencyMs);
        }
        slot.lastUsedAt = Date.now();
        if (opts.rateLimit) {
            slot.rateLimits += 1;
            slot.cooldownUntil = Date.now() + OPENROUTER_COOLDOWN_MS;
        } else if (slot.consecutiveFailures >= OPENROUTER_CIRCUIT_FAIL_THRESHOLD) {
            slot.cooldownUntil = Date.now() + OPENROUTER_COOLDOWN_MS;
        }
        const tokenEstimate = opts.promptChars ? estimateTokensFromChars(opts.promptChars) : 0;
        void import('../telemetry/ossRedisMetrics.js').then(m =>
            m.recordOssRequestInRedis(keyId, false, tokenEstimate),
        );
    }

    findSlotIdByApiKey(apiKey: string): string | null {
        return this.slots.find(s => s.apiKey === apiKey)?.id ?? null;
    }

    getMetricsSnapshot(): KeyMetricSnapshot[] {
        const now = Date.now();
        return this.slots.map(slot => {
            const avgLatencyMs =
                slot.successes > 0 ? Math.round(slot.latencySumMs / slot.successes) : 0;
            const failRate = slot.totalRequests > 0 ? slot.failures / slot.totalRequests : 0;
            const healthScore = Math.max(
                0,
                Math.min(100, Math.round(100 - failRate * 60 - slot.rateLimits * 10)),
            );
            return {
                keyId: slot.id,
                totalRequests: slot.totalRequests,
                successes: slot.successes,
                failures: slot.failures,
                rateLimits: slot.rateLimits,
                avgLatencyMs,
                promptTokensTotal: slot.promptTokensTotal,
                completionTokensTotal: slot.completionTokensTotal,
                lastUsedAt: slot.lastUsedAt ? new Date(slot.lastUsedAt).toISOString() : null,
                cooldownUntil:
                    slot.cooldownUntil > now ? new Date(slot.cooldownUntil).toISOString() : null,
                healthScore,
            };
        });
    }
}

let singleton: OpenRouterManager | null = null;

export function getOpenRouterManager(): OpenRouterManager {
    if (!singleton) singleton = new OpenRouterManager();
    return singleton;
}

export function resetOpenRouterManagerForTests(keys?: string[]): OpenRouterManager {
    singleton = new OpenRouterManager(keys);
    return singleton;
}
