'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Character, NewCharacterInfo, LogEntry, CombatState, LevelUpState, ShopState, LootOffer, UseHitDiceRequest, InventoryItem, ShopItem, Feat, LevelUpSelections, ApiSpell } from '../types';
import * as geminiService from '../services/geminiService';
import * as characterUtils from '../utils/characterUtils';
import * as DndApiService from '../services/dndApiService';
import { v4 as uuidv4 } from 'uuid';

const LOCAL_STORAGE_KEY = 'rpg-de-cria-savegame-v2';

export const useNewGameState = () => {
    const [character, setCharacter] = useState<Character | null>(null);
    const [log, setLog] = useState<LogEntry[]>([]);
    const [actionOptions, setActionOptions] = useState<(string | {text: string, action: string})[]>([]);
    const [combatState, setCombatState] = useState<CombatState>({ isActive: false, round: 0, turn: 0, combatants: [] });
    const [levelUpState, setLevelUpState] = useState<LevelUpState | null>(null);
    const [shopState, setShopState] = useState<ShopState | null>(null);
    const [pendingLootOffer, setPendingLootOffer] = useState<LootOffer | null>(null);
    const [pendingHitDiceRequest, setPendingHitDiceRequest] = useState<UseHitDiceRequest | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const saveGame = useCallback(() => {
        if (character && log.length > 0) {
            try {
                const gameState = { character, log, actionOptions, combatState, levelUpState, shopState, pendingLootOffer, pendingHitDiceRequest };
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
            } catch (error) {
                console.error("Falha ao salvar o jogo no localStorage:", error);
            }
        }
    }, [character, log, actionOptions, combatState, levelUpState, shopState, pendingLootOffer, pendingHitDiceRequest]);

    useEffect(() => {
        // This effect runs only once on mount to load the game.
        loadGameFromLocalStorage();
    }, []);

    useEffect(() => {
         if (character && !isLoading) { 
            saveGame();
        }
    }, [character, log, saveGame, isLoading]);

    const handleApiResponse = useCallback((response: geminiService.GeminiResponse | null) => {
        if (!response) {
            setLog(prev => [...prev, { id: uuidv4(), type: 'system', content: 'O Mestre parece distraído. Tente novamente.' }]);
            setActionOptions(prev => prev.length > 0 ? prev : ['Tentar novamente.']);
            return;
        }

        setCharacter(prevCharacter => {
            if (!prevCharacter) return null;

            let newCharacterState = { ...prevCharacter };

            if (response.updatedCharacter) {
                Object.assign(newCharacterState, response.updatedCharacter);
            }
            
            const newModifiers = characterUtils.calculateModifiers(newCharacterState.attributes);
            newCharacterState.modifiers = newModifiers;
            newCharacterState.ac = characterUtils.calculateAC(newCharacterState.inventory, newModifiers);
            newCharacterState.carryingCapacity = characterUtils.calculateCarryingCapacity(newCharacterState.attributes.strength);
            newCharacterState.currentWeight = (newCharacterState.inventory || []).reduce((sum: number, item: InventoryItem) => sum + (item.weight || 0) * item.quantity, 0);

            return newCharacterState;
        });

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

    }, []);
    
    const processPlayerAction = useCallback(async (action: string | object) => {
        if (!character) return;
        
        setIsLoading(true);
        setPendingHitDiceRequest(null);
        setPendingLootOffer(null);

        // Se action for um objeto, extraia a string de ação ou use uma representação
        const actionString = typeof action === 'string' ? action : (action as any).description || JSON.stringify(action);

        const currentLog = [...log, { id: uuidv4(), type: 'action', content: actionString }];
        setLog(currentLog);
        setActionOptions([]);
        
        const gameUpdateInput = {
            character,
            playerAction: actionString,
            gameLog: currentLog,
        };
        
        const response = await geminiService.getGameUpdate(gameUpdateInput);
        
        handleApiResponse(response);
        setIsLoading(false);

    }, [character, log, handleApiResponse]);

    const createCharacter = useCallback(async (info: NewCharacterInfo) => {
        setIsLoading(true);
        setLog([]); 
        setActionOptions([]);
        
        const newCharacter = await characterUtils.initializeNewCharacter(info);
        
        setCharacter(newCharacter);
        // O início do jogo agora é acionado pelo useEffect no Game.tsx
        setIsLoading(false);
    }, []);

    const startGame = useCallback(async () => {
        if (!character || log.length > 0 || isLoading) return;
        
        setIsLoading(true);
        setActionOptions([]); 
        
        const gameUpdateInput = {
            character,
            playerAction: "A aventura começa. Onde eu estou e o que está acontecendo?",
            gameLog: []
        };
        
        const response = await geminiService.getGameUpdate(gameUpdateInput);
        
        handleApiResponse(response);
        
        setIsLoading(false);
    }, [character, log.length, isLoading, handleApiResponse]);
    
    const checkForSavedGame = useCallback(() => {
        try {
            return !!localStorage.getItem(LOCAL_STORAGE_KEY);
        } catch (e) {
            return false;
        }
    }, []);

    const loadGameFromLocalStorage = useCallback(() => {
         setIsLoading(true);
         try {
            const savedGame = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedGame) {
                const { character: savedCharacter, log: savedLog, actionOptions: savedActionOptions, combatState: savedCombatState, levelUpState: savedLevelUpState, shopState: savedShopState, pendingLootOffer: savedPendingLootOffer, pendingHitDiceRequest: savedPendingHitDiceRequest } = JSON.parse(savedGame);
                setCharacter(savedCharacter);
                setLog(savedLog || []);
                setActionOptions(savedActionOptions || []);
                setCombatState(savedCombatState || { isActive: false, round: 0, turn: 0, combatants: [] });
                setLevelUpState(savedLevelUpState || null);
                setShopState(savedShopState || null);
                setPendingLootOffer(savedPendingLootOffer || null);
                setPendingHitDiceRequest(savedPendingHitDiceRequest || null);
            }
        } catch (error) {
            console.error("Falha ao carregar o jogo:", error);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
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
            const gameState = { character, log, actionOptions, combatState, levelUpState, shopState, pendingLootOffer, pendingHitDiceRequest };
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
    }, [character, log, actionOptions, combatState, levelUpState, shopState, pendingLootOffer, pendingHitDiceRequest]);

    const loadGameFromFile = (file: File) => {
        setIsLoading(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                if(text) {
                    const parsedState = JSON.parse(text);
                    setCharacter(parsedState.character || null);
                    setLog(parsedState.log || []);
                    setActionOptions(parsedState.actionOptions || []);
                    setCombatState(parsedState.combatState || { isActive: false, round: 0, turn: 0, combatants: [] });
                    setLevelUpState(parsedState.levelUpState || null);
                    setShopState(parsedState.shopState || null);
                    setPendingLootOffer(parsedState.pendingLootOffer || null);
                    setPendingHitDiceRequest(parsedState.pendingHitDiceRequest || null);
                    // Salva o estado importado no localStorage imediatamente
                    localStorage.setItem(LOCAL_STORAGE_KEY, text);
                }
            } catch (e) {
                console.error("Erro ao ler o arquivo de save:", e);
                alert("Arquivo de save inválido.");
            } finally {
                setIsLoading(false);
            }
        };
        reader.readAsText(file);
    };

    const applyLevelUp = useCallback(async (selections: LevelUpSelections) => {
        if (!character || !levelUpState || !levelUpState.isPending) return;
        console.log('Aplicando level up com as seleções:', selections);
        
        setCharacter(prev => {
            if (!prev) return null;
            const newChar = { ...prev };
            newChar.level = levelUpState.newLevel;
            newChar.xpToNextLevel = characterUtils.getXpThreshold(newChar.level);

            if (selections.hpIncrease) {
                newChar.hp.max += selections.hpIncrease;
                newChar.hp.current += selections.hpIncrease;
            }

            return newChar;
        });

        setLevelUpState(prev => prev ? { ...prev, isPending: false } : null);
        setLog(prev => [...prev, { id: uuidv4(), type: 'system', content: `Parabéns! Você alcançou o nível ${levelUpState.newLevel}!` }]);
        setActionOptions([]);
    }, [character, levelUpState]);

    const toggleEquipped = useCallback((itemId: string) => {
        if (!character) return;
        const item = character.inventory.find(i => i.id === itemId);
        if (!item) return;
        const actionText = item.equipped ? `Eu desequipo meu ${item.name}.` : `Eu equipo meu ${item.name}.`;
        processPlayerAction(actionText);
    }, [character, processPlayerAction]);

    const castSpell = useCallback((spell: ApiSpell) => {
        if (!character) return;
        processPlayerAction(`Eu conjuro a magia ${spell.name}.`);
    }, [character, processPlayerAction]);
    
    const spendHitDice = useCallback((diceCount: number) => {
        if (!character) return;
        processPlayerAction(`Eu gasto ${diceCount} dado(s) de vida para me curar.`);
    }, [character, processPlayerAction]);

    const takeLoot = useCallback((takeAll: boolean) => {
         if (!character || !pendingLootOffer) return;
         if (takeAll) {
             processPlayerAction('Eu pego todo o tesouro.');
         }
    }, [character, pendingLootOffer, processPlayerAction]);

    const buyItem = useCallback((item: ShopItem, price: number) => {
        if (!character) return;
        processPlayerAction(`Eu quero comprar ${item.name} por ${price} ${item.cost.unit}.`);
    }, [character, processPlayerAction]);
    
    const sellItem = useCallback((item: InventoryItem, price: number) => {
         if (!character) return;
         processPlayerAction(`Eu quero vender meu ${item.name} por ${price} gp.`);
    }, [character, processPlayerAction]);

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
        startGame,
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
