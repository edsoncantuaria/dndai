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
            if (isObject(source[key]) && key in target && isObject(target[key])) {
                 // For arrays, we replace the entire array instead of merging
                if (Array.isArray(source[key])) {
                     output[key] = source[key];
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

// Function to create a lean summary of the character for the AI prompt
const createCharacterSummary = (character: Character) => {
    const { 
        classLevelsData, 
        subclassLevelsData,
        ...summary 
    } = character;
    
    return {
        ...summary,
        // Convert complex objects to simple string arrays for the AI
        inventory: summary.inventory.map(item => `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`),
        proficiencies: summary.proficiencies.map(p => p.name),
        conditions: summary.conditions.map(c => c.name),
    };
};

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

    const saveGame = useCallback((char: Character | null, gameLog: LogEntry[]) => {
        if (char) {
            try {
                const gameState = { character: char, log: gameLog };
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
            } catch (error) {
                console.error("Falha ao salvar o jogo no localStorage:", error);
            }
        }
    }, []);

    // --- Core State Management ---
    
    useEffect(() => {
        if (!isLoading) {
            saveGame(character, log);
        }
    }, [character, log, isLoading, saveGame]);
    
    useEffect(() => {
        try {
            const savedGame = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedGame) {
                const { character: savedCharacter, log: savedLog } = JSON.parse(savedGame);
                setCharacter(savedCharacter);
                setLog(savedLog || []);
                setActionOptions([]);
            }
        } catch (error) {
            console.error("Falha ao carregar o jogo:", error);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleApiResponse = useCallback((response: newGeminiService.GameMasterResponse | null) => {
        if (!response) {
            setLog(prev => [...prev, { id: uuidv4(), type: 'system', content: 'O Mestre parece distraído. Tente novamente.' }]);
            setActionOptions(prev => prev.length > 0 ? prev : ['Tentar novamente.']);
            return;
        }
        
        if (response.updatedCharacter && character) {
             const updatedCharacterState = mergeDeep(character, response.updatedCharacter);
            
            // Recalculate derived stats after merging
            const newModifiers = characterUtils.calculateModifiers(updatedCharacterState.attributes);
            updatedCharacterState.modifiers = newModifiers;
            updatedCharacterState.ac = characterUtils.calculateAC(updatedCharacterState.inventory, newModifiers);
            updatedCharacterState.carryingCapacity = characterUtils.calculateCarryingCapacity(updatedCharacterState.attributes.strength);
            updatedCharacterState.currentWeight = updatedCharacterState.inventory.reduce((sum: number, item: InventoryItem) => sum + (item.weight || 0) * item.quantity, 0);

            setCharacter(updatedCharacterState);
        } else {
             // If only log/actions change, we still need to trigger a save by updating the character object reference
            setCharacter(prev => prev ? {...prev} : null);
        }
        
        if (response.logEntries) {
            const newLogEntries = (response.logEntries || []).map(entry => ({ ...entry, id: uuidv4() }));
            setLog(prev => [...prev, ...newLogEntries]);
        }
        
        if (response.actionOptions) {
            setActionOptions(response.actionOptions);
        }
        if (response.combatState) setCombatState(response.combatState);
        if (response.levelUpState) setLevelUpState(prev => ({ ...(prev || {isPending: false, newLevel: 0, choices: {}}), ...response.levelUpState }));
        if (response.shopState) setShopState(response.shopState);
        if (response.lootOffer) setPendingLootOffer(response.lootOffer);
        if (response.useHitDiceRequest) setPendingHitDiceRequest(response.useHitDiceRequest);

    }, [character]);


    const processPlayerAction = useCallback(async (action: string) => {
        if (!character) return;
        
        setIsLoading(true);
        const newActionLogEntry: LogEntry = { id: uuidv4(), type: 'action', content: action };
        const currentLog = [...log, newActionLogEntry];
        setLog(currentLog);
        setActionOptions([]);
        
        const characterSummary = createCharacterSummary(character);
        const gameUpdateInput = {
          character: characterSummary as any, // Cast to any to match the simplified schema
          playerAction: action,
          gameLog: currentLog.slice(-10) 
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
        setLog([]); 
        
        const newCharacter = await characterUtils.initializeNewCharacter(info);
        
        const characterSummary = createCharacterSummary(newCharacter);
        const initialStoryInput = {
            character: characterSummary as any,
            playerAction: 'A aventura começa. Onde eu estou e o que está acontecendo?',
            gameLog: [],
        };
        
        console.log('[useGameState] Enviando para a IA (história inicial):', initialStoryInput);
        const response = await newGeminiService.getInitialStory(initialStoryInput);

        // Set character state AFTER the initial story is generated to include AI's initial updates
        let finalCharacter = newCharacter;
        if (response?.updatedCharacter) {
            finalCharacter = mergeDeep(newCharacter, response.updatedCharacter);
        }
        setCharacter(finalCharacter); // This is the first time we set the character
        
        // This will now only handle the log entries and actions from the initial response
        handleApiResponse(response);
        setIsLoading(false); // Set loading to false only after everything is done
    }, [handleApiResponse]);

    const startNewGame = useCallback(() => {
        setIsLoading(true);
        setCharacter(null);
        setLog([]);
        setActionOptions([]);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
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
                return item;
            });
            const newCharacter = { ...prev, inventory: newInventory };
            newCharacter.ac = characterUtils.calculateAC(newInventory, newCharacter.modifiers);
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