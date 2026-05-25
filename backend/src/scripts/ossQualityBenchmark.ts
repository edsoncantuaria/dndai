/**
 * Benchmark de qualidade JSON OSS (cenários fixos).
 * Uso: cd backend && npx tsx src/scripts/ossQualityBenchmark.ts
 *      npx tsx src/scripts/ossQualityBenchmark.ts --limit=5
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { runOssNarration } from '../ai-oss/orchestration/narrationPipeline.js';
import { hasResolvableOpenRouterKey } from '../ai-oss/core/apiKeyResolve.js';
import { buildGlobalSnapshot } from '../ai-oss/telemetry/requestMetrics.js';
import { getOpenRouterManager } from '../ai-oss/providers/OpenRouterManager.js';

config({ path: resolve(process.cwd(), '../.env') });
config({ path: resolve(process.cwd(), '.env') });

process.env.AI_ENGINE = 'oss';

const SCENARIOS = [
    {
        id: 'explore-tavern',
        playerAction: 'Observo o salão em busca de ameaças.',
        gameLog: 'ENTRADA: taverna escura, chuva lá fora.',
    },
    {
        id: 'dialogue-guard',
        playerAction: 'Pergunto ao guarda sobre rumores de goblins na estrada.',
        gameLog: 'Chegada ao posto da cidade ao entardecer.',
    },
    {
        id: 'combat-attack',
        playerAction: 'Ataco o bandido mais próximo com minha adaga.',
        gameLog: 'Emboscada na floresta; dois bandidos armados.',
        combat: true,
    },
    {
        id: 'stealth',
        playerAction: 'Tento me esconder atrás dos barris sem ser visto.',
        gameLog: 'Armazém do taverneiro; guarda patrulha.',
    },
    {
        id: 'investigate',
        playerAction: 'Examino os símbolos gravados na porta da masmorra.',
        gameLog: 'Ruínas antigas; ar frio e cheiro de mofo.',
    },
    {
        id: 'social-persuade',
        playerAction: 'Tento convencer o mercador a baixar o preço.',
        gameLog: 'Mercado da vila; multidão barulhenta.',
    },
    {
        id: 'rest',
        playerAction: 'Descanso brevemente e observo o acampamento.',
        gameLog: 'Acampamento à beira da estrada; fogueira baixa.',
    },
    {
        id: 'combat-defend',
        playerAction: 'Ergo o escudo e me preparo para o próximo golpe.',
        gameLog: 'Combate: orc ferido recua; aliado caído.',
        combat: true,
    },
    {
        id: 'magic-flavor',
        playerAction: 'Preparo um truque de prestidigitação para distrair a plateia.',
        gameLog: 'Feira na praça; multidão aplaude outro artista.',
    },
    {
        id: 'chase',
        playerAction: 'Corro atrás do ladrão que roubou minha bolsa.',
        gameLog: 'Rua estreita; chuva; multidão.',
    },
    {
        id: 'combat-spell',
        playerAction: 'Conjuro uma rajada de vento contra o grupo de goblins.',
        gameLog: 'Clareira na floresta; 3 goblins; turno do mago.',
        combat: true,
    },
    {
        id: 'trap-check',
        playerAction: 'Verifico o chão em busca de armadilhas antes de avançar.',
        gameLog: 'Corredor estreito da masmorra; tochas fracas.',
    },
    {
        id: 'negotiate',
        playerAction: 'Ofereço ouro ao capitão da guarda em troca de passagem.',
        gameLog: 'Portão da cidade ao amanhecer.',
    },
    {
        id: 'combat-retreat',
        playerAction: 'Recuo para cobertura atrás da estátua.',
        gameLog: 'Salão em ruínas; arqueiro no altar; HP baixo.',
        combat: true,
    },
    {
        id: 'climb',
        playerAction: 'Tento escalar o muro do castelo usando corda e gancho.',
        gameLog: 'Pátio externo; lua cheia; guardas distantes.',
    },
    {
        id: 'loot-search',
        playerAction: 'Reviro os pertences do inimigo caído em busca de pistas.',
        gameLog: 'Após combate; corpo do bandido líder.',
    },
    {
        id: 'combat-flank',
        playerAction: 'Flanqueio o orc pela esquerda enquanto o aliado distrai.',
        gameLog: 'Caverna; orc e dois lobos; rodada 2.',
        combat: true,
    },
    {
        id: 'perception',
        playerAction: 'Escuto atentamente se há passos no corredor à frente.',
        gameLog: 'Túnel úmido; eco distante.',
    },
    {
        id: 'intimidate',
        playerAction: 'Ameaço o informante para que revele o esconderijo do culto.',
        gameLog: 'Beco sujo; chuva fina; informante nervoso.',
    },
] as const;

const run = async () => {
    if (!hasResolvableOpenRouterKey()) {
        throw new Error('Configure OPENROUTER_KEY1..N');
    }

    const limitArg = process.argv.find(a => a.startsWith('--limit='));
    const limit = limitArg ? Number(limitArg.split('=')[1]) : SCENARIOS.length;
    const scenarios = SCENARIOS.slice(0, Math.min(limit, SCENARIOS.length));

    const results: Array<{
        id: string;
        ok: boolean;
        apiCallsEstimate: number;
        logEntries: number;
        actionOptions: number;
        warnings: number;
        latencyNote: string;
        error?: string;
    }> = [];

    console.log(`[oss-benchmark] ${scenarios.length} cenários…`);

    for (const scenario of scenarios) {
        const started = Date.now();
        try {
            const result = await runOssNarration({
                apiKey: '',
                input: {
                    character: { name: 'Aldric', race: 'Humano', characterClass: 'Guerreiro', level: 2 },
                    playerAction: scenario.playerAction,
                    gameLog: scenario.gameLog,
                    suppressRollRequest: true,
                    responseFocus: 'narrative',
                    combatState: scenario.combat
                        ? { isActive: true, round: 1, turn: 1, combatants: [], log: [] }
                        : undefined,
                },
            });
            const elapsed = ((Date.now() - started) / 1000).toFixed(1);
            const ok = (result.response.logEntries?.length ?? 0) > 0;
            results.push({
                id: scenario.id,
                ok,
                apiCallsEstimate: 1,
                logEntries: result.response.logEntries?.length ?? 0,
                actionOptions: result.response.actionOptions?.length ?? 0,
                warnings: result.warnings?.length ?? 0,
                latencyNote: `${elapsed}s`,
            });
            console.log(`  ${scenario.id}: ${ok ? 'OK' : 'FALHA'} (${elapsed}s)`);
        } catch (err) {
            results.push({
                id: scenario.id,
                ok: false,
                apiCallsEstimate: 0,
                logEntries: 0,
                actionOptions: 0,
                warnings: 0,
                latencyNote: 'erro',
                error: err instanceof Error ? err.message : String(err),
            });
            console.log(`  ${scenario.id}: ERRO`, err);
        }
        await new Promise(r => setTimeout(r, 2000));
    }

    const passed = results.filter(r => r.ok).length;
    const rate = scenarios.length ? (passed / scenarios.length) * 100 : 0;

    const report = {
        generatedAt: new Date().toISOString(),
        scenarios: scenarios.length,
        passed,
        passRatePercent: Math.round(rate * 10) / 10,
        targetPassRate: 90,
        results,
        metrics: buildGlobalSnapshot(getOpenRouterManager().getMetricsSnapshot()),
    };

    const outDir = resolve(process.cwd(), 'logs');
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `oss-quality-benchmark-${Date.now()}.json`);
    writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

    console.log(`\n[oss-benchmark] ${passed}/${scenarios.length} OK (${rate.toFixed(1)}%)`);
    console.log(`[oss-benchmark] Relatório: ${outPath}`);
};

run().catch(err => {
    console.error('[oss-benchmark] Falha:', err);
    process.exit(1);
});
