// src/components/NewCreationCharacter/NewStepper.tsx
import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface NewStepperProps {
    currentStep: number;
    totalSteps: number;
    highestStep: number;
    goToStep: (step: number) => void;
    steps?: Array<{
        title: string;
        description?: string;
        icon?: LucideIcon;
    }>;
}

const NewStepper: React.FC<NewStepperProps> = ({ currentStep, totalSteps, highestStep, goToStep, steps }) => {
    const normalizedSteps = steps && steps.length === totalSteps
        ? steps
        : Array.from({ length: totalSteps }).map((_, index) => ({
            title: `Etapa ${index + 1}`,
            description: 'Continue sua jornada.',
        }));

    return (
        <div className="relative w-full rounded-[24px] border border-white/5 bg-stone-950/50 p-4 sm:p-6 shadow-xl shadow-black/40 backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-x-8 top-9 hidden h-px bg-gradient-to-r from-transparent via-white/10 to-transparent lg:block" />
            <div className="relative z-10 grid gap-4 md:grid-cols-2 lg:flex lg:flex-wrap lg:items-stretch lg:justify-between">
                {normalizedSteps.map((stepMeta, index) => {
                    const stepNumber = index + 1;
                    const isCompleted = stepNumber < highestStep;
                    const isActive = stepNumber === currentStep;
                    const isReachable = stepNumber <= highestStep;
                    const Icon = stepMeta.icon;

                    return (
                        <button
                            key={`${stepMeta.title}-${stepNumber}`}
                            onClick={() => isReachable && !isActive && goToStep(stepNumber)}
                            disabled={!isReachable}
                            className={`group relative flex min-h-[96px] min-w-[220px] flex-1 items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-300 ${
                                isActive
                                    ? 'border-amber-400/70 bg-amber-500/10 shadow-lg shadow-amber-500/20'
                                    : isCompleted
                                    ? 'border-emerald-500/30 bg-emerald-500/5'
                                    : 'border-white/5 bg-transparent hover:border-amber-300/40 hover:bg-amber-500/5'
                            } ${!isReachable ? 'cursor-not-allowed opacity-60' : ''}`}
                        >
                            <div
                                className={`mt-1 flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition ${
                                    isActive
                                        ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                                        : isCompleted
                                        ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
                                        : 'border-white/10 bg-stone-900/80 text-stone-400'
                                }`}
                            >
                                {Icon ? <Icon className="h-4 w-4" /> : stepNumber}
                            </div>
                            <div className="flex-1 space-y-1">
                                <p className={`text-[11px] uppercase tracking-[0.4em] ${isActive ? 'text-amber-200' : 'text-stone-500'}`}>
                                    Etapa {stepNumber}
                                </p>
                                <p className="text-base font-semibold text-stone-100">{stepMeta.title}</p>
                                {stepMeta.description && (
                                    <p className="text-sm text-stone-400">{stepMeta.description}</p>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default NewStepper;
