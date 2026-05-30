'use client';

import React, { createContext, useContext } from 'react';
import type { PlayerRollRequest } from '@/types';
import type { PenaiStoryEntry } from '@/hooks/usePenaiTurnPipeline';
import type { TurnPipelinePhase } from '@/hooks/game/turnPipelineStore';

export type PenaiGameplayValue = {
    active: boolean;
    connected: boolean;
    storyFeed: PenaiStoryEntry[];
    worldPulse: string[];
    playerRollRequest: PlayerRollRequest | null;
    lastMechanical: Record<string, unknown> | null;
    phase: TurnPipelinePhase;
    sendProcessAction: (playerAction: string, payload?: Record<string, unknown>) => void;
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
    active: false,
    connected: false,
    storyFeed: [],
    worldPulse: [],
    playerRollRequest: null,
    lastMechanical: null,
    phase: 'idle',
    sendProcessAction: () => {},
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
