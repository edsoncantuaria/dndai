import { ApiEquipmentOption } from "../types";
import { translateEquipment } from "./TranslatorEquipments";
import { translateApiString } from "./translator";

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
export const getOptionLabel = (option: ApiEquipmentOption): string => {
    if (!option) return 'Opção Inválida';
    
    // Para itens diretos (ex: `of: { index: 'club', name: 'Club' }`)
    if (option.of) {
        const count = (option.count || 1) > 1 ? ` (x${option.count})` : '';
        return `${translateEquipment(option.of.name)}${count}`;
    }
    
    // Para escolhas de categoria, ex: "Qualquer Arma Simples"
    if (option.type === 'choice' && option.from.option_set_type === 'equipment_category') {
         const categoryName = option.from.equipment_category?.name || 'Equipamento';
         return `Qualquer ${translateApiString(categoryName)}`;
    }
    
    // Para escolhas múltiplas aninhadas, ex: "(a) a mace or (b) a warhammer"
    if(option.type === 'multiple' && option.from?.options) {
        const optionStrings = option.from.options.map(subOpt => getOptionLabel(subOpt.item || subOpt));
        return `(${option.from.options.length}) ${optionStrings.join(' e ')}`;
    }

    // Fallback para descrições diretas
    if (option.desc) {
        return translateApiString(option.desc);
    }
    
    // Fallback para itens aninhados dentro de 'item'
    if((option as any).item?.of) {
        return getOptionLabel((option as any).item);
    }

    console.warn("Opção de equipamento não reconhecida:", option);
    return 'Opção de Equipamento';
};
