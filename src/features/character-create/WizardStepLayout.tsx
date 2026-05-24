'use client';

import { AmbientBackground, DndButton, DndHeading } from '@/components/primitives';
import { CREATION_STEPS } from './constants';

export interface WizardStepLayoutProps {
  step: number;
  children: React.ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showNext?: boolean;
  isLastStep?: boolean;
  onFinalize?: () => void;
  finalizeDisabled?: boolean;
  /** No mobile a navegação fica no dock do resumo — evita sobreposição */
  hideFooter?: boolean;
}

export function WizardStepLayout({
  step,
  children,
  onBack,
  onNext,
  nextLabel = 'Continuar',
  nextDisabled,
  showNext = true,
  isLastStep,
  onFinalize,
  finalizeDisabled,
  hideFooter = false,
}: WizardStepLayoutProps) {
  const meta = CREATION_STEPS[step - 1];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4">
        <DndHeading variant="label">Passo {step} de {CREATION_STEPS.length}</DndHeading>
        <DndHeading variant="section" className="mt-1">
          {meta?.title}
        </DndHeading>
        <p className="mt-1 font-narrative text-sm text-dnd-parchment-muted">{meta?.description}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">{children}</div>
      {hideFooter ? null : (
      <div className="mt-4 flex shrink-0 gap-2 border-t border-dnd-gold/15 pt-4">
        {onBack ? (
          <DndButton variant="ghost" onClick={onBack} className="flex-1 sm:flex-none">
            Voltar
          </DndButton>
        ) : (
          <span className="flex-1 sm:hidden" />
        )}
        {isLastStep && onFinalize ? (
          <DndButton
            variant="ember"
            className="flex-1"
            disabled={finalizeDisabled}
            onClick={onFinalize}
          >
            Revelar herói
          </DndButton>
        ) : showNext && onNext ? (
          <DndButton variant="ember" className="flex-1" disabled={nextDisabled} onClick={onNext}>
            {nextLabel}
          </DndButton>
        ) : null}
      </div>
      )}
    </div>
  );
}

export function WizardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-dnd-obsidian">
      <AmbientBackground variant="parchment" />
      <div className="relative z-10 mx-auto flex h-full min-h-0 max-w-screen-xl flex-col overflow-hidden px-3 py-4 sm:px-6 sm:py-6">
        {children}
      </div>
    </div>
  );
}
