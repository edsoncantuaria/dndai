'use client';

import { CREATION_STEPS } from './constants';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface CreationStepperProps {
  currentStep: number;
  highestStep: number;
  onGoToStep: (step: number) => void;
}

/** Sidebar vertical — só desktop (mobile usa WizardMobileStepHeader) */
export function CreationStepper({ currentStep, highestStep, onGoToStep }: CreationStepperProps) {
  return (
    <nav className="sticky top-4 space-y-1 pr-2" aria-label="Progresso da criação">
      <p className="mb-3 px-3 font-ui text-[10px] font-bold uppercase tracking-[0.28em] text-dnd-parchment-muted">
        Etapas
      </p>
      {CREATION_STEPS.map((step) => {
        const Icon = step.icon;
        const done = step.id < currentStep;
        const active = step.id === currentStep;
        const reachable = step.id <= highestStep;

        return (
          <button
            key={step.id}
            type="button"
            disabled={!reachable}
            onClick={() => reachable && onGoToStep(step.id)}
            className={cn(
              'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
              active && 'border border-dnd-gold/35 bg-dnd-gold/12',
              !active && reachable && 'hover:bg-dnd-mist',
              !reachable && 'cursor-not-allowed opacity-40',
            )}
          >
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
                active && 'border-dnd-gold bg-dnd-gold/20 text-dnd-gold',
                done && !active && 'border-dnd-success/50 bg-dnd-success/10 text-dnd-success',
                !active && !done && 'border-dnd-gold/20 text-dnd-parchment-muted',
              )}
            >
              {done && !active ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </span>
            <span className="min-w-0">
              <span className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">
                {step.id}. {step.title}
              </span>
              <span className="block font-ui text-xs text-dnd-parchment-muted/90">{step.description}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
