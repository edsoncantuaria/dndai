'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerRollRequest } from '@/types';
import {
    getTurnPipelinePhase,
    getVitalsInputSignals,
    setInputGate,
    setTurnPipelinePhase,
    setVitalsInputSignals,
    type TurnPipelinePhase,
} from '@/hooks/game/turnPipelineStore';
import { getStoredAuthToken } from '@/lib/authToken';
import { markSessionAsPenai } from '@/lib/penaiEngine';
import { buildPenaiWsUrl, validatePenaiWsConnected } from '@/lib/penaiWs';
import { mergePenaiMechanicalMessage } from '@/lib/penaiMechanicalHydrate';
import { fetchPenaiSessionUiState, fetchPenaiStoryFeed } from '@/services/penaiApi';
import { isVisibleStoryEntry } from '@/features/gameplay/story/storyEntryVisibility';

export type PenaiStoryEntry = {
    id?: string;
    timestamp: string;
    content: string;
    tone?: string;
    kind?: string;
    consequences?: string[];
    consistencyNote?: string;
};

type PenaiWsPayload = Record<string, unknown> & {
    type?: string;
    contractVersion?: number;
    locale?: string;
    sessionId?: number;
    actionSequence?: number;
    workflowId?: string;
    playerRollRequest?: PlayerRollRequest;
    entries?: PenaiStoryEntry[];
    events?: string[];
    reason?: string;
    hint?: string;
    message?: string;
    sync?: boolean;
    pendingNarration?: boolean;
    currentRegionSlug?: string;
    mechanical?: Record<string, unknown>;
    payload?: Record<string, unknown>;
    actionOptions?: unknown[];
    levelUpState?: unknown;
};

export type ProcessActionOptions = {
    /** Abertura de sessão — não trava metajogo/mapa enquanto o LLM responde. */
    bootstrap?: boolean;
};

/** Frase canônica de abertura — alinhada ao backend `isSessionOpeningRequest`. */
export const PENAI_OPENING_PROMPT =
    'A aventura começa. Onde eu estou e o que está acontecendo?';

function penaiOpeningStorageKey(sessionId: number): string {
    return `cda:session:${sessionId}:penaiOpening`;
}

function clearPenaiOpeningFlag(sessionId: number): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(penaiOpeningStorageKey(sessionId));
}

function storyHasVisibleNarration(entries: PenaiStoryEntry[]): boolean {
    return entries.some(e => {
        const kind = (e.kind ?? e.tone ?? '').toLowerCase();
        return kind !== 'opening' && Boolean(String(e.content ?? '').trim());
    });
}


function isStaleSequence(
    msg: PenaiWsPayload,
    latestSeq: number,
    type: string | undefined,
): boolean {
    if (type === 'connected' || type === 'pong' || type === 'ping') return false;
    const seq = typeof msg.actionSequence === 'number' ? msg.actionSequence : undefined;
    if (seq == null) return false;
    return seq < latestSeq;
}

function mapGateFromPhase(phase: TurnPipelinePhase, bootstrapPending: boolean): void {
    const { gameOver, unconsciousAtZero } = getVitalsInputSignals();
    if (gameOver) {
        setInputGate('LOCKED_UNCONSCIOUS');
        return;
    }
    if (bootstrapPending) {
        setInputGate('OPEN');
        return;
    }
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
            if (unconsciousAtZero) {
                setInputGate('LOCKED_UNCONSCIOUS');
            } else {
                setInputGate('OPEN');
            }
    }
}

function mergeStoryEntries(
    prev: PenaiStoryEntry[],
    incoming: PenaiStoryEntry[],
    replace = false,
): PenaiStoryEntry[] {
    const chronicleOnly = (list: PenaiStoryEntry[]) => list.filter(isVisibleStoryEntry);
    const visible = chronicleOnly(incoming);
    if (replace || !prev.length) return chronicleOnly(visible);
    if (!visible.length) return chronicleOnly(prev);
    const seen = new Set(
        prev.map(e => e.id ?? `${e.timestamp}::${e.content.slice(0, 80)}`),
    );
    const merged = chronicleOnly([...prev]);
    for (const entry of visible) {
        const key = entry.id ?? `${entry.timestamp}::${entry.content.slice(0, 80)}`;
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(entry);
        }
    }
    return merged;
}

