// src/utils/creationHelpers.ts
import { ApiEquipmentOption } from "../types";
import { translateEquipment } from "./TranslatorEquipments";

/**
 * Calculates the point-buy cost to increase an attribute score to the next level.
 * In D&D 5e: scores from 8-13 cost 1 point per level.
 * Scores from 14-15 cost 2 points per level.
 * The cost increases when the *current* score is 13 or 14.
 * @param currentScore The current base score of the attribute (before purchasing the next level).
 * @returns The cost (1 or 2) to increase the score by one.
 */
export const getCostOfNextLevel = (currentScore: number): number => {
    if (currentScore >= 13) {
        return 2;
    }
    return 1;
};

/**
 * Calculates the point refund for decreasing an attribute score.
 * This is the inverse of `getCostOfNextLevel`.
 * @param currentScore The current base score of the attribute (before decreasing).
 * @returns The amount of points to refund (1 or 2).
 */
export const getRefundForPrevLevel = (currentScore: number): number => {
    if (currentScore > 13) {
        return 2;
    }
    return 1;
};

/**
 * Generates a human-readable label for an equipment option from the API.
 * Handles cases for direct items, categories, and multiple-item choices.
 */
export const getOptionLabel = (option: ApiEquipmentOption, isCategoryDirect: boolean = false): string => {
    if (!option) return 'Opção Inválida';

    if (isCategoryDirect) {
        return `Qualquer ${translateEquipment((option as any).name)}`;
    }

    switch (option.option_type) {
        case 'counted_reference':
            if (option.of) {
                const count = (option.count || 1) > 1 ? `(x${option.count})` : '';
                return `${translateEquipment(option.of.name)}${count}`;
            }
            return 'Item de Referência';
        
        case 'choice':
            if (option.choice?.from?.equipment_category) {
                const categoryName = option.choice.desc || option.choice.from.equipment_category.name;
                return `Qualquer ${translateEquipment(categoryName)}`;
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
