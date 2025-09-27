
'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Character, NewCharacterInfo, LogEntry, CombatState, LevelUpState, ShopState, LootOffer, UseHitDiceRequest, InventoryItem, ShopItem, Feat, LevelUpSelections, ApiSpell, Relationship, JournalEntryLocation, PlayerRollRequest, Combatant } from '../types';
import * as geminiService from '../services/geminiService';
import * as characterUtils from '../utils/characterUtils';
import * as DndApiService from '../services/dndApiService';
import { v4 as uuidv4 } from 'uuid';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { generateImage } from '@/ai/flows/generateImage';
import { translateApiString, translateSpell } from '@/utils/translator';
import { TRANSLATIONS_SPELLS } from '@/utils/TranslatorSpells';

const LOCAL_STORAGE_KEY = 'rpg-de-cria-savegame-v2';
const SAVE_VERSION = 2; // Version for the save file structure

const mergeJournalEntries = (existing: JournalEntryLocation[], updates: JournalEntryLocation[]): JournalEntryLocation[] => {
    const newJournal = [...existing];
    const existingMap = new Map(newJournal.map(entry => [entry.id, entry]));

    for (const update of updates) {
        if (existingMap.has(update.id)) {
            // Update existing entry
            const existingEntry = existingMap.get(update.id)!;
            Object.assign(existingEntry, { ...update, subLocations: update.subLocations ? mergeJournalEntries(existingEntry.subLocations || [], update.subLocations) : existingEntry.subLocations });
        } else {
            // Add new entry
            newJournal.push(update);
            existingMap.set(update.id, update);
        }
    }
    return newJournal;
}


const mergeRelationships = (existing: Relationship[], updates: Relationship[]): Relationship[] => {
    const newRelationships = [...existing];
    const existingMap = new Map(newRelationships.map(rel => [rel.npcId, rel]));

    for (const update of updates) {
        if (existingMap.has(update.npcId)) {
            // Update existing relationship
            const existingRel = existingMap.get(update.npcId)!;
            Object.assign(existingRel, update);
        } else {
            // Add new relationship
            newRelationships.push(update);
            existingMap.set(update.npcId, update);
        }
    }
    return newRelationships;
};

// Character state updates should always come from the Game Master (AI).
// This function ensures that new data from the API is safely merged into the existing character state
// without unintended side effects, and recalculates derived stats.
const mergeCharacterState = (oldChar: Character, updates: Partial<Character>): Character => {
    // Use structuredClone for a safe and performant deep copy.
    let newChar: Character = structuredClone(oldChar);

    // Apply top-level updates.
    newChar = { ...newChar, ...updates };

    // Ensure arrays are handled correctly. Most arrays are completely replaced if provided.
    // The GM's response is the single source of truth for the current state.
    if (updates.inventory) {
        newChar.inventory = updates.inventory;
    }
    if (updates.spells) {
        newChar.spells = updates.spells;
    }
     // The GM sends the full list of current conditions. Always replace.
    if (updates.conditions) {
        newChar.conditions = updates.conditions;
    }

    // Smart merging for complex nested data structures that need to be preserved.
    if (updates.journal) {
        newChar.journal = mergeJournalEntries(oldChar.journal || [], updates.journal);
    }
    if (updates.relationships) {
        newChar.relationships = mergeRelationships(oldChar.relationships || [], updates.relationships);
    }
    if (updates.factionReputation) {
        newChar.factionReputation = { ...(oldChar.factionReputation || {}), ...updates.factionReputation };
    }
    if (updates.worldState) {
        newChar.worldState = { ...(oldChar.worldState || {}), ...updates.worldState };
    }


    // Ensure nested objects are merged correctly, not fully replaced.
    newChar.hp = { ...oldChar.hp, ...updates.hp };
    newChar.currency = { ...oldChar.currency, ...updates.currency };
    newChar.deathSaves = { ...oldChar.deathSaves, ...updates.deathSaves };
    newChar.ac = { ...oldChar.ac, ...updates.ac };
    newChar.hitDice = { ...oldChar.hitDice, ...updates.hitDice };


    // Recalculate derived properties after the merge.
    const newModifiers = characterUtils.calculateModifiers(newChar.attributes);
    newChar.modifiers = newModifiers;
    newChar.ac = characterUtils.calculateAC(newChar.inventory, newModifiers);
    newChar.carryingCapacity = characterUtils.calculateCarryingCapacity(newChar.attributes.strength);
    newChar.currentWeight = (newChar.inventory || []).reduce((sum: number, item: InventoryItem) => sum + (item.weight || 0) * item.quantity, 0);

    return newChar;
};

