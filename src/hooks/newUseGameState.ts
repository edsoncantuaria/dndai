// src/hooks/newUseGameState.ts — orquestrador (F.2: slices session / narration / combat)
'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useInteractionManager } from './useInteractionManager';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { useGameWebSocket } from './game/useGameWebSocket';
import { useGameSession } from './game/useGameSession';
import { useGameActions } from './game/useGameActions';
import {
    useGameActionPipelineRefs,
    useGameCombatSlice,
    useGameNarrationSlice,
    useGameSessionSlice,
} from './game/slices';

export const useNewGameState = () => {
    const { user } = useAuth();
    const { apiKey, model, useAiHomebrew, narrationVoice, narrationSpeed } = useSettingsContext();
    const { toast } = useToast();

    const session = useGameSessionSlice();
    const pipelineRefs = useGameActionPipelineRefs();
    const interactionState = useInteractionManager();
    const combat = useGameCombatSlice(interactionState);

    const narration = useGameNarrationSlice({
        pipelineRefs,
        hasPendingRoll: Boolean(interactionState.playerRollRequest),
    });

    const getApiKey = useCallback(() => apiKey, [apiKey]);

    const sessionApi = useGameSession({
        user,
        sessionId: session.sessionId,
        character: session.character,
        ambientSound: session.ambientSound,
        setCharacter: session.setCharacter,
        setSessionId: session.setSessionId,
        setAmbientSound: session.setAmbientSound,
        setApiError: narration.setApiError,
        setIsLoading: narration.setIsLoading,
        setProgressionFeed: session.setProgressionFeed,
        logState: narration.logState,
        interactionState,
        clientStateVersionRef: pipelineRefs.clientStateVersionRef,
        lastLogVersionRef: pipelineRefs.lastLogVersionRef,
        resetActionPipeline: narration.resetActionPipeline,
        toast,
        processPlayerActionRef: pipelineRefs.processPlayerActionRef,
    });

    const actionsApi = useGameActions({
        sessionId: session.sessionId,
        character: session.character,
        model,
        useAiHomebrew,
        narrationVoice,
        narrationSpeed,
        getApiKey,
        logState: narration.logState,
        interactionState,
        loadGameSession: sessionApi.loadGameSession,
        setApiError: narration.setApiError,
        setIsLoading: narration.setIsLoading,
        setActionPhaseLabel: narration.setActionPhaseLabel,
        pendingActionsRef: pipelineRefs.pendingActionsRef,
        actionTimeoutsRef: pipelineRefs.actionTimeoutsRef,
        actionOptionsBackupRef: pipelineRefs.actionOptionsBackupRef,
        clientStateVersionRef: pipelineRefs.clientStateVersionRef,
        actionCursorRef: pipelineRefs.actionCursorRef,
        clientInstanceId: pipelineRefs.clientInstanceId,
        toast,
    });

    useEffect(() => {
        pipelineRefs.processPlayerActionRef.current = actionsApi.processPlayerAction;
    }, [actionsApi.processPlayerAction, pipelineRefs.processPlayerActionRef]);

    useGameWebSocket({
        sessionId: session.sessionId,
        handleApiResponse: sessionApi.handleApiResponse,
        loadGameSession: sessionApi.loadGameSession,
        interactionState,
        clearPendingAction: narration.clearPendingAction,
        resetActionPipeline: narration.resetActionPipeline,
        setApiError: narration.setApiError,
        setIsLoading: narration.setIsLoading,
        setActionPhaseLabel: narration.setActionPhaseLabel,
        pendingActionsRef: pipelineRefs.pendingActionsRef,
        actionTimeoutsRef: pipelineRefs.actionTimeoutsRef,
        actionOptionsBackupRef: pipelineRefs.actionOptionsBackupRef,
        clientStateVersionRef: pipelineRefs.clientStateVersionRef,
        latestActionSequenceRef: pipelineRefs.latestActionSequenceRef,
        toast,
    });

    const isRollPending = Boolean(interactionState.playerRollRequest);

    useEffect(() => {
        if (interactionState.playerRollRequest) {
            narration.setActionPhaseLabel('Aguardando sua rolagem...');
        } else if (pipelineRefs.pendingActionsRef.current.size === 0) {
            narration.setActionPhaseLabel(prev => (prev?.includes('rolagem') ? null : prev));
        }
    }, [interactionState.playerRollRequest, narration.setActionPhaseLabel, pipelineRefs.pendingActionsRef]);

    useEffect(() => {
        if (session.sessionId) {
            pipelineRefs.latestActionSequenceRef.current = 0;
            narration.resetActionPipeline(null);
        }
    }, [session.sessionId, narration.resetActionPipeline, pipelineRefs.latestActionSequenceRef]);

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
            character: session.character,
            log: narration.logState.log,
            sessionId: session.sessionId,
            actionOptions: interactionState.actionOptions,
            setActionOptions: interactionState.setActionOptions,
            skillCheckRequest: interactionState.skillCheckRequest,
            setSkillCheckRequest: interactionState.setSkillCheckRequest,
            spellCastRequest: interactionState.spellCastRequest,
            setSpellCastRequest: interactionState.setSpellCastRequest,
            pendingStructuredIntent: interactionState.pendingStructuredIntent,
            setPendingStructuredIntent: interactionState.setPendingStructuredIntent,
            setRequest: interactionState.setRequest,
            clearRequest: interactionState.clearRequest,
            setPlayerRollRequest: interactionState.setPlayerRollRequest,
            setCombatState: combat.setCombatState,
            handleSkillCheck: interactionState.handleSkillCheck,
            getTestShopCatalog: interactionState.getTestShopCatalog,
            triggerTestSkillCheck: interactionState.triggerTestSkillCheck,
            ...combat,
            reinstallModal: sessionApi.reinstallModal,
            setReinstallModal: sessionApi.setReinstallModal,
            isLoading: narration.isLoading,
            apiError: narration.apiError,
            ambientSound: session.ambientSound,
            setAmbientSound: session.setAmbientSound,
            progressionFeed: session.progressionFeed,
            clearApiError: narration.clearApiError,
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
            takeLoot: combat.handleTakeLoot(actionsApi.processPlayerAction),
            buyItem: combat.handleBuyItem(actionsApi.processPlayerAction),
            sellItem: combat.handleSellItem(actionsApi.processPlayerAction),
            openShop: combat.handleOpenShop(actionsApi.processPlayerAction),
            closeShop: combat.handleCloseShop(actionsApi.processPlayerAction),
            startEncounter: combat.handleStartEncounter(actionsApi.processPlayerAction),
            nextTurn: combat.nextTurn(actionsApi.processPlayerAction),
            triggerTestShop: (processPlayerAction?: (action: string) => void) =>
                combat.triggerTestShop(processPlayerAction ?? actionsApi.processPlayerAction),
            triggerTestCombat: (
                processPlayerAction?: (action: string) => void,
                charOverride?: { id: number; name: string; attributes?: { hp?: number; maxHp?: number; ac?: number } },
            ) => {
                const c =
                    charOverride ??
                    (session.character
                        ? {
                              id: session.character.id,
                              name: session.character.name,
                              attributes: session.character.attributes,
                          }
                        : undefined);
                combat.triggerTestCombat(processPlayerAction ?? actionsApi.processPlayerAction, c);
            },
            setCharacter: session.setCharacter,
            setLog: narration.logState.setLog,
            setSessionId: session.setSessionId,
            actionPhaseLabel: narration.actionPhaseLabel,
            isRollPending,
            turnPipelinePhase: narration.turnPipelinePhase,
        }),
        [
            session,
            narration,
            interactionState,
            combat,
            sessionApi,
            actionsApi,
            applyLevelUp,
            toggleEquipped,
            useConsumable,
            spendHitDice,
            declineHitDiceRequest,
            getApiKey,
            isRollPending,
        ],
    );
};
