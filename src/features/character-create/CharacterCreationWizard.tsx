'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { AmbientBackground, DndButton } from '@/components/primitives';
import { ArrowLeft } from 'lucide-react';
import { ArchetypePicker } from './ArchetypePicker';
import { LivingCharacterSheet } from './LivingCharacterSheet';
import { SheetBlockEditor } from './SheetBlockEditor';
import type { SheetBlockDef } from './sheetBlocks';
import { getVisibleBlocks, isBlockComplete } from './sheetBlocks';
import { useOnboarding } from '@/contexts/OnboardingContext';

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

type Phase = 'archetype' | 'sheet';

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
  const { needsOnboarding, step: onboardingStep } = useOnboarding();
  const isOnboardingCreateHero = needsOnboarding && onboardingStep === 'create_hero';
  const isEditMode = editCharacterId != null;
  const scrollRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>(isEditMode ? 'sheet' : 'archetype');
  const [openBlock, setOpenBlock] = useState<SheetBlockDef | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

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

  const editorStep = openBlock?.step ?? 8;

  const hook = useCharacterCreator({
    allLanguages: allLanguages || [],
    currentStep: editorStep,
    initialSnapshot: editHydration ?? undefined,
  });

  const noop = useCallback(() => {}, []);

  useEffect(() => {
    if (phase === 'sheet') {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [phase, openBlock?.id]);

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

  const openNextIncomplete = useCallback(() => {
    const blocks = getVisibleBlocks(hook);
    const next = blocks.find((b) => !isBlockComplete(b.step, hook));
    if (next) setOpenBlock(next);
    else if (hook.isComplete) setShowConfirmationModal(true);
  }, [hook]);

  const stepContent = useMemo(() => {
    const nav = { hideNav: true as const };
    const step = openBlock?.step ?? 1;
    switch (step) {
      case 1:
        return <NewStep1_RaceClass hook={hook} races={races} classes={classes} nextStep={noop} {...nav} />;
      case 2:
        return <NewStep2_Attributes hook={hook} prevStep={noop} nextStep={noop} {...nav} />;
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
  }, [openBlock?.step, hook, races, classes, backgrounds, alignments, allLanguages, noop]);

  if (editLoading) {
    return (
      <div className="relative h-full min-h-0 bg-dnd-obsidian">
        <LoadingOracle label="Carregando herói do cofre…" />
      </div>
    );
  }

  if (hook.loadingStates.isBlocking) {
    return (
      <div className="relative h-full min-h-0 bg-dnd-obsidian">
        <LoadingOracle label={hook.loadingStates.message || 'Preparando equipamentos…'} />
      </div>
    );
  }

  if (phase === 'archetype') {
    return (
      <ArchetypePicker
        hook={hook}
        onStartBlank={() => setPhase('sheet')}
        onApplied={() => setPhase('sheet')}
        reserveOnboardingBar={isOnboardingCreateHero}
      />
    );
  }

  return (
    <div
      className={`relative flex h-full min-h-0 flex-col overflow-hidden bg-dnd-obsidian${isOnboardingCreateHero ? ' pt-[var(--dnd-onboarding-hero-bar,3.5rem)]' : ''}`}
    >
      <AmbientBackground variant="parchment" />

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-2 border-b border-dnd-gold/10 px-3 py-3 sm:px-5">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-[44px] items-center gap-1.5 font-ui text-sm text-dnd-parchment-muted hover:text-dnd-gold"
          >
            <ArrowLeft className="h-4 w-4" />
            Sair
          </button>
        ) : (
          <span className="w-14" />
        )}
        <p className="font-display text-sm text-dnd-gold sm:text-base">
          {isEditMode ? 'Editar ficha' : 'Ficha viva'}
        </p>
        <DndButton
          variant="ember"
          size="sm"
          disabled={!hook.isComplete}
          onClick={() => setShowConfirmationModal(true)}
          className="min-w-[5.5rem]"
        >
          Selar
        </DndButton>
      </header>

      <div ref={scrollRef} className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-4 sm:px-5 sm:py-6">
        <LivingCharacterSheet hook={hook} onOpenBlock={setOpenBlock} />

        {!hook.isComplete ? (
          <div className="mx-auto mt-4 max-w-3xl">
            <DndButton variant="goldOutline" className="w-full" onClick={openNextIncomplete}>
              Ir para o próximo bloco pendente
            </DndButton>
          </div>
        ) : null}
      </div>

      <SheetBlockEditor block={openBlock} hook={hook} open={Boolean(openBlock)} onClose={() => setOpenBlock(null)}>
        {stepContent}
      </SheetBlockEditor>

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
    </div>
  );
}

export default CharacterCreationWizard;
