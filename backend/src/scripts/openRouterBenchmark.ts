/**
 * Benchmark OpenRouter: limites (RPM), JSON narrativo e validação Zod.
 *
 * Uso (na raiz do repo, carrega ../.env):
 *   cd backend && npx tsx src/scripts/openRouterBenchmark.ts
 *   cd backend && npx tsx src/scripts/openRouterBenchmark.ts --probe-rpm
 *   cd backend && npx tsx src/scripts/openRouterBenchmark.ts --models=meta-llama/llama-3.3-70b-instruct:free
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { createOpenRouterAdapter } from '../ai/providers/openRouterAdapter.js';
import { validateByPhaseFocus } from '../ai/responseValidator.js';
import { extractResponseText } from '../ai/responseParser.js';

config({ path: resolve(process.cwd(), '../.env') });
config({ path: resolve(process.cwd(), '.env') });

const DEFAULT_MODELS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
    'openai/gpt-oss-120b:free',
] as const;

const NARRATIVE_JSON_INSTRUCTION = `Você é o Mestre de um RPG D&D 5e em português (Brasil).
Responda APENAS um objeto JSON válido, sem markdown, com este formato exato:
{
  "logEntries": [{"type":"narration","content":"2-4 frases de narração em PT-BR"}],
  "actionOptions": ["Investigar a porta", "Falar com o guarda", "Seguir em silêncio"],
  "systemLog": null
}
Não inclua updatedCharacter, combatState, playerRollRequest nem outros campos.`;

const SAMPLE_PLAYER_PROMPT = `CONTEXTO: taverna escura, chuva lá fora. PJ: Kael, ladino nível 3.
AÇÃO DO JOGADOR: "Observo o barman e tento perceber se ele está nervoso com alguém na mesa do canto."`;

function loadOpenRouterKeys(): string[] {
    const keys: string[] = [];
    for (let i = 1; i <= 9; i += 1) {
        const v = process.env[`OPENROUTER_KEY${i}`]?.trim();
        if (v) keys.push(v);
    }
    const bulk = process.env.OPENROUTER_API_KEYS?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
    return [...new Set([...keys, ...bulk])];
}

function maskKey(key: string): string {
    if (key.length < 12) return '***';
    return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

async function fetchKeyLimits(apiKey: string): Promise<Record<string, unknown> | null> {
    try {
        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        const data = (await res.json()) as Record<string, unknown>;
        if (!res.ok) return { error: data, status: res.status };
        return data;
    } catch (e) {
        return { error: String(e) };
    }
}

function parseJsonFromText(text: string): { parsed: unknown | null; parseError?: string } {
    const trimmed = text.trim();
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fence ? fence[1].trim() : trimmed;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) {
        return { parsed: null, parseError: 'Nenhum objeto JSON encontrado na resposta.' };
    }
    try {
        return { parsed: JSON.parse(candidate.slice(start, end + 1)) };
    } catch (e) {
        return { parsed: null, parseError: e instanceof Error ? e.message : String(e) };
    }
}

async function testModelSchema(
    apiKey: string,
    model: string,
): Promise<{
    model: string;
    ok: boolean;
    latencyMs: number;
    finishReason?: string;
    textLength: number;
    jsonParseOk: boolean;
    zodValid: boolean;
    zodIssues: string[];
    parseError?: string;
    preview?: string;
    httpStatus?: number;
    error?: string;
}> {
    const started = Date.now();
    const adapter = createOpenRouterAdapter(apiKey, model);
    try {
        const raw = await adapter.generateContent(
            {
                contents: [{ role: 'user', parts: [{ text: SAMPLE_PLAYER_PROMPT }] }],
                config: {
                    temperature: 0.85,
                    maxOutputTokens: 2048,
                    responseMimeType: 'application/json',
                },
            },
            { role: 'system', parts: [{ text: NARRATIVE_JSON_INSTRUCTION }] },
        );
        const text = extractResponseText(raw) ?? '';
        const { parsed, parseError } = parseJsonFromText(text);
        const validation =
            parsed != null
                ? validateByPhaseFocus(parsed, 'narrative')
                : { valid: false, issues: ['parse_failed'] as string[] };
        const finish =
            (raw as { candidates?: Array<{ finishReason?: string }> })?.candidates?.[0]?.finishReason;
        return {
            model,
            ok: validation.valid,
            latencyMs: Date.now() - started,
            finishReason: finish,
            textLength: text.length,
            jsonParseOk: parsed != null,
            zodValid: validation.valid,
            zodIssues: validation.issues ?? [],
            parseError,
            preview: text.slice(0, 280),
        };
    } catch (e) {
        const err = e as Error & { status?: number };
        return {
            model,
            ok: false,
            latencyMs: Date.now() - started,
            textLength: 0,
            jsonParseOk: false,
            zodValid: false,
            zodIssues: [],
            httpStatus: err.status,
            error: err.message,
        };
    }
}

/** Envia requisições em sequência rápida até 429 ou maxAttempts. */
async function probeRpm(apiKey: string, model: string, maxAttempts = 25): Promise<{
    model: string;
    attempts: number;
    successCount: number;
    first429At: number | null;
    inferredRpmCeiling: number | null;
    errors: string[];
}> {
    const errors: string[] = [];
    let successCount = 0;
    let first429At: number | null = null;

    for (let i = 1; i <= maxAttempts; i += 1) {
        const adapter = createOpenRouterAdapter(apiKey, model);
        try {
            await adapter.generateContent(
                {
                    contents: [{ role: 'user', parts: [{ text: 'Responda JSON: {"logEntries":[{"type":"narration","content":"ok"}],"actionOptions":["a"],"systemLog":null}' }] }],
                    config: { temperature: 0.2, maxOutputTokens: 256, responseMimeType: 'application/json' },
                },
                { role: 'system', parts: [{ text: 'Somente JSON válido.' }] },
            );
            successCount += 1;
            process.stdout.write(`  [${model}] req ${i} OK\n`);
        } catch (e) {
            const err = e as Error & { status?: number };
            const msg = err.message ?? String(e);
            errors.push(`#${i}: ${msg}`);
            if (err.status === 429 || /rate limit/i.test(msg)) {
                first429At = i;
                process.stdout.write(`  [${model}] req ${i} 429 — parando probe\n`);
                break;
            }
            if (err.status && err.status >= 500) {
                process.stdout.write(`  [${model}] req ${i} ${err.status} — parando\n`);
                break;
            }
        }
        await new Promise(r => setTimeout(r, 2800));
    }

    return {
        model,
        attempts: successCount + (first429At ?? 0),
        successCount,
        first429At,
        inferredRpmCeiling: first429At != null ? Math.max(1, first429At - 1) : successCount,
        errors: errors.slice(0, 5),
    };
}

