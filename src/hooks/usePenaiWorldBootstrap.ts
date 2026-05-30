'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    fetchPenaiSessionUiState,
    runPenaiWorldBootstrap,
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

export function usePenaiWorldBootstrap(sessionId: number | null, enabled: boolean) {
    const [bootstrap, setBootstrap] = useState<PenaiWorldBootstrapState | null>(null);
    const [ready, setReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const ranRef = useRef(false);

    const refresh = useCallback(async (sid: number) => {
        const ui = await fetchPenaiSessionUiState(sid);
        setBootstrap(ui.worldBootstrap);
        setReady(ui.worldBootstrap.status === 'ready');
        return ui;
    }, []);

    const runBootstrap = useCallback(async (sid: number) => {
        setLoading(true);
        setError(null);
        try {
            const result = await runPenaiWorldBootstrap(sid);
            setBootstrap(result.worldBootstrap);
            if (result.async && result.worldBootstrap.status !== 'ready') {
                for (let i = 0; i < 300; i++) {
                    await new Promise(r => setTimeout(r, 600));
                    const ui = await refresh(sid);
                    setBootstrap(ui.worldBootstrap);
                    if (ui.worldBootstrap.status === 'ready') {
                        setReady(true);
                        return ui;
                    }
                    if (ui.worldBootstrap.status === 'failed') {
                        throw new Error(ui.worldBootstrap.error ?? 'Bootstrap falhou');
                    }
                }
                throw new Error('Tempo esgotado aguardando criação do mundo');
            }
            setReady(result.worldBootstrap.status === 'ready');
            return result;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Falha ao criar o mundo';
            setError(msg);
            setReady(false);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [refresh]);

    useEffect(() => {
        if (!enabled || !sessionId) {
            setBootstrap(null);
            setReady(false);
            ranRef.current = false;
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
                    for (let i = 0; i < 300 && !cancelled; i++) {
                        await new Promise(r => setTimeout(r, 600));
                        const polled = await refresh(sessionId);
                        if (polled.worldBootstrap.status === 'ready') {
                            setReady(true);
                            return;
                        }
                        if (polled.worldBootstrap.status === 'failed') {
                            setError(polled.worldBootstrap.error ?? 'Bootstrap falhou');
                            return;
                        }
                    }
                    if (!cancelled) setError('Tempo esgotado aguardando criação do mundo');
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
    }, [enabled, sessionId, refresh, runBootstrap]);

    const retry = useCallback(() => {
        if (!sessionId) return;
        ranRef.current = false;
        void runBootstrap(sessionId);
    }, [sessionId, runBootstrap]);

    const currentStep =
        bootstrap?.step != null
            ? WORLD_BOOTSTRAP_STEP_LABELS[bootstrap.step]
            : loading
              ? 'Criando mundo…'
              : null;

    return {
        ready,
        loading,
        error,
        bootstrap,
        steps: buildStepViews(bootstrap),
        currentStep,
        retry,
        refresh: sessionId ? () => refresh(sessionId) : async () => null,
    };
}
