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

export const useInteractionManager = () => {
    const [actionOptions, setActionOptions] = useState<(string | { text: string; action: string, skill?: string })[]>([]);
    const [combatState, setCombatState] = useState<CombatState>(INITIAL_COMBAT_STATE);

    // Modal/Request states
    const [playerRollRequest, setPlayerRollRequest] = useState<PlayerRollRequest | null>(null);
    const [skillCheckRequest, setSkillCheckRequest] = useState<{ skillName: string } | null>(null);
    const [spellCastRequest, setSpellCastRequest] = useState<{ spell: ApiSpell } | null>(null);
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
    const handleRollResult = useCallback((processPlayerAction: (action: string) => void) => (result: { total: number; rolls: number[] }) => {
        if (!playerRollRequest) return;
        const actionText = `O resultado da minha rolagem de ${playerRollRequest.reason} foi ${result.total}.`;
        setPlayerRollRequest(null);
        processPlayerAction(actionText);
    }, [playerRollRequest]);

    const handleSkillCheckSubmit = useCallback((processPlayerAction: (action: string) => void) => (description: string) => {
        if (!skillCheckRequest) return;
        const translatedSkill = translateApiString(`Skill: ${skillCheckRequest.skillName}`);
        const actionText = `Eu tento usar ${translatedSkill}${description ? `: ${description}` : '.'}`;
        setSkillCheckRequest(null);
        processPlayerAction(actionText);
    }, [skillCheckRequest]);

    const submitSpellCast = useCallback((processPlayerAction: (action: string) => void) => (spell: ApiSpell, description: string) => {
        const actionText = `Eu conjuro ${spell.name}${description ? `: ${description}` : '.'}`;
        setSpellCastRequest(null);
        processPlayerAction(actionText);
    }, []);

    const handleTakeLoot = useCallback((processPlayerAction: (action: string) => void) => (takeAll: boolean) => {
        if (!pendingLootOffer) return;
        setPlayerRollRequest(null);
        if (takeAll) {
            processPlayerAction('Eu pego todo o tesouro.');
        }
    }, [pendingLootOffer]);

    const handleBuyItem = useCallback((processPlayerAction: (action: string) => void) => (item: ShopItem, price: number) => {
        setPlayerRollRequest(null);
        processPlayerAction(`Eu quero comprar ${item.name} por ${price} ${item.cost.unit}.`);
    }, []);

    const handleSellItem = useCallback((processPlayerAction: (action: string) => void) => (item: InventoryItem, price: number) => {
        setPlayerRollRequest(null);
        processPlayerAction(`Eu quero vender meu ${item.name} por ${price} gp.`);
    }, []);
    
    const nextTurn = useCallback((processPlayerAction: (action: string) => void) => () => {
        processPlayerAction("Processar próximo turno");
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
        
        // Handlers that need processPlayerAction from the main hook
        handleRollResult,
        handleSkillCheckSubmit,
        submitSpellCast,
        handleTakeLoot,
        handleBuyItem,
        handleSellItem,
        nextTurn,
    };
};
