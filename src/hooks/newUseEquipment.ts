// src/hooks/newUseEquipment.ts
import { useState, useMemo, useCallback, useEffect } from 'react';
import * as DndApiService from '../services/dndApiService';
import {
    ApiClass, ApiBackground, ApiEquipmentOption, InventoryItem, ApiEquipment, ApiListItem
} from '../types';
import { translateEquipment } from '../utils/TranslatorEquipments';
import { v4 as uuidv4 } from 'uuid';

/**
 * Este hook gerencia o estado e a lógica para a seleção de equipamentos iniciais de um personagem.
 * Ele busca e processa as opções da classe e do antecedente diretamente da API,
 * trata de sub-escolhas dinâmicas (como categorias de armas) e garante que as regras sejam seguidas.
 */
export const useNewEquipment = (classDetails: ApiClass | null, backgroundDetails: ApiBackground | null) => {
    // Estado para as escolhas principais do jogador (ex: a opção 'a' ou 'b' de um grupo).
    // A chave é um ID único para o grupo de escolha, e o valor é a opção da API selecionada.
    const [equipmentChoices, setEquipmentChoices] = useState<Record<string, ApiEquipmentOption | null>>({});

    // Estado para as opções de sub-escolha carregadas dinamicamente (ex: a lista de 'Armas Simples').
    const [subChoiceOptions, setSubChoiceOptions] = useState<Record<string, { isLoading: boolean, options: ApiListItem[] }>>({});

    // Estado para a seleção final do jogador dentro de uma sub-escolha de categoria.
    const [subChoiceSelection, setSubChoiceSelection] = useState<Record<string, string>>({});
    
    // Estado para armazenar os detalhes completos dos itens selecionados para exibição no ItemCard.
    const [selectedEquipmentDetails, setSelectedEquipmentDetails] = useState<Record<string, Partial<InventoryItem> | null>>({});

    // Estado para indicar o carregamento inicial dos dados de equipamento.
    const [isEquipmentLoading, setIsEquipmentLoading] = useState(true);

    /**
     * Processa os dados da API da classe e do antecedente para separar os itens
     * que são concedidos automaticamente (fixos) daqueles que exigem uma escolha do jogador.
     */
    const { equipmentChoiceGroups, fixedEquipment } = useMemo(() => {
        const choiceGroups: { id: string, desc: string, choice: ApiEquipmentOption }[] = [];
        const fixed: { item: ApiEquipment, quantity: number }[] = [];

        const processEquipmentSource = (source: ApiClass | ApiBackground | null, prefix: string) => {
            if (!source) return;

            (source.starting_equipment || []).forEach(eq => {
                if (eq.equipment) {
                    fixed.push({ item: eq.equipment, quantity: eq.quantity });
                }
            });
            (source.starting_equipment_options || []).forEach((choice, i) => {
                choiceGroups.push({
                    id: `${prefix}-${i}`,
                    desc: choice.desc || `Escolha de Equipamento (${prefix.toUpperCase()} ${i + 1})`,
                    choice: choice,
                });
            });
        };
        
        processEquipmentSource(classDetails, 'class');
        processEquipmentSource(backgroundDetails, 'bg');
        
        // Corrigido: Retornar as variáveis corretas que foram declaradas dentro do escopo do useMemo.
        return { equipmentChoiceGroups: choiceGroups, fixedEquipment: fixed };
    }, [classDetails, backgroundDetails]);

    useEffect(() => {
        setIsEquipmentLoading(!classDetails || !backgroundDetails);
    }, [classDetails, backgroundDetails]);


    /**
     * Gerencia a seleção de alto nível do jogador. Se a opção for uma categoria,
     * dispara a busca pelos itens dessa categoria na API.
     */
    const handleEquipmentChange = useCallback(async (groupId: string, optionIdxString: string) => {
        const optionIndex = parseInt(optionIdxString, 10);
        if (isNaN(optionIndex) || optionIndex < 0) {
            setEquipmentChoices(prev => ({ ...prev, [groupId]: null }));
            return;
        }

        const group = equipmentChoiceGroups.find(g => g.id === groupId);
        const optionWrapper = group?.choice.from.options?.[optionIndex];
        
        if (!optionWrapper) return;
        
        const option = optionWrapper; // Use o wrapper completo

        // Limpa seleções de sub-escolha e detalhes antigos para este grupo.
        setEquipmentChoices(prev => ({ ...prev, [groupId]: option }));
        setSubChoiceSelection(prev => { const next = {...prev}; delete next[groupId]; return next; });
        setSelectedEquipmentDetails(prev => {
            const next = {...prev};
            delete next[`choice-${groupId}`];
            delete next[`subchoice-${groupId}`];
            return next;
        });

        // Se a opção for uma escolha de categoria, busca os itens correspondentes.
        if (option.type === 'choice' && option.from.option_set_type === 'equipment_category' && option.from.equipment_category?.index) {
            setSubChoiceOptions(prev => ({ ...prev, [groupId]: { isLoading: true, options: [] } }));
            const data = await DndApiService.getEquipmentForCategory(option.from.equipment_category.index);
            const translatedOptions = (data?.equipment || []).map(e => ({...e, name: translateEquipment(e.name)}));
            setSubChoiceOptions(prev => ({ ...prev, [groupId]: { isLoading: false, options: translatedOptions } }));
        } else if (option.of?.index) {
            // Se for um item direto, busca seus detalhes para exibição.
            const details = await DndApiService.getEquipmentDetails(option.of.index);
            setSelectedEquipmentDetails(prev => ({ ...prev, [`choice-${groupId}`]: details ? translateEquipment(details) : null }));
        } else {
            // Limpa as sub-opções se a escolha não for uma categoria
            setSubChoiceOptions(prev => {
                const next = {...prev};
                delete next[groupId];
                return next;
            });
        }
    }, [equipmentChoiceGroups]);

    /**
     * Gerencia a seleção final do jogador dentro de uma sub-escolha de categoria.
     * Busca os detalhes do item para exibição.
     */
    const handleSubEquipmentChange = useCallback(async (groupId: string, itemIndex: string) => {
        if (!itemIndex) return;

        setSubChoiceSelection(prev => ({ ...prev, [groupId]: itemIndex }));

        const details = await DndApiService.getEquipmentDetails(itemIndex);
        setSelectedEquipmentDetails(prev => ({ ...prev, [`subchoice-${groupId}`]: details ? translateEquipment(details) : null }));
    }, []);

    // Constrói o inventário final com base em todas as seleções feitas.
    const finalInventory = useMemo<InventoryItem[]>(() => {
        const inventory: InventoryItem[] = [];
        const processedIds = new Set<string>();

        fixedEquipment.forEach(eq => {
            if (eq.item && !processedIds.has(eq.item.index)) {
                inventory.push({ ...translateEquipment(eq.item), id: uuidv4(), quantity: eq.quantity, equipped: false } as InventoryItem);
                processedIds.add(eq.item.index);
            }
        });

        Object.keys(equipmentChoices).forEach(groupId => {
            const choice = equipmentChoices[groupId];
            const subSelectionIndex = subChoiceSelection[groupId];

            if (subSelectionIndex) { // Item de uma sub-escolha de categoria.
                const details = selectedEquipmentDetails[`subchoice-${groupId}`];
                if (details && !processedIds.has(details.index!)) {
                    inventory.push({ ...details, id: uuidv4(), quantity: 1, equipped: false } as InventoryItem);
                    processedIds.add(details.index!);
                }
            } else if (choice?.of?.index) { // Item direto de uma escolha.
                const details = selectedEquipmentDetails[`choice-${groupId}`];
                 if (details && !processedIds.has(details.index!)) {
                    inventory.push({ ...details, id: uuidv4(), quantity: choice.count || 1, equipped: false } as InventoryItem);
                    processedIds.add(details.index!);
                 }
            } else if (choice?.type === 'multiple' && choice?.from?.options) { // Múltiplos itens de uma única escolha.
                choice.from.options.forEach(optWrapper => {
                     const opt = optWrapper.of ? optWrapper : (optWrapper as any).item; // Ajuste para diferentes estruturas da API
                     if(opt?.of && !processedIds.has(opt.of.index)) {
                       inventory.push({ ...translateEquipment(opt.of), id: uuidv4(), quantity: opt.count, equipped: false } as InventoryItem);
                       processedIds.add(opt.of.index);
                     }
                });
            }
        });
        
        // Adiciona ouro inicial do antecedente, se houver.
        const gold = backgroundDetails?.starting_gold ?? 0;
        if(gold > 0){
            inventory.push({
                id: uuidv4(),
                index: 'gold-pouch',
                name: `Bolsa contendo ${gold} moedas de ouro`,
                quantity: 1,
                equipped: false,
                cost: { quantity: gold, unit: 'gp' }
            } as InventoryItem);
        }

        return inventory;
    }, [fixedEquipment, equipmentChoices, subChoiceSelection, selectedEquipmentDetails, backgroundDetails]);
    
    // Verifica se todas as escolhas de equipamento obrigatórias foram feitas.
    const isEquipmentComplete = useMemo(() => {
        if(equipmentChoiceGroups.length === 0) return true;
        return equipmentChoiceGroups.every(group => {
            const selection = equipmentChoices[group.id];
            if (!selection) return false;
            
            // Se a escolha requer uma sub-seleção (é uma categoria), verifica se a sub-seleção foi feita.
            if (selection.type === 'choice' && selection.from.option_set_type === 'equipment_category') {
                return !!subChoiceSelection[group.id];
            }
            return true; // Se não for uma categoria, a seleção principal é suficiente.
        });
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
        isEquipmentLoading,
    };
};
