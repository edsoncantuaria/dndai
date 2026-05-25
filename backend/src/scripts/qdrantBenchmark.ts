/**
 * Benchmark Qdrant (self-hosted) + opcionalmente embeddings OpenRouter.
 *
 * Uso:
 *   npm run ai:qdrant-benchmark -- --vectors-only --writes=30
 *   npm run ai:qdrant-benchmark -- --with-embeddings --writes=10
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { createWriteStream } from 'fs';
import { randomUUID } from 'crypto';
import { mkdir } from 'fs/promises';

config({ path: resolve(process.cwd(), '../.env') });
config({ path: resolve(process.cwd(), '.env') });

process.env.QDRANT_ENABLED = process.env.QDRANT_ENABLED ?? 'true';

type PhaseResult = {
    name: string;
    ok: boolean;
    ms?: number;
    detail?: string;
    error?: string;
};

type BenchReport = {
    generatedAt: string;
    qdrantUrl: string;
    vectorSize: number;
    mode: 'vectors-only' | 'with-embeddings' | 'health-only';
    writes: number;
    searches: number;
    phases: PhaseResult[];
    writeLatencyMs: { p50: number; p95: number; max: number };
    searchLatencyMs: { p50: number; p95: number; max: number };
    recallHitRate: number | null;
    embeddingFailures: number;
    recommendation: string;
};

function parseArgs() {
    const vectorsOnly = process.argv.includes('--vectors-only');
    const withEmbeddings = process.argv.includes('--with-embeddings') || !vectorsOnly;
    const writesArg = process.argv.find(a => a.startsWith('--writes='));
    const searchesArg = process.argv.find(a => a.startsWith('--searches='));
    const writes = writesArg ? Number(writesArg.split('=')[1]) : vectorsOnly ? 40 : 12;
    const searches = searchesArg ? Number(searchesArg.split('=')[1]) : vectorsOnly ? 20 : 10;
    const mode: BenchReport['mode'] = vectorsOnly && !process.argv.includes('--with-embeddings')
        ? 'vectors-only'
        : withEmbeddings
          ? 'with-embeddings'
          : 'health-only';
    return { mode, writes, searches, useEmbeddings: mode === 'with-embeddings' };
}

function percentile(sorted: number[], p: number): number {
    if (!sorted.length) return 0;
    const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[Math.max(0, idx)] ?? 0;
}

function stats(samples: number[]) {
    const sorted = [...samples].sort((a, b) => a - b);
    return {
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        max: sorted[sorted.length - 1] ?? 0,
    };
}

function randomVector(dim: number): number[] {
    const v: number[] = [];
    for (let i = 0; i < dim; i += 1) {
        v.push(Math.random() * 2 - 1);
    }
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map(x => x / norm);
}

async function checkHttpHealth(url: string): Promise<PhaseResult> {
    const started = Date.now();
    try {
        const base = url.replace(/\/$/, '');
        const res = await fetch(`${base}/readyz`, { signal: AbortSignal.timeout(5000) });
        const text = await res.text();
        return {
            name: 'http_readyz',
            ok: res.ok,
            ms: Date.now() - started,
            detail: text.trim().slice(0, 80),
        };
    } catch (err) {
        return {
            name: 'http_readyz',
            ok: false,
            ms: Date.now() - started,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

const run = async () => {
    const { mode, writes, searches, useEmbeddings } = parseArgs();
    const vectorSize = Number(process.env.QDRANT_VECTOR_SIZE) || 2048;
    const qdrantUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';

    console.log(`[qdrant-benchmark] modo=${mode} writes=${writes} searches=${searches}`);
    console.log(`[qdrant-benchmark] url=${qdrantUrl} dim=${vectorSize}`);

    const phases: PhaseResult[] = [];
    phases.push(await checkHttpHealth(qdrantUrl));

    const { ensureQdrantCollections, isQdrantReady, qdrant } = await import(
        '../database/qdrant-client.js'
    );
    const { env } = await import('../config/env.js');

    if (!env.QDRANT_ENABLED || !isQdrantReady() || !qdrant) {
        console.error('[qdrant-benchmark] Qdrant desabilitado ou cliente nulo. docker compose up -d qdrant');
        process.exit(1);
    }

    const collStarted = Date.now();
    try {
        await ensureQdrantCollections();
        phases.push({
            name: 'ensure_collections',
            ok: true,
            ms: Date.now() - collStarted,
            detail: 'session_memories, world_memories, npc_profiles',
        });
    } catch (err) {
        phases.push({
            name: 'ensure_collections',
            ok: false,
            ms: Date.now() - collStarted,
            error: err instanceof Error ? err.message : String(err),
        });
        await writeReport({
            generatedAt: new Date().toISOString(),
            qdrantUrl,
            vectorSize,
            mode,
            writes,
            searches,
            phases,
            writeLatencyMs: { p50: 0, p95: 0, max: 0 },
            searchLatencyMs: { p50: 0, p95: 0, max: 0 },
            recallHitRate: null,
            embeddingFailures: 0,
            recommendation: 'Qdrant inacessível — jogo segue sem recall vetorial (backlog SQL).',
        });
        process.exit(1);
    }

    const collection = 'session_memories';
    const sessionId = `bench-${Date.now()}`;
    const apiKey =
        process.env.OPENROUTER_KEY_EMBEDDING?.trim() ||
        process.env.OPENROUTER_KEY1?.trim() ||
        '';

    const stored: Array<{ id: string; token: string; vector: number[] }> = [];
    const writeLatencies: number[] = [];
    let embeddingFailures = 0;

    const { storeMemory, recallSimilarMemories } = await import('../services/vectorMemoryService.js');

    console.log(`[qdrant-benchmark] gravando ${writes} memórias…`);

    for (let i = 0; i < writes; i += 1) {
        const token = `tok-${randomUUID().slice(0, 8)}`;
        const text = `Memória de benchmark ${i}: o herói descobriu ${token} na taverna escura.`;
        const id = randomUUID();
        const started = Date.now();

        try {
            if (useEmbeddings) {
                if (!apiKey) throw new Error('Sem OPENROUTER_KEY_EMBEDDING');
                await storeMemory(collection, text, {
                    id,
                    sessionId,
                    type: 'benchmark',
                    timestamp: Date.now(),
                    summary: `Bench ${token}`,
                }, apiKey);
                stored.push({ id, token, vector: [] });
            } else {
                const vector = randomVector(vectorSize);
                await qdrant.upsert(collection, {
                    wait: true,
                    points: [
                        {
                            id,
                            vector,
                            payload: {
                                id,
                                sessionId,
                                type: 'benchmark',
                                timestamp: Date.now(),
                                text,
                                summary: `Bench ${token}`,
                            },
                        },
                    ],
                });
                stored.push({ id, token, vector });
            }
            writeLatencies.push(Date.now() - started);
            if ((i + 1) % 10 === 0) console.log(`  write ${i + 1}/${writes}`);
        } catch (err) {
            embeddingFailures += 1;
            const msg = err instanceof Error ? err.message : String(err);
            if (/429|rate/i.test(msg)) {
                console.warn(`  [${i}] rate limit embedding — pare benchmark OR`);
                break;
            }
            console.warn(`  [${i}] falha:`, msg);
        }

        if (useEmbeddings && i < writes - 1) {
            await new Promise(r => setTimeout(r, 3500));
        }
    }

    phases.push({
        name: 'writes',
        ok: stored.length > 0,
        detail: `${stored.length}/${writes} ok, embed_fail=${embeddingFailures}`,
    });

    await new Promise(r => setTimeout(r, 800));

    const searchLatencies: number[] = [];
    let recallHits = 0;
    let recallTrials = 0;

    console.log(`[qdrant-benchmark] ${searches} buscas…`);

    for (let i = 0; i < Math.min(searches, stored.length); i += 1) {
        const item = stored[i % stored.length];
        const query = `taverna escura ${item.token}`;
        const started = Date.now();
        recallTrials += 1;

        try {
            if (useEmbeddings && apiKey) {
                const results = await recallSimilarMemories(collection, query, {
                    apiKey,
                    limit: 5,
                    filter: { sessionId },
                });
                const hit = results.some(
                    r =>
                        String(r.summary ?? '').includes(item.token) ||
                        String(r.text ?? '').includes(item.token),
                );
                if (hit) recallHits += 1;
            } else {
                const res = await qdrant.search(collection, {
                    vector: item.vector,
                    limit: 5,
                    with_payload: true,
                    filter: {
                        must: [{ key: 'sessionId', match: { value: sessionId } }],
                    },
                });
                const hit = res.some(p => {
                    const pl = p.payload as Record<string, unknown> | undefined;
                    return String(pl?.summary ?? pl?.text ?? '').includes(item.token);
                });
                if (hit) recallHits += 1;
            }
            searchLatencies.push(Date.now() - started);
        } catch (err) {
            console.warn(`  search ${i} falha:`, err);
        }
    }

    phases.push({
        name: 'searches',
        ok: recallTrials > 0 && recallHits / recallTrials >= 0.7,
        detail: `hit ${recallHits}/${recallTrials}`,
    });

    const writeStats = stats(writeLatencies);
    const searchStats = stats(searchLatencies);
    const recallHitRate = recallTrials ? recallHits / recallTrials : null;

    let recommendation: string;
    if (!phases[0]?.ok) {
        recommendation = 'Suba Qdrant: docker compose up -d qdrant';
    } else if (mode === 'vectors-only' && recallHitRate !== null && recallHitRate >= 0.9) {
        recommendation =
            'Qdrant local OK para hobby. Gargalo em produção será embedding OpenRouter (50 req/dia), não o Qdrant.';
    } else if (mode === 'with-embeddings' && embeddingFailures > writes / 2) {
        recommendation =
            'Qdrant provavelmente OK; embeddings no free tier esgotaram. Use OPENROUTER_KEY_EMBEDDING dedicada ou reduza indexação por turno.';
    } else if (recallHitRate !== null && recallHitRate < 0.7) {
        recommendation = 'Investigar dimensão vetorial, filtro sessionId ou latência de indexação.';
    } else {
        recommendation = 'Aceitável para recall em sessão com fail-soft (backlog SQL).';
    }

    const report: BenchReport = {
        generatedAt: new Date().toISOString(),
        qdrantUrl,
        vectorSize,
        mode,
        writes,
        searches,
        phases,
        writeLatencyMs: writeStats,
        searchLatencyMs: searchStats,
        recallHitRate,
        embeddingFailures,
        recommendation,
    };

    await writeReport(report);

    console.log('\n[qdrant-benchmark] Resumo');
    console.log('  write p50/p95(ms):', writeStats.p50, writeStats.p95);
    console.log('  search p50/p95(ms):', searchStats.p50, searchStats.p95);
    console.log('  recall hit rate:', recallHitRate !== null ? `${(recallHitRate * 100).toFixed(1)}%` : 'n/a');
    console.log('  →', recommendation);

    const criticalOk = phases.filter(p => p.name !== 'searches').every(p => p.ok);
    const ok =
        criticalOk &&
        stored.length >= Math.min(5, writes) &&
        (recallHitRate === null || recallHitRate >= 0.7);
    process.exit(ok ? 0 : 1);
};

async function writeReport(report: BenchReport) {
    await mkdir(resolve(process.cwd(), 'logs'), { recursive: true });
    const path = resolve(process.cwd(), `logs/qdrant-benchmark-${Date.now()}.json`);
    await new Promise<void>((res, rej) => {
        const stream = createWriteStream(path);
        stream.write(JSON.stringify(report, null, 2));
        stream.end();
        stream.on('finish', () => res());
        stream.on('error', rej);
    });
    console.log(`[qdrant-benchmark] Relatório: ${path}`);
}

run().catch(err => {
    console.error('[qdrant-benchmark] ERRO:', err);
    process.exit(1);
});
