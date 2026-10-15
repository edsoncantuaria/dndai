// src/hooks/useInteractionManager.ts
import { useState, useCallback } from 'react';
import {
    buildBuyItemIntent,
    buildSellItemIntent,
    buildOpenShopIntent,
    buildStartEncounterFromCharacter,
} from '@/hooks/game/motorIntents';
import type { StructuredIntent } from '@/hooks/game/motorIntents';
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

export type SendMotorActionFn = (action: string, structured?: StructuredIntent) => void;

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
    const [pendingStructuredIntent, setPendingStructuredIntent] = useState<any | null>(null);
    
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
        if (type === 'roll') {
            setPendingStructuredIntent(null);
        }
    }, []);
    
    const clearTransientInteractions = useCallback(() => {
        setPendingHitDiceRequest(null);
        setPendingLootOffer(null);
        setPendingStructuredIntent(null);
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

    // --- Action Handlers that depend on sendMotorAction ---
    const handleRollResult = useCallback((
        submitRollResult: (request: PlayerRollRequest, result: { rawRoll: number; rolls: number[] }) => void
    ) => (result: { rawRoll: number; rolls: number[] }) => {
        if (!playerRollRequest) return;
        const currentRequest = playerRollRequest;
        setPlayerRollRequest(null);
        submitRollResult(currentRequest, result);
    }, [playerRollRequest]);

    const handleSkillCheckSubmit = useCallback((sendMotorAction: SendMotorActionFn) => (description: string) => {
        if (!skillCheckRequest) return;
        const translatedSkill = translateApiString(skillCheckRequest.skillName);
        const base = skillCheckRequest.baseAction || `Eu tento usar ${translatedSkill}.`;
        const actionText = description
            ? `${base}${base.trim().endsWith('.') ? '' : '.'} Detalhes: ${description}`
            : base;
        setSkillCheckRequest(null);
        sendMotorAction(actionText);
    }, [skillCheckRequest]);

    const submitSpellCast = useCallback((sendMotorAction: SendMotorActionFn) => (spell: ApiSpell, description: string) => {
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
        sendMotorAction(actionText);
    }, [spellCastRequest]);

    const handleTakeLoot = useCallback((sendMotorAction: SendMotorActionFn) => (takeAll: boolean) => {
        if (!pendingLootOffer) return;
        setPlayerRollRequest(null);
        if (takeAll) {
            sendMotorAction('Eu pego todo o tesouro.', { type: 'claim-loot', payload: {} });
        }
    }, [pendingLootOffer]);

    const handleBuyItem = useCallback((sendMotorAction: SendMotorActionFn) => (item: ShopItem, price: number) => {
        setPlayerRollRequest(null);
        sendMotorAction(`Compro ${item.name} por ${price} ${item.cost.unit}.`, buildBuyItemIntent(item));
    }, []);

    const handleSellItem = useCallback((sendMotorAction: SendMotorActionFn) => (item: InventoryItem, price: number) => {
        setPlayerRollRequest(null);
        const intent = buildSellItemIntent(item, price);
        if (intent.type === 'sell-item' && intent.payload.itemId > 0) {
            sendMotorAction(`Vendo ${item.name} por ${price} gp.`, intent);
        } else {
            sendMotorAction(`Eu quero vender meu ${item.name} por ${price} gp.`);
        }
    }, []);

    const handleOpenShop = useCallback((
        sendMotorAction: SendMotorActionFn,
    ) => (catalog: { name: string; inventory: ShopItem[]; merchantName?: string }) => {
        sendMotorAction(
            `Entro em ${catalog.name} para negociar.`,
            buildOpenShopIntent(catalog.name, catalog.inventory, catalog.merchantName),
        );
    }, []);

    const handleCloseShop = useCallback((sendMotorAction: SendMotorActionFn) => () => {
        setShopState(null);
        sendMotorAction('Saio da loja.', { type: 'close-shop', payload: {} });
    }, []);

    const handleStartEncounter = useCallback((
        sendMotorAction: SendMotorActionFn,
    ) => (
        character: { id: number; name: string; attributes?: { hp?: number; maxHp?: number; ac?: number } },
        hostiles: Array<{ id: string; name: string; hp: number; maxHp: number; ac?: number; initiative?: number }>,
    ) => {
        sendMotorAction('O combate começa!', buildStartEncounterFromCharacter(character, hostiles));
    }, []);
    
    const nextTurn = useCallback((sendMotorAction: SendMotorActionFn) => () => {
        sendMotorAction("Processar próximo turno");
    }, []);

    const handleSkillCheck = useCallback((skillName: string) => {
        setSkillCheckRequest({ skillName });
    }, []);

     // --- Debug/Test Triggers ---
    const getTestShopCatalog = useCallback(() => ({
        name: 'Loja de Testes do Ferreiro',
        merchantName: 'Ferreiro',
        inventory: [
            { id: 'item-1', index: 'potion-of-healing', name: 'Poção de Cura', cost: { quantity: 50, unit: 'gp' }, quantity: 5, equipped: false },
            { id: 'item-2', index: 'longsword', name: 'Espada Longa +1', cost: { quantity: 500, unit: 'gp' }, quantity: 1, equipped: false },
            { id: 'item-3', index: 'rations', name: 'Rações (1 dia)', cost: { quantity: 5, unit: 'sp' }, quantity: 20, equipped: false },
        ] as ShopItem[],
    }), []);

    const triggerTestShop = useCallback((
        sendMotorAction?: (action: string) => void,
    ) => {
        const catalog = getTestShopCatalog();
        if (sendMotorAction) {
            (sendMotorAction as SendMotorActionFn)(
                `Visito ${catalog.name}.`,
                buildOpenShopIntent(catalog.name, catalog.inventory, catalog.merchantName),
            );
            return;
        }
        setShopState({
            isOpen: true,
            isHaggling: false,
            name: catalog.name,
            inventory: catalog.inventory,
            sellPrices: {},
        });
    }, [getTestShopCatalog]);

    const triggerTestCombat = useCallback((
        sendMotorAction?: (action: string) => void,
        character?: { id: number; name: string; attributes?: { hp?: number; maxHp?: number; ac?: number } },
    ) => {
        const hostiles = [
            { id: 'goblin-1', name: 'Goblin Batedor', hp: 7, maxHp: 7, ac: 13, initiative: 12 },
            { id: 'goblin-2', name: 'Goblin Arqueiro', hp: 5, maxHp: 7, ac: 13, initiative: 10 },
        ];
        if (sendMotorAction && character) {
            (sendMotorAction as SendMotorActionFn)(
                'Inimigos surgem — combate!',
                buildStartEncounterFromCharacter(character, hostiles),
            );
            return;
        }
        setCombatState({
            isActive: true,
            round: 1,
            turn: 0,
            initiativeOrder: ['player', 'goblin-1', 'goblin-2'],
            combatants: [
                { id: 'player', name: character?.name ?? 'Herói', isPlayer: true, hp: { current: 45, max: 50 }, ac: 16, initiative: 18, hasMoved: false, hasActed: false, actionPoints: 3, bonusActionPoints: 1, conditions: [], rollHistory: [], isDead: false },
                { id: 'goblin-1', name: 'Goblin Batedor', hp: { current: 7, max: 7 }, ac: 13, initiative: 12, hasMoved: false, hasActed: false, actionPoints: 3, bonusActionPoints: 1, conditions: [], rollHistory: [], isDead: false },
                { id: 'goblin-2', name: 'Goblin Arqueiro', hp: { current: 5, max: 7 }, ac: 13, initiative: 10, hasMoved: false, hasActed: false, actionPoints: 3, bonusActionPoints: 1, conditions: [], rollHistory: [], isDead: false },
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
        
        // Handlers that need sendMotorAction
        handleRollResult,
        handleSkillCheckSubmit,
        handleSkillCheck,
        submitSpellCast,
        handleTakeLoot,
        handleBuyItem,
        handleSellItem,
        handleOpenShop,
        handleCloseShop,
        handleStartEncounter,
        nextTurn,

        // Debug triggers
        triggerTestShop,
        triggerTestCombat,
        getTestShopCatalog,
        triggerTestSkillCheck,
        pendingStructuredIntent,
        setPendingStructuredIntent,
    };
};