const INITIAL_COMBAT_STATE: CombatState = {
    isActive: false,
    round: 1,
    turn: 0,
    combatants: [],
    initiativeOrder: [],
};


export const useNewGameState = () => {
    const [character, setCharacter] = useState<Character | null>(null);
    const [log, setLog] = useState<LogEntry[]>([]);
    const [actionOptions, setActionOptions] = useState<(string | {text: string, action: string, skill: string})[]>([]);
    const [combatState, setCombatState] = useState<CombatState>(INITIAL_COMBAT_STATE);
    const [levelUpState, setLevelUpState] = useState<LevelUpState | null>(null);
    const [shopState, setShopState] = useState<ShopState | null>(null);
    const [pendingLootOffer, setPendingLootOffer] = useState<LootOffer | null>(null);
    const [pendingHitDiceRequest, setPendingHitDiceRequest] = useState<UseHitDiceRequest | null>(null);
    const [skillCheckRequest, setSkillCheckRequest] = useState<{ skillName: string } | null>(null);
    const [spellCastRequest, setSpellCastRequest] = useState<{ spell: ApiSpell } | null>(null);
    const [playerRollRequest, setPlayerRollRequest] = useState<PlayerRollRequest | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [ambientSound, setAmbientSound] = useState<string>('none');
    
    const [systemLog, setSystemLog] = useState<string | null>(null);
    
    const { model: selectedModel, imageModel: selectedImageModel, generationConfig, apiKey: userApiKey } = useSettingsContext();

    const addLog = useCallback((newEntryData: Omit<LogEntry, 'id'>) => {
        const newEntry = { ...newEntryData, id: uuidv4() } as LogEntry;
        setLog(prev => [...prev, newEntry]);
    }, []);

    const getApiKey = useCallback(() => {
        return userApiKey || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    }, [userApiKey]);

    const clearApiError = useCallback(() => setApiError(null), []);

    const handleApiResponse = useCallback((response: geminiService.GameMasterResponse | null) => {
        if (!response) {
            throw new Error('O Mestre parece distraído. A resposta da IA foi vazia.');
        }

        if (response.updatedCharacter) {
             setCharacter(prevCharacter => {
                if (!prevCharacter) return null;
                return mergeCharacterState(prevCharacter, response.updatedCharacter as Partial<Character>);
            });
        }
       
        if (response.logEntries && Array.isArray(response.logEntries)) {
            response.logEntries.forEach(entry => addLog(entry));
        }
        
        if(response.playerRollRequest) {
            setPlayerRollRequest({ ...response.playerRollRequest, reason: response.playerRollRequest.reason || '...' });
            setActionOptions([]); 
            return; 
        }
        
        if (response.actionOptions !== undefined) {
             setActionOptions(response.actionOptions);
        }
        
        if (response.combatState) {
            const newCombatState = response.combatState;
            // If combat is ending, clear the roll history for all combatants
            if (combatState.isActive && !newCombatState.isActive) {
                if (newCombatState.combatants && Array.isArray(newCombatState.combatants)) {
                    newCombatState.combatants.forEach(c => c.rollHistory = []);
                }
            }
            setCombatState(newCombatState);
        }

        if (response.levelUpState) setLevelUpState(prev => ({ ...(prev || {isPending: false, newLevel: 0, choices: {}}), ...response.levelUpState }));
        if (response.shopState) setShopState(response.shopState);
        if (response.lootOffer) setPendingLootOffer(response.lootOffer);
        if (response.useHitDiceRequest) setPendingHitDiceRequest(response.useHitDiceRequest);
        if (response.ambientSound) setAmbientSound(response.ambientSound);

    }, [addLog, combatState.isActive]);


    const processPlayerAction = useCallback(async (action: string, rollResultForLog?: LogEntry['rollResult']) => {
        if (!character) return;
        
        setIsLoading(true);
        setApiError(null);
        setPlayerRollRequest(null);
        setPendingHitDiceRequest(null);
        setPendingLootOffer(null);
        const previousActionOptions = actionOptions;
        
        const entryId = uuidv4();
        // Don't add a new log entry if the action is just to process the next turn
        if (action !== "Processar o próximo turno do combate.") {
            const newLogEntry: LogEntry = rollResultForLog
                ? { id: entryId, type: 'roll', content: action, rollResult: rollResultForLog }
                : { id: entryId, type: 'action', content: action };

            addLog(newLogEntry);
        }

        setActionOptions([]); 
        
        const currentLog = [...log, { id: entryId, type: 'action', content: action }];
        
        try {
            const apiKey = getApiKey();
            if (!apiKey) {
                throw new Error("Chave de API do Google não configurada. Por favor, adicione sua chave nas configurações.");
            }

            const gameUpdateInput: geminiService.GameMasterFlowInput = {
                character,
                playerAction: action,
                gameLog: currentLog,
                combatState: combatState
            };
            
            const response = await geminiService.getGameUpdate(gameUpdateInput, selectedModel, generationConfig, apiKey);
            
            handleApiResponse(response);

        } catch (error: any) {
            console.error("Erro ao processar a ação do jogador:", error);
            setApiError(error.message || "Ocorreu um erro desconhecido ao contatar o Mestre.");
            if (action !== "Processar o próximo turno do combate.") {
                setLog(prev => prev.filter(entry => entry.id !== entryId));
            }
            setActionOptions(previousActionOptions);
        } finally {
            setIsLoading(false); 
        }

    }, [character, combatState, selectedModel, generationConfig, getApiKey, log, actionOptions, addLog, handleApiResponse]);

    const nextTurn = useCallback(() => {
        if (!combatState.isActive || isLoading) return;
        processPlayerAction("Processar o próximo turno do combate.");
    }, [combatState.isActive, isLoading, processPlayerAction]);

    const handleRollResult = useCallback((result: { total: number; rolls: number[] }) => {
        if (!playerRollRequest) return;
    
        const actionText = `O resultado da minha rolagem de ${playerRollRequest.reason} foi ${result.total}.`;
    
        const rollLogEntry: LogEntry['rollResult'] = {
            ...playerRollRequest,
            ...result,
            description: playerRollRequest.reason,
            success: playerRollRequest.dc !== undefined ? result.total >= playerRollRequest.dc : undefined,
        };
    
        // Immediately update player's roll history in combatState
        if (combatState.isActive) {
            setCombatState(prev => {
                const playerCombatantIndex = prev.combatants.findIndex(c => c.id === 'player');
                if (playerCombatantIndex === -1) return prev;
    
                const newCombatants = [...prev.combatants];
                const playerCombatant = { ...newCombatants[playerCombatantIndex] };
                
                const newHistoryEntry: Combatant['rollHistory'][0] = {
                    type: rollLogEntry.rollType, // Map rollType to history type
                    total: rollLogEntry.total,
                    rolls: rollLogEntry.rolls,
                    description: rollLogEntry.description,
                    dice: rollLogEntry.dice,
                };
    
                playerCombatant.rollHistory = [...(playerCombatant.rollHistory || []), newHistoryEntry];
                newCombatants[playerCombatantIndex] = playerCombatant;
    
                return { ...prev, combatants: newCombatants };
            });
        }
    
        setPlayerRollRequest(null);
        processPlayerAction(actionText, rollLogEntry);
    
    }, [playerRollRequest, processPlayerAction, combatState.isActive]);
    

    const saveGame = useCallback(() => {
        if (character && log.length > 0) {
            try {
                // Don't save transient states
                const gameState = { version: SAVE_VERSION, character, log, actionOptions, combatState, levelUpState, shopState, ambientSound, systemLog };
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
            } catch (error) {
                console.error("Falha ao salvar o jogo no localStorage:", error);
            }
        }
    }, [character, log, actionOptions, combatState, levelUpState, shopState, ambientSound, systemLog]);
    
    const loadGameFromLocalStorage = useCallback(() => {
        setIsLoading(true);
        try {
            const savedGame = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedGame) {
                const parsedState = JSON.parse(savedGame);

                const lastEntry = parsedState.log && parsedState.log.length > 0 ? parsedState.log[parsedState.log.length - 1] : null;
                if (lastEntry && lastEntry.type === 'action') {
                    parsedState.log.pop(); 
                }

                setCharacter(parsedState.character || null);
                setLog(parsedState.log || []);
                setActionOptions(parsedState.actionOptions || []);
                setCombatState(parsedState.combatState || INITIAL_COMBAT_STATE);
                setLevelUpState(parsedState.levelUpState || null);
                setShopState(parsedState.shopState || null);
                setAmbientSound(parsedState.ambientSound || 'none');
                setSystemLog(parsedState.systemLog || null);
                
                // Clear transient states that should not persist across sessions
                setPlayerRollRequest(null);
                setSkillCheckRequest(null);
                setSpellCastRequest(null);
                setPendingLootOffer(null);
                setPendingHitDiceRequest(null);
            }
        } catch (error) {
            console.error("Falha ao carregar o jogo:", error);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const forceReload = useCallback(() => {
        addLog({ type: 'system', content: 'Restaurando o jogo para o último estado seguro...' });
        loadGameFromLocalStorage();
    }, [loadGameFromLocalStorage, addLog]);


    const clearGameState = useCallback(() => {
        setCharacter(null);
        setLog([]);
        setActionOptions([]);
        setCombatState(INITIAL_COMBAT_STATE);
        setLevelUpState(null);
        setShopState(null);
        setPendingLootOffer(null);
        setPendingHitDiceRequest(null);
        setSkillCheckRequest(null);
        setSpellCastRequest(null);
        setPlayerRollRequest(null);
        setApiError(null);
        setAmbientSound('none');
        setSystemLog(null);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }, []);


    useEffect(() => {
        const handler = setTimeout(() => {
            if (character && !isLoading) { 
                saveGame();
            }
        }, 1500);

        return () => {
            clearTimeout(handler);
        };
    }, [character, log, actionOptions, combatState, levelUpState, shopState, pendingLootOffer, pendingHitDiceRequest, ambientSound, skillCheckRequest, spellCastRequest, playerRollRequest, systemLog, isLoading, saveGame]);

    
    
    const handleSkillCheck = useCallback((skillName: string) => {
        setSkillCheckRequest({ skillName });
    }, []);

    const handleSkillCheckSubmit = useCallback((description: string) => {
        if (!skillCheckRequest) return;
        const translatedSkill = translateApiString(`Skill: ${skillCheckRequest.skillName}`);
        const actionText = `Eu tento usar ${translatedSkill}: ${description}`;
        setSkillCheckRequest(null);
        processPlayerAction(actionText);
    }, [skillCheckRequest, processPlayerAction]);

    const castSpell = useCallback((spell: ApiSpell) => {
        setSpellCastRequest({ spell });
    }, []);

    const submitSpellCast = useCallback((spell: ApiSpell, description: string) => {
        const translatedSpellName = translateSpell(spell)?.name || spell.name;
        const actionText = `Eu conjuro ${translatedSpellName}${description ? `: ${description}`: '.'}`;
        setSpellCastRequest(null);
        processPlayerAction(actionText);
    }, [processPlayerAction]);


    const createCharacter = useCallback(async (info: NewCharacterInfo) => {
        setIsLoading(true);
        clearGameState();
        
        const newCharacter = await characterUtils.initializeNewCharacter(info);
        
        setCharacter(newCharacter);
        setIsLoading(false);
    }, [clearGameState]);

    const startGame = useCallback(async () => {
        if (!character || log.length > 0 || isLoading) return Promise.resolve(undefined);
        
        setIsLoading(true);
        setActionOptions([]); 
        setApiError(null);
        
        try {
            const apiKey = getApiKey();
            if (!apiKey) {
                throw new Error("Chave de API do Google não configurada. Por favor, adicione sua chave nas configurações para continuar.");
            }

            const gameUpdateInput: geminiService.GameMasterFlowInput = {
                character,
                playerAction: "A aventura começa. Onde eu estou e o que está acontecendo?",
                gameLog: [],
                combatState: combatState
            };
            
            const response = await geminiService.getGameUpdate(gameUpdateInput, selectedModel, generationConfig, apiKey);
            handleApiResponse(response);
            return true;
        } catch (error: any) {
             console.error("Erro ao iniciar o jogo:", error);
            setApiError(error.message || "O Mestre não conseguiu preparar a sua aventura. Por favor, tente recarregar.");
            setLog([]); // Clear log on error to allow retry
            return false;
        } finally {
            setIsLoading(false);
        }
        
    }, [character, log.length, isLoading, selectedModel, generationConfig, getApiKey, combatState, handleApiResponse]);
    
    const checkForSavedGame = useCallback(() => {
        try {
            return !!localStorage.getItem(LOCAL_STORAGE_KEY);
        } catch (e) {
            return false;
        }
    }, []);

    const saveGameToFile = useCallback(() => {
        if (!character) return;
        try {
            const gameState = { version: SAVE_VERSION, character, log, actionOptions, combatState, levelUpState, shopState, pendingLootOffer, pendingHitDiceRequest, ambientSound, systemLog };
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
    }, [character, log, actionOptions, combatState, levelUpState, shopState, pendingLootOffer, pendingHitDiceRequest, ambientSound, systemLog]);

    const loadGameFromFile = (file: File): Promise<boolean> => {
        return new Promise((resolve) => {
            setIsLoading(true);
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const text = event.target?.result as string;
                    if(text) {
                        const parsedState = JSON.parse(text);

                        const lastEntry = parsedState.log && parsedState.log.length > 0 ? parsedState.log[parsedState.log.length - 1] : null;
                        if (lastEntry && lastEntry.type === 'action') {
                            parsedState.log.pop();
                        }

                        setCharacter(parsedState.character || null);
                        setLog(parsedState.log || []);
                        setActionOptions(parsedState.actionOptions || []);
                        setCombatState(parsedState.combatState || INITIAL_COMBAT_STATE);
                        setLevelUpState(parsedState.levelUpState || null);
                        setShopState(parsedState.shopState || null);
                        setAmbientSound(parsedState.ambientSound || 'none');
                        setSystemLog(parsedState.systemLog || null);
                        
                        setPlayerRollRequest(null);
                        setSkillCheckRequest(null);
                        setSpellCastRequest(null);
                        setPendingLootOffer(null);
                        setPendingHitDiceRequest(null);

                        localStorage.setItem(LOCAL_STORAGE_KEY, text);
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                } catch (e) {
                    console.error("Erro ao ler o arquivo de save:", e);
                    setApiError("Arquivo de save inválido ou corrompido.");
                    resolve(false);
                } finally {
                    setIsLoading(false);
                }
            };
            reader.onerror = () => {
                setIsLoading(false);
                resolve(false);
            };
            reader.readAsText(file);
        });
    };

    const applyLevelUp = useCallback(async (selections: LevelUpSelections) => {
        if (!character || !levelUpState || !levelUpState.isPending) return;
        
        setIsLoading(true);
        
        const updatedChar = await characterUtils.applyLevelUp(character, levelUpState, selections);

        setCharacter(updatedChar);

        setLevelUpState(prev => prev ? { ...prev, isPending: false, choices: {} } : null);
        addLog({ type: 'system', content: `Parabéns! Você alcançou o nível ${levelUpState.newLevel}!` });
        setActionOptions([]);
        setIsLoading(false);

    }, [character, levelUpState, addLog]);

    const toggleEquipped = useCallback((itemId: string) => {
        if (!character) return;
        const item = character.inventory.find(i => i.id === itemId);
        if (!item) return;
        const actionText = item.equipped ? `Eu desequipo meu ${item.name}.` : `Eu equipo meu ${item.name}.`;
        processPlayerAction(actionText);
    }, [character, processPlayerAction]);
    
    const useConsumable = useCallback((itemId: string) => {
      if (!character) return;
      const item = character.inventory.find(i => i.id === itemId);
      if (!item) return;
      processPlayerAction(`Eu uso meu ${item.name}.`);
    }, [character, processPlayerAction]);

    const spendHitDice = useCallback((diceCount: number) => {
        if (!character) return;
        processPlayerAction(`Eu gasto ${diceCount} dado(s) de vida para me curar.`);
    }, [character, processPlayerAction]);

    const takeLoot = useCallback((takeAll: boolean) => {
         if (!character || !pendingLootOffer) return;
         setPlayerRollRequest(null);
         if (takeAll) {
             processPlayerAction('Eu pego todo o tesouro.');
         }
    }, [character, pendingLootOffer, processPlayerAction]);

    const buyItem = useCallback((item: ShopItem, price: number) => {
        if (!character) return;
        setPlayerRollRequest(null);
        processPlayerAction(`Eu quero comprar ${item.name} por ${price} ${item.cost.unit}.`);
    }, [character, processPlayerAction]);
    
    const sellItem = useCallback((item: InventoryItem, price: number) => {
         if (!character) return;
         setPlayerRollRequest(null);
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
        skillCheckRequest,
        setSkillCheckRequest,
        handleSkillCheck,
        handleSkillCheckSubmit,
        spellCastRequest,
        setSpellCastRequest,
        castSpell,
        submitSpellCast,
        playerRollRequest,
        setPlayerRollRequest,
        handleRollResult,
        isLoading,
        apiError,
        ambientSound,
        clearApiError,
        getApiKey,
        createCharacter,
        startGame,
        processPlayerAction,
        applyLevelUp,
        toggleEquipped,
        useConsumable,
        spendHitDice,
        takeLoot,
        buyItem,
        sellItem,
        checkForSavedGame,
        loadGameFromLocalStorage,
        loadGameFromFile,
        saveGameToFile,
        systemLog, 
        nextTurn,
        clearGameState,
        forceReload,
    };
};
