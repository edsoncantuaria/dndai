'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { sendMessage } from '@/services/webSocketService';
import { translateAttribute } from '@/utils/translator';
import type { Character, LevelUpSelections, PlayerRollRequest } from '@/types';
import type { useInteractionManager } from '../useInteractionManager';
import type { useGameLog } from '../useGameLog';

const CLIENT_ACTION_TIMEOUT_MS =
    Number(process.env.NEXT_PUBLIC_ACTION_TIMEOUT_MS) || 120_000;

type InteractionSlice = ReturnType<typeof useInteractionManager>;
type LogSlice = Pick<ReturnType<typeof useGameLog>, 'addLogEntry'>;

export interface UseGameActionsOptions {
    sessionId: number | null;
    character: Character | null;
    model: string;
    useAiHomebrew: boolean;
    getApiKey: () => string | undefined;
    logState: LogSlice;
    interactionState: InteractionSlice;
    loadGameSession: (id: number) => Promise<unknown>;
    setApiError: Dispatch<SetStateAction<string | null>>;
    setIsLoading: Dispatch<SetStateAction<boolean>>;
    setActionPhaseLabel: Dispatch<SetStateAction<string | null>>;
    pendingActionsRef: MutableRefObject<Set<string>>;
    actionTimeoutsRef: MutableRefObject<Map<string, NodeJS.Timeout>>;
    actionOptionsBackupRef: MutableRefObject<(string | { text: string; action: string; skill?: string })[] | null>;
    clientStateVersionRef: MutableRefObject<number>;
    actionCursorRef: MutableRefObject<number>;
    clientInstanceId: string;
    toast: (opts: { variant?: 'destructive'; title: string; description?: string }) => void;
}

