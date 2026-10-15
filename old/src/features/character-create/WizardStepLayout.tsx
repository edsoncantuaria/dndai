'use client';

import { forwardRef, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AmbientBackground, DndButton, DndHeading } from '@/components/primitives';
import { CREATION_STEPS, TOTAL_CREATION_STEPS } from './constants';
import { cn } from '@/lib/utils';

export interface WizardNavProps {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showNext?: boolean;
  isLastStep?: boolean;
  onFinalize?: () => void;
  finalizeDisabled?: boolean;
}

export function WizardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-dnd-obsidian">
      <AmbientBackground variant="parchment" />
      <div className="relative z-10 mx-auto flex h-full min-h-0 max-w-screen-2xl flex-col px-3 py-3 sm:px-5 sm:py-4 lg:px-6 lg:py-5">
        {children}
      </div>
    </div>
  );
}

export function WizardTopBar({
  title,
  onCancel,
}: {
  title: string;
  onCancel?: () => void;
}) {
  return (
    <header className="mb-3 flex shrink-0 items-center justify-between gap-3 border-b border-dnd-gold/10 pb-3">
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-[44px] items-center gap-1.5 font-ui text-sm text-dnd-parchment-muted transition hover:text-dnd-gold"
        >
          <ArrowLeft className="h-4 w-4" />
          Sair
        </button>
      ) : (
        <span className="w-12" />
      )}
      <p className="font-display text-sm text-dnd-gold sm:text-base">{title}</p>
      <span className="w-12" aria-hidden />
    </header>
  );
}

/** Mobile/tablet: passo atual + barra de progresso */
export function WizardMobileStepHeader({
  step,
  onGoToStep,
  highestStep,
}: {
  step: number;
  highestStep: number;
  onGoToStep: (step: number) => void;
}) {
  const meta = CREATION_STEPS[step - 1];
  const progress = Math.round((step / TOTAL_CREATION_STEPS) * 100);

  return (
    <div className="mb-3 shrink-0 rounded-xl border border-dnd-gold/15 bg-dnd-obsidian-raised/80 px-4 py-3 lg:hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.22em] text-dnd-ember">
            Passo {step} de {TOTAL_CREATION_STEPS}
          </p>
          <p className="truncate font-display text-base text-dnd-parchment">{meta?.title}</p>
          <p className="truncate font-ui text-xs text-dnd-parchment-muted">{meta?.description}</p>
        </div>
        <span className="shrink-0 rounded-full border border-dnd-gold/25 bg-dnd-gold/10 px-2.5 py-1 font-ui text-xs font-semibold text-dnd-gold">
          {progress}%
        </span>
      </div>
      <div className="mt-3 flex gap-1">
        {CREATION_STEPS.map((s) => {
          const reachable = s.id <= highestStep;
          const active = s.id === step;
          const done = s.id < step;
          return (
            <button
              key={s.id}
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onGoToStep(s.id)}
              aria-label={s.title}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                active && 'bg-dnd-gold',
                !active && done && 'bg-dnd-success/80',
                !active && !done && 'bg-dnd-mist-strong',
                !reachable && 'opacity-35',
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Área de scroll única — ref usada para voltar ao topo ao mudar passo */
export const WizardScrollRegion = forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(
  function WizardScrollRegion({ children, className }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth',
          '[scrollbar-gutter:stable]',
          className,
        )}
      >
        {children}
      </div>
    );
  },
);

/** Desktop: título do passo acima do conteúdo (sidebar já lista etapas) */
export function WizardStepIntro({ step }: { step: number }) {
  const meta = CREATION_STEPS[step - 1];
  return (
    <div className="mb-4 hidden lg:block">
      <DndHeading variant="label">
        Passo {step} de {TOTAL_CREATION_STEPS}
      </DndHeading>
      <DndHeading variant="section" className="mt-1">
        {meta?.title}
      </DndHeading>
      <p className="mt-1 font-narrative text-sm text-dnd-parchment-muted">{meta?.description}</p>
    </div>
  );
}

export function WizardDesktopFooter({
  onBack,
  onNext,
  nextLabel = 'Continuar',
  nextDisabled,
  showNext = true,
  isLastStep,
  onFinalize,
  finalizeDisabled,
}: WizardNavProps) {
  return (
    <div className="mt-4 hidden shrink-0 gap-2 border-t border-dnd-gold/15 pt-4 lg:flex">
      {onBack ? (
        <DndButton variant="ghost" onClick={onBack} className="min-w-[7rem]">
          Voltar
        </DndButton>
      ) : (
        <span className="min-w-[7rem]" />
      )}
      <span className="flex-1" />
      {isLastStep && onFinalize ? (
        <DndButton variant="ember" disabled={finalizeDisabled} onClick={onFinalize} className="min-w-[10rem]">
          Revelar herói
        </DndButton>
      ) : showNext && onNext ? (
        <DndButton variant="ember" disabled={nextDisabled} onClick={onNext} className="min-w-[10rem]">
          {nextLabel}
        </DndButton>
      ) : null}
    </div>
  );
}

export function WizardMobileNavDock(props: WizardNavProps) {
  const {
    onBack,
    onNext,
    nextLabel = 'Continuar',
    nextDisabled,
    showNext = true,
    isLastStep,
    onFinalize,
    finalizeDisabled,
  } = props;

  return (
    <div className="flex shrink-0 gap-2 border-t border-dnd-gold/15 bg-dnd-obsidian/95 px-3 py-2.5 pb-[calc(0.625rem+var(--dnd-safe-bottom))] backdrop-blur-md lg:hidden">
      {onBack ? (
        <DndButton variant="ghost" onClick={onBack} className="flex-1">
          Voltar
        </DndButton>
      ) : (
        <span className="flex-1" />
      )}
      {isLastStep && onFinalize ? (
        <DndButton variant="ember" className="flex-[1.4]" disabled={finalizeDisabled} onClick={onFinalize}>
          Revelar herói
        </DndButton>
      ) : showNext && onNext ? (
        <DndButton variant="ember" className="flex-[1.4]" disabled={nextDisabled} onClick={onNext}>
          {nextLabel}
        </DndButton>
      ) : null}
    </div>
  );
}

/** @deprecated use WizardScrollRegion + WizardStepIntro */
export function WizardStepLayout({
  step,
  children,
}: {
  step: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <WizardStepIntro step={step} />
      {children}
    </>
  );
}
