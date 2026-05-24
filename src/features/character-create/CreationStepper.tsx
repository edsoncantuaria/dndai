'use client';

import { CREATION_STEPS } from './constants';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export interface CreationStepperProps {
  currentStep: number;
  highestStep: number;
  onGoToStep: (step: number) => void;
}

export function CreationStepper({ currentStep, highestStep, onGoToStep }: CreationStepperProps) {
  const { isLgUp } = useBreakpoint();

  if (!isLgUp) {
    return (
      <div className="flex items-center justify-center gap-2 py-2">
        {CREATION_STEPS.map((step) => {
          const done = step.id < highestStep;
          const active = step.id === currentStep;
          const reachable = step.id <= highestStep;
          return (
            <button
              key={step.id}
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onGoToStep(step.id)}
              aria-label={step.title}
              className={cn(
                'h-2 rounded-full transition-all',
                active ? 'w-8 bg-dnd-gold' : done ? 'w-2 bg-dnd-success' : 'w-2 bg-dnd-mist-strong',
                !reachable && 'opacity-40'
              )}
            />
          );
        })}
      </div>
    );
  }

  return (
    <nav className="space-y-1 pr-4" aria-label="Progresso da criação">
      {CREATION_STEPS.map((step) => {
        const Icon = step.icon;
        const done = step.id < currentStep || (step.id < highestStep && step.id !== currentStep);
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
              active && 'bg-dnd-gold/15 border border-dnd-gold/30',
              !active && reachable && 'hover:bg-dnd-mist',
              !reachable && 'opacity-45 cursor-not-allowed'
            )}
          >
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
                active && 'border-dnd-gold bg-dnd-gold/20 text-dnd-gold',
                done && !active && 'border-dnd-success/50 text-dnd-success',
                !active && !done && 'border-dnd-gold/20 text-dnd-parchment-muted'
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span>
              <span className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">
                Passo {step.id}
              </span>
              <span className="block font-display text-sm text-dnd-parchment">{step.title}</span>
              <span className="block font-ui text-xs text-dnd-parchment-muted">{step.description}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
