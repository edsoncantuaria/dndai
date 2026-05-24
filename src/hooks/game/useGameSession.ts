'use client';

import { useCallback, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';
import * as GameService from '@/services/gameService';
import * as HomebrewService from '@/services/homebrewService';
import * as characterUtils from '@/utils/characterUtils';
import { initializeWebSocket, closeWebSocket } from '@/services/webSocketService';
import type {
    Character,
    GameMasterResponse,
    HomebrewContent,
    InventoryItem,
    LogEntry,
    NewCharacterInfo,
    ProgressionFeedItem,
    SessaoIA,
} from '@/types';
import { deriveAmbientSoundFromWorld } from './ambientSound';
import { patchCharacter } from './characterPatch';
import type { useGameLog } from '../useGameLog';
import type { useInteractionManager } from '../useInteractionManager';

type LogSlice = Pick<ReturnType<typeof useGameLog>, 'log' | 'setLog' | 'addLogEntries' | 'clearLog'>;
type InteractionSlice = ReturnType<typeof useInteractionManager>;

export interface UseGameSessionOptions {
    user: { installedHomebrewIds?: number[] } | null;
    sessionId: number | null;
    character: Character | null;
    ambientSound: string;
    setCharacter: Dispatch<SetStateAction<Character | null>>;
    setSessionId: Dispatch<SetStateAction<number | null>>;
    setAmbientSound: Dispatch<SetStateAction<string>>;
    setApiError: Dispatch<SetStateAction<string | null>>;
    setIsLoading: Dispatch<SetStateAction<boolean>>;
    setProgressionFeed: Dispatch<SetStateAction<ProgressionFeedItem[]>>;
    logState: LogSlice;
    interactionState: InteractionSlice;
    clientStateVersionRef: MutableRefObject<number>;
    lastLogVersionRef: MutableRefObject<number>;
    resetActionPipeline: (label: string | null) => void;
    toast: (opts: { title?: string; description?: string; variant?: 'destructive' }) => void;
    processPlayerActionRef: MutableRefObject<
        ((action: string, sessionIdOverride?: number, modelOverride?: string) => Promise<void>) | undefined
    >;
}

export function useGameSession(options: UseGameSessionOptions) {
    const {
        user,
        sessionId,
        character,
        ambientSound,
        setCharacter,
        setSessionId,
        setAmbientSound,
        setApiError,
        setIsLoading,
        setProgressionFeed,
        logState,
        interactionState,
        clientStateVersionRef,
        lastLogVersionRef,
        resetActionPipeline,
        toast,
        processPlayerActionRef,
    } = options;

    const [reinstallModal, setReinstallModal] = useState<{
        open: boolean;
        deps: HomebrewContent[];
        onConfirm: () => void;
    }>({ open: false, deps: [], onConfirm: () => {} });

    const updateCharacter = useCallback(
        (updates: Partial<Character>) => {
            setCharacter(prev => (prev ? patchCharacter(prev, updates) : null));
        },
        [setCharacter],
    );

    const handleApiResponse = useCallback(
        (response: GameMasterResponse, isRestoring = false) => {
            const responseStateVersion =
                typeof response.stateVersion === 'number' ? response.stateVersion : undefined;
            const versionForLogs = responseStateVersion ?? clientStateVersionRef.current ?? null;
            if (!isRestoring && response.logEntries && (!versionForLogs || versionForLogs > lastLogVersionRef.current)) {
                if (typeof versionForLogs === 'number') {
                    lastLogVersionRef.current = versionForLogs;
                }
                const newLogEntries = response.logEntries.map((entry: { type: string; content?: unknown }) => ({
                    ...entry,
                    id: uuidv4(),
                    stateVersion: versionForLogs ?? undefined,
                }));
                logState.addLogEntries(newLogEntries as LogEntry[]);
            }

            if (response.updatedCharacter) {
                updateCharacter(response.updatedCharacter);
            }

            if (response.worldState) {
                updateCharacter({ worldState: response.worldState });
            } else if (character?.worldState) {
                updateCharacter({ worldState: character.worldState });
            }

            if (response.playerRollRequest && Object.keys(response.playerRollRequest).length > 0) {
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
            if (response.useHitDiceRequest) {
                interactionState.setRequest({ type: 'hitDice', request: response.useHitDiceRequest });
            }

            const nextWorldState = response.worldState ?? character?.worldState ?? null;
            const derivedAmbient = deriveAmbientSoundFromWorld(nextWorldState, {
                isCombatActive: response.combatState?.isActive ?? interactionState.combatState?.isActive ?? false,
                currentAmbientId: ambientSound,
            });
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
        },
        [
            logState,
            updateCharacter,
            interactionState,
            toast,
            setProgressionFeed,
            character,
            ambientSound,
            setAmbientSound,
            clientStateVersionRef,
            lastLogVersionRef,
        ],
    );

    const clearGameState = useCallback(() => {
        setCharacter(null);
        logState.clearLog();
        interactionState.clearAllInteractions();
        setSessionId(null);
        setApiError(null);
        setProgressionFeed([]);
        resetActionPipeline(null);
        closeWebSocket();
    }, [logState, interactionState, resetActionPipeline, setCharacter, setSessionId, setApiError, setProgressionFeed]);

    const startGame = useCallback(
        async (newSessionId?: number): Promise<void> => {
            const targetSessionId = newSessionId ?? sessionId;
            if (!targetSessionId || !processPlayerActionRef.current) return;
            await processPlayerActionRef.current(
                'A aventura começa. Onde eu estou e o que está acontecendo?',
                targetSessionId,
            );
        },
        [sessionId, processPlayerActionRef],
    );

    const loadGameSession = useCallback(
        async (id: number): Promise<{ character: Character; logs: LogEntry[] } | null> => {
            setIsLoading(true);
            setApiError(null);
            try {
                initializeWebSocket();
                const sessionDetails: SessaoIA = await GameService.getSessionDetails(id);
                const userInstalledIds = new Set(user?.installedHomebrewIds || []);
                const sessionRequiredIds = sessionDetails.homebrewContentIds || [];
                const missingIds = sessionRequiredIds.filter(hbId => !userInstalledIds.has(hbId));

                const loadSessionContent = async () => {
                    if (!sessionDetails) return null;

                    const characterId = sessionDetails.character?.id ?? sessionDetails.characterId;
                    let backendCharacterPayload: Character | null = null;
                    const inventorySnapshot = Array.isArray(sessionDetails.character?.inventory)
                        ? sessionDetails.character?.inventory
                        : null;

                    if (characterId) {
                        try {
                            backendCharacterPayload = await GameService.getCharacterById(characterId);
                        } catch (err) {
                            console.warn(`[loadGameSession] Falha ao buscar personagem ${characterId}:`, err);
                            backendCharacterPayload = sessionDetails.character as Character;
                        }
                    } else if (sessionDetails.character) {
                        backendCharacterPayload = sessionDetails.character as Character;
                    }

                    if (!backendCharacterPayload) {
                        setApiError('Não foi possível carregar os dados do personagem desta sessão.');
                        return null;
                    }

                    const fullCharacter = await characterUtils.buildFrontendCharacter(backendCharacterPayload as Character);
                    if ((!fullCharacter.inventory || fullCharacter.inventory.length === 0) && inventorySnapshot?.length) {
                        fullCharacter.inventory = inventorySnapshot as InventoryItem[];
                    }
                    const baseStateVersion = sessionDetails.stateVersion ?? 0;
                    const displayLogs = (sessionDetails.logs || [])
                        .filter(log => !['state', 'gm_raw', 'gm_validation'].includes(log.type))
                        .map(log => {
                            let parsedContent: unknown = log.response;
                            if (typeof log.response === 'string') {
                                try {
                                    parsedContent = JSON.parse(log.response);
                                } catch {
                                    parsedContent = log.response;
                                }
                            }
                            const audioUrl =
                                parsedContent &&
                                typeof parsedContent === 'object' &&
                                parsedContent !== null &&
                                'audioUrl' in parsedContent
                                    ? (parsedContent as { audioUrl?: string }).audioUrl
                                    : undefined;
                            return {
                                id: log.id?.toString() || uuidv4(),
                                type: log.type as LogEntry['type'],
                                content: parsedContent,
                                rollResult: log.rollResult,
                                audioUrl,
                                stateVersion: log.stateVersion ?? baseStateVersion,
                            };
                        });
                    const previousStateVersion = lastLogVersionRef.current ?? 0;
                    setCharacter(fullCharacter);
                    logState.setLog(prev => {
                        if (!prev.length || sessionId !== id) {
                            return displayLogs as LogEntry[];
                        }
                        const incrementalEntries = (displayLogs as LogEntry[]).filter(entry => {
                            if (typeof entry.stateVersion !== 'number') return false;
                            return entry.stateVersion > previousStateVersion;
                        });
                        if (!incrementalEntries.length) return prev;
                        return [...prev, ...incrementalEntries];
                    });
                    setSessionId(id);
                    clientStateVersionRef.current = sessionDetails.stateVersion ?? clientStateVersionRef.current;
                    lastLogVersionRef.current = sessionDetails.stateVersion ?? previousStateVersion;

                    const lastStateLog = [...(sessionDetails.logs || [])]
                        .reverse()
                        .find(l => l.type === 'state');
                    if (lastStateLog?.response) {
                        try {
                            const parsedState = JSON.parse(lastStateLog.response);
                            handleApiResponse(parsedState, true);
                        } catch {
                            await startGame(id);
                        }
                    } else if (displayLogs.length === 0) {
                        await startGame(id);
                    }
                    return { character: fullCharacter, logs: displayLogs as LogEntry[] };
                };

                if (missingIds.length > 0) {
                    const deps = await Promise.all(missingIds.map(hbId => HomebrewService.getHomebrewDetails(hbId)));
                    setReinstallModal({
                        open: true,
                        deps: deps.filter((d): d is HomebrewContent => !!d),
                        onConfirm: async () => {
                            try {
                                setIsLoading(true);
                                for (const depId of missingIds) {
                                    await GameService.updateSessionHomebrew(id, depId, 'install');
                                }
                                toast({
                                    title: 'Dependências restauradas!',
                                    description: 'O conteúdo necessário para a sessão foi instalado.',
                                });
                                setReinstallModal({ open: false, deps: [], onConfirm: () => {} });
                                await loadSessionContent();
                            } catch (err: unknown) {
                                const message = err instanceof Error ? err.message : String(err);
                                setApiError(`Falha ao reinstalar dependências: ${message}`);
                            } finally {
                                setIsLoading(false);
                            }
                        },
                    });
                    return null;
                }

                return await loadSessionContent();
            } catch (err: unknown) {
                const httpError = err as { message?: string; response?: { status?: number } };
                console.error('[loadGameSession] Erro ao carregar sessão:', err);
                setApiError(httpError.message || 'Erro ao carregar sessão.');
                if (httpError?.response?.status === 401) {
                    console.warn('[loadGameSession] Sessão expirada — limpando estado.');
                    clearGameState();
                }
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [
            user,
            handleApiResponse,
            startGame,
            logState,
            toast,
            clearGameState,
            sessionId,
            setIsLoading,
            setApiError,
            setCharacter,
            setSessionId,
            clientStateVersionRef,
            lastLogVersionRef,
        ],
    );

    const createCharacter = useCallback(async (info: NewCharacterInfo): Promise<Character | null> => {
        setIsLoading(true);
        setApiError(null);
        try {
            const savedCharacterResponse = await GameService.createNewCharacter(info);
            return savedCharacterResponse.character ?? null;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Falha ao criar o personagem no servidor.';
            setApiError(message);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [setIsLoading, setApiError]);

    const deleteCharacter = useCallback(
        async (characterId: number): Promise<boolean> => {
            setIsLoading(true);
            setApiError(null);
            try {
                await GameService.deleteCharacterById(characterId);
                return true;
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Falha ao deletar o personagem.';
                setApiError(message);
                return false;
            } finally {
                setIsLoading(false);
            }
        },
        [setIsLoading, setApiError],
    );

    const deleteSession = useCallback(
        async (sessionIdToDelete: number): Promise<boolean> => {
            setIsLoading(true);
            setApiError(null);
            try {
                await GameService.deleteSessionById(sessionIdToDelete);
                if (sessionId === sessionIdToDelete) {
                    clearGameState();
                }
                return true;
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Falha ao deletar a sessão.';
                setApiError(message);
                return false;
            } finally {
                setIsLoading(false);
            }
        },
        [sessionId, clearGameState, setIsLoading, setApiError],
    );

    return {
        reinstallModal,
        setReinstallModal,
        updateCharacter,
        handleApiResponse,
        clearGameState,
        startGame,
        loadGameSession,
        createCharacter,
        deleteCharacter,
        deleteSession,
    };
}
