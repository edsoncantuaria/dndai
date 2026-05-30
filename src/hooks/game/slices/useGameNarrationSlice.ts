'use client';

import { useCallback, useState } from 'react';
import { useGameLog } from '@/hooks/useGameLog';
import { setTurnPipelinePhase } from '@/hooks/game/turnPipelineStore';
import { useTurnPipeline } from '@/hooks/game/useTurnPipeline';
import type { GameActionPipelineRefs } from './useGameActionPipelineRefs';

type NarrationSliceOpts = {
    pipelineRefs: GameActionPipelineRefs;
    hasPendingRoll: boolean;
};

/** F.2 — log, loading, erros e fase do turno narrativo. */
export function useGameNarrationSlice({ pipelineRefs, hasPendingRoll }: NarrationSliceOpts) {
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [actionPhaseLabel, setActionPhaseLabel] = useState<string | null>(null);
    const logState = useGameLog();
    const turnPipelinePhase = useTurnPipeline();

    const { pendingActionsRef, actionTimeoutsRef } = pipelineRefs;

    const clearApiError = useCallback(() => setApiError(null), []);

    const resetActionPipeline = useCallback((label: string | null = null) => {
        pendingActionsRef.current.clear();
        actionTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
        actionTimeoutsRef.current.clear();
        setIsLoading(false);
        setActionPhaseLabel(label);
        setTurnPipelinePhase('idle');
    }, [pendingActionsRef, actionTimeoutsRef]);

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
            if (pendingActionsRef.current.size === 0 && !hasPendingRoll) {
                setActionPhaseLabel(null);
            }
        },
        [hasPendingRoll, pendingActionsRef, actionTimeoutsRef],
    );

    return {
        isLoading,
        setIsLoading,
        apiError,
        setApiError,
        actionPhaseLabel,
        setActionPhaseLabel,
        logState,
        turnPipelinePhase,
        clearApiError,
        resetActionPipeline,
        clearPendingAction,
    };
}

export type GameNarrationSlice = ReturnType<typeof useGameNarrationSlice>;
