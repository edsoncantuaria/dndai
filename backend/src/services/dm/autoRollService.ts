import type { PlayerRollRequest } from '../../types.js';

export type AutomatedRollResult = {
    diceValues: number[];
    rawRoll: number;
    modifier: number;
    total: number;
    success: boolean | null;
    notation: string;
};

const DICE_NOTATION = /^(\d+)d(\d+)$/i;

function rollDie(sides: number): number {
    return Math.floor(Math.random() * sides) + 1;
}

/** Rola notação NdS (ex.: 2d6, 1d20). */
export function rollNotation(notation: string, count = 1): number[] {
    const match = notation.trim().match(DICE_NOTATION);
    if (!match) {
        return [rollDie(20)];
    }
    const diceCount = Math.min(Math.max(parseInt(match[1], 10), 1), 20);
    const sides = Math.min(Math.max(parseInt(match[2], 10), 2), 100);
    const values: number[] = [];
    for (let i = 0; i < diceCount; i += 1) {
        values.push(rollDie(sides));
    }
    return values;
}

function resolveRawFromD20Values(values: number[], request: PlayerRollRequest): number {
    const notation = (request.dice || '1d20').toLowerCase();
    if (notation === '1d20' && values.length >= 2) {
        if (request.advantage) return Math.max(...values);
        if (request.disadvantage) return Math.min(...values);
    }
    return values.reduce((sum, v) => sum + v, 0);
}

/**
 * Executa a rolagem no servidor (mestre virtual rola por você).
 */
export function executeAutomatedRoll(request: PlayerRollRequest): AutomatedRollResult {
    const notation = (request.dice || '1d20').trim().toLowerCase();
    const match = notation.match(DICE_NOTATION);
    const isD20 = match && match[2] === '20' && parseInt(match[1], 10) === 1;

    let diceValues: number[];
    if (isD20 && (request.advantage || request.disadvantage)) {
        diceValues = [rollDie(20), rollDie(20)];
    } else {
        diceValues = rollNotation(notation);
    }

    const rawRoll = resolveRawFromD20Values(diceValues, request);
    const modifier = Number(request.modifier) || 0;
    const total = rawRoll + modifier;
    const dc = typeof request.dc === 'number' ? request.dc : null;
    const success = dc === null ? null : total >= dc;

    return {
        diceValues,
        rawRoll,
        modifier,
        total,
        success,
        notation,
    };
}

export function formatRollOutcomeForDm(
    request: PlayerRollRequest,
    roll: AutomatedRollResult,
): string {
    const adv =
        request.advantage ? ' (vantagem)' : request.disadvantage ? ' (desvantagem)' : '';
    const modText =
        roll.modifier !== 0
            ? ` ${roll.modifier >= 0 ? '+' : ''}${roll.modifier}`
            : '';
    const dcText =
        typeof request.dc === 'number'
            ? roll.success === true
                ? ` — SUCESSO (total ${roll.total} ≥ CD ${request.dc})`
                : roll.success === false
                  ? ` — FALHA (total ${roll.total} < CD ${request.dc})`
                  : ` (CD ${request.dc})`
            : '';
    return [
        `[Mestre — rolagem automática] ${request.reason}`,
        `Dados: ${request.dice}${adv} → [${roll.diceValues.join(', ')}]${modText} = ${roll.total}${dcText}.`,
        roll.success === true
            ? 'Narre as consequências do sucesso com tom de mestre de jogo.'
            : roll.success === false
              ? 'Narre as consequências da falha sem punir o jogador de forma injusta.'
              : 'Narre o desfecho mecânico e emocional desta rolagem.',
    ].join('\n');
}
