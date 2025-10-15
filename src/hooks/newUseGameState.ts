// src/hooks/newUseGameState.ts
'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Character, NewCharacterInfo, LogEntry, CombatState, LevelUpState, ShopState, LootOffer, UseHitDiceRequest, InventoryItem, ShopItem, Feat, LevelUpSelections, ApiSpell, Relationship, JournalEntry, PlayerRollRequest, Combatant, SessaoIA } from '../types';
import * as characterUtils from '../utils/characterUtils';
import * as GameService from '../services/gameService';
import { v4 as uuidv4 } from 'uuid';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { translateApiString } from '@/utils/translator';
import { useAuth } from '@/contexts/AuthContext';


// Helper functions for merging state
const mergeJournalEntries = (existing: JournalEntry[], updates: JournalEntry[]): JournalEntry[] => {
    const newJournal = [...existing];
    const existingMap = new Map(newJournal.map(entry => [entry.id, entry]));
    for (const update of updates) {
        if (existingMap.has(update.id)) {
            const existingEntry = existingMap.get(update.id)!;
            Object.assign(existingEntry, { ...update, subLocations: update.subLocations ? mergeJournalEntries(existingEntry.subLocations || [], update.subLocations) : existingEntry.subLocations });
        } else {
            newJournal.push(update);
            existingMap.set(update.id, update);
        }
    }
    return newJournal;
};

const mergeRelationships = (existing: Relationship[], updates: Relationship[]): Relationship[] => {
    const newRelationships = [...existing];
    const existingMap = new Map(newRelationships.map(rel => [rel.npcId, rel]));
    for (const update of updates) {
        if (existingMap.has(update.npcId)) {
            const existingRel = existingMap.get(update.npcId)!;
            Object.assign(existingRel, update);
        } else {
            newRelationships.push(update);
            existingMap.set(update.npcId, update);
        }
    }
    return newRelationships;
};

