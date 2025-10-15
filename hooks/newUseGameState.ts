// src/hooks/newUseGameState.ts
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useCharacterState } from './useCharacterState';
import { useGameLog } from './useGameLog';
import { useInteractionManager } from './useInteractionManager';
import * as GameService from '../services/gameService';
import * as characterUtils from '../utils/characterUtils';
import type { Character, NewCharacterInfo, SessaoIA, LogEntry } from '../types';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';


export const useNewGameState = () => {
    const { user } = useAuth();
    const { apiKey } = useSettingsContext();
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [ambientSound, setAmbientSound] = useState<string>('none');

    const characterState = useCharacterState();
    const logState = useGameLog();
    const interactionState = useInteractionManager();
    
    const getApiKey = useCallback(() => apiKey, [apiKey]);
    const clearApiError = useCallback(() => setApiError(null), []);

    const clearGameState = useCallback(() => {
        characterState.clearCharacterState();
        logState.clearLog();
        interactionState.clearAllInteractions();
        setSessionId(null);
        setApiError(null);
    }, [characterState, logState, interactionState]);


    const handleApiResponse = useCallback((response: any, isRestoring: boolean = false) => {
        if (!response) {
            setApiError('O Mestre parece distraído. A resposta da IA foi vazia.');
            return;
        }

        if (!isRestoring && Array.isArray(response.logEntries)) {
            const newLogEntries = response.logEntries.map((entry: any) => ({ ...entry, id: uuidv4() }));
            logState.addLogEntries(newLogEntries);
        }

        if (response.updatedCharacter) {
             characterState.updateCharacter(response.updatedCharacter);
        }
        
        if (response.worldState) {
            characterState.updateCharacter({ worldState: response.worldState });
        }
        
        if(response.playerRollRequest) {
            interactionState.setRequest({ type: 'roll', request: response.playerRollRequest });
            interactionState.setActionOptions(response.actionOptions || []);
            return;
        }

        if (response.actionOptions !== undefined) {
            interactionState.setActionOptions(response.actionOptions);
        }
        
        if (response.combatState) interactionState.setCombatState(response.combatState);
        if (response.levelUpState) interactionState.setRequest({ type: 'levelUp', request: response.levelUpState });
        if (response.shopState) interactionState.setRequest({ type: 'shop', request: response.shopState });
        if (response.lootOffer) interactionState.setRequest({ type: 'loot', request: response.lootOffer });
        if (response.useHitDiceRequest) interactionState.setRequest({ type: 'hitDice', request: response.useHitDiceRequest });
        
        if (response.ambientSound) setAmbientSound(response.ambientSound);

    }, [logState, characterState, interactionState]);


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
        interactionState.clearTransientInteractions();
        
        // Don't add internal system actions to the visible log
        if (action !== "Recarregar estado atual e obter opções." && !action.startsWith("A aventura começa.")) {
            logState.addLogEntry({ id: uuidv4(), type: 'action', content: action, response: action });
        }

        interactionState.setActionOptions([]); 
        
        try {
            const responseData = await GameService.processPlayerAction(currentSessionId, action, key, interactionState.combatState);
            handleApiResponse(responseData);
        } catch (error: any) {
            console.error("[processPlayerAction] Error processing player action:", error);
            setApiError(error.message || "Ocorreu um erro desconhecido.");
        } finally {
            setIsLoading(false); 
        }
    }, [sessionId, interactionState.combatState, handleApiResponse, getApiKey, logState, interactionState]);
    
    const startGame = useCallback(async (newSessionId?: number): Promise<void> => {
        const targetSessionId = newSessionId ?? sessionId;
        if (!targetSessionId || isLoading) return;
        await processPlayerAction("A aventura começa. Onde eu estou e o que está acontecendo?", targetSessionId);
    }, [sessionId, isLoading, processPlayerAction]);

     const loadGameSession = useCallback(async (id: number): Promise<{ character: Character, logs: any[] } | null> => {
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
                
                characterState.setCharacter(fullCharacter);
                logState.setLog(displayLogs);
                setSessionId(id);

                const lastStateLog = [...(sessionDetails.logs || [])].reverse().find(l => l.type === 'state');
                
                if (lastStateLog?.response) {
                     try {
                        const lastState = JSON.parse(lastStateLog.response);
                        handleApiResponse(lastState, true);
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
    }, [clearGameState, handleApiResponse, processPlayerAction, startGame, characterState, logState]);


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

    const memoizedValue = useMemo(() => ({
        // Core State
        character: characterState.character,
        log: logState.log,
        sessionId,
        ...interactionState,
        isLoading,
        apiError,
        ambientSound,

        // Core Functions
        clearApiError,
        getApiKey,
        createCharacter,
        deleteCharacter,
        deleteSession,
        startGame,
        processPlayerAction,
        clearGameState,
        loadGameSession,

        // Interaction Handlers (delegated from interactionManager)
        handleRollResult: interactionState.handleRollResult(processPlayerAction),
        handleSkillCheckSubmit: interactionState.handleSkillCheckSubmit(processPlayerAction),
        submitSpellCast: interactionState.submitSpellCast(processPlayerAction),
        applyLevelUp: characterState.handleApplyLevelUp(interactionState.levelUpState, logState.addLogEntry, interactionState.clearRequest, interactionState.setActionOptions),
        toggleEquipped: characterState.handleToggleEquipped(processPlayerAction),
        useConsumable: characterState.handleUseConsumable(processPlayerAction),
        spendHitDice: characterState.handleSpendHitDice(processPlayerAction),
        takeLoot: interactionState.handleTakeLoot(processPlayerAction),
        buyItem: interactionState.handleBuyItem(processPlayerAction),
        sellItem: interactionState.handleSellItem(processPlayerAction),
        nextTurn: interactionState.nextTurn(processPlayerAction),

        // Direct setters are mostly internal now, but exposing some for compatibility
        setCharacter: characterState.setCharacter,
        setLog: logState.setLog,
        setSessionId,
    }), [
        characterState, logState, sessionId, interactionState, 
        isLoading, apiError, ambientSound,
        clearApiError, getApiKey, createCharacter, deleteCharacter, deleteSession, 
        startGame, processPlayerAction, clearGameState, loadGameSession
    ]);

    return memoizedValue;
};
