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
    maxOutputTokens: 1024,
};

const run = async () => {
    const model = process.argv[2] ?? 'gemini-2.5-pro';
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY não configurada. Defina a variável antes de rodar o check.');
    }

    console.log(`[ai:integrity-check] Iniciando verificação rápida com o modelo ${model}.`);
    const result = await getGameUpdate(defaultInput, model, defaultGeneration, apiKey);
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
