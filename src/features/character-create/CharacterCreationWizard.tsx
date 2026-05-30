'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { ApiListItem } from '@/types';
import { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { useToast } from '@/hooks/use-toast';
import * as GameService from '@/services/gameService';
import { vaultCharacterToCreatorState } from '@/lib/vaultCharacterHydrate';
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
import { cn } from '@/lib/utils';

export interface CharacterCreationWizardProps {
  races: ApiListItem[];
  classes: ApiListItem[];
  backgrounds: ApiListItem[];
  alignments: ApiListItem[];
  allLanguages: ApiListItem[];
  onCharacterCreated: () => void;
  onCancel?: () => void;
  editCharacterId?: string | number;
}

export function CharacterCreationWizard({
  races,
  classes,
  backgrounds,
  alignments,
  allLanguages,
  onCharacterCreated,
  onCancel,
  editCharacterId,
}: CharacterCreationWizardProps) {
  const { createCharacter, updateCharacter } = useGameStateContext();
  const { toast } = useToast();
  const isEditMode = editCharacterId != null;

  const [editHydration, setEditHydration] = useState<ReturnType<typeof vaultCharacterToCreatorState> | null>(
    null,
  );
  const [editLoading, setEditLoading] = useState(isEditMode);

  useEffect(() => {
    if (!isEditMode || editCharacterId == null) return;
    let cancelled = false;
    (async () => {
      try {
        const character = await GameService.getCharacterById(editCharacterId);
        if (cancelled) return;
        setEditHydration(vaultCharacterToCreatorState(character as unknown as Record<string, unknown>));
      } catch {
        if (!cancelled) {
          toast({
            variant: 'destructive',
            title: 'Falha ao carregar herói',
            description: 'Não foi possível abrir o herói para edição.',
          });
          onCancel?.();
        }
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editCharacterId, isEditMode, onCancel, toast]);
  const { isLgUp } = useBreakpoint();

  const [currentStep, setCurrentStep] = useState(1);
  const [highestStep, setHighestStep] = useState(isEditMode ? TOTAL_CREATION_STEPS : 1);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  const hook = useCharacterCreator({
    allLanguages: allLanguages || [],
    currentStep,
    initialSnapshot: editHydration ?? undefined,
  });

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
      const result =
        isEditMode && editCharacterId != null
          ? await updateCharacter(editCharacterId, data)
          : await createCharacter(data);
      if (result) {
        if (isEditMode) {
          toast({
            title: 'Herói atualizado',
            description: 'Campanhas em andamento não são alteradas — só novas sessões usam a ficha revisada.',
          });
        }
        onCharacterCreated();
      }
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

  if (editLoading) {
    return (
      <WizardShell>
        <LoadingOracle label="Carregando herói do cofre…" />
      </WizardShell>
    );
  }

  if (hook.loadingStates.isBlocking) {
    return (
      <WizardShell>
        <LoadingOracle
          label={hook.loadingStates.message || 'Preparando equipamentos…'}
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
        <p className="font-display text-sm text-dnd-gold">{isEditMode ? 'Editar herói' : 'Forja de herói'}</p>
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
          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-1 flex-col',
              !isLgUp && 'pb-[calc(13rem+var(--dnd-safe-bottom))]'
            )}
          >
            <WizardStepLayout
              step={currentStep}
              onBack={currentStep > 1 ? goPrev : undefined}
              onNext={currentStep < 8 ? goNext : undefined}
              nextDisabled={!canProceed}
              showNext={currentStep < 8}
              isLastStep={currentStep === 8}
              onFinalize={() => setShowConfirmationModal(true)}
              finalizeDisabled={!hook.isComplete}
              hideFooter={!isLgUp}
              nextLabel={
                currentStep === 7 ? 'Ver revelação' : currentStep === 6 && !canProceed ? 'Continuar' : 'Continuar'
              }
            >
              {stepContent}
            </WizardStepLayout>
          </div>

          {isLgUp ? (
            <div className="hidden shrink-0 lg:block lg:w-72">
              <CharacterSummaryCollapsible
                hook={hook}
                currentStep={currentStep}
                defaultOpen
              />
            </div>
          ) : null}
        </div>
      </div>

      {!isLgUp ? (
        <CharacterSummaryCollapsible
          hook={hook}
          currentStep={currentStep}
          mobileNav={{
            onBack: currentStep > 1 ? goPrev : undefined,
            onNext: currentStep < 8 ? goNext : undefined,
            nextDisabled: !canProceed,
            showNext: currentStep < 8,
            isLastStep: currentStep === 8,
            onFinalize: () => setShowConfirmationModal(true),
            finalizeDisabled: !hook.isComplete,
            nextLabel:
              currentStep === 7
                ? 'Ver revelação'
                : currentStep === 6 && !canProceed
                  ? 'Continuar'
                  : 'Continuar',
          }}
        />
      ) : null}

      {showConfirmationModal ? (
        <ActionModal
          isOpen={showConfirmationModal}
          title={isEditMode ? 'Salvar alterações?' : 'Selar o destino?'}
          onClose={() => setShowConfirmationModal(false)}
          actions={[
            {
              text: 'Ainda não',
              onClick: () => setShowConfirmationModal(false),
              variant: 'secondary',
            },
            {
              text: isEditMode ? 'Sim, salvar!' : 'Sim, forjar herói!',
              onClick: handleFinalizeAndSubmit,
              variant: 'primary',
            },
          ]}
        >
          <p className="text-stone-300">
            {isEditMode
              ? `Você está prestes a atualizar ${hook.name || 'seu herói'} no cofre. Campanhas ativas mantêm a ficha anterior.`
              : `Você está prestes a registrar ${hook.name || 'seu herói'} no cofre. Deseja continuar?`}
          </p>
        </ActionModal>
      ) : null}
    </WizardShell>
  );
}

export default CharacterCreationWizard;
