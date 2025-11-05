// src/hooks/useInteractionManager.ts
import { useState, useCallback } from 'react';
import type {
    PlayerRollRequest, CombatState, LevelUpState, ShopState,
    LootOffer, UseHitDiceRequest, ApiSpell, ShopItem, InventoryItem
} from '../types';
import { translateApiString } from '@/utils/translator';

const INITIAL_COMBAT_STATE: CombatState = {
    isActive: false,
    round: 1,
    turn: 0,
    combatants: [],
    initiativeOrder: [],
};

type RequestType = 'roll' | 'skill' | 'spell' | 'levelUp' | 'shop' | 'loot' | 'hitDice';

export type SkillCheckRequestState = {
    skillName: string;
    baseAction?: string;
    promptText?: string;
};

export type SpellCastRequestState = {
    spell: ApiSpell;
    slotLevel?: number;
    slotsBefore?: { current: number; max: number };
};

export const useInteractionManager = () => {
    const [actionOptions, setActionOptions] = useState<(string | { text: string; action: string, skill?: string })[]>([]);
    const [combatState, setCombatState] = useState<CombatState>(INITIAL_COMBAT_STATE);

    // Modal/Request states
    const [playerRollRequest, setPlayerRollRequest] = useState<PlayerRollRequest | null>(null);
    const [skillCheckRequest, setSkillCheckRequest] = useState<SkillCheckRequestState | null>(null);
    const [spellCastRequest, setSpellCastRequest] = useState<SpellCastRequestState | null>(null);
    const [levelUpState, setLevelUpState] = useState<LevelUpState | null>(null);
    const [shopState, setShopState] = useState<ShopState | null>(null);
    const [pendingLootOffer, setPendingLootOffer] = useState<LootOffer | null>(null);
    const [pendingHitDiceRequest, setPendingHitDiceRequest] = useState<UseHitDiceRequest | null>(null);
    
    const setRequest = useCallback(({ type, request }: { type: RequestType, request: any }) => {
        switch (type) {
            case 'roll': setPlayerRollRequest(request); break;
            case 'skill': setSkillCheckRequest(request); break;
            case 'spell': setSpellCastRequest(request); break;
            case 'levelUp': setLevelUpState(request); break;
            case 'shop': setShopState(request); break;
            case 'loot': setPendingLootOffer(request); break;
            case 'hitDice': setPendingHitDiceRequest(request); break;
        }
    }, []);

    const clearRequest = useCallback((type: RequestType) => {
        switch (type) {
            case 'roll': setPlayerRollRequest(null); break;
            case 'skill': setSkillCheckRequest(null); break;
            case 'spell': setSpellCastRequest(null); break;
            case 'levelUp': setLevelUpState(null); break;
            case 'shop': setShopState(null); break;
            case 'loot': setPendingLootOffer(null); break;
            case 'hitDice': setPendingHitDiceRequest(null); break;
        }
    }, []);
    
    const clearTransientInteractions = useCallback(() => {
        setPendingHitDiceRequest(null);
        setPendingLootOffer(null);
    }, []);

    const clearAllInteractions = useCallback(() => {
        setActionOptions([]);
        setCombatState(INITIAL_COMBAT_STATE);
        setPlayerRollRequest(null);
        setSkillCheckRequest(null);
        setSpellCastRequest(null);
        setLevelUpState(null);
        setShopState(null);
        clearTransientInteractions();
    }, [clearTransientInteractions]);

    // --- Action Handlers that depend on processPlayerAction ---
    const handleRollResult = useCallback((processPlayerAction: (action: string, sessionIdOverride?: number, modelOverride?: string) => void) => (result: { rawRoll: number; rolls: number[] }) => {
        if (!playerRollRequest) return;
        const total = result.rawRoll + (playerRollRequest.modifier || 0);
        const actionText = `O resultado da minha rolagem de ${playerRollRequest.reason} foi ${total}. (Dado: ${result.rawRoll} + Mod: ${playerRollRequest.modifier})`;
        setPlayerRollRequest(null);
        processPlayerAction(actionText);
    }, [playerRollRequest]);

    const handleSkillCheckSubmit = useCallback((processPlayerAction: (action: string, sessionIdOverride?: number, modelOverride?: string) => void) => (description: string, modelOverride?: string) => {
        if (!skillCheckRequest) return;
        const translatedSkill = translateApiString(skillCheckRequest.skillName);
        const base = skillCheckRequest.baseAction || `Eu tento usar ${translatedSkill}.`;
        const actionText = description
            ? `${base}${base.trim().endsWith('.') ? '' : '.'} Detalhes: ${description}`
            : base;
        setSkillCheckRequest(null);
        processPlayerAction(actionText, undefined, modelOverride);
    }, [skillCheckRequest]);

    const submitSpellCast = useCallback((processPlayerAction: (action: string, sessionIdOverride?: number, modelOverride?: string) => void) => (spell: ApiSpell, description: string) => {
        const slotLevel = spellCastRequest?.slotLevel && spellCastRequest.slotLevel > 0 ? spellCastRequest.slotLevel : null;
        let actionText = '';
        if (slotLevel) {
            actionText = `Eu gasto um espaço de magia de nível ${slotLevel} e conjuro ${spell.name}`;
        } else {
            actionText = `Eu conjuro ${spell.name}`;
        }
        if (description) {
            actionText += `: ${description}`;
        } else {
            actionText += '.';
        }
        if (slotLevel && spellCastRequest?.slotsBefore) {
            actionText += ` (Antes da conjuração: ${spellCastRequest.slotsBefore.current}/${spellCastRequest.slotsBefore.max} espaços de nível ${slotLevel} restantes.)`;
        }
        setSpellCastRequest(null);
        processPlayerAction(actionText);
    }, [spellCastRequest]);

    const handleTakeLoot = useCallback((processPlayerAction: (action: string, sessionIdOverride?: number, modelOverride?: string) => void) => (takeAll: boolean) => {
        if (!pendingLootOffer) return;
        setPlayerRollRequest(null);
        if (takeAll) {
            processPlayerAction('Eu pego todo o tesouro.');
        }
    }, [pendingLootOffer]);

    const handleBuyItem = useCallback((processPlayerAction: (action: string, sessionIdOverride?: number, modelOverride?: string) => void) => (item: ShopItem, price: number) => {
        setPlayerRollRequest(null);
        processPlayerAction(`Eu quero comprar ${item.name} por ${price} ${item.cost.unit}.`);
    }, []);

    const handleSellItem = useCallback((processPlayerAction: (action: string, sessionIdOverride?: number, modelOverride?: string) => void) => (item: InventoryItem, price: number) => {
        setPlayerRollRequest(null);
        processPlayerAction(`Eu quero vender meu ${item.name} por ${price} gp.`);
    }, []);
    
    const nextTurn = useCallback((processPlayerAction: (action: string, sessionIdOverride?: number, modelOverride?: string) => void) => () => {
        processPlayerAction("Processar próximo turno");
    }, []);

     // --- Debug/Test Triggers ---
    const triggerTestShop = useCallback(() => {
        setShopState({
            isOpen: true,
            isHaggling: false,
            name: "Loja de Testes do Ferreiro",
            inventory: [
                { id: 'item-1', index: 'potion-of-healing', name: 'Poção de Cura', cost: { quantity: 50, unit: 'gp' }, quantity: 5, equipped: false },
                { id: 'item-2', index: 'longsword', name: 'Espada Longa +1', cost: { quantity: 500, unit: 'gp' }, quantity: 1, equipped: false },
                { id: 'item-3', index: 'rations', name: 'Rações (1 dia)', cost: { quantity: 5, unit: 'sp' }, quantity: Infinity, equipped: false },
            ],
            sellPrices: { 'player-item-1': 25, 'player-item-2': 10 },
        });
    }, []);

    const triggerTestCombat = useCallback(() => {
        setCombatState({
            isActive: true,
            round: 2,
            turn: 1, // Goblin's turn
            initiativeOrder: ['player', 'goblin-1', 'goblin-2'],
            combatants: [
                { id: 'player', name: 'Herói de Teste', isPlayer: true, hp: { current: 45, max: 50 }, ac: 16, initiative: 18, hasMoved: false, hasActed: false, actionPoints: 1, bonusActionPoints: 1, conditions: [], rollHistory: [] },
                { id: 'goblin-1', name: 'Goblin Batedor', hp: { current: 7, max: 7 }, ac: 13, initiative: 15, hasMoved: false, hasActed: false, actionPoints: 1, bonusActionPoints: 1, conditions: [], rollHistory: [], isDead: false },
                { id: 'goblin-2', name: 'Goblin Arqueiro', hp: { current: 5, max: 7 }, ac: 13, initiative: 12, hasMoved: false, hasActed: false, actionPoints: 1, bonusActionPoints: 1, conditions: ['Frightened'], rollHistory: [], isDead: false },
            ],
        });
    }, []);

    const triggerTestSkillCheck = useCallback((skillName: string) => {
        setSkillCheckRequest({ skillName });
    }, []);
    
    return {
        actionOptions, setActionOptions,
        combatState, setCombatState,
        playerRollRequest, setPlayerRollRequest,
        skillCheckRequest, setSkillCheckRequest,
        spellCastRequest, setSpellCastRequest,
        levelUpState,
        shopState,
        pendingLootOffer,
        pendingHitDiceRequest,
        
        setRequest,
        clearRequest,
        clearTransientInteractions,
        clearAllInteractions,
        
        // Handlers that need processPlayerAction
        handleRollResult,
        handleSkillCheckSubmit,
        submitSpellCast,
        handleTakeLoot,
        handleBuyItem,
        handleSellItem,
        nextTurn,

        // Debug triggers
        triggerTestShop,
        triggerTestCombat,
        triggerTestSkillCheck,
    };
};