const run = async () => {
    const args = process.argv.slice(2);
    const probeRpmFlag = args.includes('--probe-rpm');
    const modelsArg = args.find(a => a.startsWith('--models='));
    const models = modelsArg
        ? modelsArg.split('=')[1].split(',').map(s => s.trim()).filter(Boolean)
        : [...DEFAULT_MODELS];

    const keys = loadOpenRouterKeys();
    if (!keys.length) {
        throw new Error('Defina OPENROUTER_KEY1, OPENROUTER_KEY2, … ou OPENROUTER_API_KEYS no .env');
    }

    console.log(`[openRouterBenchmark] Chaves: ${keys.map(maskKey).join(', ')}`);
    console.log(`[openRouterBenchmark] Modelos: ${models.join(', ')}`);

    const keyInfo = await fetchKeyLimits(keys[0]);
    console.log('[openRouterBenchmark] GET /api/v1/auth/key (chave 1):');
    console.log(JSON.stringify(keyInfo, null, 2));

    const schemaResults = [];
    for (const model of models) {
        console.log(`\n[schema] ${model} …`);
        const result = await testModelSchema(keys[0], model);
        schemaResults.push(result);
        console.log(
            `  ${result.ok ? 'OK' : 'FALHA'} | ${result.latencyMs}ms | json=${result.jsonParseOk} zod=${result.zodValid}`,
        );
        if (result.zodIssues.length) console.log(`  issues: ${result.zodIssues.slice(0, 4).join('; ')}`);
        if (result.error) console.log(`  erro: ${result.error}`);
        await new Promise(r => setTimeout(r, 4000));
    }

    let rpmResults: Awaited<ReturnType<typeof probeRpm>>[] = [];
    if (probeRpmFlag) {
        console.log('\n[probe-rpm] Atenção: consome cota free. Intervalo ~2.8s entre reqs.');
        for (const model of models) {
            console.log(`\n[probe-rpm] ${model}`);
            rpmResults.push(await probeRpm(keys[0], model, 22));
            await new Promise(r => setTimeout(r, 65000));
        }
    }

    const report = {
        generatedAt: new Date().toISOString(),
        keysLoaded: keys.length,
        keyMasks: keys.map(maskKey),
        openRouterKeyLimits: keyInfo,
        officialNotes: {
            freeModelsDocRpm: 20,
            freeModelsDocDailyNoCredits: 50,
            freeModelsDocDailyWith10Credits: 1000,
            extraKeysSameAccount: 'OpenRouter docs: chaves/contas extras não aumentam RPM global',
            modelRotation: 'Failover entre modelos usa limites separados por provedor',
        },
        schemaResults,
        rpmResults: rpmResults.length ? rpmResults : undefined,
    };

    const outDir = resolve(process.cwd(), 'logs');
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `openrouter-benchmark-${Date.now()}.json`);
    writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n[openRouterBenchmark] Relatório: ${outPath}`);
};

run().catch(err => {
    console.error('[openRouterBenchmark] Erro:', err);
    process.exit(1);
});
