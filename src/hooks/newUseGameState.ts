// src/hooks/newUseGameState.ts
'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useGameLog } from './useGameLog';
import { useInteractionManager } from './useInteractionManager';
import * as GameService from '../services/gameService';
import * as characterUtils from '../utils/characterUtils';
import * as HomebrewService from '../services/homebrewService';
import type { Character, NewCharacterInfo, SessaoIA, LogEntry, GameMasterResponse, HomebrewContent, InventoryItem, ApiSpell, LevelUpState, LevelUpSelections, ProgressionFeedItem, PlayerRollRequest } from '../types';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './use-toast';
import { initializeWebSocket, sendMessage, addEventListener, removeEventListener, closeWebSocket } from '@/services/webSocketService';
import { translateAttribute } from '@/utils/translator';

const buildItemKey = (item?: InventoryItem) => {
    if (!item) return null;
    const raw = item.id ?? item.index ?? item.name;
    if (!raw) return null;
    return String(raw).toLowerCase();
};

const mergeInventoryItems = (previous: InventoryItem[] | undefined, incoming: InventoryItem[]): InventoryItem[] => {
    const prevMap = new Map<string, InventoryItem>();
    (previous || []).forEach(item => {
        const key = buildItemKey(item) ?? `${Date.now()}-${Math.random()}`;
        prevMap.set(key, item);
    });

    return incoming.map(item => {
        const key = buildItemKey(item) ?? `${Date.now()}-${Math.random()}`;
        const prevItem = prevMap.get(key);
        if (!prevItem) return item;
        return { ...prevItem, ...item };
    });
};

const deriveAmbientSoundFromWorld = (worldState?: { [key: string]: any } | null): string => {
    if (!worldState) return 'none';
    const label = (
        worldState.poiSlug ||
        worldState.poiName ||
        worldState.regionSlug ||
        worldState.currentRegion ||
        ''
    ).toString().toLowerCase();
    if (!label) return 'none';
    if (label.includes('biblioteca')) return 'library_ambience';
    if (label.includes('floresta')) return 'forest_night';
    if (label.includes('beco') || label.includes('cidade')) return 'city_alley';
    if (label.includes('deserto')) return 'desert_wind';
    if (label.includes('caverna')) return 'cave_drip';
    return 'none';
};

