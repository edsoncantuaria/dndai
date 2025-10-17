// src/utils/creationHelpers.ts
import { ApiEquipmentOption } from "../types";
import { translateApiString } from "./translator";

/**
 * Point-buy costs for each attribute score in D&D 5e.
 */
const POINT_BUY_COST: Record<number, number> = {
    8: 0,
    9: 1,
    10: 2,
    11: 3,
    12: 4,
    13: 5,
    14: 7,
    15: 9,
};

/**
 * Gets the total point cost for a given attribute score.
 * @param score The attribute score.
 * @returns The total cost in points for that score.
 */
export const getPointsForScore = (score: number): number => {
    return POINT_BUY_COST[score] ?? 0;
};

/**
 * Gets the marginal cost to upgrade to a specific score.
 * @param score The target score you want to buy.
 * @returns The cost to go from score-1 to score.
 */
export const getCostForScore = (score: number): number => {
    if (score <= 8) return 1; // Should not happen, but for safety
    if (score <= 13) return 1;
    if (score <= 15) return 2;
    return 99; // Can't buy past 15
};

/**
 * Rolls 4 six-sided dice, drops the lowest, and returns the sum.
 * @returns A number between 3 and 18.
 */
export const rollAttribute = (): number => {
    const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
    rolls.sort((a, b) => a - b);
    rolls.shift(); // Drop the lowest
    return rolls.reduce((sum, value) => sum + value, 0);
};

/**
 * Generates a human-readable label for an equipment option from the API.
 * Handles cases for direct items, categories, and multiple-item choices.
 */
export const getOptionLabel = (option: ApiEquipmentOption, isCategoryDirect: boolean = false): string => {
    if (!option) return 'Opção Inválida';

    if (isCategoryDirect) {
        return `Qualquer ${translateApiString((option as any).name)}`;
    }

    switch (option.option_type) {
        case 'counted_reference':
            if (option.of) {
                const count = (option.count || 1) > 1 ? `(x${option.count})` : '';
                return `${translateApiString(option.of.name)}${count}`;
            }
            return 'Item de Referência';
        
        case 'choice':
            if (option.choice?.from?.equipment_category) {
                const categoryName = option.choice.desc || option.choice.from.equipment_category.name;
                return `Qualquer ${translateApiString(categoryName)}`;
            }
            return 'Outra Escolha';

        case 'multiple':
            if (option.items) {
                return option.items.map(getOptionLabel).join(' e ');
            }
            return 'Múltiplos Itens';

        default:
            return `Opção Desconhecida: ${option.option_type}`;
    }
};
