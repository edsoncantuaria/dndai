'use client';

import { HOMEBREW_CREATOR_STEPS, type HomebrewCreatorStepId } from './constants';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export interface HomebrewCreationStepperProps {
  activeStep: HomebrewCreatorStepId;
  canStructure: boolean;
  canReview: boolean;
  onStepChange: (step: HomebrewCreatorStepId) => void;
}

export function HomebrewCreationStepper({
  activeStep,
  canStructure,
  canReview,
  onStepChange,
}: HomebrewCreationStepperProps) {
  const { isLgUp } = useBreakpoint();

  const canGo = (id: HomebrewCreatorStepId) => {
    if (id === 'meta') return true;
    if (id === 'structure') return canStructure;
    return canReview;
  };

  if (!isLgUp) {
    return (
      <div className="flex items-center justify-center gap-2 py-1">
        {HOMEBREW_CREATOR_STEPS.map((step) => {
          const active = step.id === activeStep;
          const reachable = canGo(step.id);
          return (
            <button
              key={step.id}
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onStepChange(step.id)}
              aria-label={step.label}
              className={cn(
                'h-2 rounded-full transition-all',
                active ? 'w-8 bg-dnd-gold' : reachable ? 'w-2 bg-dnd-mist-strong' : 'w-2 bg-dnd-mist-strong/40',
                !reachable && 'opacity-40'
              )}
            />
          );
        })}
      </div>
    );
  }

  return (
    <nav className="space-y-1" aria-label="Etapas do criador">
      {HOMEBREW_CREATOR_STEPS.map((step) => {
        const Icon = step.icon;
        const active = step.id === activeStep;
        const reachable = canGo(step.id);
        const stepIndex = HOMEBREW_CREATOR_STEPS.findIndex((s) => s.id === step.id);
        const activeIndex = HOMEBREW_CREATOR_STEPS.findIndex((s) => s.id === activeStep);
        const done = stepIndex < activeIndex;

        return (
          <button
            key={step.id}
            type="button"
            disabled={!reachable}
            onClick={() => reachable && onStepChange(step.id)}
            className={cn(
              'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
              active && 'border border-dnd-gold/30 bg-dnd-gold/15',
              !active && reachable && 'hover:bg-dnd-mist',
              !reachable && 'cursor-not-allowed opacity-45'
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
                {step.label}
              </span>
              <span className="block font-display text-sm text-dnd-parchment">{step.description}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
