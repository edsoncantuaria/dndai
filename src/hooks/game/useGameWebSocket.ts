'use client';

import { useEffect, type MutableRefObject } from 'react';
import type { GameMasterResponse } from '@/types';
import { addEventListener, removeEventListener } from '@/services/webSocketService';
import { setTurnPipelinePhase } from '@/hooks/game/turnPipelineStore';
import type { useInteractionManager } from '../useInteractionManager';

type InteractionSlice = Pick<
    ReturnType<typeof useInteractionManager>,
    'playerRollRequest' | 'setActionOptions'
>;

export interface GameWebSocketDeps {
    sessionId: number | null;
    handleApiResponse: (response: GameMasterResponse, isRestoring?: boolean) => void;
    loadGameSession: (id: number) => Promise<unknown>;
    interactionState: InteractionSlice;
    clearPendingAction: (actionId?: string) => void;
    resetActionPipeline: (label: string | null) => void;
    setApiError: (message: string) => void;
    setIsLoading: (value: boolean) => void;
    setActionPhaseLabel: (label: string | null) => void;
    pendingActionsRef: MutableRefObject<Set<string>>;
    actionTimeoutsRef: MutableRefObject<Map<string, NodeJS.Timeout>>;
    actionOptionsBackupRef: MutableRefObject<(string | { text: string; action: string; skill?: string })[] | null>;
    clientStateVersionRef: MutableRefObject<number>;
    latestActionSequenceRef: MutableRefObject<number>;
    toast: (opts: { variant?: 'destructive'; title: string; description?: string }) => void;
}

function acceptActionSequence(
    payload: { actionSequence?: number } | undefined,
    latestRef: MutableRefObject<number>,
): boolean {
    const seq = payload?.actionSequence;
    if (typeof seq !== 'number' || !Number.isFinite(seq)) return true;
    if (seq < latestRef.current) return false;
    if (seq > latestRef.current) latestRef.current = seq;
    return true;
}

