import { ApiEquipmentOption } from "../types";
import { translateEquipment } from "./TranslatorEquipments";

/**
 * Calculates the point-buy cost to increase an attribute score to the next level.
 * In this system: scores from 8-13 cost 1 point per level.
 * Scores from 14-15 cost 2 points per level.
 * @param currentScore The current base score of the attribute (before purchasing the next level).
 * @returns The cost (1 or 2) to increase the score by one.
 */
export const getCostOfNextLevel = (currentScore: number): number => (currentScore >= 13 ? 2 : 1);

/**
 * Calculates the point refund for decreasing an attribute score.
 * This is the inverse of `getCostOfNextLevel`.
 * @param currentScore The current base score of the attribute (before decreasing).
 * @returns The amount of points to refund (1 or 2).
 */
export const getRefundForPrevLevel = (currentScore: number): number => (currentScore > 13 ? 2 : 1);

/**
 * Gera um rótulo legível para uma opção de equipamento da API.
 * Trata casos de itens diretos, categorias e múltiplas escolhas.
 */
export const getOptionLabel = (option: any): string => {
    if (!option) return 'Opção Inválida';

    if (option.option_type === 'multiple' && option.items) {
        return option.items.map(getOptionLabel).join(' e ');
    }

    if (option.option_type === 'counted_reference' && option.of) {
        const count = (option.count || 1) > 1 ? ` (x${option.count})` : '';
        return `${translateEquipment(option.of.name)}${count}`;
    }

    if (option.option_type === 'choice' && option.choice?.from?.option_set_type === 'equipment_category') {
        const categoryName = option.choice.desc || option.choice.from.equipment_category.name;
        return `Qualquer ${translateEquipment(categoryName)}`;
    }

    if (option.option_set_type === 'equipment_category' && option.equipment_category) {
        const categoryName = option.equipment_category.name;
        return `Qualquer ${translateEquipment(categoryName)}`;
    }
    
    if ((option as any).item) {
        return getOptionLabel((option as any).item);
    }
    
    console.warn("Opção de equipamento não reconhecida:", option);
    return 'Opção de Equipamento';
};