export function usePenaiTurnPipeline(
    sessionId: number | null,
    userId: number,
    enabled: boolean,
) {
    const socketRef = useRef<WebSocket | null>(null);
    const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const bootstrapPendingRef = useRef(false);
    const rollPriorityRef = useRef(false);
    const latestActionSequenceRef = useRef(0);
    const storyHasNarrationRef = useRef(false);
    const [connected, setConnected] = useState(false);
    const [contractOk, setContractOk] = useState(false);
    const [actionCursor, setActionCursor] = useState(0);
    const [narrationWorkflowId, setNarrationWorkflowId] = useState<string | null>(null);
    const [storyFeed, setStoryFeed] = useState<PenaiStoryEntry[]>([]);
    const [storyHydrated, setStoryHydrated] = useState(false);
    const [worldPulse, setWorldPulse] = useState<string[]>([]);
    const [worldPulseHeadline, setWorldPulseHeadline] = useState<string | null>(null);
    const [playerRollRequest, setPlayerRollRequest] = useState<PlayerRollRequest | null>(null);
    const [lastMechanical, setLastMechanical] = useState<Record<string, unknown> | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);
    const [phase, setPhase] = useState<TurnPipelinePhase>('idle');
    const [narrationPending, setNarrationPending] = useState(false);
    const [gameOver, setGameOver] = useState<{
        heroName: string;
        level: number;
        vaultTemplateId?: string | null;
        reason?: string;
    } | null>(null);

    const clearPhaseTimer = useCallback(() => {
        if (phaseTimerRef.current) {
            clearTimeout(phaseTimerRef.current);
            phaseTimerRef.current = null;
        }
    }, []);

    const setPhaseBoth = useCallback(
        (next: TurnPipelinePhase) => {
            if (rollPriorityRef.current && next === 'narrating') {
                return;
            }
            setPhase(next);
            setTurnPipelinePhase(next);
            mapGateFromPhase(next, bootstrapPendingRef.current);
            clearPhaseTimer();
            if (next === 'narrating' || next === 'mechanical') {
                phaseTimerRef.current = setTimeout(() => {
                    bootstrapPendingRef.current = false;
                    rollPriorityRef.current = false;
                    setNarrationPending(false);
                    setPhase('idle');
                    setTurnPipelinePhase('idle');
                    setInputGate('OPEN');
                    setLastError(
                        'A narração demorou demais. Você pode continuar jogando; tente recarregar se o log não atualizar.',
                    );
                }, 120_000);
            }
        },
        [clearPhaseTimer],
    );

    const applyServerNarrationPending = useCallback(
        (pending: boolean) => {
            setNarrationPending(pending);
            if (pending) {
                if (!rollPriorityRef.current) {
                    setPhaseBoth('narrating');
                }
                return;
            }
            bootstrapPendingRef.current = false;
            if (!rollPriorityRef.current) {
                setPhaseBoth('idle');
            }
        },
        [setPhaseBoth],
    );

    useEffect(() => {
        storyHasNarrationRef.current = storyHasVisibleNarration(storyFeed);
    }, [storyFeed]);

    const prioritizePlayerRollRequest = useCallback(
        (roll: PlayerRollRequest) => {
            rollPriorityRef.current = true;
            bootstrapPendingRef.current = false;
            setPlayerRollRequest(roll);
            setNarrationPending(false);
            setNarrationWorkflowId(null);
            setPhaseBoth('rolling');
        },
        [setPhaseBoth],
    );

    const applyPersistedUiState = useCallback(
        (actionOptions: unknown[], pulse: { headline: string | null; events: string[] } | null) => {
            if (pulse?.events?.length) {
                setWorldPulse(pulse.events);
                setWorldPulseHeadline(pulse.headline);
            }
            if (actionOptions.length) {
                setLastMechanical(prev => ({
                    ...(prev ?? {}),
                    actionOptions,
                }));
            }
        },
        [],
    );

    const hydrateStoryFeed = useCallback(async (sid: number, replace = true) => {
        try {
            const [feed, ui] = await Promise.all([
                fetchPenaiStoryFeed(sid),
                fetchPenaiSessionUiState(sid).catch(() => null),
            ]);
            setStoryFeed(prev => mergeStoryEntries(prev, feed.entries, replace));
            setStoryHydrated(true);
            if (ui) {
                applyPersistedUiState(ui.actionOptions, ui.worldPulse);
            }
            applyServerNarrationPending(feed.pendingNarration);
        } catch (err) {
            console.warn('[PENAI] Falha ao carregar story-feed:', err);
            setStoryHydrated(true);
        }
    }, [applyPersistedUiState, applyServerNarrationPending]);

    useEffect(() => {
        if (!enabled || !sessionId || !userId) return;
        void hydrateStoryFeed(sessionId, true);
    }, [enabled, sessionId, userId, hydrateStoryFeed]);

    useEffect(() => {
        if (!enabled || !sessionId || !userId) return;
        markSessionAsPenai(sessionId);

        const token = getStoredAuthToken();
        const url = buildPenaiWsUrl(token);
        let disposed = false;
        const ws = new WebSocket(url);
        socketRef.current = ws;

        ws.onopen = () => {
            if (disposed) {
                ws.close();
                return;
            }
            setConnected(true);
            setLastError(null);
            ws.send(JSON.stringify({ type: 'syncPendingRoll', sessionId }));
        };
        ws.onclose = () => {
            if (disposed) return;
            setConnected(false);
            setPhaseBoth('idle');
        };
        ws.onerror = () => {
            if (disposed) return;
            setLastError(
                'Falha na conexão PENAI WS. Confira se o backend está no ar e faça logout/login (token JWT desatualizado).',
            );
        };

        ws.onmessage = event => {
            try {
                const msg = JSON.parse(event.data as string) as PenaiWsPayload;

                if (isStaleSequence(msg, latestActionSequenceRef.current, msg.type)) {
                    return;
                }

                if (msg.type === 'connected') {
                    const check = validatePenaiWsConnected(msg);
                    if (!check.ok) {
                        setLastError(check.reason ?? 'Contrato WS inválido');
                        ws.close();
                        return;
                    }
                    setContractOk(true);
                    setLastError(null);
                    return;
                }

                if (typeof msg.actionSequence === 'number') {
                    latestActionSequenceRef.current = Math.max(
                        latestActionSequenceRef.current,
                        msg.actionSequence,
                    );
                }

                if (msg.type === 'storyFeedReplay' && Array.isArray(msg.entries)) {
                    setStoryFeed(prev =>
                        mergeStoryEntries(prev, msg.entries as PenaiStoryEntry[], !prev.length),
                    );
                    setStoryHydrated(true);
                    applyServerNarrationPending(Boolean(msg.pendingNarration));
                }
                if (msg.type === 'storyFeed' && Array.isArray(msg.entries)) {
                    setStoryFeed(prev => mergeStoryEntries(prev, msg.entries as PenaiStoryEntry[]));
                    setStoryHydrated(true);
                    bootstrapPendingRef.current = false;
                }
                if (msg.type === 'worldPulse' && Array.isArray(msg.events)) {
                    setWorldPulse(msg.events as string[]);
                    setWorldPulseHeadline(
                        typeof msg.headline === 'string' && msg.headline.trim()
                            ? msg.headline.trim()
                            : null,
                    );
                }
                if (msg.type === 'uiStateReplay') {
                    const opts = Array.isArray(msg.actionOptions) ? msg.actionOptions : [];
                    if (opts.length) {
                        setLastMechanical(prev => ({
                            ...(prev ?? {}),
                            actionOptions: opts,
                        }));
                    }
                    if (Array.isArray(msg.worldPulse) && msg.worldPulse.length) {
                        setWorldPulse(msg.worldPulse as string[]);
                        setWorldPulseHeadline(
                            typeof msg.worldPulseHeadline === 'string'
                                ? msg.worldPulseHeadline
                                : null,
                        );
                    }
                }
                if (msg.type === 'pendingRollState' && msg.playerRollRequest) {
                    prioritizePlayerRollRequest(msg.playerRollRequest as PlayerRollRequest);
                }
                if (msg.type === 'gameStateUpdate') {
                    if (msg.mechanical) {
                        setLastMechanical(mergePenaiMechanicalMessage(msg));
                        const roll =
                            (msg.playerRollRequest as PlayerRollRequest | undefined) ??
                            (msg.mechanical as { playerRollRequest?: PlayerRollRequest }).playerRollRequest;
                        if (roll) {
                            prioritizePlayerRollRequest(roll);
                        }
                    }
                }
                if (msg.type === 'playerRollRequest' && msg.playerRollRequest) {
                    prioritizePlayerRollRequest(msg.playerRollRequest as PlayerRollRequest);
                }
                if (msg.type === 'mechanicalStateUpdate') {
                    const roll =
                        (msg.playerRollRequest as PlayerRollRequest | undefined) ??
                        (msg.mechanical as { playerRollRequest?: PlayerRollRequest } | undefined)
                            ?.playerRollRequest;
                    if (roll) {
                        prioritizePlayerRollRequest(roll);
                    } else {
                        setLastMechanical(mergePenaiMechanicalMessage(msg));
                        if (!bootstrapPendingRef.current && !rollPriorityRef.current) {
                            setPhaseBoth('mechanical');
                        }
                    }
                }
                if (msg.type === 'narrationQueued') {
                    if (typeof msg.workflowId === 'string') {
                        setNarrationWorkflowId(msg.workflowId);
                    }
                    if (rollPriorityRef.current) {
                        return;
                    }
                    if (!msg.sync && !bootstrapPendingRef.current) {
                        setNarrationPending(true);
                        setPhaseBoth('narrating');
                    }
                }
                if (msg.type === 'narrationComplete') {
                    rollPriorityRef.current = false;
                    setPlayerRollRequest(null);
                    setNarrationPending(false);
                    setNarrationWorkflowId(null);
                    bootstrapPendingRef.current = false;
                    if (typeof msg.actionSequence === 'number') {
                        setActionCursor(msg.actionSequence);
                    }
                    setPhaseBoth('idle');
                    window.dispatchEvent(new Event('penai-turn-settled'));
                }
                if (msg.type === 'narrationFailed') {
                    rollPriorityRef.current = false;
                    setPlayerRollRequest(null);
                    setNarrationPending(false);
                    setNarrationWorkflowId(null);
                    bootstrapPendingRef.current = false;
                    if (typeof msg.actionCursor === 'number') {
                        setActionCursor(msg.actionCursor);
                    } else if (typeof msg.actionSequence === 'number') {
                        setActionCursor(Math.max(0, msg.actionSequence - 1));
                    }
                    const failText = String(msg.message ?? 'Narração indisponível.');
                    setLastError(failText);
                    if (!storyHasNarrationRef.current && sessionId != null) {
                        clearPenaiOpeningFlag(sessionId);
                    }
                    setPhaseBoth('idle');
                    window.dispatchEvent(new Event('penai-turn-settled'));
                }
                if (msg.type === 'heroPermanentlyDead') {
                    rollPriorityRef.current = false;
                    setPlayerRollRequest(null);
                    setNarrationPending(false);
                    setNarrationWorkflowId(null);
                    bootstrapPendingRef.current = false;
                    setVitalsInputSignals({ gameOver: true, unconsciousAtZero: false });
                    setPhaseBoth('idle');
                    setGameOver({
                        heroName: String(msg.heroName ?? 'Herói'),
                        level: Number(msg.level ?? 1),
                        vaultTemplateId:
                            typeof msg.vaultTemplateId === 'string' ? msg.vaultTemplateId : null,
                        reason: typeof msg.reason === 'string' ? msg.reason : undefined,
                    });
                    window.dispatchEvent(new Event('penai-turn-settled'));
                }
                if (msg.type === 'actionRejected') {
                    const hint = msg.hint ? ` ${String(msg.hint)}` : '';
                    setLastError(`${String(msg.reason ?? 'Ação rejeitada')}${hint}`);
                    bootstrapPendingRef.current = false;
                    setNarrationPending(false);
                    setNarrationWorkflowId(null);
                    setPhaseBoth('idle');
                    window.dispatchEvent(new Event('penai-turn-settled'));
                }
                if (msg.type === 'error') {
                    const text = String(msg.message ?? msg.reason ?? 'Erro WS');
                    setLastError(
                        text.includes('Autenticação') || text.includes('JWT')
                            ? `${text} Faça logout e login novamente.`
                            : text,
                    );
                    bootstrapPendingRef.current = false;
                    setNarrationPending(false);
                    setNarrationWorkflowId(null);
                    setPhaseBoth('idle');
                    window.dispatchEvent(new Event('penai-turn-settled'));
                }
            } catch {
                setLastError('Mensagem WS inválida');
            }
        };

        return () => {
            disposed = true;
            clearPhaseTimer();
            ws.onopen = null;
            ws.onmessage = null;
            ws.onerror = null;
            ws.onclose = null;
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
            if (socketRef.current === ws) {
                socketRef.current = null;
            }
            bootstrapPendingRef.current = false;
            latestActionSequenceRef.current = 0;
            setContractOk(false);
            setNarrationWorkflowId(null);
            setPhaseBoth('idle');
        };
    }, [
        sessionId,
        userId,
        enabled,
        setPhaseBoth,
        clearPhaseTimer,
        prioritizePlayerRollRequest,
        applyServerNarrationPending,
    ]);

    const sendProcessAction = useCallback(
        (playerAction: string, payload?: Record<string, unknown>) => {
            if (!sessionId) return;
            const ws = socketRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                setLastError('WebSocket PENAI não conectado');
                return;
            }
            const bootstrap = Boolean(payload?.bootstrap);
            if (bootstrap) {
                bootstrapPendingRef.current = true;
                setNarrationPending(true);
                setPhaseBoth('narrating');
            } else {
                bootstrapPendingRef.current = false;
                setPhaseBoth('mechanical');
            }
            setLastError(null);
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

    const retryOpening = useCallback(() => {
        if (!sessionId) return;
        clearPenaiOpeningFlag(sessionId);
        sendProcessAction(PENAI_OPENING_PROMPT, { bootstrap: true });
    }, [sessionId, sendProcessAction]);

    const submitRollResult = useCallback(
        (request: PlayerRollRequest, result: { rawRoll: number; rolls: number[] }) => {
            if (!sessionId) return;
            const ws = socketRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                setLastError('WebSocket PENAI não conectado');
                return;
            }
            setPlayerRollRequest(null);
            bootstrapPendingRef.current = false;
            setPhaseBoth(rollPriorityRef.current ? 'idle' : 'mechanical');
            ws.send(
                JSON.stringify({
                    type: 'submitRollResult',
                    sessionId,
                    payload: {
                        requestId: request.requestId,
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
        contractOk,
        actionCursor,
        narrationWorkflowId,
        storyFeed,
        storyHydrated,
        narrationPending,
        worldPulse,
        worldPulseHeadline,
        playerRollRequest,
        lastMechanical,
        lastError,
        phase,
        sendProcessAction,
        retryOpening,
        gameOver,
        clearGameOver: () => {
            setGameOver(null);
            setVitalsInputSignals({ gameOver: false, unconsciousAtZero: false });
            mapGateFromPhase(getTurnPipelinePhase(), bootstrapPendingRef.current);
        },
        submitRollResult,
        handleRollResult,
    };
}