export function useGameWebSocket(deps: GameWebSocketDeps) {
    const {
        sessionId,
        handleApiResponse,
        loadGameSession,
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
        latestActionSequenceRef,
        toast,
    } = deps;

    useEffect(() => {
        const releaseNarrationPipeline = () => {
            pendingActionsRef.current.clear();
            actionTimeoutsRef.current.forEach(timer => clearTimeout(timer));
            actionTimeoutsRef.current.clear();
            setIsLoading(false);
            if (!interactionState.playerRollRequest) {
                setActionPhaseLabel(null);
            }
        };

        const handleGameStateUpdate = (payload: GameMasterResponse & {
            stateVersion?: number;
            actionSequence?: number;
        }) => {
            if (!acceptActionSequence(payload, latestActionSequenceRef)) {
                return;
            }
            if (typeof payload?.stateVersion === 'number') {
                clientStateVersionRef.current = payload.stateVersion;
            }
            handleApiResponse(payload);
            const hasNarrativePayload =
                (Array.isArray(payload?.logEntries) && payload.logEntries.length > 0) ||
                Boolean(payload?.systemLog);
            if (
                hasNarrativePayload &&
                !interactionState.playerRollRequest &&
                !payload?.playerRollRequest
            ) {
                releaseNarrationPipeline();
                setTurnPipelinePhase('idle');
                return;
            }
            if (!interactionState.playerRollRequest && pendingActionsRef.current.size === 0) {
                setActionPhaseLabel(null);
            }
        };

        const handleError = (payload: { message: string; actionId?: string | null }) => {
            setApiError(payload.message);
            if (payload?.actionId) {
                clearPendingAction(payload.actionId);
            } else if (pendingActionsRef.current.size) {
                pendingActionsRef.current.forEach(id => clearPendingAction(id));
                pendingActionsRef.current.clear();
                actionTimeoutsRef.current.forEach(timer => clearTimeout(timer));
                actionTimeoutsRef.current.clear();
                setActionPhaseLabel(null);
            }
            if (actionOptionsBackupRef.current) {
                interactionState.setActionOptions(actionOptionsBackupRef.current);
                actionOptionsBackupRef.current = null;
            }
            if (sessionId) {
                void loadGameSession(sessionId);
            }
        };

        const updateLoadingState = () => setIsLoading(pendingActionsRef.current.size > 0);

        const handleStartLoading = (payload?: { actionId?: string }) => {
            if (payload?.actionId) {
                pendingActionsRef.current.add(payload.actionId);
                updateLoadingState();
            } else {
                setIsLoading(true);
            }
            setActionPhaseLabel('Validando regras...');
            if (interactionState.playerRollRequest) {
                setTurnPipelinePhase('rolling');
            }
        };

        const handleStopLoading = (payload?: { actionId?: string }) => {
            if (payload?.actionId) {
                clearPendingAction(payload.actionId);
            } else {
                pendingActionsRef.current.clear();
                actionTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
                actionTimeoutsRef.current.clear();
                setIsLoading(false);
            }
            if (pendingActionsRef.current.size === 0 && !interactionState.playerRollRequest) {
                setActionPhaseLabel(null);
            }
        };

        const handleActionAck = (payload?: { actionId?: string; receivedAt?: string }) => {
            if (payload?.actionId) {
                console.debug('[WS] actionAck', payload.actionId, payload.receivedAt);
            }
        };

        const handleActionResolution = (payload?: {
            actionId?: string;
            stateVersion?: number;
            status?: string;
            result?: GameMasterResponse;
            stateDelta?: Record<string, unknown>;
        }) => {
            if (payload?.actionId) {
                clearPendingAction(payload.actionId);
            }
            if (typeof payload?.stateVersion === 'number') {
                clientStateVersionRef.current = payload.stateVersion;
            }
            if (payload?.status === 'rejected' && payload.result?.systemLog) {
                toast({ variant: 'destructive', title: payload.result.systemLog });
            }
            if (payload?.stateDelta?.rest && typeof payload.stateDelta.rest === 'object') {
                const rest = payload.stateDelta.rest as { type?: string; benefits?: string[] };
                toast({
                    title: rest.type === 'long' ? 'Descanso longo validado' : 'Descanso curto validado',
                    description: rest.benefits?.join(' • '),
                });
            }
            if (payload?.status === 'needs_roll') {
                setActionPhaseLabel('Aguardando rolagem do jogador');
                if (pendingActionsRef.current.size === 0) {
                    setIsLoading(false);
                }
            } else if (payload?.status === 'accepted') {
                const awaitingRoll = Boolean(payload?.result?.playerRollRequest);
                const hasNarration =
                    (Array.isArray(payload?.result?.logEntries) && payload.result.logEntries.length > 0) ||
                    Boolean(payload?.result?.systemLog);
                if (awaitingRoll) {
                    setActionPhaseLabel('Aguardando rolagem do jogador');
                } else if (hasNarration && !interactionState.playerRollRequest) {
                    releaseNarrationPipeline();
                } else {
                    setActionPhaseLabel('Gerando narrativa...');
                }
            } else if (payload?.status === 'rejected') {
                if (!interactionState.playerRollRequest && pendingActionsRef.current.size === 0) {
                    setActionPhaseLabel(null);
                    setIsLoading(false);
                }
            }
            if (payload?.result) {
                handleApiResponse({ ...payload.result, stateVersion: payload.stateVersion });
            }
        };

        const handleSocketClosed = (payload?: { code?: number; reason?: string }) => {
            resetActionPipeline('Conexão perdida. Reconectando...');
            if (sessionId) {
                void loadGameSession(sessionId);
            }
            console.warn('[WS] conexão encerrada', payload);
        };

        const handleMechanicalStateUpdate = (payload?: GameMasterResponse & {
            stateVersion?: number;
            actionSequence?: number;
            actionId?: string;
        }) => {
            if (!acceptActionSequence(payload, latestActionSequenceRef)) {
                return;
            }
            if (typeof payload?.stateVersion === 'number') {
                clientStateVersionRef.current = payload.stateVersion;
            }
            handleApiResponse(
                {
                    logEntries: [],
                    actionOptions: [],
                    updatedCharacter: payload?.updatedCharacter,
                    combatState: payload?.combatState,
                    playerRollRequest: payload?.playerRollRequest,
                    lootOffer: payload?.lootOffer,
                    stateVersion: payload?.stateVersion,
                },
                false,
            );
            setActionPhaseLabel('Regras aplicadas — gerando narração...');
            setTurnPipelinePhase('mechanical');
        };

        const handleNarrationLoading = (payload?: { actionId?: string }) => {
            if (payload?.actionId) {
                pendingActionsRef.current.add(payload.actionId);
            }
            setActionPhaseLabel('O Mestre está narrando...');
            setIsLoading(true);
            setTurnPipelinePhase('narrating');
        };

        const handleNarrationStream = (payload?: {
            actionId?: string;
            kind?: string;
            text?: string;
            canonical?: boolean;
        }) => {
            // P4.6 — preview efêmero; gameStateUpdate substitui o texto canônico
            if (payload?.canonical === true) return;
            if (payload?.kind === 'preview' && payload.text?.trim()) {
                const snippet = payload.text.trim().slice(-160);
                setActionPhaseLabel(snippet.length > 12 ? snippet : 'O Mestre está narrando...');
            }
        };

        const handleNarrationQueued = (payload?: { actionId?: string; actionSequence?: number }) => {
            acceptActionSequence(payload, latestActionSequenceRef);
            if (payload?.actionId) {
                pendingActionsRef.current.add(payload.actionId);
                setIsLoading(true);
            }
            setActionPhaseLabel('Narração na fila — aguarde...');
            setTurnPipelinePhase('narrating');
        };

        const handleNarrationCancelled = (payload?: {
            actionId?: string;
            actionSequence?: number;
            reason?: string;
        }) => {
            if (payload?.actionId) {
                clearPendingAction(payload.actionId);
            }
            if (pendingActionsRef.current.size === 0 && !interactionState.playerRollRequest) {
                setIsLoading(false);
                setActionPhaseLabel(null);
                setTurnPipelinePhase('idle');
            }
        };

        const handleNarrationComplete = (payload?: { actionId?: string }) => {
            if (payload?.actionId) {
                clearPendingAction(payload.actionId);
            }
            if (pendingActionsRef.current.size === 0 && !interactionState.playerRollRequest) {
                setActionPhaseLabel(null);
                setIsLoading(false);
            }
        };

        const handleActionTimeout = (payload?: { actionId?: string }) => {
            if (!payload?.actionId) return;
            pendingActionsRef.current.delete(payload.actionId);
            const timer = actionTimeoutsRef.current.get(payload.actionId);
            if (timer) {
                clearTimeout(timer);
                actionTimeoutsRef.current.delete(payload.actionId);
            }
            updateLoadingState();
            if (!interactionState.playerRollRequest) {
                setActionPhaseLabel(null);
            }
            toast({
                variant: 'destructive',
                title: 'Ação demorou demais',
                description: 'Recarregando a sessão para sincronizar.',
            });
            if (sessionId) {
                void loadGameSession(sessionId);
            }
        };

        addEventListener('gameStateUpdate', handleGameStateUpdate);
        addEventListener('mechanicalStateUpdate', handleMechanicalStateUpdate);
        addEventListener('error', handleError);
        addEventListener('startLoading', handleStartLoading);
        addEventListener('stopLoading', handleStopLoading);
        addEventListener('timeout', handleActionTimeout);
        addEventListener('narrationLoading', handleNarrationLoading);
        addEventListener('narrationStream', handleNarrationStream);
        addEventListener('narrationQueued', handleNarrationQueued);
        addEventListener('narrationCancelled', handleNarrationCancelled);
        addEventListener('narrationComplete', handleNarrationComplete);
        addEventListener('actionAck', handleActionAck);
        addEventListener('actionResolution', handleActionResolution);
        addEventListener('connectionClosed', handleSocketClosed);

        return () => {
            removeEventListener('gameStateUpdate', handleGameStateUpdate);
            removeEventListener('mechanicalStateUpdate', handleMechanicalStateUpdate);
            removeEventListener('error', handleError);
            removeEventListener('startLoading', handleStartLoading);
            removeEventListener('stopLoading', handleStopLoading);
            removeEventListener('timeout', handleActionTimeout);
            removeEventListener('narrationLoading', handleNarrationLoading);
            removeEventListener('narrationStream', handleNarrationStream);
            removeEventListener('narrationQueued', handleNarrationQueued);
            removeEventListener('narrationCancelled', handleNarrationCancelled);
            removeEventListener('narrationComplete', handleNarrationComplete);
            removeEventListener('actionAck', handleActionAck);
            removeEventListener('actionResolution', handleActionResolution);
            removeEventListener('connectionClosed', handleSocketClosed);
        };
    }, [
        handleApiResponse,
        interactionState.playerRollRequest,
        interactionState,
        clearPendingAction,
        loadGameSession,
        sessionId,
        resetActionPipeline,
        setApiError,
        setIsLoading,
        setActionPhaseLabel,
        pendingActionsRef,
        actionTimeoutsRef,
        actionOptionsBackupRef,
        clientStateVersionRef,
        toast,
    ]);
}
