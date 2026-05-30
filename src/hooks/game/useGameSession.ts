'use client';

import { useCallback, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';
import * as GameService from '@/services/gameService';
import type {
    Character,
    CombatState,
    GameMasterResponse,
    LogEntry,
    LootOffer,
    NewCharacterInfo,
    ProgressionFeedItem,
    ShopState,
} from '@/types';
import { hasSessionBeenOpened, markSessionOpened } from '@/lib/sessionDevStorage';
import { deriveAmbientSoundFromWorld } from '@/hooks/game/ambientSound';
import { setTurnPipelinePhase } from '@/hooks/game/turnPipelineStore';
import { patchCharacter } from './characterPatch';
import { loadPenaiGameSession } from '@/lib/penaiCharacterAdapter';
import { getPenaiBridge } from '@/lib/penaiBridge';
import { deletePenaiSession } from '@/services/penaiApi';
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
    } = options;

    const bootstrappedSessionsRef = useRef(new Set<number>());

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
                setTurnPipelinePhase('rolling');
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
    }, [logState, interactionState, resetActionPipeline, setCharacter, setSessionId, setApiError, setProgressionFeed]);

    const startGame = useCallback(
        async (newSessionId?: number): Promise<void> => {
            const targetSessionId = newSessionId ?? sessionId;
            if (!targetSessionId) return;

            const opening =
                'A aventura começa. Onde eu estou e o que está acontecendo?';

            const bridge = getPenaiBridge();
            if (bridge?.active) {
                bridge.sendProcessAction(opening);
                return;
            }
            if (typeof window !== 'undefined') {
                sessionStorage.setItem(
                    `cda:session:${targetSessionId}:penaiBootstrap`,
                    '1',
                );
            }
        },
        [sessionId],
    );

    const hydratePenaiMechanical = useCallback(
        (mechanical: Record<string, unknown>) => {
            const combatRaw = mechanical.combatState as Record<string, unknown> | undefined;
            if (combatRaw && typeof combatRaw === 'object') {
                const combatants = Array.isArray(combatRaw.combatants)
                    ? (combatRaw.combatants as Array<Record<string, unknown>>)
                    : [];
                const order = Array.isArray(combatRaw.initiativeOrder)
                    ? (combatRaw.initiativeOrder as string[])
                    : combatants.map(c => String(c.entityKey ?? ''));
                interactionState.setCombatState({
                    isActive: Boolean(combatRaw.isActive),
                    round: Number(combatRaw.round ?? 1),
                    turn: Number(combatRaw.turn ?? 0),
                    initiativeOrder: order,
                    combatants: combatants.map(c => ({
                        id: String(c.entityKey ?? c.id ?? ''),
                        name: String(c.displayName ?? c.name ?? 'Combatente'),
                        isPlayer: c.side === 'hero',
                        hp: { current: Number(c.hp ?? 0), max: Number(c.hpMax ?? 1) },
                        ac: Number(c.armorClass ?? 10),
                        initiative: Number(c.initiative ?? 10),
                        hasMoved: false,
                        hasActed: false,
                        actionPoints: 3,
                        bonusActionPoints: 1,
                        conditions: [],
                        rollHistory: [],
                    })),
                } as CombatState);
            }

            const loot = mechanical.pendingLootOffer as LootOffer | null | undefined;
            if (loot && typeof loot === 'object') {
                interactionState.setRequest({ type: 'loot', request: loot });
            }

            const shop = mechanical.shopState as Record<string, unknown> | null | undefined;
            if (shop && typeof shop === 'object' && Array.isArray(shop.inventory)) {
                interactionState.setRequest({
                    type: 'shop',
                    request: {
                        isOpen: true,
                        isHaggling: false,
                        name: String(shop.name ?? 'Loja'),
                        inventory: shop.inventory,
                        sellPrices: {},
                    } as ShopState,
                });
            }
        },
        [interactionState],
    );

    const loadGameSession = useCallback(
        async (id: number): Promise<{ character: Character; logs: LogEntry[] } | null> => {
            setIsLoading(true);
            setApiError(null);
            try {
                const userId = (user as { id?: number } | undefined)?.id ?? 1;
                const { session, mechanical, character: penaiCharacter } =
                    await loadPenaiGameSession(id, userId);

                setCharacter(penaiCharacter);
                logState.setLog([]);
                setSessionId(id);
                clientStateVersionRef.current =
                    Number(mechanical.stateVersion ?? session.stateVersion ?? 0);
                lastLogVersionRef.current = clientStateVersionRef.current;
                hydratePenaiMechanical(mechanical);

                const regionSlug = String(
                    mechanical.currentRegionSlug ??
                        session.currentRegionSlug ??
                        penaiCharacter.currentRegion ??
                        '',
                );
                if (regionSlug) {
                    setAmbientSound(deriveAmbientSoundFromWorld({ currentRegion: regionSlug }));
                }

                if (hasSessionBeenOpened(id)) {
                    markSessionOpened(id);
                    bootstrappedSessionsRef.current.add(id);
                } else if (!bootstrappedSessionsRef.current.has(id)) {
                    bootstrappedSessionsRef.current.add(id);
                    markSessionOpened(id);
                    await startGame(id);
                }

                return { character: penaiCharacter, logs: [] as LogEntry[] };
            } catch (err: unknown) {
                const httpError = err as { message?: string; response?: { status?: number } };
                console.error('[loadGameSession] Erro ao carregar sessão PENAI:', err);
                setApiError(httpError.message || 'Erro ao carregar sessão.');
                if (httpError?.response?.status === 401) {
                    toast({
                        variant: 'destructive',
                        title: 'Sessão expirada',
                        description: 'Faça login novamente e reabra a aventura.',
                    });
                    clearGameState();
                }
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [
            user,
            startGame,
            logState,
            toast,
            clearGameState,
            setIsLoading,
            setApiError,
            setCharacter,
            setSessionId,
            setAmbientSound,
            clientStateVersionRef,
            lastLogVersionRef,
            hydratePenaiMechanical,
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

    const updateCharacter = useCallback(
        async (characterId: string | number, info: NewCharacterInfo): Promise<Character | null> => {
            setIsLoading(true);
            setApiError(null);
            try {
                const savedCharacterResponse = await GameService.updateVaultCharacter(characterId, info);
                return savedCharacterResponse.character ?? null;
            } catch (error: unknown) {
                const message =
                    error instanceof Error ? error.message : 'Falha ao atualizar o personagem no cofre.';
                setApiError(message);
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [setIsLoading, setApiError],
    );

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
                await deletePenaiSession(sessionIdToDelete);
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
        updateCharacter,
        handleApiResponse,
        clearGameState,
        startGame,
        loadGameSession,
        createCharacter,
        updateCharacter,
        deleteCharacter,
        deleteSession,
    };
}
