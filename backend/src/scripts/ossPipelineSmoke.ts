/**
 * Smoke test do pipeline OSS (1 chamada real).
 * Uso: cd backend && npx tsx src/scripts/ossPipelineSmoke.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { runOssNarration } from '../ai-oss/orchestration/narrationPipeline.js';
import { hasResolvableOpenRouterKey } from '../ai-oss/core/apiKeyResolve.js';

config({ path: resolve(process.cwd(), '../.env') });
config({ path: resolve(process.cwd(), '.env') });

process.env.AI_ENGINE = 'oss';

const run = async () => {
    if (!hasResolvableOpenRouterKey()) {
        throw new Error('Configure OPENROUTER_KEY1..N no .env');
    }
    const result = await runOssNarration({
        apiKey: '',
        input: {
            character: { name: 'Kael', race: 'Humano', characterClass: 'Ladino', level: 3 },
            playerAction: 'Observo o salão em busca de ameaças.',
            gameLog: 'ENTRADA: taverna movimentada.',
            suppressRollRequest: true,
            responseFocus: 'narrative',
        },
    });
    console.log('[oss-smoke] logEntries:', result.response.logEntries?.length);
    console.log('[oss-smoke] actionOptions:', result.response.actionOptions?.length);
    console.log('[oss-smoke] warnings:', result.warnings?.length ?? 0);
    console.log('[oss-smoke] raw preview:', result.rawText.slice(0, 200));
};

run().catch(err => {
    console.error('[oss-smoke] FALHA:', err);
    process.exit(1);
});
