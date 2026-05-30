import type { PlayerRollRequest } from '@/types';

export type PenaiBridge = {
    active: boolean;
    sendProcessAction: (playerAction: string, payload?: Record<string, unknown>) => void;
    sendStructuredIntent: (
        intent: { type: string; payload?: Record<string, unknown> },
        playerAction?: string,
    ) => void;
    submitRollResult?: (
        request: PlayerRollRequest,
        result: { rawRoll: number; rolls: number[] },
    ) => void;
};

let bridge: PenaiBridge | null = null;

export function setPenaiBridge(next: PenaiBridge | null): void {
    bridge = next;
}

export function getPenaiBridge(): PenaiBridge | null {
    return bridge;
}