const mergeCharacterState = (oldChar: Character, updates: Partial<Character>): Character => {
    let newChar: Character = { ...oldChar, ...updates };

    // Deep merge for nested objects and arrays
    if (updates.inventory) {
        newChar.inventory = updates.inventory;
        // Recalculate currency and weight whenever inventory changes
        newChar.currency = characterUtils.calculateCurrency(newChar.inventory);
        newChar.currentWeight = characterUtils.calculateWeight(newChar.inventory);
    }
    if (updates.spells) newChar.spells = updates.spells;
    if (updates.conditions) newChar.conditions = updates.conditions;
    if (updates.journal) newChar.journal = mergeJournalEntries(oldChar.journal || [], updates.journal);
    if (updates.relationships) newChar.relationships = mergeRelationships(oldChar.relationships || [], updates.relationships);
    if (updates.factionReputation) newChar.factionReputation = { ...(oldChar.factionReputation || {}), ...updates.factionReputation };
    if (updates.worldState) newChar.worldState = { ...(oldChar.worldState || {}), ...updates.worldState };
    
    newChar.attributes = { ...oldChar.attributes, ...updates.attributes };
    newChar.hp = { ...oldChar.hp, ...updates.hp };
    newChar.deathSaves = { ...oldChar.deathSaves, ...updates.deathSaves };
    newChar.ac = { ...oldChar.ac, ...updates.ac };
    newChar.hitDice = { ...oldChar.hitDice, ...updates.hitDice };
    newChar.spellSlots = { ...oldChar.spellSlots, ...updates.spellSlots };


    // Recalculate derived properties if attributes changed
    if (updates.attributes) {
        const newModifiers = characterUtils.calculateModifiers(newChar.attributes);
        newChar.modifiers = newModifiers;
        newChar.ac = characterUtils.calculateAC(newChar.inventory, newModifiers);
        newChar.carryingCapacity = characterUtils.calculateCarryingCapacity(newChar.attributes.strength);
    }

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
    const { user } = useAuth();
    const { apiKey } = useSettingsContext();
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [character, setCharacter] = useState<Character | null>(null);
    const [log, setLog] = useState<LogEntry[]>([]);
    const [actionOptions, setActionOptions] = useState<(string | { text: string; action: string, skill?: string })[]>([]);
    const [combatState, setCombatState] = useState<CombatState>(INITIAL_COMBAT_STATE);
    const [levelUpState, setLevelUpState] = useState<LevelUpState | null>(null);
    const [shopState, setShopState] = useState<ShopState | null>(null);
    const [pendingLootOffer, setPendingLootOffer] = useState<LootOffer | null>(null);
    const [pendingHitDiceRequest, setPendingHitDiceRequest] = useState<UseHitDiceRequest | null>(null);
    const [skillCheckRequest, setSkillCheckRequest] = useState<{ skillName: string, description: string } | null>(null);
    const [spellCastRequest, setSpellCastRequest] = useState<{ spell: ApiSpell } | null>(null);
    const [playerRollRequest, setPlayerRollRequest] = useState<PlayerRollRequest | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [ambientSound, setAmbientSound] = useState<string>('none');
    
    const getApiKey = useCallback(() => apiKey, [apiKey]);

    const clearApiError = useCallback(() => setApiError(null), []);

    const clearGameState = useCallback(() => {
        setCharacter(null);
        setSessionId(null);
        setLog([]);
        setActionOptions([]);
        setCombatState(INITIAL_COMBAT_STATE);
        setApiError(null);
        setLevelUpState(null);
        setShopState(null);
        setPendingLootOffer(null);
        setPendingHitDiceRequest(null);
        setSkillCheckRequest(null);
        setSpellCastRequest(null);
        setPlayerRollRequest(null);
    }, []);


    const handleApiResponse = useCallback((response: any, isRestoring: boolean = false) => {
        if (!response) {
            throw new Error('O Mestre parece distraído. A resposta da IA foi vazia.');
        }
    
        if (!isRestoring && Array.isArray(response.logEntries)) {
            const newLogEntries = response.logEntries.map((entry: any) => ({ ...entry, id: uuidv4() }));
            setLog(prev => [...prev, ...newLogEntries]);
        }
    
        if (response.updatedCharacter) {
             setCharacter(prev => prev ? mergeCharacterState(prev, response.updatedCharacter) : null);
        }
        
        if (response.worldState) {
            setCharacter(prev => prev ? mergeCharacterState(prev, { worldState: response.worldState }) : null);
        }
    
        if(response.playerRollRequest) {
            setPlayerRollRequest(response.playerRollRequest);
            setActionOptions(response.actionOptions || []);
            return;
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
        
    }, []);
    
    const processPlayerAction = useCallback(async (action: string, sessionIdOverride?: number) => {
        const currentSessionId = sessionIdOverride ?? sessionId;
        if (!currentSessionId) {
            console.error("[processPlayerAction] Aborted: No sessionId.");
            return;
        }
        const key = getApiKey();
        if (!key) {
             console.error("[processPlayerAction] Aborted: No API Key.");
             setApiError("Chave de API não encontrada. Por favor, configure-a nas Configurações.");
             return;
        }
        
        setIsLoading(true);
        setApiError(null);
        setPendingHitDiceRequest(null);
        setPendingLootOffer(null);
        
        // Don't add internal refresh actions to the visible log
        if (action !== "Recarregar estado atual e obter opções.") {
            const newLogEntry: LogEntry = { id: uuidv4(), type: 'action', content: action };
            setLog(prev => [...prev, newLogEntry]);
        }

        setActionOptions([]); 
        
        try {
            const responseData = await GameService.processPlayerAction(currentSessionId, action, key, combatState);
            handleApiResponse(responseData);
        } catch (error: any) {
            console.error("[processPlayerAction] Error processing player action:", error);
            setApiError(error.message || "Ocorreu um erro desconhecido.");
        } finally {
            setIsLoading(false); 
        }
    }, [sessionId, combatState, handleApiResponse, getApiKey]);
    
    const createCharacter = useCallback(async (info: NewCharacterInfo): Promise<Character | null> => {
        setIsLoading(true);
        setApiError(null);
        try {
            const savedCharacterResponse = await GameService.createNewCharacter(info);
            if(savedCharacterResponse.character) {
                return savedCharacterResponse.character;
            }
            return null;
        } catch (error: any) {
            setApiError(error.message || 'Falha ao criar o personagem no servidor.');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const deleteCharacter = useCallback(async (characterId: number): Promise<boolean> => {
        setIsLoading(true);
        setApiError(null);
        try {
            await GameService.deleteCharacterById(characterId);
            return true;
        } catch (error: any) {
            setApiError(error.message || 'Falha ao deletar o personagem.');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const deleteSession = useCallback(async (sessionIdToDelete: number): Promise<boolean> => {
        setIsLoading(true);
        setApiError(null);
        try {
            await GameService.deleteSessionById(sessionIdToDelete);
            if(sessionId === sessionIdToDelete) {
                clearGameState();
            }
            return true;
        } catch (error: any) {
            setApiError(error.message || 'Falha ao deletar a sessão.');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, clearGameState]);


    const startGame = useCallback(async (newSessionId: number): Promise<void> => {
        if (isLoading) return;
        await processPlayerAction("A aventura começa. Onde eu estou e o que está acontecendo?", newSessionId);
        
    }, [isLoading, processPlayerAction]);

    const loadGameSession = useCallback(async (id: number): Promise<{ character: Character, logs: LogEntry[] } | null> => {
        clearGameState();
        setIsLoading(true);
        setApiError(null);
        try {
            const sessionDetails: SessaoIA = await GameService.getSessionDetails(id);

            if (sessionDetails && sessionDetails.character) {
                const fullCharacter = await characterUtils.buildFrontendCharacter(sessionDetails.character as any);
                
                const displayLogs = (sessionDetails.logs || [])
                    .filter(log => log.type !== 'state') 
                    .map(log => ({
                        id: log.id?.toString() || uuidv4(),
                        type: log.type as LogEntry['type'],
                        content: log.response,
                        rollResult: log.rollResult,
                    }));
                
                setCharacter(fullCharacter);
                setLog(displayLogs); 
                setSessionId(id);

                const lastStateLog = [...(sessionDetails.logs || [])].reverse().find(l => l.type === 'state');
                
                if (lastStateLog?.response) {
                     try {
                        const lastState = JSON.parse(lastStateLog.response);
                        handleApiResponse(lastState, true); // Pass true to indicate we are restoring
                    } catch(e) {
                        console.error("Failed to parse last GM state from log, requesting refresh.", e);
                        await processPlayerAction("Recarregar estado atual e obter opções.", id);
                    }
                } else if (displayLogs.length === 0) {
                    await startGame(id);
                } else {
                     await processPlayerAction("Recarregar estado atual e obter opções.", id);
                }

                return { character: fullCharacter, logs: displayLogs };
            } else {
                throw new Error("Dados da sessão ou do personagem estão faltando.");
            }
        } catch(err: any) {
            setApiError(err.message);
            clearGameState();
            return null;
        } finally {
             setIsLoading(false);
        }
    }, [clearGameState, handleApiResponse, processPlayerAction, startGame]);


    const handleRollResult = useCallback((result: { total: number; rolls: number[] }) => {
        if (!playerRollRequest) return;
        const actionText = `O resultado da minha rolagem de ${playerRollRequest.reason} foi ${result.total}.`;
        setPlayerRollRequest(null);
        processPlayerAction(actionText);
    }, [playerRollRequest, processPlayerAction]);
    
    const handleSkillCheck = useCallback((skillName: string) => {
        setSkillCheckRequest({ skillName, description: '' });
    }, []);

    const handleSkillCheckSubmit = useCallback((description: string) => {
        if (!skillCheckRequest) return;
        const translatedSkill = translateApiString(`Skill: ${skillCheckRequest.skillName}`);
        const actionText = `Eu tento usar ${translatedSkill}${description ? `: ${description}`: '.'}`;
        setSkillCheckRequest(null);
        processPlayerAction(actionText);
    }, [skillCheckRequest, processPlayerAction]);

    const castSpell = useCallback((spell: ApiSpell) => setSpellCastRequest({ spell }), []);
    const submitSpellCast = useCallback((spell: ApiSpell, description: string) => {
        const actionText = `Eu conjuro ${spell.name}${description ? `: ${description}`: '.'}`;
        setSpellCastRequest(null);
        processPlayerAction(actionText);
    }, [processPlayerAction]);

    const applyLevelUp = useCallback(async (selections: any) => {
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
        processPlayerAction(item.equipped ? `Eu desequipo meu ${item.name}.` : `Eu equipo meu ${item.name}.`);
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

    const nextTurn = useCallback(() => processPlayerAction("Processar próximo turno"), [processPlayerAction]);
    
    return {
        character,
        log,
        sessionId,
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
        deleteCharacter,
        deleteSession,
        startGame,
        processPlayerAction,
        applyLevelUp,
        toggleEquipped,
        useConsumable,
        spendHitDice,
        takeLoot,
        buyItem,
        sellItem,
        clearGameState,
        nextTurn,
        loadGameSession,
        // State setters
        setCharacter,
        setLog,
        setSessionId
    };
};

    