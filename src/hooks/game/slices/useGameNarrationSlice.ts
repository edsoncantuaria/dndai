'use client';

import { useCallback, useMemo, useState } from 'react';
import { useGameLog } from '@/hooks/useGameLog';
import { setTurnPipelinePhase, type TurnPipelinePhase } from '@/hooks/game/turnPipelineStore';
import { useTurnPipeline } from '@/hooks/game/useTurnPipeline';
import type { GameActionPipelineRefs } from './useGameActionPipelineRefs';

type NarrationSliceOpts = {
    pipelineRefs: GameActionPipelineRefs;
    hasPendingRoll: boolean;
};

function phaseToLabel(phase: TurnPipelinePhase): string | null {
    switch (phase) {
        case 'rolling':
            return 'Aguardando sua rolagem...';
        case 'mechanical':
            return 'Aplicando resultado mecânico…';
        case 'narrating':
            return 'Aguarde o Mestre…';
        default:
            return null;
    }
}

/** F.2 — log, loading, erros e fase do turno narrativo. F.1: fase PENAI = autoridade de loading. */
export function useGameNarrationSlice({ pipelineRefs, hasPendingRoll }: NarrationSliceOpts) {
    const [apiLoading, setApiLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const logState = useGameLog();
    const turnPipelinePhase = useTurnPipeline();

    const isLoading = apiLoading || turnPipelinePhase !== 'idle';
    const actionPhaseLabel = useMemo(() => phaseToLabel(turnPipelinePhase), [turnPipelinePhase]);

    const { pendingActionsRef, actionTimeoutsRef } = pipelineRefs;

    const clearApiError = useCallback(() => setApiError(null), []);

    const resetActionPipeline = useCallback((_label: string | null = null) => {
        pendingActionsRef.current.clear();
        actionTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
        actionTimeoutsRef.current.clear();
        setApiLoading(false);
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
            if (pendingActionsRef.current.size === 0 && !hasPendingRoll) {
                setTurnPipelinePhase('idle');
            }
        },
        [hasPendingRoll, pendingActionsRef, actionTimeoutsRef],
    );

    /** Compat REST (useGameSession) — não controla fase do turno PENAI. */
    const setIsLoading = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
        setApiLoading(prev => (typeof value === 'function' ? value(prev) : value));
    }, []);

    const setActionPhaseLabel = useCallback((_label: string | null) => {
        /* no-op — label derivado de turnPipelinePhase */
    }, []);

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
