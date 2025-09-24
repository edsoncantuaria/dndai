// hooks/newUseGameState.ts
'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Character, NewCharacterInfo, LogEntry, CombatState, LevelUpState, ShopState, LootOffer, UseHitDiceRequest, LevelUpSelections, ApiSpell, InventoryItem, ShopItem, Feat } from '../types';
import * as newGeminiService from '../services/newGeminiService';
import * as characterUtils from '../utils/characterUtils';
import * as DndApiService from '../services/dndApiService';
import { v4 as uuidv4 } from 'uuid';

const LOCAL_STORAGE_KEY = 'rpg-de-cria-savegame-v2';

// A simple deep merge utility for updating character state
function mergeDeep(target: any, source: any): any {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = mergeDeep(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

function isObject(item: any): boolean {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

export const useNewGameState = () => {
    const [character, setCharacter] = useState<Character | null>(null);
    const [log, setLog] = useState<LogEntry[]>([]);
    const [actionOptions, setActionOptions] = useState<string[]>([]);
    const [combatState, setCombatState] = useState<CombatState>({ isActive: false, round: 0, turn: 0, combatants: [] });
    const [levelUpState, setLevelUpState] = useState<LevelUpState | null>(null);
    const [shopState, setShopState] = useState<ShopState | null>(null);
    const [pendingLootOffer, setPendingLootOffer] = useState<LootOffer | null>(null);
    const [pendingHitDiceRequest, setPendingHitDiceRequest] = useState<UseHitDiceRequest | null>(null);
    const [isLoading, setIsLoading] = useState(true); // Start as true to check for saved game

    // --- Core State Management ---
    
    // NEW: Use useEffect to save game state whenever character or log changes.
    // This is more reliable than calling saveGame manually from multiple places.
    useEffect(() => {
        if (character && !isLoading) { // Only save if a game is loaded and not during initial load
            try {
                const gameState = { character, log };
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
                console.log("[useNewGameState] Jogo salvo no localStorage.");
            } catch (error) {
                console.error("Falha ao salvar o jogo no localStorage:", error);
            }
        }
    }, [character, log, isLoading]);
    
    // Auto-load on initial mount
    useEffect(() => {
        try {
            const savedGame = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedGame) {
                const { character: savedCharacter, log: savedLog } = JSON.parse(savedGame);
                setCharacter(savedCharacter);
                setLog(savedLog || []);
                // Clear transient states that shouldn't persist
                setActionOptions([]);
                setIsLoading(false);
                 console.log("[useNewGameState] Jogo carregado do localStorage.");
            } else {
                setIsLoading(false); // No saved game found
            }
        } catch (error) {
            console.error("Falha ao carregar o jogo:", error);
            localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear corrupted data
            setIsLoading(false);
        }
    }, []);

    const handleApiResponse = useCallback((response: newGeminiService.GameMasterResponse | null) => {
        if (!response) {
            setLog(prev => [...prev, { id: uuidv4(), type: 'system', content: 'O Mestre parece distraído. Tente novamente.' }]);
            setActionOptions(prev => prev.length > 0 ? prev : ['Tentar novamente.']);
            return;
        }

        // 1. Update character state first
        if (response.updatedCharacter) {
             setCharacter(prev => {
                if (!prev) return null;
                const updated = mergeDeep(prev, response.updatedCharacter);
                
                // Recalculate derived stats
                const newModifiers = characterUtils.calculateModifiers(updated.attributes);
                updated.modifiers = newModifiers;
                updated.ac = characterUtils.calculateAC(updated.inventory, newModifiers);
                updated.carryingCapacity = characterUtils.calculateCarryingCapacity(updated.attributes.strength);
                updated.currentWeight = updated.inventory.reduce((sum: number, item: InventoryItem) => sum + (item.weight || 0) * item.quantity, 0);

                return updated;
            });
        }
        
        // 2. Update log
        if (response.logEntries) {
            const newLogEntries = (response.logEntries || []).map(entry => ({ ...entry, id: uuidv4() }));
            setLog(prev => [...prev, ...newLogEntries]);
        }
        
        // 3. Update other game states
        if (response.actionOptions) {
            setActionOptions(response.actionOptions);
        }
        if (response.combatState) setCombatState(response.combatState);
        if (response.levelUpState) setLevelUpState(prev => ({ ...(prev || {isPending: false, newLevel: 0, choices: {}}), ...response.levelUpState }));
        if (response.shopState) setShopState(response.shopState);
        if (response.lootOffer) setPendingLootOffer(response.lootOffer);
        if (response.useHitDiceRequest) setPendingHitDiceRequest(response.useHitDiceRequest);

    }, []);


    const processPlayerAction = useCallback(async (action: string) => {
        if (!character) return;
        
        setIsLoading(true);
        const newActionLogEntry: LogEntry = { id: uuidv4(), type: 'action', content: action };
        const currentLog = [...log, newActionLogEntry];
        setLog(currentLog);
        setActionOptions([]);
        
        const gameUpdateInput = {
          character,
          playerAction: action,
          gameLog: log.slice(-10) // Send only the last 10 log entries for brevity
        };
        console.log('[useGameState] Enviando para a IA:', gameUpdateInput);

        const response = await newGeminiService.getGameUpdate(gameUpdateInput);
        
        console.log("[useGameState] Resposta recebida do Gemini:", response);
        handleApiResponse(response);
        setIsLoading(false);

    }, [character, log, handleApiResponse]);

    // --- Character Creation & Game Lifecycle ---

    const createCharacter = useCallback(async (info: NewCharacterInfo) => {
        setIsLoading(true);
        
        const newCharacter = await characterUtils.initializeNewCharacter(info);

        const initialStoryInput = {
            character: newCharacter,
            playerAction: 'A aventura começa. Onde eu estou e o que está acontecendo?',
            gameLog: [],
        };
        
        console.log('[useGameState] Enviando para a IA (história inicial):', initialStoryInput);
        const response = await newGeminiService.getInitialStory(initialStoryInput);
        
        // Set the character state, which will trigger the useEffect to save the game
        setCharacter(newCharacter); 
        setLog([]); 

        handleApiResponse(response);
        setIsLoading(false);
    }, [handleApiResponse]);

    const startNewGame = useCallback(() => {
        setIsLoading(true); // Prevent saving while resetting
        setCharacter(null);
        setLog([]);
        setActionOptions([]);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        console.log("[useNewGameState] Novo jogo iniciado, localStorage limpo.");
        setIsLoading(false);
    }, []);

    // --- Specific Game Actions ---

    const applyLevelUp = useCallback((selections: LevelUpSelections) => {
        const action = `(OOC: Eu subo de nível. Minhas escolhas são: ${JSON.stringify(selections)})`;
        setLevelUpState(null);
        processPlayerAction(action);
    }, [processPlayerAction]);
    
    const toggleEquipped = useCallback((itemId: string) => {
        setCharacter(prev => {
            if (!prev) return null;
            const newInventory = prev.inventory.map(item => {
                if (item.id === itemId) return { ...item, equipped: !item.equipped };
                // Handle weapon/shield un-equipping logic if needed
                return item;
            });
            const newCharacter = { ...prev, inventory: newInventory };
            newCharacter.ac = characterUtils.calculateAC(newInventory, newCharacter.modifiers);
            // The change to 'character' state will trigger the saveGame useEffect
            return newCharacter;
        });
    }, []);
    
    const castSpell = useCallback((spell: ApiSpell) => {
        processPlayerAction(`Eu conjuro a magia: ${spell.name}.`);
    }, [processPlayerAction]);

    const spendHitDice = useCallback((diceCount: number) => {
        setPendingHitDiceRequest(null);
        processPlayerAction(`Eu gasto ${diceCount} dado(s) de vida para me curar.`);
    }, [processPlayerAction]);
    
    const takeLoot = useCallback((accept: boolean) => {
        setPendingLootOffer(null);
        processPlayerAction(accept ? "Eu pego todos os itens." : "Eu deixo os itens para trás.");
    }, [processPlayerAction]);
    
    const buyItem = useCallback((item: ShopItem, price: number) => {
        processPlayerAction(`Eu compro ${item.name} por ${price} moedas de ouro.`);
    }, [processPlayerAction]);

    const sellItem = useCallback((item: InventoryItem, price: number) => {
        processPlayerAction(`Eu vendo ${item.name} por ${price} moedas de ouro.`);
    }, [processPlayerAction]);

    return {
        character,
        log,
        actionOptions,
        combatState,
        levelUpState,
        shopState,
        pendingLootOffer,
        pendingHitDiceRequest,
        isLoading,
        createCharacter,
        processPlayerAction,
        applyLevelUp,
        toggleEquipped,
        castSpell,
        spendHitDice,
        takeLoot,
        buyItem,
        sellItem,
        startNewGame,
    };
};
