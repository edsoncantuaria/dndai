import type { GameMasterResponse } from '../schemas/gameSchemas.js';
import { sanitizeActionOptionsForPlayerAgency } from '../ai/narrativeContract.js';

export type NarrativeGmValidatorContext = {
    memorySummary?: string;
};

/**
 * Validador mínimo para modo motor: só narrativa e opções.
 * Não injeta worldState, updatedCharacter, loot nem combate.
 */
export function runNarrativeGmValidator(
    raw: GameMasterResponse,
    context?: NarrativeGmValidatorContext,
): GameMasterResponse {
    const response: GameMasterResponse = {
        logEntries: Array.isArray(raw.logEntries) ? [...raw.logEntries] : [],
        actionOptions: sanitizeActionOptionsForPlayerAgency(raw.actionOptions ?? []),
    };

    if (raw.systemLog) response.systemLog = raw.systemLog;
    if (raw.memoryContext) {
        response.memoryContext = raw.memoryContext;
    } else if (context?.memorySummary) {
        response.memoryContext = { summary: context.memorySummary, references: [] };
    }

    if (response.logEntries.length === 0) {
        response.logEntries.push({
            type: 'narration',
            content: 'O momento se estende enquanto você decide o próximo passo.',
        });
    }

    if (response.actionOptions.length < 3) {
        const fillers = [
            { text: 'Observar o ambiente', action: 'observe' },
            { text: 'Aguardar e escutar', action: 'listen' },
            { text: 'Avançar com cautela', action: 'advance' },
        ];
        for (const f of fillers) {
            if (response.actionOptions.length >= 3) break;
            if (!response.actionOptions.some(o => (typeof o === 'string' ? o : o.text) === f.text)) {
                response.actionOptions.push(f);
            }
        }
    }

    return response;
}
