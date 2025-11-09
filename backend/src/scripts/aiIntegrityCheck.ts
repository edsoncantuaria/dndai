import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getGameUpdate } from '../services/aiService.js';
import { env } from '../config/env.js';
import type { GameMasterFlowInput } from '../schemas/gameSchemas.js';
import type { GenerationConfig } from '../schemas/validationSchemas.js';

const defaultInput: GameMasterFlowInput = {
    character: {
        id: 'integrity-bot',
        name: 'Guardião de Integridade',
        worldState: { timeOfDay: 'Manhã', weather: 'Ensolarado', currentRegion: 'Biblioteca Arcana' },
        journal: [],
        relationships: [],
        inventory: [],
    },
    playerAction: 'Observar o salão e procurar pistas do próximo desafio.',
    gameLog: 'SISTEMA: O aventureiro desperta em uma biblioteca arcana.\nJOGADOR: Observo o salão e procuro pistas.',
    combatState: undefined,
    homebrewSummary: '',
    validationFeedback: '',
    useAiHomebrew: false,
    enableNarrativeRevalidation: true,
    mode: 'gameplay',
};

const defaultGeneration: GenerationConfig = {
    temperature: 0.7,
    topP: 0.9,
    topK: 32,
    maxOutputTokens: 8192,
};

const loadInputFromArg = (arg?: string): GameMasterFlowInput => {
    if (!arg) return defaultInput;
    const filePath = resolve(process.cwd(), arg);
    const content = readFileSync(filePath, 'utf8');
    return JSON.parse(content) as GameMasterFlowInput;
};

const run = async () => {
    const args = process.argv.slice(2);
    const modelArg = args.find(entry => !entry.startsWith('--')) ?? 'gemini-2.5-pro';
    const payloadFlag = args.find(entry => entry.startsWith('--payload='));
    const payloadPath = payloadFlag ? payloadFlag.split('=')[1] : undefined;
    const input = loadInputFromArg(payloadPath);

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY não configurada. Defina a variável antes de rodar o check.');
    }

    if (payloadPath) {
        console.log(`[ai:integrity-check] Usando payload customizado: ${payloadPath}`);
    }
    console.log(`[ai:integrity-check] Iniciando verificação rápida com o modelo ${modelArg}.`);

    const result = await getGameUpdate(input, modelArg, defaultGeneration, apiKey);
    console.log('[ai:integrity-check] Resposta obtida com sucesso.');
    console.log(JSON.stringify({
        logEntries: result.response.logEntries?.length ?? 0,
        actionOptions: result.response.actionOptions?.length ?? 0,
        meta: result.response._meta,
        systemLog: result.response.systemLog,
    }, null, 2));
};

run().catch(error => {
    console.error('[ai:integrity-check] Falha na verificação:', error);
    process.exit(1);
});
