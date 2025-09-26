'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Character, NewCharacterInfo, LogEntry, CombatState, LevelUpState, ShopState, LootOffer, UseHitDiceRequest, InventoryItem, ShopItem, Feat, LevelUpSelections, ApiSpell, Relationship, JournalEntryLocation, PlayerRollRequest } from '../types';
import * as geminiService from '../services/geminiService';
import * as characterUtils from '../utils/characterUtils';
import { SKILL_ATTRIBUTE_MAP } from '../utils/characterUtils';
import * as DndApiService from '../services/dndApiService';
import { v4 as uuidv4 } from 'uuid';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { generateImage } from '@/ai/flows/generateImage';

const LOCAL_STORAGE_KEY = 'rpg-de-cria-savegame-v2';

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

// Função auxiliar para mesclar o estado do personagem de forma segura.
const mergeCharacterState = (oldChar: Character, updates: Partial<Character>): Character => {
    // Começa com uma cópia profunda para evitar mutações inesperadas.
    let newChar: Character = JSON.parse(JSON.stringify(oldChar));

    // Aplica as atualizações de nível superior
    newChar = { ...newChar, ...updates };

    // Garante que arrays sejam mesclados e não sobrescritos
    if (updates.inventory) {
        newChar.inventory = updates.inventory;
    } else {
        newChar.inventory = oldChar.inventory;
    }
    if (updates.conditions) {
        newChar.conditions = updates.conditions;
    } else {
        newChar.conditions = oldChar.conditions;
    }
    if (updates.spells) {
        newChar.spells = updates.spells;
    } else {
        newChar.spells = oldChar.spells;
    }

    // Mesclagem inteligente para diário e relacionamentos
    if (updates.journal) {
        newChar.journal = mergeJournalEntries(oldChar.journal || [], updates.journal);
    }
    if (updates.relationships) {
        newChar.relationships = mergeRelationships(oldChar.relationships || [], updates.relationships);
    }

    // Garante que objetos aninhados sejam mesclados e não substituídos.
    newChar.hp = { ...oldChar.hp, ...updates.hp };
    newChar.currency = { ...oldChar.currency, ...updates.currency };
    newChar.deathSaves = { ...oldChar.deathSaves, ...updates.deathSaves };
    newChar.ac = { ...oldChar.ac, ...updates.ac };
    newChar.hitDice = { ...oldChar.hitDice, ...updates.hitDice };


    // Recalcula propriedades derivadas após a fusão.
    const newModifiers = characterUtils.calculateModifiers(newChar.attributes);
    newChar.modifiers = newModifiers;
    newChar.ac = characterUtils.calculateAC(newChar.inventory, newModifiers);
    newChar.carryingCapacity = characterUtils.calculateCarryingCapacity(newChar.attributes.strength);
    newChar.currentWeight = (newChar.inventory || []).reduce((sum: number, item: InventoryItem) => sum + (item.weight || 0) * item.quantity, 0);

    return newChar;
};


