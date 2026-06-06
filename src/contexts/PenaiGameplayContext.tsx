'use client';

import React, { createContext, useContext } from 'react';
import type { PlayerRollRequest } from '@/types';
import type { PenaiStoryEntry } from '@/hooks/usePenaiTurnPipeline';
import type { TurnPipelinePhase } from '@/hooks/game/turnPipelineStore';

export type PenaiGameplayValue = {
    active: boolean;
    connected: boolean;
    contractOk: boolean;
    actionCursor: number;
    narrationWorkflowId: string | null;
    storyFeed: PenaiStoryEntry[];
    storyHydrated: boolean;
    narrationPending: boolean;
    worldPulse: string[];
    worldPulseHeadline: string | null;
    playerRollRequest: PlayerRollRequest | null;
    lastMechanical: Record<string, unknown> | null;
    lastError: string | null;
    phase: TurnPipelinePhase;
    gameOver: {
        heroName: string;
        level: number;
        vaultTemplateId?: string | null;
        reason?: string;
    } | null;
    clearGameOver: () => void;
    sendProcessAction: (playerAction: string, payload?: Record<string, unknown>) => void;
    /** Reenvia abertura manualmente após falha (sem retry automático de LLM). */
    retryOpening: () => void;
    sendStructuredIntent: (
        intent: { type: string; payload?: Record<string, unknown> },
        playerAction?: string,
    ) => void;
    submitRollResult: (request: PlayerRollRequest, result: { rawRoll: number; rolls: number[] }) => void;
    handleRollResult: (
        submit: (req: PlayerRollRequest, res: { rawRoll: number; rolls: number[] }) => void,
    ) => (result: { rawRoll: number; rolls: number[] }) => void;
};

const defaultValue: PenaiGameplayValue = {
    active: true,
    connected: false,
    contractOk: false,
    actionCursor: 0,
    narrationWorkflowId: null,
    storyFeed: [],
    storyHydrated: false,
    narrationPending: false,
    worldPulse: [],
    worldPulseHeadline: null,
    playerRollRequest: null,
    lastMechanical: null,
    lastError: null,
    phase: 'idle',
    gameOver: null,
    clearGameOver: () => {},
    sendProcessAction: () => {},
    retryOpening: () => {},
    sendStructuredIntent: () => {},
    submitRollResult: () => {},
    handleRollResult: () => () => {},
};

const PenaiGameplayContext = createContext<PenaiGameplayValue>(defaultValue);

export function PenaiGameplayProvider({
    value,
    children,
}: {
    value: PenaiGameplayValue;
    children: React.ReactNode;
}) {
    return <PenaiGameplayContext.Provider value={value}>{children}</PenaiGameplayContext.Provider>;
}

export function usePenaiGameplay(): PenaiGameplayValue {
    return useContext(PenaiGameplayContext);
}
