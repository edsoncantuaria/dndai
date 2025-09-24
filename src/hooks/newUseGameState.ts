'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Character, NewCharacterInfo, LogEntry, CombatState, LevelUpState, ShopState, LootOffer, UseHitDiceRequest, InventoryItem, ShopItem, Feat, LevelUpSelections } from '../types';
import * as geminiService from '../services/geminiService';
import * as characterUtils from '../utils/characterUtils';
import * as DndApiService from '../services/dndApiService';
import { v4 as uuidv4 } from 'uuid';

const LOCAL_STORAGE_KEY = 'rpg-de-cria-savegame-v2';

function isObject(item: any): boolean {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

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

export const useNewGameState = () => {
    const [character, setCharacter] = useState<Character | null>(null);
    const [log, setLog] = useState<LogEntry[]>([]);
    const [actionOptions, setActionOptions] = useState<string[]>([]);
    const [combatState, setCombatState] = useState<CombatState>({ isActive: false, round: 0, turn: 0, combatants: [] });
    const [levelUpState, setLevelUpState] = useState<LevelUpState | null>(null);
    const [shopState, setShopState] = useState<ShopState | null>(null);
    const [pendingLootOffer, setPendingLootOffer] = useState<LootOffer | null>(null);
    const [pendingHitDiceRequest, setPendingHitDiceRequest] = useState<UseHitDiceRequest | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const saveGame = useCallback(() => {
        if (character) {
            try {
                const gameState = { character, log };
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
            } catch (error) {
                console.error("Falha ao salvar o jogo no localStorage:", error);
            }
        }
    }, [character, log]);

    useEffect(() => {
        // This effect now automatically saves the game whenever character or log changes.
         if (character && log.length > 0) { // Only save if there's a game in progress
            saveGame();
        }
    }, [character, log, saveGame]);

    const handleApiResponse = useCallback((response: geminiService.GeminiResponse | null) => {
        if (!response) {
            setLog(prev => [...prev, { id: uuidv4(), type: 'system', content: 'O Mestre parece distraído. Tente novamente.' }]);
            setActionOptions(prev => prev.length > 0 ? prev : ['Tentar novamente.']);
            return;
        }

        // Use a temporary state variable to batch updates
        let newCharacterState = character;

        if (response.updatedCharacter) {
            newCharacterState = mergeDeep(newCharacterState, response.updatedCharacter);
            const newModifiers = characterUtils.calculateModifiers(newCharacterState!.attributes);
            newCharacterState!.modifiers = newModifiers;
            newCharacterState!.ac = characterUtils.calculateAC(newCharacterState!.inventory, newModifiers);
            newCharacterState!.carryingCapacity = characterUtils.calculateCarryingCapacity(newCharacterState!.attributes.strength);
            newCharacterState!.currentWeight = newCharacterState!.inventory.reduce((sum: number, item: InventoryItem) => sum + (item.weight || 0) * item.quantity, 0);
        }
        
        // Set all state updates at once
        setCharacter(newCharacterState);
        if (response.logEntries) {
            const newLogEntries = (response.logEntries || []).map(entry => ({ ...entry, id: uuidv4() }));
            setLog(prev => [...prev, ...newLogEntries]);
        }
        if (response.actionOptions) setActionOptions(response.actionOptions);
        if (response.combatState) setCombatState(response.combatState);
        if (response.levelUpState) setLevelUpState(prev => ({ ...(prev || {isPending: false, newLevel: 0, choices: {}}), ...response.levelUpState }));
        if (response.shopState) setShopState(response.shopState);
        if (response.lootOffer) setPendingLootOffer(response.lootOffer);
        if (response.useHitDiceRequest) setPendingHitDiceRequest(response.useHitDiceRequest);

    }, [character]);

    const createCharacterSummary = (char: Character | null): Omit<Character, 'classLevelsData' | 'subclassLevelsData'> | null => {
        if (!char) return null;
        
        const { 
            classLevelsData, 
            subclassLevelsData,
            ...summary 
        } = char;
        
        return {
            ...summary,
            inventory: summary.inventory.map(item => ({ id: item.id, name: item.name, quantity: item.quantity, equipped: item.equipped })),
            proficiencies: summary.proficiencies.map(p => ({ index: p.index, name: p.name, url: p.url })),
        };
    };

    const processPlayerAction = useCallback(async (action: string) => {
        if (!character) return;
        
        setIsLoading(true);
        const newActionLogEntry: LogEntry = { id: uuidv4(), type: 'action', content: action };
        const currentLog = [...log, newActionLogEntry];
        setLog(currentLog);
        setActionOptions([]);
        
        const characterSummary = createCharacterSummary(character);
        const gameUpdateInput = {
            character: characterSummary as Character, // Cast because summary is slightly different but compatible for the prompt
            playerAction: action,
            gameLog: currentLog
        };
        console.log('[useGameState] Enviando para a IA:', gameUpdateInput);
        
        const response = await geminiService.getGameUpdate(gameUpdateInput);
        
        console.log("[useGameState] Resposta recebida do Gemini:", response);
        handleApiResponse(response);
        setIsLoading(false);

    }, [character, log, handleApiResponse]);

    const createCharacter = useCallback(async (info: NewCharacterInfo) => {
        setIsLoading(true);
        setLog([]); 
        
        const newCharacter = await characterUtils.initializeNewCharacter(info);
        
        // Set the character state immediately so the UI transitions to the game screen
        setCharacter(newCharacter);

        // Now, fetch the initial story using the newly created character state
        const characterSummary = createCharacterSummary(newCharacter);
        
        const gameUpdateInput = {
            character: characterSummary as Character,
            playerAction: "A aventura começa. Onde eu estou e o que está acontecendo?",
            gameLog: []
        };
        
        console.log('[useGameState] Enviando para a IA (história inicial):', gameUpdateInput);
        const response = await geminiService.getInitialStory(gameUpdateInput);
        
        // The character state is already set, so handleApiResponse will now *update* it with any initial changes from the AI
        handleApiResponse(response);
        
        setIsLoading(false);
    }, [handleApiResponse]);
    
    const checkForSavedGame = useCallback(() => {
        try {
            return !!localStorage.getItem(LOCAL_STORAGE_KEY);
        } catch (e) {
            return false;
        }
    }, []);

    useEffect(() => {
        // Only check for saved game on initial load, don't load it automatically
        setIsLoading(true);
        // The existence check is now synchronous and relies on the return of checkForSavedGame
        // The actual loading is deferred to a user action (onLoadGame).
        setIsLoading(false);
    }, [checkForSavedGame]);

    const loadGameFromLocalStorage = useCallback(() => {
        setIsLoading(true);
         try {
            const savedGame = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedGame) {
                const { character: savedCharacter, log: savedLog } = JSON.parse(savedGame);
                setCharacter(savedCharacter);
                setLog(savedLog || []);
                setActionOptions([]); // Clear old options
            }
        } catch (error) {
            console.error("Falha ao carregar o jogo:", error);
            // Optionally, clear the broken save file
            // localStorage.removeItem(LOCAL_STORAGE_KEY);
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    const startNewGame = useCallback(() => {
        setIsLoading(true);
        setCharacter(null);
        setLog([]);
        setActionOptions([]);
        try {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        } catch (error) {
            console.error("Falha ao remover o jogo salvo:", error);
        }
        setIsLoading(false);
    }, []);

    const saveGameToFile = useCallback(() => {
        if (!character) return;
        try {
            const gameState = { character, log };
            const jsonString = JSON.stringify(gameState, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "crônicas-de-aventuras.json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Falha ao salvar o jogo em arquivo:", error);
        }
    }, [character, log]);

    const loadGameFromFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                if(text) {
                    const { character: savedCharacter, log: savedLog } = JSON.parse(text);
                    setCharacter(savedCharacter);
                    setLog(savedLog || []);
                    setActionOptions([]);
                }
            } catch (e) {
                console.error("Erro ao ler o arquivo de save:", e);
                alert("Arquivo de save inválido.");
            }
        };
        reader.readAsText(file);
    };

    const applyLevelUp = useCallback(async (selections: LevelUpSelections) => {
        if (!character || !levelUpState || !levelUpState.isPending) return;
        console.log('Aplicando level up com as seleções:', selections);
        // This is a placeholder for the full logic
        // In a real scenario, you'd fetch class/subclass level data and apply features
        setCharacter(prev => {
            if (!prev) return null;
            const newChar = { ...prev };
            newChar.level = levelUpState.newLevel;
            newChar.xpToNextLevel = characterUtils.getXpThreshold(newChar.level);

            // Apply HP increase
            if (selections.hpIncrease) {
                newChar.hp.max += selections.hpIncrease;
                newChar.hp.current += selections.hpIncrease;
            }

            // TODO: Add logic for feature choices, spells, etc.

            return newChar;
        });

        setLevelUpState(prev => prev ? { ...prev, isPending: false } : null);
        setLog(prev => [...prev, { id: uuidv4(), type: 'system', content: `Parabéns! Você alcançou o nível ${levelUpState.newLevel}!` }]);
        setActionOptions([]); // Clear level up options
    }, [character, levelUpState]);


    const toggleEquipped = useCallback((itemId: string) => {
        // Implement logic
    }, []);
    const castSpell = useCallback((spell: any) => {
         // Implement logic
    }, []);
    const spendHitDice = useCallback((diceCount: number) => {
         // Implement logic
    }, []);
    const takeLoot = useCallback((takeAll: boolean) => {
         // Implement logic
    }, []);
    const buyItem = useCallback((item: ShopItem, price: number) => {
         // Implement logic
    }, []);
    const sellItem = useCallback((item: InventoryItem, price: number) => {
         // Implement logic
    }, []);


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
        checkForSavedGame,
        loadGameFromLocalStorage,
        loadGameFromFile,
        saveGameToFile
    };
};