export const useNewGameState = () => {
    const { user, revalidateUserSession } = useAuth();
    const { apiKey, model, useAiHomebrew } = useSettingsContext();
    const { toast } = useToast();
    const [character, setCharacter] = useState<Character | null>(null);
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [ambientSound, setAmbientSound] = useState<string>('none');
    const [progressionFeed, setProgressionFeed] = useState<ProgressionFeedItem[]>([]);
    const actionOptionsBackupRef = useRef<(string | { text: string; action: string; skill?: string })[] | null>(null);
    
    const [reinstallModal, setReinstallModal] = useState<{ open: boolean; deps: HomebrewContent[]; onConfirm: () => void }>({ open: false, deps: [], onConfirm: () => {} });

    const logState = useGameLog();
    const interactionState = useInteractionManager();
    
    const getApiKey = useCallback(() => apiKey, [apiKey]);
    const clearApiError = useCallback(() => setApiError(null), []);

    const updateCharacter = useCallback((updates: Partial<Character>) => {
        setCharacter(prev => {
            if (!prev) return null;
            
            const newChar: Character = { ...prev };

            if (updates.level !== undefined) {
                newChar.level = updates.level;
                newChar.proficiencyBonus = characterUtils.getProficiencyBonus(updates.level);
            }
            if (updates.attributes) {
                newChar.attributes = { ...prev.attributes, ...updates.attributes };
            }
            if (updates.hp) {
                newChar.hp = { ...prev.hp, ...updates.hp };
            }
            if ('xp' in updates && updates.xp !== undefined) {
                newChar.xp = updates.xp;
            }
            if (updates.inventory) {
                const mergedInventory = mergeInventoryItems(prev.inventory, updates.inventory as InventoryItem[]);
                newChar.inventory = mergedInventory;
                newChar.currency = characterUtils.calculateCurrency(mergedInventory);
                newChar.currentWeight = characterUtils.calculateWeight(mergedInventory);
                const strengthScore = newChar.attributes?.strength ?? prev.attributes?.strength ?? 10;
                newChar.carryingCapacity = characterUtils.calculateCarryingCapacity(strengthScore);
            }
            if (updates.spellSlots) {
                const mergedSlots = { ...prev.spellSlots };
                Object.entries(updates.spellSlots).forEach(([key, slot]) => {
                    const prevSlot = mergedSlots[key as keyof typeof mergedSlots];
                    const max = Math.max(slot?.max ?? prevSlot?.max ?? 0, prevSlot?.max ?? 0);
                    const current = slot?.current ?? prevSlot?.current ?? max;
                    mergedSlots[key as keyof typeof mergedSlots] = {
                        max,
                        current: Math.min(Math.max(current, 0), max),
                    };
                });
                newChar.spellSlots = mergedSlots;
            }
            if (updates.spells) {
                newChar.spells = updates.spells as Character['spells'];
            }
            if (updates.classLevelsData) {
                newChar.classLevelsData = updates.classLevelsData;
            }
            if (updates.subclassLevelsData) {
                newChar.subclassLevelsData = updates.subclassLevelsData;
            }
            if (updates.traits) {
                newChar.traits = updates.traits as Character['traits'];
            }
            if (updates.languages) {
                newChar.languages = updates.languages;
            }
            if (updates.personalityTraits) {
                newChar.personalityTraits = updates.personalityTraits;
            }
            if (updates.feats) {
                newChar.feats = updates.feats;
            }
            if (updates.journal) {
                newChar.journal = updates.journal;
            }
            if (updates.relationships) {
                const prevRelationships = prev.relationships || [];
                const relMap = new Map<string, typeof prevRelationships[number]>();
                prevRelationships.forEach(rel => {
                    const key = rel.npcId || rel.name;
                    if (key) relMap.set(key, rel);
                });
                newChar.relationships = updates.relationships.map(rel => {
                    const key = rel.npcId || rel.name;
                    const existing = key ? relMap.get(key) : null;
                    if (!existing) return rel;
                    return {
                        ...existing,
                        ...rel,
                        quests: Array.isArray(rel.quests) ? rel.quests : existing.quests || [],
                        status: rel.status || existing.status,
                    };
                });
            }
            if (updates.worldState) {
                const prevWorld = prev.worldState || {};
                const nextWorld = { ...prevWorld, ...updates.worldState };
                newChar.worldState = {
                    ...nextWorld,
                    timeOfDay: updates.worldState.timeOfDay || prevWorld.timeOfDay || 'Manhã',
                    weather: updates.worldState.weather || prevWorld.weather || 'Ensolarado',
                    location: updates.worldState.location || prevWorld.location,
                    currentRegion: updates.worldState.currentRegion || prevWorld.currentRegion || 'Desconhecida',
                };
            }
            if (updates.currentRegion) {
                newChar.currentRegion = updates.currentRegion;
            }
            if ('storySoFar' in updates) {
                newChar.storySoFar = updates.storySoFar;
            }
            if (updates.factionReputation) {
                newChar.factionReputation = { ...(prev.factionReputation || {}), ...updates.factionReputation };
            }
            if (updates.ac) {
                newChar.ac = { ...prev.ac, ...updates.ac };
            }
            if (updates.deathSaves) {
                newChar.deathSaves = { ...prev.deathSaves, ...updates.deathSaves };
            }
            if (updates.conditions) {
                newChar.conditions = updates.conditions as any;
            }
            if (updates.hitDice) {
                newChar.hitDice = { ...prev.hitDice, ...updates.hitDice };
            }
            if (updates.currency) {
                newChar.currency = { ...(prev.currency || {}), ...updates.currency };
            }

            const attributesForCalc = newChar.attributes || prev.attributes;
            const inventoryForCalc = Array.isArray(newChar.inventory) ? newChar.inventory : [];
            const modifiers = attributesForCalc ? characterUtils.calculateModifiers(attributesForCalc) : prev.modifiers;
            const ac = updates.ac
                ? { ...prev.ac, ...updates.ac }
                : characterUtils.calculateAC(inventoryForCalc, modifiers);
            const currentWeight = characterUtils.calculateWeight(inventoryForCalc);
            const carryingCapacity = attributesForCalc ? characterUtils.calculateCarryingCapacity(attributesForCalc.strength) : prev.carryingCapacity;
            const currency = updates.currency
                ? { ...(prev.currency || {}), ...updates.currency }
                : characterUtils.calculateCurrency(inventoryForCalc);
            const xpToNextLevel = characterUtils.getXpThreshold(newChar.level);
            newChar.currency = currency;
            newChar.carryingCapacity = carryingCapacity;
            newChar.ac = ac;
            newChar.currentWeight = currentWeight;
            newChar.modifiers = modifiers;
            newChar.xpToNextLevel = xpToNextLevel;
            
            return {
                ...newChar,
                modifiers,
                ac,
                currentWeight,
                carryingCapacity,
                currency,
                xpToNextLevel,
            };
        });
    }, []);

    const clearGameState = useCallback(() => {
        setCharacter(null);
        logState.clearLog();
        interactionState.clearAllInteractions();
        setSessionId(null);
        setApiError(null);
        setProgressionFeed([]);
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
        } else if (character?.worldState) {
            updateCharacter({ worldState: character.worldState });
        }
        
        if(response.playerRollRequest && Object.keys(response.playerRollRequest).length > 0) {
            interactionState.setRequest({ type: 'roll', request: response.playerRollRequest });
            if (response.actionOptions !== undefined) {
                interactionState.setActionOptions(response.actionOptions);
                actionOptionsBackupRef.current = null;
            }
            return;
        }

        if (response.actionOptions !== undefined) {
            interactionState.setActionOptions(response.actionOptions);
            actionOptionsBackupRef.current = null;
        }
        
        if (response.combatState) interactionState.setCombatState(response.combatState);
        
        if (response.levelUpState) interactionState.setRequest({ type: 'levelUp', request: response.levelUpState });
        if (response.shopState) interactionState.setRequest({ type: 'shop', request: response.shopState });
        if (response.lootOffer) interactionState.setRequest({ type: 'loot', request: response.lootOffer });
        if (response.useHitDiceRequest) interactionState.setRequest({ type: 'hitDice', request: response.useHitDiceRequest });
        
        const derivedAmbient = deriveAmbientSoundFromWorld(response.worldState ?? character?.worldState ?? null);
        if (derivedAmbient !== ambientSound) {
            setAmbientSound(derivedAmbient);
        }

        if (Array.isArray(response.progressionFeed) && response.progressionFeed.length) {
            const enrichedEvents: ProgressionFeedItem[] = response.progressionFeed.map(event => ({
                ...event,
                id: uuidv4(),
                timestamp: new Date().toISOString(),
            }));

            setProgressionFeed(prev => {
                const merged = [...prev, ...enrichedEvents];
                return merged.slice(-10);
            });

            if (!isRestoring) {
                enrichedEvents.forEach(event => {
                    if (event.type === 'level_up') {
                        toast({
                            title: event.summary,
                            description: event.detail || 'Você avançou para um novo patamar de poder.',
                        });
                    } else if (event.type === 'xp_gain') {
                        const detailParts = [event.source, event.detail].filter(Boolean);
                        toast({
                            title: event.summary,
                            description: detailParts.length ? detailParts.join(' • ') : undefined,
                        });
                    }
                });
            }
        }

    }, [logState, updateCharacter, interactionState, toast, setProgressionFeed, character, ambientSound]);

    // WebSocket event handlers
    useEffect(() => {
        const handleGameStateUpdate = (payload: GameMasterResponse) => handleApiResponse(payload);
        const handleError = (payload: { message: string }) => {
            setApiError(payload.message);
            if (actionOptionsBackupRef.current) {
                interactionState.setActionOptions(actionOptionsBackupRef.current);
                actionOptionsBackupRef.current = null;
            }
        };
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
    }, [handleApiResponse, interactionState]);


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

        actionOptionsBackupRef.current = interactionState.actionOptions.slice();
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

    const submitRollResult = useCallback((request: PlayerRollRequest, result: { rawRoll: number; rolls: number[] }) => {
        if (!sessionId) {
            setApiError('Nenhuma sessão ativa para enviar o resultado da rolagem.');
            return;
        }
        if (!request.requestId) {
            setApiError('Esta rolagem não possui um identificador válido.');
            return;
        }
        const key = getApiKey();
        if (!key) {
            setApiError('Chave de API não encontrada. Configure-a nas Configurações.');
            return;
        }
        sendMessage('submitRollResult', {
            sessionId,
            requestId: request.requestId,
            rolls: result.rolls,
            rawRoll: result.rawRoll,
            apiKey: key,
            combatState: interactionState.combatState,
            useAiHomebrew,
        });
    }, [sessionId, getApiKey, interactionState.combatState, useAiHomebrew, setApiError]);
    
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
                if (sessionDetails) {
                    const characterId = sessionDetails.character?.id ?? sessionDetails.characterId;
                    let backendCharacterPayload: Character | null = null;
                    const inventorySnapshot = Array.isArray(sessionDetails.character?.inventory)
                        ? sessionDetails.character?.inventory
                        : null;

                    if (characterId) {
                        try {
                            backendCharacterPayload = await GameService.getCharacterById(characterId);
                        } catch (err) {
                            console.warn(`[loadGameSession] Falha ao buscar personagem ${characterId} diretamente:`, err);
                            backendCharacterPayload = sessionDetails.character as any;
                        }
                    } else if (sessionDetails.character) {
                        backendCharacterPayload = sessionDetails.character as any;
                    }

                    if (!backendCharacterPayload) {
                        setApiError('Não foi possível carregar os dados do personagem desta sessão.');
                        return null;
                    }

                    const fullCharacter = await characterUtils.buildFrontendCharacter(backendCharacterPayload as any);
                    if ((!fullCharacter.inventory || fullCharacter.inventory.length === 0) && inventorySnapshot?.length) {
                        fullCharacter.inventory = inventorySnapshot as InventoryItem[];
                    }
                    const displayLogs = (sessionDetails.logs || [])
                        .filter(log => !['state', 'gm_raw', 'gm_validation'].includes(log.type))
                        .map(log => ({ id: log.id?.toString() || uuidv4(), type: log.type as LogEntry['type'], content: log.response, rollResult: log.rollResult }));
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
                const deps = await Promise.all(missingIds.map(id => HomebrewService.getHomebrewDetails(id)));
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
        } catch (err: any) {
            const httpError = err as any;
            console.error("[loadGameSession] Erro ao carregar sessão:", err);
            setApiError(httpError.message || "Erro ao carregar sessão.");
            // Fecha o socket apenas em erro de autenticação real
            if (httpError?.response?.status === 401) {
              console.warn("[loadGameSession] Sessão expirada — limpando estado e desconectando.");
              clearGameState();
            }
            return null;
        } finally {
             setIsLoading(false);
        }
    }, [user, handleApiResponse, processPlayerAction, startGame, logState, toast, clearGameState]);


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

        const { newLevel } = interactionState.levelUpState;
        const summaryParts: string[] = [];

        if (selections.attributes) {
            const attrChanges = Object.entries(selections.attributes)
                .filter(([, value]) => !!value)
                .map(([attr, value]) => `${translateAttribute(attr)} +${value}`);
            if (attrChanges.length) {
                summaryParts.push(`Atributos: ${attrChanges.join(', ')}`);
            }
        }

        if (selections.spells && selections.spells.length) {
            summaryParts.push(`Novas magias: ${selections.spells.join(', ')}`);
        }

        if (selections.featureChoices && selections.featureChoices.length) {
            const featSummary = selections.featureChoices
                .map(choice => choice.selections.join(', '))
                .filter(Boolean);
            if (featSummary.length) {
                summaryParts.push(`Características: ${featSummary.join('; ')}`);
            }
        }

        if (selections.subclass) {
            summaryParts.push(`Subclasse: ${selections.subclass}`);
        }

        if (selections.hpIncrease !== undefined) {
            summaryParts.push(`Aumento de PV total: +${selections.hpIncrease}`);
        }

        const actionText = [
            `Confirmo meu avanço para o nível ${newLevel}.`,
            summaryParts.length ? summaryParts.join(' | ') : ''
        ].filter(Boolean).join(' ');

        interactionState.clearRequest('levelUp');
        interactionState.setActionOptions([]);
        await processPlayerAction(actionText);
    }, [character, interactionState, processPlayerAction]);

    const handleToggleEquipped = useCallback((itemId: string) => {
        const item = character?.inventory.find(i => i.id === itemId);
        if (!item) return;

        const willEquip = !item.equipped;

        setCharacter(prev => {
            if (!prev || !Array.isArray(prev.inventory)) return prev;
            return {
                ...prev,
                inventory: prev.inventory.map(invItem =>
                    invItem.id === itemId ? { ...invItem, equipped: willEquip } : invItem
                ),
            };
        });

        const actionText = willEquip
            ? `Eu equipo meu ${item.name}.`
            : `Eu desequipo meu ${item.name}.`;
        processPlayerAction(actionText);
    }, [character, processPlayerAction, setCharacter]);

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
        progressionFeed,
        clearApiError,
        getApiKey,
        createCharacter,
        deleteCharacter,
        deleteSession,
        startGame,
        processPlayerAction,
        clearGameState,
        loadGameSession,
        handleRollResult: interactionState.handleRollResult(submitRollResult),
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
        isLoading, apiError, ambientSound, progressionFeed,
        clearApiError, getApiKey, createCharacter, deleteCharacter, deleteSession, 
        startGame, processPlayerAction, submitRollResult, clearGameState, loadGameSession, handleApplyLevelUp,
        handleToggleEquipped, handleUseConsumable, handleSpendHitDice, setCharacter
    ]);

    return memoizedValue;
};