export function useGameActions(options: UseGameActionsOptions) {
    const {
        sessionId,
        character,
        model,
        useAiHomebrew,
        getApiKey,
        logState,
        interactionState,
        loadGameSession,
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
    } = options;

    const processPlayerAction = useCallback(
        async (action: string, sessionIdOverride?: number, modelOverride?: string) => {
            const currentSessionId = sessionIdOverride ?? sessionId;

            if (currentSessionId == null || currentSessionId <= 0) {
                const warningMessage = 'Nenhuma sessão ativa. Abra ou selecione uma aventura antes de agir.';
                setApiError(warningMessage);
                toast({ variant: 'destructive', title: warningMessage });
                return;
            }
            const finalSessionId = currentSessionId;

            const isInternalAction =
                action.startsWith('Recarregar estado atual') ||
                action.startsWith('A aventura começa.') ||
                action.includes('Gere uma resposta de Mestre de Jogo que demonstre todas as suas capacidades');

            if (!isInternalAction && finalSessionId !== -1) {
                logState.addLogEntry({
                    id: uuidv4(),
                    type: 'action',
                    content: action,
                    stateVersion: clientStateVersionRef.current,
                });
            }

            actionOptionsBackupRef.current = interactionState.actionOptions.slice();
            interactionState.clearTransientInteractions();
            interactionState.setActionOptions([]);

            const actionId = uuidv4();
            actionCursorRef.current += 1;
            setActionPhaseLabel('Enfileirando ação...');

            const intentPayload =
                interactionState.pendingStructuredIntent &&
                typeof interactionState.pendingStructuredIntent === 'object'
                    ? interactionState.pendingStructuredIntent
                    : undefined;

            sendMessage('processAction', {
                contractVersion: 1,
                sessionId: finalSessionId,
                prompt: action,
                apiKey: getApiKey() ?? '',
                combatState: interactionState.combatState,
                useAiHomebrew,
                model: modelOverride || model,
                intent: intentPayload,
                actionId,
                clientStateVersion: clientStateVersionRef.current,
                clientInstanceId,
                actionCursor: actionCursorRef.current,
            });
            interactionState.setPendingStructuredIntent(null);
            pendingActionsRef.current.add(actionId);
            setIsLoading(true);

            const safetyTimeout = setTimeout(() => {
                actionTimeoutsRef.current.delete(actionId);
                if (pendingActionsRef.current.delete(actionId)) {
                    setIsLoading(pendingActionsRef.current.size > 0);
                    setActionPhaseLabel('Sem resposta do motor');
                    toast({
                        variant: 'destructive',
                        title: 'Ação não confirmada',
                        description:
                            'O Mestre demorou mais que o esperado. Recarregando a sessão para sincronizar.',
                    });
                    void loadGameSession(finalSessionId);
                }
            }, CLIENT_ACTION_TIMEOUT_MS);
            actionTimeoutsRef.current.set(actionId, safetyTimeout);
        },
        [
            sessionId,
            interactionState,
            getApiKey,
            logState,
            model,
            useAiHomebrew,
            toast,
            loadGameSession,
            setApiError,
            setIsLoading,
            setActionPhaseLabel,
            pendingActionsRef,
            actionTimeoutsRef,
            actionOptionsBackupRef,
            clientStateVersionRef,
            actionCursorRef,
            clientInstanceId,
        ],
    );

    const submitRollResult = useCallback(
        (request: PlayerRollRequest, result: { rawRoll: number; rolls: number[] }) => {
            if (!sessionId) {
                setApiError('Nenhuma sessão ativa para enviar o resultado da rolagem.');
                return;
            }
            if (!request.requestId) {
                setApiError('Esta rolagem não possui um identificador válido.');
                return;
            }
            sendMessage('submitRollResult', {
                sessionId,
                requestId: request.requestId,
                rolls: result.rolls,
                rawRoll: result.rawRoll,
                apiKey: getApiKey() ?? '',
                combatState: interactionState.combatState,
                useAiHomebrew,
                clientStateVersion: clientStateVersionRef.current,
            });
        },
        [sessionId, getApiKey, interactionState.combatState, useAiHomebrew, setApiError, clientStateVersionRef],
    );

    const handleApplyLevelUp = useCallback(
        async (selections: LevelUpSelections, processPlayerActionFn: typeof processPlayerAction) => {
            if (!character || !interactionState.levelUpState?.isPending) return;

            const { newLevel } = interactionState.levelUpState;
            const summaryParts: string[] = [];

            if (selections.attributes) {
                const attrChanges = Object.entries(selections.attributes)
                    .filter(([, value]) => !!value)
                    .map(([attr, value]) => `${translateAttribute(attr)} +${value}`);
                if (attrChanges.length) summaryParts.push(`Atributos: ${attrChanges.join(', ')}`);
            }
            if (selections.spells?.length) summaryParts.push(`Novas magias: ${selections.spells.join(', ')}`);
            if (selections.featureChoices?.length) {
                const featSummary = selections.featureChoices
                    .map(choice => choice.selections.join(', '))
                    .filter(Boolean);
                if (featSummary.length) summaryParts.push(`Características: ${featSummary.join('; ')}`);
            }
            if (selections.subclass) summaryParts.push(`Subclasse: ${selections.subclass}`);
            if (selections.hpIncrease !== undefined) {
                summaryParts.push(`Aumento de PV total: +${selections.hpIncrease}`);
            }

            const actionText = [
                `Confirmo meu avanço para o nível ${newLevel}.`,
                summaryParts.length ? summaryParts.join(' | ') : '',
            ]
                .filter(Boolean)
                .join(' ');

            interactionState.clearRequest('levelUp');
            interactionState.setActionOptions([]);
            await processPlayerActionFn(actionText);
        },
        [character, interactionState],
    );

    const handleToggleEquipped = useCallback(
        (itemId: string, processPlayerActionFn: typeof processPlayerAction) => {
            const item = character?.inventory.find(i => String(i.id) === String(itemId));
            if (!item) return;

            const numericId = Number(itemId);
            if (!Number.isFinite(numericId)) {
                processPlayerActionFn(
                    item.equipped ? `Eu desequipo meu ${item.name}.` : `Eu equipo meu ${item.name}.`,
                );
                return;
            }

            interactionState.setPendingStructuredIntent({
                type: 'equip-item',
                payload: { itemId: numericId, equipped: !item.equipped },
            });
            const actionText = item.equipped ? `Eu desequipo meu ${item.name}.` : `Eu equipo meu ${item.name}.`;
            processPlayerActionFn(actionText);
        },
        [character, interactionState],
    );

    const handleUseConsumable = useCallback(
        (itemId: string, processPlayerActionFn: typeof processPlayerAction) => {
            const item = character?.inventory.find(i => i.id === itemId);
            if (!item || !item.consumable) {
                toast({ variant: 'destructive', title: 'Item não consumível' });
                return;
            }
            processPlayerActionFn(`Eu uso ${item.name}.`);
        },
        [character, toast],
    );

    const handleSpendHitDice = useCallback(
        (diceCount: number, processPlayerActionFn: typeof processPlayerAction) => {
            if (!character || character.hitDice.current < diceCount) return;
            processPlayerActionFn(`Eu gasto ${diceCount} dado(s) de vida para me curar.`);
        },
        [character],
    );

    const handleDeclineHitDiceRequest = useCallback(
        (processPlayerActionFn: typeof processPlayerAction) => {
            interactionState.clearRequest('hitDice');
            toast({
                title: 'Sem descanso agora',
                description: 'Os Dados de Vida continuam disponíveis para a próxima pausa.',
            });
            processPlayerActionFn('Eu não vou gastar dados de vida agora.');
        },
        [interactionState, toast],
    );

    return {
        processPlayerAction,
        submitRollResult,
        handleApplyLevelUp,
        handleToggleEquipped,
        handleUseConsumable,
        handleSpendHitDice,
        handleDeclineHitDiceRequest,
    };
}
