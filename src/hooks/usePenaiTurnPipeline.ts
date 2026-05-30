'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerRollRequest } from '@/types';
import {
    setInputGate,
    setTurnPipelinePhase,
    type TurnPipelinePhase,
} from '@/hooks/game/turnPipelineStore';
import { getStoredAuthToken } from '@/lib/authToken';
import { markSessionAsPenai } from '@/lib/penaiEngine';

export type PenaiStoryEntry = {
    timestamp: string;
    content: string;
    tone?: string;
    consequences?: string[];
};

type PenaiWsPayload = Record<string, unknown> & {
    type?: string;
    sessionId?: number;
    playerRollRequest?: PlayerRollRequest;
    entries?: PenaiStoryEntry[];
    events?: string[];
    reason?: string;
    message?: string;
};

function penaiWsBaseUrl(): string {
    const explicit = process.env.NEXT_PUBLIC_PENAI_WS_URL?.replace(/\/$/, '');
    if (explicit) return explicit;
    const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:8071/api';
    const origin = api.replace(/\/api\/?$/, '');
    return origin.replace(/^http/, 'ws') + '/ws';
}

function mapGateFromPhase(phase: TurnPipelinePhase): void {
    switch (phase) {
        case 'rolling':
            setInputGate('LOCKED_ROLLING');
            break;
        case 'mechanical':
            setInputGate('LOCKED_MECHANICAL');
            break;
        case 'narrating':
            setInputGate('LOCKED_NARRATING');
            break;
        default:
            setInputGate('OPEN');
    }
}

export function usePenaiTurnPipeline(
    sessionId: number | null,
    userId: number,
    enabled: boolean,
) {
    const socketRef = useRef<WebSocket | null>(null);
    const [connected, setConnected] = useState(false);
    const [storyFeed, setStoryFeed] = useState<PenaiStoryEntry[]>([]);
    const [worldPulse, setWorldPulse] = useState<string[]>([]);
    const [playerRollRequest, setPlayerRollRequest] = useState<PlayerRollRequest | null>(null);
    const [lastMechanical, setLastMechanical] = useState<Record<string, unknown> | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);
    const [phase, setPhase] = useState<TurnPipelinePhase>('idle');

    const setPhaseBoth = useCallback((next: TurnPipelinePhase) => {
        setPhase(next);
        setTurnPipelinePhase(next);
        mapGateFromPhase(next);
    }, []);

    useEffect(() => {
        if (!enabled || !sessionId || !userId) return;
        markSessionAsPenai(sessionId);

        const token = getStoredAuthToken();
        const url = token
            ? `${penaiWsBaseUrl()}?token=${encodeURIComponent(token)}`
            : penaiWsBaseUrl();
        const ws = new WebSocket(url);
        socketRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            ws.send(JSON.stringify({ type: 'syncPendingRoll', sessionId }));
        };
        ws.onclose = () => {
            setConnected(false);
            setPhaseBoth('idle');
        };
        ws.onerror = () => setLastError('Falha na conexão PENAI WS');

        ws.onmessage = event => {
            try {
                const msg = JSON.parse(event.data as string) as PenaiWsPayload;

                if (msg.type === 'storyFeed' && Array.isArray(msg.entries)) {
                    setStoryFeed(prev => [...prev, ...(msg.entries as PenaiStoryEntry[])]);
                }
                if (msg.type === 'worldPulse' && Array.isArray(msg.events)) {
                    setWorldPulse(msg.events as string[]);
                }
                if (msg.type === 'pendingRollState' && msg.playerRollRequest) {
                    setPlayerRollRequest(msg.playerRollRequest as PlayerRollRequest);
                    setPhaseBoth('rolling');
                }
                if (msg.type === 'gameStateUpdate' && msg.mechanical) {
                    const mech = {
                        ...(msg.mechanical as Record<string, unknown>),
                    };
                    if (msg.levelUpState != null) mech.levelUpState = msg.levelUpState;
                    if (Array.isArray(msg.actionOptions)) mech.actionOptions = msg.actionOptions;
                    setLastMechanical(mech);
                }
                if (msg.type === 'playerRollRequest' || msg.type === 'mechanicalStateUpdate') {
                    const roll =
                        (msg.playerRollRequest as PlayerRollRequest | undefined) ??
                        (msg.mechanical as { playerRollRequest?: PlayerRollRequest } | undefined)
                            ?.playerRollRequest;
                    if (roll) {
                        setPlayerRollRequest(roll);
                        setPhaseBoth('rolling');
                    }
                    if (msg.type === 'mechanicalStateUpdate') {
                        const mech =
                            (msg.mechanical as Record<string, unknown>) ??
                            (msg as PenaiWsPayload);
                        setLastMechanical(mech);
                        if (!roll) setPhaseBoth('mechanical');
                    }
                }
                if (msg.type === 'narrationQueued') {
                    setPhaseBoth('narrating');
                }
                if (msg.type === 'narrationComplete') {
                    setPlayerRollRequest(null);
                    setPhaseBoth('idle');
                }
                if (msg.type === 'actionRejected') {
                    const hint = msg.hint ? ` ${String(msg.hint)}` : '';
                    setLastError(`${String(msg.reason ?? 'Ação rejeitada')}${hint}`);
                    setPhaseBoth('idle');
                }
                if (msg.type === 'error') {
                    setLastError(String(msg.message ?? msg.reason ?? 'Erro WS'));
                    setPhaseBoth('idle');
                }
            } catch {
                setLastError('Mensagem WS inválida');
            }
        };

        return () => {
            ws.close();
            socketRef.current = null;
            setPhaseBoth('idle');
        };
    }, [sessionId, userId, enabled, setPhaseBoth]);

    const sendProcessAction = useCallback(
        (playerAction: string, payload?: Record<string, unknown>) => {
            if (!sessionId) return;
            const ws = socketRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                setLastError('WebSocket PENAI não conectado');
                return;
            }
            setLastError(null);
            setPhaseBoth('mechanical');
            ws.send(
                JSON.stringify({
                    type: 'processAction',
                    sessionId,
                    payload: { playerAction, ...payload },
                }),
            );
        },
        [sessionId, setPhaseBoth],
    );

    const submitRollResult = useCallback(
        (request: PlayerRollRequest, result: { rawRoll: number; rolls: number[] }) => {
            if (!sessionId) return;
            const ws = socketRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                setLastError('WebSocket PENAI não conectado');
                return;
            }
            setPlayerRollRequest(null);
            setPhaseBoth('mechanical');
            ws.send(
                JSON.stringify({
                    type: 'submitRollResult',
                    sessionId,
                    payload: {
                        requestId: request.requestId,
                        rolls: result.rolls,
                        rawRoll: result.rawRoll,
                    },
                }),
            );
        },
        [sessionId, setPhaseBoth],
    );

    const handleRollResult = useCallback(
        (submit: (req: PlayerRollRequest, res: { rawRoll: number; rolls: number[] }) => void) =>
            (result: { rawRoll: number; rolls: number[] }) => {
                if (!playerRollRequest) return;
                const current = playerRollRequest;
                setPlayerRollRequest(null);
                submit(current, result);
            },
        [playerRollRequest],
    );

    return {
        connected,
        storyFeed,
        worldPulse,
        playerRollRequest,
        lastMechanical,
        lastError,
        phase,
        sendProcessAction,
        submitRollResult,
        handleRollResult,
    };
}
