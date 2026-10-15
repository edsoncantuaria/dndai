'use client';

import { useRef, useState } from 'react';

/** Refs compartilhados entre WS, actions e session reload. */
export function useGameActionPipelineRefs() {
    const actionOptionsBackupRef = useRef<
        (string | { text: string; action: string; skill?: string })[] | null
    >(null);
    const clientStateVersionRef = useRef(0);
    /** P4.1 — último actionSequence do servidor (narração); descarta WS obsoleto. */
    const latestActionSequenceRef = useRef(0);
    const lastLogVersionRef = useRef(0);
    const pendingActionsRef = useRef<Set<string>>(new Set());
    const actionTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const actionCursorRef = useRef(0);
    const [clientInstanceId] = useState(() => `web-${Math.random().toString(36).slice(2, 10)}`);

    return {
        actionOptionsBackupRef,
        clientStateVersionRef,
        latestActionSequenceRef,
        lastLogVersionRef,
        pendingActionsRef,
        actionTimeoutsRef,
        actionCursorRef,
        clientInstanceId,
    };
}

export type GameActionPipelineRefs = ReturnType<typeof useGameActionPipelineRefs>;