export const useNewGameState = () => {
    const [character, setCharacter] = useState<Character | null>(null);
    const [log, setLog] = useState<LogEntry[]>([]);
    const [actionOptions, setActionOptions] = useState<(string | {text: string, action: string, skill: string})[]>([]);
    const [combatState, setCombatState] = useState<CombatState>({ isActive: false, round: 0, turn: 0, combatants: [] });
    const [levelUpState, setLevelUpState] = useState<LevelUpState | null>(null);
    const [shopState, setShopState] = useState<ShopState | null>(null);
    const [pendingLootOffer, setPendingLootOffer] = useState<LootOffer | null>(null);
    const [pendingHitDiceRequest, setPendingHitDiceRequest] = useState<UseHitDiceRequest | null>(null);
    const [playerRollRequest, setPlayerRollRequest] = useState<PlayerRollRequest | null>(null);
    const [skillCheckRequest, setSkillCheckRequest] = useState<{ skillName: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [ambientSound, setAmbientSound] = useState<string>('none');
    const { model: selectedModel, imageModel: selectedImageModel, generationConfig, apiKey: userApiKey } = useSettingsContext();

    const getApiKey = useCallback(() => {
        return process.env.NEXT_PUBLIC_GOOGLE_API_KEY || userApiKey;
    }, [userApiKey]);

    const clearApiError = useCallback(() => setApiError(null), []);

    const saveGame = useCallback(() => {
        if (character && log.length > 0) {
            try {
                const gameState = { character, log, actionOptions, combatState, levelUpState, shopState, pendingLootOffer, pendingHitDiceRequest, ambientSound, playerRollRequest, skillCheckRequest };
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameState));
            } catch (error) {
                console.error("Falha ao salvar o jogo no localStorage:", error);
            }
        }
    }, [character, log, actionOptions, combatState, levelUpState, shopState, pendingLootOffer, pendingHitDiceRequest, ambientSound, playerRollRequest, skillCheckRequest]);
    
    const loadGameFromLocalStorage = useCallback(() => {
         setIsLoading(true);
         try {
            const savedGame = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedGame) {
                const { character: savedCharacter, log: savedLog, actionOptions: savedActionOptions, combatState: savedCombatState, levelUpState: savedLevelUpState, shopState: savedShopState, pendingLootOffer: savedPendingLootOffer, pendingHitDiceRequest: savedPendingHitDiceRequest, ambientSound: savedAmbientSound } = JSON.parse(savedGame);
                setCharacter(savedCharacter);
                setLog(savedLog || []);
                setActionOptions(savedActionOptions || []);
                setCombatState(savedCombatState || { isActive: false, round: 0, turn: 0, combatants: [] });
                setLevelUpState(savedLevelUpState || null);
                setShopState(savedShopState || null);
                setPendingLootOffer(savedPendingLootOffer || null);
                setPendingHitDiceRequest(savedPendingHitDiceRequest || null);
                setAmbientSound(savedAmbientSound || 'none');
            }
        } catch (error) {
            console.error("Falha ao carregar o jogo:", error);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // This effect will only run once on mount to load the game state.
        // The start of the game is now handled by the UI flow in page.tsx
    }, [loadGameFromLocalStorage]);

    useEffect(() => {
        // Debounced save
        const handler = setTimeout(() => {
            if (character && !isLoading) { 
                saveGame();
            }
        }, 1500);

        return () => {
            clearTimeout(handler);
        };
    }, [character, log, isLoading, saveGame]);

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
            const newLogEntries = response.logEntries.map(entry => ({ ...entry, id: uuidv4() }));
            setLog(prev => [...prev, ...newLogEntries]);
        }

        if (response.playerRollRequest) {
            setPlayerRollRequest(response.playerRollRequest);
            // DO NOT add a log entry here. The player needs to see the modal first.
            // The action will be logged when the player submits the roll.
            return; // Pause further processing, wait for player roll
        }

        if (response.actionOptions !== undefined) {
             setActionOptions(response.actionOptions);
        }
        if (response.combatState) setCombatState(response.combatState);
        if (response.levelUpState) setLevelUpState(prev => ({ ...(prev || {isPending: false, newLevel: 0, choices: {}}), ...response.levelUpState }));
        if (response.shopState) setShopState(response.shopState);
        if (response.lootOffer) setPendingLootOffer(response.lootOffer);
        if (response.useHitDiceRequest) setPendingHitDiceRequest(response.useHitDiceRequest);
        if (response.ambientSound) setAmbientSound(response.ambientSound);

        // Handle image generation silently
        if (response.imagePrompt) {
            const imageLogId = uuidv4();
            const apiKeyToUse = getApiKey();
            if (!apiKeyToUse) {
                console.warn("Nenhuma chave de API para geração de imagem, pulando.");
                return;
            }
            // Add a placeholder entry immediately
            setLog(prev => [...prev, { id: imageLogId, type: 'image', content: 'generating' }]);

            generateImage(response.imagePrompt, selectedImageModel, apiKeyToUse).then(imageResult => {
                if (imageResult?.imageUrl) {
                    setLog(prev => prev.map(entry => 
                        entry.id === imageLogId 
                            ? { ...entry, content: imageResult.imageUrl } 
                            : entry
                    ));
                } else {
                     setLog(prev => prev.filter(entry => entry.id !== imageLogId));
                }
            }).catch(error => {
                console.error("Image generation failed silently:", error);
                setLog(prev => prev.filter(entry => entry.id !== imageLogId));
            });
        }

    }, [getApiKey, selectedImageModel]);
    
    const processPlayerAction = useCallback(async (action: string) => {
        if (!character) return;
        
        setIsLoading(true);
        setApiError(null);
        setPendingHitDiceRequest(null);
        setPendingLootOffer(null);
        const previousActionOptions = actionOptions;
        
        const newLogEntry: LogEntry = { id: uuidv4(), type: 'action', content: action };
        setLog(prev => [...prev, newLogEntry]);
        setActionOptions([]); 
        
        const currentLog = [...log, newLogEntry];
        
        try {
            const apiKey = getApiKey();
            if (!apiKey) {
                throw new Error("Chave de API do Google não configurada. Por favor, adicione sua chave nas configurações.");
            }
            const gameUpdateInput: geminiService.GameMasterFlowInput = {
                character,
                playerAction: action,
                gameLog: currentLog,
            };
            
            const response = await geminiService.getGameUpdate(gameUpdateInput, selectedModel, generationConfig, apiKey);
            
            handleApiResponse(response);

        } catch (error: any) {
            console.error("Erro ao processar a ação do jogador:", error);
            setApiError(error.message || "Ocorreu um erro desconhecido ao contatar o Mestre.");
            // Rollback UI changes on error
            setActionOptions(previousActionOptions);
            setLog(prev => prev.filter(entry => entry.id !== newLogEntry.id));
        } finally {
            setIsLoading(false); 
        }

    }, [character, log, actionOptions, handleApiResponse, selectedModel, generationConfig, getApiKey]);

    const submitPlayerRoll = useCallback(async (result: number) => {
        if (!character || !playerRollRequest) return;

        const originalReason = playerRollRequest.reason;
        setPlayerRollRequest(null); // Clear request before sending new action

        await processPlayerAction(`O resultado da minha rolagem para "${originalReason}" foi ${result}.`);
    }, [character, playerRollRequest, processPlayerAction]);
    
    const handleSkillCheck = useCallback((skillName: string) => {
        setSkillCheckRequest({ skillName });
    }, []);

    const createCharacter = useCallback(async (info: NewCharacterInfo) => {
        setIsLoading(true);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        setCharacter(null); // Clear character first
        setLog([]); 
        setActionOptions([]);
        setApiError(null);
        setAmbientSound('none');
        
        const newCharacter = await characterUtils.initializeNewCharacter(info);
        
        setCharacter(newCharacter);
        setIsLoading(false);
    }, []);

    const startGame = useCallback(async () => {
        if (!character || log.length > 0 || isLoading) return;
        
        setIsLoading(true);
        setActionOptions([]); 
        setApiError(null);
        
        try {
            const apiKey = getApiKey();
            if (!apiKey) {
                throw new Error("Chave de API do Google não configurada. Por favor, adicione sua chave nas configurações.");
            }
            const gameUpdateInput: geminiService.GameMasterFlowInput = {
                character,
                playerAction: "A aventura começa. Onde eu estou e o que está acontecendo?",
                gameLog: []
            };
            
            const response = await geminiService.getGameUpdate(gameUpdateInput, selectedModel, generationConfig, apiKey);
            
            handleApiResponse(response);
        } catch (error: any) {
             console.error("Erro ao iniciar o jogo:", error);
            setApiError(error.message || "O Mestre não conseguiu preparar a sua aventura. Por favor, tente recarregar.");
        } finally {
            setIsLoading(false);
        }
        
    }, [character, log.length, isLoading, handleApiResponse, selectedModel, generationConfig, getApiKey]);
    
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
            const gameState = { character, log, actionOptions, combatState, levelUpState, shopState, pendingLootOffer, pendingHitDiceRequest, ambientSound };
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
    }, [character, log, actionOptions, combatState, levelUpState, shopState, pendingLootOffer, pendingHitDiceRequest, ambientSound]);

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
                    setAmbientSound(parsedState.ambientSound || 'none');
                    localStorage.setItem(LOCAL_STORAGE_KEY, text);
                }
            } catch (e) {
                console.error("Erro ao ler o arquivo de save:", e);
                setApiError("Arquivo de save inválido ou corrompido.");
            } finally {
                setIsLoading(false);
            }
        };
        reader.readAsText(file);
    };

    const applyLevelUp = useCallback(async (selections: LevelUpSelections) => {
        if (!character || !levelUpState || !levelUpState.isPending) return;
        
        setIsLoading(true);
        
        const updatedChar = await characterUtils.applyLevelUp(character, levelUpState, selections);

        setCharacter(updatedChar);

        setLevelUpState(prev => prev ? { ...prev, isPending: false, choices: {} } : null);
        setLog(prev => [...prev, { id: uuidv4(), type: 'system', content: `Parabéns! Você alcançou o nível ${levelUpState.newLevel}!` }]);
        setActionOptions([]);
        setIsLoading(false);

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
        playerRollRequest,
        skillCheckRequest,
        setSkillCheckRequest,
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
        castSpell,
        spendHitDice,
        takeLoot,
        buyItem,
        sellItem,
        checkForSavedGame,
        loadGameFromLocalStorage,
        loadGameFromFile,
        saveGameToFile,
        submitPlayerRoll,
        handleSkillCheck,
    };
};
