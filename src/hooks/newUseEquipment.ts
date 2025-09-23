// src/hooks/newUseEquipment.ts
import { useState, useMemo, useCallback } from 'react';
import * as DndApiService from '../services/dndApiService';
import {
    ApiClass, ApiBackground, ApiEquipmentOption, InventoryItem, ApiEquipment, ApiListItem
} from '../types';
import { translateEquipment } from '../utils/TranslatorEquipments';
import { v4 as uuidv4 } from 'uuid';

/**
 * Este hook gerencia o estado e a lógica para a seleção de equipamentos iniciais.
 * Ele busca e processa as opções da classe e do antecedente, trata de sub-escolhas
 * dinâmicas (como categorias de armas) e garante que as regras sejam seguidas.
 */
export const useNewEquipment = (classDetails: ApiClass | null, backgroundDetails: ApiBackground | null) => {
    // Estado para as escolhas principais do jogador (ex: 'a' ou 'b' de um grupo)
    const [equipmentChoices, setEquipmentChoices] = useState<Record<string, ApiEquipmentOption>>({});
    // Estado para as opções de sub-escolha carregadas dinamicamente (ex: lista de armas simples)
    const [subChoiceOptions, setSubChoiceOptions] = useState<Record<string, ApiListItem[]>>({});
    // Estado para a seleção final do jogador dentro de uma sub-escolha
    const [subChoiceSelection, setSubChoiceSelection] = useState<Record<string, string>>({});
    // Estado para armazenar os detalhes dos itens selecionados para exibição
    const [selectedEquipmentDetails, setSelectedEquipmentDetails] = useState<Record<string, Partial<InventoryItem> | null>>({});

    /**
     * `equipmentChoiceGroups` e `fixedEquipment` são calculados com `useMemo`.
     * Eles processam os dados da API da classe e do antecedente para separar
     * os itens que são concedidos automaticamente (fixos) daqueles que exigem
     * uma escolha do jogador (grupos de escolha).
     */
    const { equipmentChoiceGroups, fixedEquipment } = useMemo(() => {
        const choiceGroups: { id: string, desc: string, choices: ApiEquipmentOption[] }[] = [];
        const fixed: { item: ApiEquipment, quantity: number }[] = [];

        // Adiciona equipamentos e opções da CLASSE
        if (classDetails) {
            (classDetails.starting_equipment || []).forEach(eq => {
                if (eq.equipment) {
                    fixed.push({ item: eq.equipment, quantity: eq.quantity });
                }
            });
            (classDetails.starting_equipment_options || []).forEach((choice, i) => {
                choiceGroups.push({
                    id: `class-${i}`,
                    desc: `Escolha de Equipamento da Classe (${i + 1})`,
                    choices: [choice]
                });
            });
        }
        
        // Adiciona equipamentos e opções do ANTECEDENTE
        if (backgroundDetails) {
            (backgroundDetails.starting_equipment || []).forEach(eq => {
                if (eq.equipment) {
                    fixed.push({ item: eq.equipment, quantity: eq.quantity });
                }
            });
            (backgroundDetails.starting_equipment_options || []).forEach((choice, i) => {
                 choiceGroups.push({
                    id: `bg-${i}`,
                    desc: `Escolha de Equipamento do Antecedente (${i + 1})`,
                    choices: [choice]
                });
            });
        }
        
        return { equipmentChoiceGroups: choiceGroups, fixedEquipment: fixed };
    }, [classDetails, backgroundDetails]);

    /**
     * Gerencia a seleção de alto nível do jogador dentro de um grupo de escolha.
     * Se a opção selecionada for uma categoria, dispara a busca pelos itens dessa categoria.
     */
    const handleEquipmentChange = useCallback(async (groupId: string, choiceIndex: number, optionIdxString: string) => {
        const optionIndex = parseInt(optionIdxString, 10);
        const group = equipmentChoiceGroups.find(g => g.id === groupId);
        const choice = group?.choices[choiceIndex];
        const optionWrapper = choice?.from.options?.[optionIndex];
        
        if (!optionWrapper) return;
        
        const option = optionWrapper.item || optionWrapper;
        const choiceKey = `${groupId}-${choiceIndex}`;

        // Atualiza a escolha principal
        setEquipmentChoices(prev => ({ ...prev, [choiceKey]: option }));

        // Limpa seleções de sub-escolha e detalhes antigos para este grupo
        setSubChoiceSelection(prev => { const next = {...prev}; delete next[choiceKey]; return next; });
        setSelectedEquipmentDetails(prev => {
            const next = {...prev};
            delete next[`choice-${choiceKey}`];
            delete next[`subchoice-${choiceKey}`];
            return next;
        });
        setSubChoiceOptions(prev => { const next = {...prev}; delete next[choiceKey]; return next; });
        
        // Se a opção for uma categoria, busca os itens correspondentes na API
        if (option.type === 'choice' && option.from.option_set_type === 'equipment_category' && option.from.equipment_category?.index) {
            const data = await DndApiService.getEquipmentForCategory(option.from.equipment_category.index);
            setSubChoiceOptions(prev => ({ ...prev, [choiceKey]: data?.equipment || [] }));
        } else if (option.of) {
            // Se for um item direto, busca seus detalhes para exibição
            const details = await DndApiService.getEquipmentDetails(option.of.index);
            setSelectedEquipmentDetails(prev => ({ ...prev, [`choice-${choiceKey}`]: translateEquipment(details) }));
        }
    }, [equipmentChoiceGroups]);

    /**
     * Gerencia a seleção final do jogador dentro de uma sub-escolha (categoria).
     * Busca os detalhes do item selecionado para exibição.
     */
    const handleSubEquipmentChange = useCallback(async (groupId: string, choiceIndex: number, itemIndex: string) => {
        const choiceKey = `${groupId}-${choiceIndex}`;
        if (!itemIndex) return;

        setSubChoiceSelection(prev => ({ ...prev, [choiceKey]: itemIndex }));

        const details = await DndApiService.getEquipmentDetails(itemIndex);
        setSelectedEquipmentDetails(prev => ({ ...prev, [`subchoice-${choiceKey}`]: translateEquipment(details) }));
    }, []);

    // Constrói o inventário final com base em todas as seleções.
    const finalInventory = useMemo<InventoryItem[]>(() => {
        const inventory: InventoryItem[] = [];

        // Adiciona itens fixos
        fixedEquipment.forEach(eq => {
            if (eq.item) {
                inventory.push({ ...eq.item, id: uuidv4(), quantity: eq.quantity, equipped: false });
            }
        });

        // Adiciona itens das escolhas
        Object.keys(equipmentChoices).forEach(key => {
            const choice = equipmentChoices[key];
            const subSelection = subChoiceSelection[key];

            if (subSelection) { // Item de uma sub-escolha de categoria
                const details = selectedEquipmentDetails[`subchoice-${key}`];
                if (details) {
                    inventory.push({ ...details, id: uuidv4(), quantity: 1, equipped: false } as InventoryItem);
                }
            } else if (choice.of) { // Item direto de uma escolha
                const details = selectedEquipmentDetails[`choice-${key}`];
                 if (details) {
                    inventory.push({ ...details, id: uuidv4(), quantity: choice.count || 1, equipped: false } as InventoryItem);
                 }
            } else if (choice.type === 'multiple') { // Múltiplos itens de uma única escolha
                choice.from.options.forEach(opt => {
                     inventory.push({ ...opt.of, id: uuidv4(), quantity: opt.count, equipped: false });
                });
            }
        });

        return inventory;
    }, [fixedEquipment, equipmentChoices, subChoiceSelection, selectedEquipmentDetails]);
    
    // Verifica se todas as escolhas de equipamento foram feitas
    const isEquipmentComplete = useMemo(() => {
        return equipmentChoiceGroups.every(group =>
            group.choices.every((choice, index) => {
                const choiceKey = `${group.id}-${index}`;
                const selection = equipmentChoices[choiceKey];
                if (!selection) return false;
                // Se a escolha requer uma sub-seleção, verifica se ela foi feita
                if (selection.type === 'choice' && selection.from.option_set_type === 'equipment_category') {
                    return !!subChoiceSelection[choiceKey];
                }
                return true;
            })
        );
    }, [equipmentChoiceGroups, equipmentChoices, subChoiceSelection]);


    return {
        fixedEquipment,
        equipmentChoiceGroups,
        equipmentChoices,
        subChoiceOptions,
        subChoiceSelection,
        selectedEquipmentDetails,
        handleEquipmentChange,
        handleSubEquipmentChange,
        finalInventory,
        isEquipmentComplete,
    };
};
