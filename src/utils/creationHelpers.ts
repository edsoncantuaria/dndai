import { ApiEquipmentOption } from "../types";
import { translateEquipment } from "./translator";

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

    // Caso 1: É uma escolha de categoria de equipamento (ex: "Qualquer Arma Simples")
    const choiceDetails = (option as any).choice || option;
    if (choiceDetails.from?.option_set_type === 'equipment_category') {
        return translateEquipment(choiceDetails.desc || choiceDetails.from.equipment_category?.name || 'Categoria de Equipamento');
    }

    // Caso 2: É uma escolha de múltiplos itens (ex: uma besta e 20 virotes)
    if(option.type === 'multiple' && option.from?.options) {
        const optionStrings = option.from.options.map(subOpt => getOptionLabel(subOpt.item || subOpt));
        return optionStrings.join(' e ');
    }

    // Caso 3: Item direto (ex: `of: { index: 'club', name: 'Club' }`)
    if (option.of) {
        const count = (option.count || 1) > 1 ? ` (x${option.count})` : '';
        return `${translateEquipment(option.of.name)}${count}`;
    }
    
    // Caso 4: Fallback para uma descrição genérica se existir
    if (option.desc) {
        return translateEquipment(option.desc);
    }
    
    // Caso 5: Fallback para itens aninhados dentro de 'item' (outra variação da API)
    if((option as any).item?.of) {
        return getOptionLabel((option as any).item);
    }

    console.warn("Opção de equipamento não reconhecida:", option);
    return 'Opção de Equipamento';
};
