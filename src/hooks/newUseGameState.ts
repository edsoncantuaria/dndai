// src/hooks/newUseGameState.ts — orquestrador fino (Fase 6)
'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useGameLog } from './useGameLog';
import { useInteractionManager } from './useInteractionManager';
import type { Character, ProgressionFeedItem } from '../types';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { useGameWebSocket } from './game/useGameWebSocket';
import { useGameSession } from './game/useGameSession';
import { useGameActions } from './game/useGameActions';

export const useNewGameState = () => {
    const { user } = useAuth();
    const { apiKey, model, useAiHomebrew } = useSettingsContext();
    const { toast } = useToast();

    const [character, setCharacter] = useState<Character | null>(null);
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [ambientSound, setAmbientSound] = useState<string>('none');
    const [progressionFeed, setProgressionFeed] = useState<ProgressionFeedItem[]>([]);
    const [actionPhaseLabel, setActionPhaseLabel] = useState<string | null>(null);

    const actionOptionsBackupRef = useRef<(string | { text: string; action: string; skill?: string })[] | null>(null);
    const clientStateVersionRef = useRef(0);
    const lastLogVersionRef = useRef(0);
    const pendingActionsRef = useRef<Set<string>>(new Set());
    const actionTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const processPlayerActionRef = useRef<
        (action: string, sessionIdOverride?: number, modelOverride?: string) => Promise<void>
    >();
    const actionCursorRef = useRef(0);
    const [clientInstanceId] = useState(() => `web-${Math.random().toString(36).slice(2, 10)}`);

    const logState = useGameLog();
    const interactionState = useInteractionManager();

    const getApiKey = useCallback(() => apiKey, [apiKey]);
    const clearApiError = useCallback(() => setApiError(null), []);

    const resetActionPipeline = useCallback((label: string | null = null) => {
        pendingActionsRef.current.clear();
        actionTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
        actionTimeoutsRef.current.clear();
        setIsLoading(false);
        setActionPhaseLabel(label);
    }, []);

    const clearPendingAction = useCallback(
        (actionId?: string) => {
            if (!actionId) return;
            pendingActionsRef.current.delete(actionId);
            const timer = actionTimeoutsRef.current.get(actionId);
            if (timer) {
                clearTimeout(timer);
                actionTimeoutsRef.current.delete(actionId);
            }
            setIsLoading(pendingActionsRef.current.size > 0);
            if (pendingActionsRef.current.size === 0 && !interactionState.playerRollRequest) {
                setActionPhaseLabel(null);
            }
        },
        [interactionState.playerRollRequest],
    );

    const sessionApi = useGameSession({
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
    });

    const actionsApi = useGameActions({
        sessionId,
        character,
        model,
        useAiHomebrew,
        getApiKey,
        logState,
        interactionState,
        loadGameSession: sessionApi.loadGameSession,
        setApiError,
        setIsLoading,
        setActionPhaseLabel,
        pendingActionsRef,
        actionTimeoutsRef,
        actionOptionsBackupRef,
        clientStateVersionRef,
        actionCursorRef,
        clientInstanceId,
        toast,
    });

    useEffect(() => {
        processPlayerActionRef.current = actionsApi.processPlayerAction;
    }, [actionsApi.processPlayerAction]);

    useGameWebSocket({
        sessionId,
        handleApiResponse: sessionApi.handleApiResponse,
        loadGameSession: sessionApi.loadGameSession,
        interactionState,
        clearPendingAction,
        resetActionPipeline,
        setApiError,
        setIsLoading,
        setActionPhaseLabel,
        pendingActionsRef,
        actionTimeoutsRef,
        actionOptionsBackupRef,
        clientStateVersionRef,
        toast,
    });

    const isRollPending = Boolean(interactionState.playerRollRequest);

    useEffect(() => {
        if (interactionState.playerRollRequest) {
            setActionPhaseLabel('Aguardando sua rolagem...');
        } else if (pendingActionsRef.current.size === 0) {
            setActionPhaseLabel(prev => (prev?.includes('rolagem') ? null : prev));
        }
    }, [interactionState.playerRollRequest]);

    useEffect(() => {
        if (sessionId) {
            resetActionPipeline(null);
        }
    }, [sessionId, resetActionPipeline]);

    const applyLevelUp = useCallback(
        (selections: Parameters<typeof actionsApi.handleApplyLevelUp>[0]) =>
            actionsApi.handleApplyLevelUp(selections, actionsApi.processPlayerAction),
        [actionsApi],
    );

    const toggleEquipped = useCallback(
        (itemId: string) => actionsApi.handleToggleEquipped(itemId, actionsApi.processPlayerAction),
        [actionsApi],
    );

    const useConsumable = useCallback(
        (itemId: string) => actionsApi.handleUseConsumable(itemId, actionsApi.processPlayerAction),
        [actionsApi],
    );

    const spendHitDice = useCallback(
        (diceCount: number) => actionsApi.handleSpendHitDice(diceCount, actionsApi.processPlayerAction),
        [actionsApi],
    );

    const declineHitDiceRequest = useCallback(
        () => actionsApi.handleDeclineHitDiceRequest(actionsApi.processPlayerAction),
        [actionsApi],
    );

    return useMemo(
        () => ({
            character,
            log: logState.log,
            sessionId,
            ...interactionState,
            reinstallModal: sessionApi.reinstallModal,
            setReinstallModal: sessionApi.setReinstallModal,
            isLoading,
            apiError,
            ambientSound,
            setAmbientSound,
            progressionFeed,
            clearApiError,
            getApiKey,
            createCharacter: sessionApi.createCharacter,
            deleteCharacter: sessionApi.deleteCharacter,
            deleteSession: sessionApi.deleteSession,
            startGame: sessionApi.startGame,
            processPlayerAction: actionsApi.processPlayerAction,
            clearGameState: sessionApi.clearGameState,
            loadGameSession: sessionApi.loadGameSession,
            handleRollResult: interactionState.handleRollResult(actionsApi.submitRollResult),
            handleSkillCheckSubmit: interactionState.handleSkillCheckSubmit(actionsApi.processPlayerAction),
            submitSpellCast: interactionState.submitSpellCast(actionsApi.processPlayerAction),
            applyLevelUp,
            toggleEquipped,
            useConsumable,
            spendHitDice,
            declineHitDiceRequest,
            takeLoot: interactionState.handleTakeLoot(actionsApi.processPlayerAction),
            buyItem: interactionState.handleBuyItem(actionsApi.processPlayerAction),
            sellItem: interactionState.handleSellItem(actionsApi.processPlayerAction),
            openShop: interactionState.handleOpenShop(actionsApi.processPlayerAction),
            closeShop: interactionState.handleCloseShop(actionsApi.processPlayerAction),
            startEncounter: interactionState.handleStartEncounter(actionsApi.processPlayerAction),
            nextTurn: interactionState.nextTurn(actionsApi.processPlayerAction),
            triggerTestShop: (processPlayerAction?: (action: string) => void) =>
                interactionState.triggerTestShop(
                    processPlayerAction ?? actionsApi.processPlayerAction,
                ),
            triggerTestCombat: (
                processPlayerAction?: (action: string) => void,
                charOverride?: { id: number; name: string; attributes?: { hp?: number; maxHp?: number; ac?: number } },
            ) => {
                const c = charOverride ?? (character
                    ? { id: character.id, name: character.name, attributes: character.attributes }
                    : undefined);
                interactionState.triggerTestCombat(
                    processPlayerAction ?? actionsApi.processPlayerAction,
                    c,
                );
            },
            setCharacter,
            setLog: logState.setLog,
            setSessionId,
            actionPhaseLabel,
            isRollPending,
        }),
        [
            character,
            logState,
            sessionId,
            interactionState,
            sessionApi,
            isLoading,
            apiError,
            ambientSound,
            setAmbientSound,
            progressionFeed,
            clearApiError,
            getApiKey,
            actionsApi,
            applyLevelUp,
            toggleEquipped,
            useConsumable,
            spendHitDice,
            declineHitDiceRequest,
            setCharacter,
            actionPhaseLabel,
            isRollPending,
        ],
    );
};
