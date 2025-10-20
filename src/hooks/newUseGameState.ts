// src/hooks/newUseGameState.ts
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useGameLog } from './useGameLog';
import { useInteractionManager } from './useInteractionManager';
import * as GameService from '../services/gameService';
import * as characterUtils from '../utils/characterUtils';
import * as HomebrewService from '../services/homebrewService';
import type { Character, NewCharacterInfo, SessaoIA, LogEntry, GameMasterResponse, HomebrewContent, InventoryItem, ApiSpell, LevelUpState, LevelUpSelections } from '../types';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './use-toast';
import { initializeWebSocket, sendMessage, addEventListener, removeEventListener, closeWebSocket } from '@/services/webSocketService';


export const useNewGameState = () => {
    const { user, revalidateUserSession } = useAuth();
    const { apiKey, model, useAiHomebrew } = useSettingsContext();
    const { toast } = useToast();
    const [character, setCharacter] = useState<Character | null>(null);
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [ambientSound, setAmbientSound] = useState<string>('none');
    
    const [reinstallModal, setReinstallModal] = useState<{ open: boolean; deps: HomebrewContent[]; onConfirm: () => void }>({ open: false, deps: [], onConfirm: () => {} });

    const logState = useGameLog();
    const interactionState = useInteractionManager();
    
    const getApiKey = useCallback(() => apiKey, [apiKey]);
    const clearApiError = useCallback(() => setApiError(null), []);

    const updateCharacter = useCallback((updates: Partial<Character>) => {
        setCharacter(prev => {
            if (!prev) return null;
            
            const newChar = { ...prev };

            if (updates.attributes) {
                newChar.attributes = { ...prev.attributes, ...updates.attributes };
            }
            if (updates.hp) {
                newChar.hp = { ...prev.hp, ...updates.hp };
            }
            if (updates.xp) {
                newChar.xp = updates.xp;
            }
            if(updates.inventory) {
                newChar.inventory = updates.inventory;
            }
            if(updates.spellSlots) {
                newChar.spellSlots = { ...prev.spellSlots, ...updates.spellSlots };
            }
            
            // Recalculate derived stats
            const modifiers = characterUtils.calculateModifiers(newChar.attributes);
            const ac = characterUtils.calculateAC(newChar.inventory, modifiers);
            const currentWeight = characterUtils.calculateWeight(newChar.inventory);
            
            return {
                ...newChar,
                modifiers,
                ac,
                currentWeight
            };
        });
    }, []);

    const clearGameState = useCallback(() => {
        setCharacter(null);
        logState.clearLog();
        interactionState.clearAllInteractions();
        setSessionId(null);
        setApiError(null);
        closeWebSocket();
    }, [logState, interactionState]);


    const handleApiResponse = useCallback((response: GameMasterResponse, isRestoring: boolean = false) => {
        if (!isRestoring && response.logEntries) {
            const newLogEntries = response.logEntries.map((entry: any) => ({ ...entry, id: uuidv4() }));
            logState.addLogEntries(newLogEntries);
        }

        if (response.updatedCharacter) {
             updateCharacter(response.updatedCharacter);
        }
        
        if (response.worldState) {
            updateCharacter({ worldState: response.worldState });
        }
        
        if(response.playerRollRequest && Object.keys(response.playerRollRequest).length > 0) {
            interactionState.setRequest({ type: 'roll', request: response.playerRollRequest });
            if (response.actionOptions !== undefined) {
                interactionState.setActionOptions(response.actionOptions);
            }
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

    }, [logState, updateCharacter, interactionState]);

    // WebSocket event handlers
    useEffect(() => {
        const handleGameStateUpdate = (payload: GameMasterResponse) => handleApiResponse(payload);
        const handleError = (payload: { message: string }) => setApiError(payload.message);
        const handleStartLoading = () => setIsLoading(true);
        const handleStopLoading = () => setIsLoading(false);

        addEventListener('gameStateUpdate', handleGameStateUpdate);
        addEventListener('error', handleError);
        addEventListener('startLoading', handleStartLoading);
        addEventListener('stopLoading', handleStopLoading);

        return () => {
            removeEventListener('gameStateUpdate', handleGameStateUpdate);
            removeEventListener('error', handleError);
            removeEventListener('startLoading', handleStartLoading);
            removeEventListener('stopLoading', handleStopLoading);
        };
    }, [handleApiResponse]);


    const processPlayerAction = useCallback(async (action: string, sessionIdOverride?: number, modelOverride?: string) => {
        const currentSessionId = sessionIdOverride ?? sessionId;
        
        let finalSessionId = currentSessionId;
        if (finalSessionId === null || finalSessionId === undefined) {
            finalSessionId = -1; // Use a mock session ID for tests
            console.log("[processPlayerAction] No active session. Running in test mode.");
            if (!character) {
                const mockCharacter = await characterUtils.buildFrontendCharacter({ id: 1, name: 'Herói de Teste' } as any);
                setCharacter(mockCharacter);
            }
        }
        
        const key = getApiKey();
        if (!key) {
             console.error("[processPlayerAction] Aborted: No API Key.");
             setApiError("Chave de API não encontrada. Por favor, configure-a nas Configurações.");
             return;
        }
        
        const isInternalAction = action.startsWith("Recarregar estado atual") || action.startsWith("A aventura começa.") || action.includes("Gere uma resposta de Mestre de Jogo que demonstre todas as suas capacidades");

        if (!isInternalAction && finalSessionId !== -1) {
            logState.addLogEntry({ id: uuidv4(), type: 'action', content: action });
        }

        interactionState.clearTransientInteractions();
        interactionState.setActionOptions([]); 
        
        sendMessage('processAction', {
            sessionId: finalSessionId,
            prompt: action,
            apiKey: key,
            combatState: interactionState.combatState,
            useAiHomebrew: useAiHomebrew,
            model: modelOverride || model
        });
        
    }, [sessionId, interactionState.combatState, getApiKey, logState, interactionState, model, character, useAiHomebrew]);
    
    const startGame = useCallback(async (newSessionId?: number): Promise<void> => {
        const targetSessionId = newSessionId ?? sessionId;
        if (!targetSessionId || isLoading) return;
        await processPlayerAction("A aventura começa. Onde eu estou e o que está acontecendo?", targetSessionId);
    }, [sessionId, isLoading, processPlayerAction]);

     const loadGameSession = useCallback(async (id: number): Promise<{ character: Character, logs: any[] } | null> => {
        setIsLoading(true);
        setApiError(null);
        try {
            initializeWebSocket(); // Inicia a conexão WebSocket
            const sessionDetails: SessaoIA = await GameService.getSessionDetails(id);
            const userInstalledIds = new Set(user?.installedHomebrewIds || []);
            const sessionRequiredIds = sessionDetails.homebrewContentIds || [];
            
            const missingIds = sessionRequiredIds.filter(id => !userInstalledIds.has(id));

            const loadSessionContent = async () => {
                if (sessionDetails && sessionDetails.character) {
                    const fullCharacter = await characterUtils.buildFrontendCharacter(sessionDetails.character as any);
                    const displayLogs = (sessionDetails.logs || []).filter(log => log.type !== 'state').map(log => ({ id: log.id?.toString() || uuidv4(), type: log.type as LogEntry['type'], content: log.response, rollResult: log.rollResult }));
                    setCharacter(fullCharacter);
                    logState.setLog(displayLogs);
                    setSessionId(id);

                    const lastStateLog = [...(sessionDetails.logs || [])].reverse().find(l => l.type === 'state');
                    if (lastStateLog?.response) {
                         try {
                            const parsedState = JSON.parse(lastStateLog.response);
                            handleApiResponse(parsedState, true);
                        } catch(e) {
                            await processPlayerAction("Recarregar estado atual e obter opções.", id);
                        }
                    } else if (displayLogs.length === 0) {
                        await startGame(id);
                    } else {
                         await processPlayerAction("Recarregar estado atual e obter opções.", id);
                    }
                    return { character: fullCharacter, logs: displayLogs };
                }
                return null;
            };

            if (missingIds.length > 0) {
                const deps = await Promise.all(missingIds.map(id => GameService.getHomebrewDetails(id)));
                setReinstallModal({
                    open: true,
                    deps: deps.filter((d): d is HomebrewContent => !!d),
                    onConfirm: async () => {
                        try {
                             setIsLoading(true);
                            for (const depId of missingIds) {
                                await GameService.updateSessionHomebrew(id, depId, 'install');
                            }
                            toast({ title: 'Dependências restauradas!', description: 'O conteúdo necessário para a sessão foi instalado.'});
                            setReinstallModal({ open: false, deps: [], onConfirm: () => {} });
                            await loadSessionContent();
                        } catch (err: any) {
                            setApiError(`Falha ao reinstalar dependências: ${err.message}`);
                        } finally {
                            setIsLoading(false);
                        }
                    },
                });
                return null; // Don't proceed with loading yet
            } else {
                return await loadSessionContent();
            }
        } catch(err: any) {
            setApiError(err.message);
            clearGameState();
            return null;
        } finally {
             setIsLoading(false);
        }
    }, [user, clearGameState, handleApiResponse, processPlayerAction, startGame, logState, toast]);


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

    const handleApplyLevelUp = useCallback(async (selections: LevelUpSelections) => {
        if (!character || !interactionState.levelUpState || !interactionState.levelUpState.isPending) return;

        const updatedChar = await characterUtils.applyLevelUp(character, interactionState.levelUpState, selections);

        setCharacter(updatedChar);

        logState.addLogEntry({ type: 'system', content: `Parabéns! Você alcançou o nível ${interactionState.levelUpState.newLevel}!` } as LogEntry);
        interactionState.clearRequest('levelUp');
        interactionState.setActionOptions([]);
    }, [character, interactionState, logState.addLogEntry]);

    const handleToggleEquipped = useCallback((itemId: string) => {
        const item = character?.inventory.find(i => i.id === itemId);
        if (!item) return;
        const actionText = item.equipped ? `Eu desequipo meu ${item.name}.` : `Eu equipo meu ${item.name}.`;
        processPlayerAction(actionText);
    }, [character, processPlayerAction]);

    const handleUseConsumable = useCallback((itemId: string) => {
        const item = character?.inventory.find(i => i.id === itemId);
        if (!item || !item.consumable) {
            toast({ variant: "destructive", title: "Item não consumível" });
            return;
        }
        const actionText = `Eu uso ${item.name}.`;
        processPlayerAction(actionText);
    }, [character, processPlayerAction, toast]);

    const handleSpendHitDice = useCallback((diceCount: number) => {
        if (!character || character.hitDice.current < diceCount) return;
        processPlayerAction(`Eu gasto ${diceCount} dado(s) de vida para me curar.`);
    }, [character, processPlayerAction]);

    const memoizedValue = useMemo(() => ({
        character: character,
        log: logState.log,
        sessionId,
        ...interactionState,
        reinstallModal,
        setReinstallModal,
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
        clearGameState,
        loadGameSession,
        handleRollResult: interactionState.handleRollResult(processPlayerAction),
        handleSkillCheckSubmit: interactionState.handleSkillCheckSubmit(processPlayerAction),
        submitSpellCast: interactionState.submitSpellCast(processPlayerAction),
        applyLevelUp: handleApplyLevelUp,
        toggleEquipped: handleToggleEquipped,
        useConsumable: handleUseConsumable,
        spendHitDice: handleSpendHitDice,
        takeLoot: interactionState.handleTakeLoot(processPlayerAction),
        buyItem: interactionState.handleBuyItem(processPlayerAction),
        sellItem: interactionState.handleSellItem(processPlayerAction),
        nextTurn: interactionState.nextTurn(processPlayerAction),
        setCharacter,
        setLog: logState.setLog,
        setSessionId,
    }), [
        character, logState, sessionId, interactionState, reinstallModal,
        isLoading, apiError, ambientSound,
        clearApiError, getApiKey, createCharacter, deleteCharacter, deleteSession, 
        startGame, processPlayerAction, clearGameState, loadGameSession, handleApplyLevelUp,
        handleToggleEquipped, handleUseConsumable, handleSpendHitDice, setCharacter
    ]);

    return memoizedValue;
};
