'use client';

import { useMemo, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import type { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { DndButton } from '@/components/primitives';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export type CharacterSummaryMobileNav = {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showNext?: boolean;
  isLastStep?: boolean;
  onFinalize?: () => void;
  finalizeDisabled?: boolean;
};

const ATTRIBUTE_ORDER = [
  { key: 'strength', label: 'FOR' },
  { key: 'dexterity', label: 'DES' },
  { key: 'constitution', label: 'CON' },
  { key: 'intelligence', label: 'INT' },
  { key: 'wisdom', label: 'SAB' },
  { key: 'charisma', label: 'CAR' },
] as const;

const METHOD_LABELS: Record<string, string> = {
  'point-buy': 'Compra de pontos',
  roll: 'Rolar dados',
};

export function CharacterSummaryCollapsible({
  hook,
  currentStep,
  defaultOpen = false,
  mobileNav,
}: {
  hook: ReturnType<typeof useCharacterCreator>;
  currentStep: number;
  defaultOpen?: boolean;
  mobileNav?: CharacterSummaryMobileNav;
}) {
  const { isLgUp } = useBreakpoint();
  const [open, setOpen] = useState(defaultOpen);
  const {
    name,
    details,
    race,
    characterClass,
    background,
    alignment,
    finalAttributes,
    baseAttributes,
    modifiers,
    ac,
    hp,
    proficiencyBonus,
    attributeMethod,
    points,
  } = hook;

  const attributeSource = (finalAttributes || baseAttributes) as Record<string, number> | undefined;
  const modifierSource = modifiers as Record<string, number> | undefined;
  const wisMod = modifierSource?.wisdom ?? 0;
  const passivePerception = 10 + wisMod;

  const preview = useMemo(
    () => ({
      race: details.raceDetails?.name || race || null,
      cls: details.classDetails?.name || characterClass || null,
      bg: details.backgroundDetails?.name || background || null,
    }),
    [details, race, characterClass, background]
  );

  const subtitleParts = [
    preview.race,
    preview.cls,
    currentStep >= 3 && preview.bg ? preview.bg : null,
  ].filter(Boolean) as string[];

  const hasAttributes = ATTRIBUTE_ORDER.some((a) => typeof attributeSource?.[a.key] === 'number');

  const panel = (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-dnd-gold/25 bg-dnd-obsidian-raised/95 shadow-[var(--dnd-shadow-elevated)] backdrop-blur-sm',
        !isLgUp && 'mx-auto max-w-screen-xl'
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="font-ui text-[10px] font-semibold uppercase tracking-wider text-dnd-gold">
            Resumo do herói
          </p>
          <p className="truncate font-display text-base text-dnd-parchment">{name || 'Herói sem nome'}</p>
          {subtitleParts.length > 0 ? (
            <p className="mt-0.5 truncate font-ui text-xs text-dnd-parchment-muted">
              {subtitleParts.join(' · ')}
            </p>
          ) : (
            <p className="mt-0.5 font-ui text-xs italic text-dnd-parchment-muted/80">
              Escolha raça e classe para ver o retrato.
            </p>
          )}
        </div>
        <ChevronUp
          className={cn('h-5 w-5 shrink-0 text-dnd-gold transition-transform', !open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {!open && hasAttributes && currentStep >= 2 ? (
        <div className="flex gap-1 overflow-x-auto border-t border-dnd-gold/10 px-3 pb-3 pt-2">
          {ATTRIBUTE_ORDER.map((attr) => {
            const score = attributeSource?.[attr.key];
            if (score === undefined) return null;
            const mod = modifierSource?.[attr.key];
            return (
              <div
                key={attr.key}
                className="shrink-0 rounded-md border border-dnd-gold/15 bg-dnd-obsidian/80 px-2 py-1 text-center"
              >
                <p className="font-ui text-[9px] text-dnd-gold">{attr.label}</p>
                <p className="font-display text-sm leading-none text-dnd-parchment">{score}</p>
                {typeof mod === 'number' ? (
                  <p className="font-ui text-[9px] text-dnd-parchment-muted">
                    {mod >= 0 ? `+${mod}` : mod}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {open ? (
        <div className="max-h-[min(52vh,420px)] space-y-4 overflow-y-auto overscroll-contain border-t border-dnd-gold/15 px-4 pb-4 pt-3">
          {currentStep >= 2 ? (
            <div className="flex flex-wrap items-center gap-2 font-ui text-xs">
              {attributeMethod ? (
                <span className="rounded-full border border-dnd-gold/30 bg-dnd-gold/10 px-2.5 py-0.5 text-dnd-gold">
                  {METHOD_LABELS[attributeMethod] ?? attributeMethod}
                </span>
              ) : null}
              {attributeMethod === 'point-buy' && typeof points === 'number' ? (
                <span className="text-dnd-parchment-muted">Pontos restantes: {points}</span>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 font-ui text-xs sm:grid-cols-4">
            <div>
              <span className="text-dnd-parchment-muted">Raça</span>
              <p className="text-dnd-parchment">{preview.race || '—'}</p>
            </div>
            <div>
              <span className="text-dnd-parchment-muted">Classe</span>
              <p className="text-dnd-parchment">{preview.cls || '—'}</p>
            </div>
            <div>
              <span className="text-dnd-parchment-muted">Antecedente</span>
              <p className="text-dnd-parchment">{preview.bg || '—'}</p>
            </div>
            <div>
              <span className="text-dnd-parchment-muted">Alinhamento</span>
              <p className="text-dnd-parchment">{alignment || '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {ATTRIBUTE_ORDER.map((attr) => {
              const score = attributeSource?.[attr.key];
              const mod = modifierSource?.[attr.key];
              return (
                <div
                  key={attr.key}
                  className="rounded-md border border-dnd-gold/15 bg-dnd-obsidian/80 py-2 text-center"
                >
                  <p className="font-ui text-[10px] text-dnd-gold">{attr.label}</p>
                  <p className="font-display text-lg text-dnd-parchment">{score ?? '—'}</p>
                  <p className="font-ui text-[10px] text-dnd-parchment-muted">
                    {typeof mod === 'number' ? (mod >= 0 ? `+${mod}` : mod) : '—'}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2 font-ui text-center text-xs">
            <div className="rounded-md border border-dnd-gold/10 py-2">
              <p className="text-dnd-parchment-muted">CA</p>
              <p className="font-display text-dnd-gold">{ac?.value ?? '—'}</p>
            </div>
            <div className="rounded-md border border-dnd-gold/10 py-2">
              <p className="text-dnd-parchment-muted">PV</p>
              <p className="font-display text-dnd-gold">{hp?.max ?? '—'}</p>
            </div>
            <div className="rounded-md border border-dnd-gold/10 py-2">
              <p className="text-dnd-parchment-muted">Percepção</p>
              <p className="font-display text-dnd-gold">{passivePerception}</p>
            </div>
          </div>

          {proficiencyBonus ? (
            <p className="text-center font-ui text-[10px] text-dnd-parchment-muted">
              Bônus de proficiência +{proficiencyBonus}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (isLgUp) {
    return <div className="lg:sticky lg:top-4">{panel}</div>;
  }

  const navRow =
    mobileNav &&
    (mobileNav.isLastStep && mobileNav.onFinalize ? (
      <div className="flex gap-2 rounded-xl border border-dnd-gold/20 bg-dnd-obsidian p-2 shadow-[var(--dnd-shadow-elevated)]">
        {mobileNav.onBack ? (
          <DndButton variant="ghost" onClick={mobileNav.onBack} className="flex-1">
            Voltar
          </DndButton>
        ) : null}
        <DndButton
          variant="ember"
          className="flex-1"
          disabled={mobileNav.finalizeDisabled}
          onClick={mobileNav.onFinalize}
        >
          Revelar herói
        </DndButton>
      </div>
    ) : mobileNav.showNext !== false && mobileNav.onNext ? (
      <div className="flex gap-2 rounded-xl border border-dnd-gold/20 bg-dnd-obsidian p-2 shadow-[var(--dnd-shadow-elevated)]">
        {mobileNav.onBack ? (
          <DndButton variant="ghost" onClick={mobileNav.onBack} className="flex-1">
            Voltar
          </DndButton>
        ) : (
          <span className="flex-1" />
        )}
        <DndButton
          variant="ember"
          className="flex-1"
          disabled={mobileNav.nextDisabled}
          onClick={mobileNav.onNext}
        >
          {mobileNav.nextLabel ?? 'Continuar'}
        </DndButton>
      </div>
    ) : mobileNav.onBack ? (
      <div className="rounded-xl border border-dnd-gold/20 bg-dnd-obsidian p-2 shadow-[var(--dnd-shadow-elevated)]">
        <DndButton variant="ghost" onClick={mobileNav.onBack} className="w-full">
          Voltar
        </DndButton>
      </div>
    ) : null);

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-[2px] lg:hidden"
          aria-label="Fechar resumo"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 px-3 pb-[calc(0.75rem+var(--dnd-safe-bottom))] pt-2 lg:hidden',
          open && 'z-40'
        )}
      >
        {navRow}
        <div className="relative z-10">{panel}</div>
      </div>
    </>
  );
}
