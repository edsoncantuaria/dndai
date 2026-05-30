'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    fetchPenaiSessionUiState,
    runPenaiWorldBootstrap,
    runPenaiWorldBootstrapFallback,
    type PenaiWorldBootstrapState,
    type PenaiWorldBootstrapStepId,
    WORLD_BOOTSTRAP_STEP_LABELS,
} from '@/services/penaiApi';

export type WorldBootstrapStepView = {
    id: PenaiWorldBootstrapStepId;
    label: string;
    status: 'pending' | 'running' | 'done' | 'failed';
};

function buildStepViews(state: PenaiWorldBootstrapState | null): WorldBootstrapStepView[] {
    const steps = state?.steps;
    const order: PenaiWorldBootstrapStepId[] = [
        'region',
        'factions',
        'npcs',
        'quests',
        'economy',
        'simulation',
        'pulse',
    ];
    return order.map(id => ({
        id,
        label: WORLD_BOOTSTRAP_STEP_LABELS[id] ?? id,
        status: steps?.[id] ?? 'pending',
    }));
}

function isGeminiBootstrapFailure(error: string | null | undefined): boolean {
    if (!error) return false;
    return /WorldGeminiGenerationError|Gemini|geração|rate limit|429|503/i.test(error);
}

export function usePenaiWorldBootstrap(sessionId: number | null, enabled: boolean) {
    const [bootstrap, setBootstrap] = useState<PenaiWorldBootstrapState | null>(null);
    const [ready, setReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [usedOfflineFallback, setUsedOfflineFallback] = useState(false);
    const ranRef = useRef(false);
    const fallbackAttemptedRef = useRef(false);

    const refresh = useCallback(async (sid: number) => {
        const ui = await fetchPenaiSessionUiState(sid);
        setBootstrap(ui.worldBootstrap);
        setReady(ui.worldBootstrap.status === 'ready');
        return ui;
    }, []);

    const pollUntilReady = useCallback(
        async (sid: number, maxAttempts = 300): Promise<boolean> => {
            for (let i = 0; i < maxAttempts; i++) {
                await new Promise(r => setTimeout(r, 600));
                const ui = await refresh(sid);
                if (ui.worldBootstrap.status === 'ready') {
                    setReady(true);
                    return true;
                }
                if (ui.worldBootstrap.status === 'failed') {
                    if (isGeminiBootstrapFailure(ui.worldBootstrap.error) && !fallbackAttemptedRef.current) {
                        fallbackAttemptedRef.current = true;
                        setUsedOfflineFallback(true);
                        await runPenaiWorldBootstrapFallback(sid);
                        continue;
                    }
                    throw new Error(ui.worldBootstrap.error ?? 'Bootstrap falhou');
                }
            }
            throw new Error('Tempo esgotado aguardando criação do mundo');
        },
        [refresh],
    );

    const runBootstrap = useCallback(
        async (sid: number, offline = false) => {
            setLoading(true);
            setError(null);
            try {
                const result = offline
                    ? await runPenaiWorldBootstrapFallback(sid)
                    : await runPenaiWorldBootstrap(sid);
                setBootstrap(result.worldBootstrap);
                if (offline) setUsedOfflineFallback(true);

                if (result.worldBootstrap.status === 'ready') {
                    setReady(true);
                    return result;
                }

                if (result.async && result.worldBootstrap.status !== 'ready') {
                    await pollUntilReady(sid);
                    return result;
                }

                setReady(result.worldBootstrap.status === 'ready');
                return result;
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Falha ao criar o mundo';
                if (isGeminiBootstrapFailure(msg) && !fallbackAttemptedRef.current) {
                    fallbackAttemptedRef.current = true;
                    setUsedOfflineFallback(true);
                    try {
                        const fallback = await runPenaiWorldBootstrapFallback(sid);
                        setBootstrap(fallback.worldBootstrap);
                        setReady(fallback.worldBootstrap.status === 'ready');
                        if (!fallback.worldBootstrap.status || fallback.worldBootstrap.status !== 'ready') {
                            await pollUntilReady(sid);
                        }
                        return fallback;
                    } catch (fallbackErr) {
                        const fbMsg =
                            fallbackErr instanceof Error ? fallbackErr.message : 'Fallback offline falhou';
                        setError(fbMsg);
                        setReady(false);
                        throw fallbackErr;
                    }
                }
                setError(msg);
                setReady(false);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [pollUntilReady],
    );

    useEffect(() => {
        if (!enabled || !sessionId) {
            setBootstrap(null);
            setReady(false);
            setUsedOfflineFallback(false);
            ranRef.current = false;
            fallbackAttemptedRef.current = false;
            return;
        }

        let cancelled = false;

        const boot = async () => {
            setLoading(true);
            setError(null);
            try {
                const ui = await refresh(sessionId);
                if (cancelled) return;
                if (ui.worldBootstrap.status === 'ready') {
                    setLoading(false);
                    return;
                }
                if (ui.worldBootstrap.status === 'running') {
                    try {
                        await pollUntilReady(sessionId);
                    } catch (err) {
                        if (!cancelled) {
                            setError(err instanceof Error ? err.message : 'Bootstrap falhou');
                        }
                    }
                    return;
                }
                if (ui.worldBootstrap.status === 'failed') {
                    if (isGeminiBootstrapFailure(ui.worldBootstrap.error)) {
                        fallbackAttemptedRef.current = true;
                        setUsedOfflineFallback(true);
                        await runBootstrap(sessionId, true);
                        return;
                    }
                    setError(ui.worldBootstrap.error ?? 'Bootstrap falhou');
                    return;
                }
                if (ranRef.current) return;
                ranRef.current = true;
                await runBootstrap(sessionId);
            } catch {
                /* error set in runBootstrap */
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void boot();
        return () => {
            cancelled = true;
        };
    }, [enabled, sessionId, refresh, runBootstrap, pollUntilReady]);

    const retry = useCallback(() => {
        if (!sessionId) return;
        ranRef.current = false;
        fallbackAttemptedRef.current = false;
        void runBootstrap(sessionId);
    }, [sessionId, runBootstrap]);

    const retryOffline = useCallback(() => {
        if (!sessionId) return;
        fallbackAttemptedRef.current = true;
        setUsedOfflineFallback(true);
        void runBootstrap(sessionId, true);
    }, [sessionId, runBootstrap]);

    const currentStep =
        bootstrap?.step != null
            ? WORLD_BOOTSTRAP_STEP_LABELS[bootstrap.step]
            : loading
              ? usedOfflineFallback
                  ? 'Preparando mundo local (sem IA)…'
                  : 'Criando mundo…'
              : null;

    return {
        ready,
        loading,
        error,
        bootstrap,
        steps: buildStepViews(bootstrap),
        currentStep,
        usedOfflineFallback,
        retry,
        retryOffline,
        refresh: sessionId ? () => refresh(sessionId) : async () => null,
    };
}
