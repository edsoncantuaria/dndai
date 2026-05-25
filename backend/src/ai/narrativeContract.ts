import type { GameMasterResponse } from '../schemas/gameSchemas.js';
import { MOTOR_OWNED_RESPONSE_FIELDS } from '../narration/motorStateBridge.js';

/** Campos que a IA não pode enviar no modo narration_only (além dos do motor). */
export const NARRATIVE_FORBIDDEN_OUTPUT_KEYS = [
    ...MOTOR_OWNED_RESPONSE_FIELDS,
    '_meta',
    'imagePrompt',
    'progressionFeed',
    'xpEvents',
] as const;

export const NARRATIVE_ALLOWED_OUTPUT_KEYS = new Set([
    'logEntries',
    'actionOptions',
    'systemLog',
    'memoryContext',
    'newFacts',
]);

export const NARRATIVE_JSON_EXAMPLE = {
    logEntries: [
        { type: 'narration', content: 'Prosa imersiva do mestre.' },
        { type: 'system', content: 'Opcional: nota curta de mesa.' },
    ],
    actionOptions: [
        { text: 'Investigar o altar', action: 'investigate', skill: 'investigation' },
        { text: 'Falar com o guarda', action: 'talk' },
        { text: 'Preparar uma emboscada', action: 'ambush', skill: 'stealth' },
    ],
    newFacts: [
        { fact: 'O taverneiro reconheceu o grupo pelo brasão na capa.', importance: 'medium' },
    ],
    memoryContext: {
        summary: 'Resumo opcional para continuidade.',
        references: ['gancho-atual'],
    },
};

export function buildNarrativeContractPromptBlock(): string {
    return `### CONTRATO DE SAÍDA (OBRIGATÓRIO — NARRAÇÃO APENAS)
Você é o MESTRE DE JOGO. O servidor executa D&D 5e: combate, HP, inventário, magias, loot, loja, XP, level-up e rolagens.
Sua ÚNICA função: narrar e sugerir opções. O jogador NÃO pode "inventar" mecânicas via texto — ele usa botões da ficha.

JSON permitido (somente estas chaves):
${JSON.stringify(NARRATIVE_JSON_EXAMPLE, null, 0)}

PROIBIDO incluir qualquer outra chave (updatedCharacter, combatState, playerRollRequest, levelUpState, shopState, lootOffer, xpEvents, _meta, etc.).
Se [Motor] ou [Mestre — rolagem] informar sucesso/falha, narre o desfecho; não peça nova rolagem.
actionOptions devem ser ações jogáveis (verbos no mundo), nunca "peça ao mestre para..." ou "role manualmente".`;
}

/** Remove chaves proibidas que modelos free costumam alucinar. */
export function enforceNarrativeOnlyResponse(response: GameMasterResponse): {
    cleaned: GameMasterResponse;
    stripped: string[];
} {
    const cleaned: GameMasterResponse = {
        logEntries: Array.isArray(response.logEntries) ? response.logEntries : [],
        actionOptions: Array.isArray(response.actionOptions) ? response.actionOptions : [],
    };
    const stripped: string[] = [];

    if (response.systemLog !== undefined) cleaned.systemLog = response.systemLog;
    if (response.memoryContext !== undefined) cleaned.memoryContext = response.memoryContext;
    const rawFacts = (response as { newFacts?: unknown }).newFacts;
    if (Array.isArray(rawFacts) && rawFacts.length) {
        (cleaned as { newFacts?: unknown }).newFacts = rawFacts;
    }

    for (const key of Object.keys(response) as (keyof GameMasterResponse)[]) {
        if (NARRATIVE_ALLOWED_OUTPUT_KEYS.has(key)) continue;
        if ((response as Record<string, unknown>)[key] !== undefined) {
            stripped.push(String(key));
        }
    }

    return { cleaned, stripped };
}

/** Bloqueia actionOptions que tentam manipular o sistema em vez de jogar. */
export function sanitizeActionOptionsForPlayerAgency(
    options: GameMasterResponse['actionOptions'],
): GameMasterResponse['actionOptions'] {
    if (!Array.isArray(options)) return [];
    const forbidden = /peça ao mestre|peça para o mestre|edite sua ficha|altere seu hp|invente um item|modo administrador|ignore as regras/i;
    return options.filter(opt => {
        const text = typeof opt === 'string' ? opt : opt?.text ?? '';
        return text.length > 2 && !forbidden.test(text);
    });
}
