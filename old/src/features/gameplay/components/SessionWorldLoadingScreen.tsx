'use client';

import { Check, Circle, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorldBootstrapStepView } from '@/hooks/usePenaiWorldBootstrap';

type SessionWorldLoadingScreenProps = {
    sessionName?: string;
    steps: WorldBootstrapStepView[];
    currentStep: string | null;
    error: string | null;
    usedOfflineFallback?: boolean;
    onRetry?: () => void;
    onRetryOffline?: () => void;
};

function formatBootstrapError(raw: string | null): string | null {
    if (!raw) return null;
    if (/WorldGeminiGenerationError|Gemini|geração/i.test(raw)) {
        return 'O Mestre de IA não conseguiu tecer o mundo desta região. Verifique sua chave Gemini (BYOK) ou tente novamente em instantes.';
    }
    return raw;
}

function StepIcon({ status }: { status: WorldBootstrapStepView['status'] }) {
    if (status === 'done') {
        return <Check className="h-4 w-4 text-emerald-400" aria-hidden />;
    }
    if (status === 'running') {
        return <Loader2 className="h-4 w-4 animate-spin text-dnd-gold" aria-hidden />;
    }
    if (status === 'failed') {
        return <X className="h-4 w-4 text-dnd-ember" aria-hidden />;
    }
    return <Circle className="h-3 w-3 text-dnd-parchment-muted/50" aria-hidden />;
}

export function SessionWorldLoadingScreen({
    sessionName,
    steps,
    currentStep,
    error,
    usedOfflineFallback = false,
    onRetry,
    onRetryOffline,
}: SessionWorldLoadingScreenProps) {
    const friendlyError = formatBootstrapError(error);

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-dnd-obsidian px-6">
            <div className="w-full max-w-md space-y-8 text-center">
                <div>
                    <p className="font-display text-2xl tracking-wide text-dnd-gold">
                        Criando Mundo
                    </p>
                    {usedOfflineFallback ? (
                        <p className="mt-2 font-ui text-xs text-dnd-parchment-muted">
                            A IA falhou — abrindo com personagens e missões do seed local.
                        </p>
                    ) : null}
                    {sessionName ? (
                        <p className="mt-2 font-ui text-sm text-dnd-parchment-muted">{sessionName}</p>
                    ) : null}
                    {currentStep ? (
                        <p className="mt-4 font-ui text-base text-dnd-parchment">{currentStep}</p>
                    ) : null}
                </div>

                <ul className="space-y-3 text-left" aria-label="Progresso da criação do mundo">
                    {steps.map(step => (
                        <li
                            key={step.id}
                            className={cn(
                                'flex items-center gap-3 rounded-lg border px-4 py-3 font-ui text-sm transition-colors',
                                step.status === 'running' &&
                                    'border-dnd-gold/40 bg-dnd-obsidian-raised',
                                step.status === 'done' && 'border-emerald-500/20 bg-emerald-500/5',
                                step.status === 'pending' && 'border-dnd-gold/10 opacity-60',
                                step.status === 'failed' && 'border-dnd-ember/40',
                            )}
                        >
                            <StepIcon status={step.status} />
                            <span className="text-dnd-parchment">{step.label}</span>
                        </li>
                    ))}
                </ul>

                {friendlyError ? (
                    <div className="space-y-3 rounded-lg border border-dnd-ember/30 bg-dnd-obsidian-raised px-4 py-3">
                        <p className="font-ui text-sm leading-relaxed text-dnd-parchment">
                            {friendlyError}
                        </p>
                        {onRetry ? (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="rounded-md border border-dnd-gold/50 px-4 py-2 font-ui text-sm text-dnd-gold hover:bg-dnd-gold/10"
                            >
                                Tentar novamente
                            </button>
                        ) : null}
                        {onRetryOffline ? (
                            <button
                                type="button"
                                onClick={onRetryOffline}
                                className="rounded-md border border-dnd-parchment/30 px-4 py-2 font-ui text-sm text-dnd-parchment hover:bg-dnd-obsidian-raised"
                            >
                                Entrar com mundo local (sem IA)
                            </button>
                        ) : null}
                    </div>
                ) : (
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-dnd-gold/70" aria-hidden />
                )}
            </div>
        </div>
    );
}
