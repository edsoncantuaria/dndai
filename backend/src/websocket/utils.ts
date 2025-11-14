import type { PlayerRollRequest } from '../types.js';

export const sanitizeRollValues = (values: unknown[]): number[] => {
    if (!Array.isArray(values)) return [];
    return values.map(value => Number(value)).filter(value => Number.isFinite(value));
};

export const computeRawRollFromValues = (request: PlayerRollRequest, diceValues: number[]): number => {
    if (!diceValues.length) return 0;
    const notation = (request.dice || '').toLowerCase();
    const isAdvDis = notation === '1d20' && (request.advantage || request.disadvantage);
    if (isAdvDis) {
        return request.advantage ? Math.max(...diceValues) : Math.min(...diceValues);
    }
    return diceValues.reduce((sum, value) => sum + value, 0);
};

export const buildRollResolutionPrompt = (
    request: PlayerRollRequest,
    diceValues: number[],
    rawRoll: number,
    total: number
) => {
    const modifier = request.modifier || 0;
    const modifierText = modifier ? ` ${modifier >= 0 ? '+' : '-'} ${Math.abs(modifier)}` : '';
    const dcText =
        typeof request.dc === 'number'
            ? ` (CD ${request.dc}, ${total >= request.dc ? 'sucesso' : 'falha'})`
            : '';
    const advText = request.advantage
        ? ' com vantagem'
        : request.disadvantage
          ? ' com desvantagem'
          : '';

    return `Resultado da rolagem "${request.reason}": ${total}. (Dados ${request.dice}${advText}: [${diceValues.join(', ')}]${modifierText})${dcText}`.trim();
};
