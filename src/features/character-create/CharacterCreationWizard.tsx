'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { ApiListItem } from '@/types';
import { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { useGameStateContext } from '@/contexts/GameStateContext';
import NewStep1_RaceClass from '@/components/NewCreationCharacter/NewStep1_RaceClass';
import NewStep2_Attributes from '@/components/NewCreationCharacter/NewStep2_Attributes';
import NewStep3_Background from '@/components/NewCreationCharacter/NewStep3_Background';
import NewStep4_ProficienciesAndLanguages from '@/components/NewCreationCharacter/NewStep4_ProficienciesAndLanguages';
import NewStep5_Equipment2 from '@/components/NewCreationCharacter/NewStep5_Equipment2';
import NewStep6_Spells from '@/components/NewCreationCharacter/NewStep6_Spells';
import NewStep7_Feats from '@/components/NewCreationCharacter/NewStep7_Feats';
import NewStep8_Finalize from '@/components/NewCreationCharacter/NewStep8_Finalize';
import ActionModal from '@/components/ui/ActionModal';
import { LoadingOracle } from '@/features/gameplay/components/LoadingOracle';
import { CreationStepper } from './CreationStepper';
import { CharacterSummaryCollapsible } from './CharacterSummaryCollapsible';
import { WizardShell, WizardStepLayout } from './WizardStepLayout';
import { TOTAL_CREATION_STEPS } from './constants';
import { canProceedFromStep } from './stepCompleteness';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export interface CharacterCreationWizardProps {
  races: ApiListItem[];
  classes: ApiListItem[];
  backgrounds: ApiListItem[];
  alignments: ApiListItem[];
  allLanguages: ApiListItem[];
  onCharacterCreated: () => void;
  onCancel?: () => void;
}

export function CharacterCreationWizard({
  races,
  classes,
  backgrounds,
  alignments,
  allLanguages,
  onCharacterCreated,
  onCancel,
}: CharacterCreationWizardProps) {
  const { createCharacter } = useGameStateContext();
  const hook = useCharacterCreator({ allLanguages: allLanguages || [] });
  const { isLgUp } = useBreakpoint();

  const [currentStep, setCurrentStep] = useState(1);
  const [highestStep, setHighestStep] = useState(1);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  const noop = useCallback(() => {}, []);

  const goNext = useCallback(() => {
    setCurrentStep((s) => {
      const next = Math.min(s + 1, TOTAL_CREATION_STEPS);
      setHighestStep((h) => Math.max(h, next));
      return next;
    });
  }, []);

  const goPrev = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }, []);

  const goToStep = useCallback((step: number) => {
    if (step <= highestStep) setCurrentStep(step);
  }, [highestStep]);

  const handleFinalizeAndSubmit = async () => {
    const data = hook.buildCharacter();
    if (data) {
      setShowConfirmationModal(false);
      const result = await createCharacter(data);
      if (result) onCharacterCreated();
    } else {
      setShowConfirmationModal(false);
    }
  };

  const canProceed = canProceedFromStep(currentStep, hook);

  useEffect(() => {
    if (currentStep === 7 && !hook.isVariantHuman) {
      setCurrentStep(8);
      setHighestStep((h) => Math.max(h, 8));
    }
  }, [currentStep, hook.isVariantHuman]);

  if (hook.loadingStates.isLoading) {
    return (
      <WizardShell>
        <LoadingOracle
          label={hook.loadingStates.message || 'Preparando o crisol de criação…'}
        />
      </WizardShell>
    );
  }

  const stepContent = (() => {
    const nav = { hideNav: true as const };
    switch (currentStep) {
      case 1:
        return (
          <NewStep1_RaceClass hook={hook} races={races} classes={classes} nextStep={noop} {...nav} />
        );
      case 2:
        return (
          <NewStep2_Attributes hook={hook} prevStep={noop} nextStep={noop} {...nav} />
        );
      case 3:
        return (
          <NewStep3_Background
            hook={hook}
            backgrounds={backgrounds}
            alignments={alignments}
            prevStep={noop}
            nextStep={noop}
            {...nav}
          />
        );
      case 4:
        return (
          <NewStep4_ProficienciesAndLanguages
            hook={hook}
            prevStep={noop}
            nextStep={noop}
            allLanguages={allLanguages}
            {...nav}
          />
        );
      case 5:
        return <NewStep5_Equipment2 hook={hook} prevStep={noop} nextStep={noop} {...nav} />;
      case 6:
        return <NewStep6_Spells hook={hook} prevStep={noop} nextStep={noop} {...nav} />;
      case 7:
        return <NewStep7_Feats hook={hook} prevStep={noop} nextStep={noop} {...nav} />;
      case 8:
        return (
          <NewStep8_Finalize
            hook={hook}
            prevStep={noop}
            handleFinalize={() => setShowConfirmationModal(true)}
            {...nav}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <WizardShell>
      <header className="mb-4 flex shrink-0 items-center justify-between gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 font-ui text-sm text-dnd-parchment-muted hover:text-dnd-gold"
          >
            <ArrowLeft className="h-4 w-4" />
            Sair
          </button>
        ) : (
          <span />
        )}
        <p className="font-display text-sm text-dnd-gold">Forja de herói</p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-8">
        {isLgUp ? (
          <aside className="hidden w-56 shrink-0 lg:block xl:w-64">
            <CreationStepper
              currentStep={currentStep}
              highestStep={highestStep}
              onGoToStep={goToStep}
            />
          </aside>
        ) : (
          <CreationStepper
            currentStep={currentStep}
            highestStep={highestStep}
            onGoToStep={goToStep}
          />
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row lg:gap-6">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <WizardStepLayout
              step={currentStep}
              onBack={currentStep > 1 ? goPrev : undefined}
              onNext={currentStep < 8 ? goNext : undefined}
              nextDisabled={!canProceed}
              showNext={currentStep < 8}
              isLastStep={currentStep === 8}
              onFinalize={() => setShowConfirmationModal(true)}
              finalizeDisabled={!hook.isComplete}
              nextLabel={
                currentStep === 7 ? 'Ver revelação' : currentStep === 6 && !canProceed ? 'Continuar' : 'Continuar'
              }
            >
              {stepContent}
            </WizardStepLayout>
          </div>

          <div className="shrink-0 lg:w-72">
            <CharacterSummaryCollapsible hook={hook} defaultOpen={isLgUp} />
          </div>
        </div>
      </div>

      {showConfirmationModal ? (
        <ActionModal
          isOpen={showConfirmationModal}
          title="Selar o destino?"
          onClose={() => setShowConfirmationModal(false)}
          actions={[
            {
              text: 'Ainda não',
              onClick: () => setShowConfirmationModal(false),
              variant: 'secondary',
            },
            {
              text: 'Sim, forjar herói!',
              onClick: handleFinalizeAndSubmit,
              variant: 'primary',
            },
          ]}
        >
          <p className="text-stone-300">
            {`Você está prestes a registrar ${hook.name || 'seu herói'} no cofre. Deseja continuar?`}
          </p>
        </ActionModal>
      ) : null}
    </WizardShell>
  );
}

export default CharacterCreationWizard;
