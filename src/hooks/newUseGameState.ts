
'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Character, NewCharacterInfo, LogEntry, CombatState, LevelUpState, ShopState, LootOffer, UseHitDiceRequest, InventoryItem, ShopItem, Feat, LevelUpSelections, ApiSpell, Relationship, JournalEntryLocation, PlayerRollRequest, Combatant } from '../types';
import * as characterUtils from '../utils/characterUtils';
import * as DndApiService from '../services/dndApiService';
import * as GameService from '../services/gameService';
import { v4 as uuidv4 } from 'uuid';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { generateImage } from '@/ai/flows/generateImage';
import { translateApiString } from '@/utils/translator';
import { useAuth } from '@/contexts/AuthContext';


const LOCAL_STORAGE_KEY_PREFIX = 'rpg-de-cria-active-session-';

const mergeJournalEntries = (existing: JournalEntryLocation[], updates: JournalEntryLocation[]): JournalEntryLocation[] => {
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
}


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
    let newChar: Character = structuredClone(oldChar);
    newChar = { ...newChar, ...updates };

    if (updates.inventory) {
        newChar.inventory = updates.inventory;
    }
    if (updates.spells) {
        newChar.spells = updates.spells;
    }
    if (updates.conditions) {
        newChar.conditions = updates.conditions;
    }

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


    newChar.hp = { ...oldChar.hp, ...updates.hp };
    newChar.currency = { ...oldChar.currency, ...updates.currency };
    newChar.deathSaves = { ...oldChar.deathSaves, ...updates.deathSaves };
    newChar.ac = { ...oldChar.ac, ...updates.ac };
    newChar.hitDice = { ...oldChar.hitDice, ...updates.hitDice };

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
    const { user } = useAuth();
    const { imageModel, apiKey: settingsApiKey } = useSettingsContext();
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [character, setCharacter] = useState<Character | null>(null);
    const [log, setLog] = useState<LogEntry[]>([]);
    const [actionOptions, setActionOptions] = useState<(string | { text: string; action: string, skill?: string })[]>([]);
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
    
    const getApiKey = useCallback(() => settingsApiKey, [settingsApiKey]);
    const getLocalStorageKey = useCallback(() => `${LOCAL_STORAGE_KEY_PREFIX}${user?.id}`, [user]);

    const clearApiError = useCallback(() => setApiError(null), []);

    const saveSession = useCallback((id: number | null) => {
        if (!user) return;
        const localStorageKey = getLocalStorageKey();
        if (id !== null) {
            localStorage.setItem(localStorageKey, id.toString());
        } else {
            localStorage.removeItem(localStorageKey);
        }
    }, [user, getLocalStorageKey]);

    const loadSessionId = useCallback(() => {
        if (!user) return null;
        const localStorageKey = getLocalStorageKey();
        const savedId = localStorage.getItem(localStorageKey);
        return savedId ? parseInt(savedId, 10) : null;
    }, [user, getLocalStorageKey]);

    const handleApiResponse = useCallback((response: any | null) => {
        if (!response) {
            throw new Error('O Mestre parece distraído. A resposta da IA foi vazia.');
        }

        // The backend response for narration now comes as { response: "text" }
        // We need to parse this into our logEntry format.
        if (response.response) {
             setLog(prev => [...prev, { id: uuidv4(), type: 'narration', content: response.response }]);
        }

        // The new backend doesn't send these complex state objects directly in the narrar response.
        // This logic needs to be re-evaluated. For now, we only handle the narrative log.
        
    }, []);
    
    const processPlayerAction = useCallback(async (action: string) => {
        if (!character || !sessionId) return;
        
        setIsLoading(true);
        setApiError(null);
        setPlayerRollRequest(null);
        setPendingHitDiceRequest(null);
        setPendingLootOffer(null);
        
        const newLogEntry: LogEntry = { id: uuidv4(), type: 'action', content: action };
        setLog(prev => [...prev, newLogEntry]);
        setActionOptions([]); 
        
        try {
            const apiKey = getApiKey();
            if (!apiKey) {
                throw new Error("Chave de API não configurada.");
            }
            const responseData = await GameService.processPlayerAction(sessionId, action, apiKey);
            handleApiResponse(responseData);

        } catch (error: any) {
            console.error("Erro ao processar a ação do jogador:", error);
            setApiError(error.message || "Ocorreu um erro desconhecido ao contatar o Mestre.");
            setLog(prev => prev.filter(entry => entry.id !== newLogEntry.id));
        } finally {
            setIsLoading(false); 
        }

    }, [character, sessionId, handleApiResponse, getApiKey]);
    
    const handleRollResult = useCallback((result: { total: number; rolls: number[] }) => {
        if (!playerRollRequest) return;
        const actionText = `O resultado da minha rolagem de ${playerRollRequest.reason} foi ${result.total}.`;
        setPlayerRollRequest(null);
        processPlayerAction(actionText);
    }, [playerRollRequest, processPlayerAction]);
    
    const handleSkillCheck = useCallback((skillName: string) => setSkillCheckRequest({ skillName }), []);
    const handleSkillCheckSubmit = useCallback((description: string) => {
        if (!skillCheckRequest) return;
        const translatedSkill = translateApiString(`Skill: ${skillCheckRequest.skillName}`);
        const actionText = `Eu tento usar ${translatedSkill}: ${description}`;
        setSkillCheckRequest(null);
        processPlayerAction(actionText);
    }, [skillCheckRequest, processPlayerAction]);

    const castSpell = useCallback((spell: ApiSpell) => setSpellCastRequest({ spell }), []);
    const submitSpellCast = useCallback((spell: ApiSpell, description: string) => {
        const actionText = `Eu conjuro ${spell.name}${description ? `: ${description}`: '.'}`;
        setSpellCastRequest(null);
        processPlayerAction(actionText);
    }, [processPlayerAction]);

    const createCharacter = useCallback(async (info: NewCharacterInfo) => {
        setIsLoading(true);
        setApiError(null);
        const apiKey = getApiKey();
        if (!apiKey) {
            setApiError("Chave de API não configurada. Por favor, vá para as configurações.");
            setIsLoading(false);
            return null;
        }

        try {
            const newCharacter = await characterUtils.initializeNewCharacter(info);
            // Instead of just setting the character, we create a session
            const sessionData = await GameService.createGameSession(newCharacter.name, apiKey);
            setSessionId(sessionData.sessao.id);
            setCharacter(newCharacter);
            setLog([]); // Start with a fresh log
            saveSession(sessionData.sessao.id); // Save the new session ID
            return newCharacter;

        } catch (error: any) {
            setApiError(error.message || 'Falha ao criar a sessão de jogo.');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [getApiKey, saveSession]);

    const startGame = useCallback(async (): Promise<boolean> => {
        if (!character || log.length > 0 || isLoading) return Promise.resolve(true);
        
        setIsLoading(true);
        setApiError(null);
        
        try {
            // The initial prompt is now sent to the backend
            await processPlayerAction("A aventura começa. Onde eu estou e o que está acontecendo?");
            return true;
        } catch (error: any) {
             console.error("Erro ao iniciar o jogo:", error);
            setApiError(error.message || "O Mestre não conseguiu preparar a sua aventura. Por favor, tente recarregar.");
            return false;
        } finally {
            setIsLoading(false);
        }
        
    }, [character, log.length, isLoading, processPlayerAction]);

    const loadGameSession = useCallback(async (id: number) => {
        setIsLoading(true);
        setApiError(null);
        try {
            const sessionDetails = await GameService.getSessionDetails(id);
            // The backend needs to be updated to store the character sheet within the session.
            // For now, we'll have to rely on local storage for the character sheet itself,
            // but use the backend for logs. This is a temporary hybrid approach.
            
            const localStorageKey = getLocalStorageKey();
            const localDataStr = localStorage.getItem(localStorageKey);
            if (localDataStr) {
                const localData = JSON.parse(localDataStr);
                setCharacter(localData.character); // Load character from local for now
            } else {
                 throw new Error("Não foi possível encontrar os dados do personagem localmente. O salvamento pode estar corrompido.");
            }

            setLog(sessionDetails.logs || []);
            setSessionId(id);
            saveSession(id);
        } catch(err: any) {
            setApiError(err.message);
            clearGameState();
        } finally {
            setIsLoading(false);
        }
    }, [getLocalStorageKey, saveSession]);

    const clearGameState = useCallback(() => {
        const localStorageKey = getLocalStorageKey();
        setCharacter(null);
        setSessionId(null);
        setLog([]);
        setActionOptions([]);
        setCombatState(INITIAL_COMBAT_STATE);
        setApiError(null);
        localStorage.removeItem(localStorageKey);
    }, [getLocalStorageKey]);

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
    const forceReload = useCallback(() => {
        const id = loadSessionId();
        if (id) {
            loadGameSession(id);
        }
        setIsLoading(false);
        setApiError(null);
    },[loadSessionId, loadGameSession]);
    
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
        clearGameState,
        nextTurn,
        forceReload,
        loadGameSession,
        loadSessionId, // Exposing this to check for active sessions
    };
};
