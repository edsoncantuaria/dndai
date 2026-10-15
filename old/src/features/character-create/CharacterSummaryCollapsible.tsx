'use client';

import { useMemo, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import type { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/hooks/useBreakpoint';

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
}: {
  hook: ReturnType<typeof useCharacterCreator>;
  currentStep: number;
  defaultOpen?: boolean;
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
    [details, race, characterClass, background],
  );

  const subtitleParts = [
    preview.race,
    preview.cls,
    currentStep >= 3 && preview.bg ? preview.bg : null,
  ].filter(Boolean) as string[];

  const hasAttributes = ATTRIBUTE_ORDER.some((a) => typeof attributeSource?.[a.key] === 'number');

  const detailsBody = (
    <div className="space-y-4">
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
  );

  if (isLgUp) {
    return (
      <aside className="sticky top-4 w-72 shrink-0 xl:w-80">
        <div className="overflow-hidden rounded-xl border border-dnd-gold/25 bg-dnd-obsidian-raised/95 shadow-[var(--dnd-shadow-elevated)]">
          <div className="border-b border-dnd-gold/10 px-4 py-3">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-wider text-dnd-gold">
              Resumo do herói
            </p>
            <p className="font-display text-lg text-dnd-parchment">{name || 'Herói sem nome'}</p>
            {subtitleParts.length > 0 ? (
              <p className="mt-0.5 font-ui text-xs text-dnd-parchment-muted">{subtitleParts.join(' · ')}</p>
            ) : (
              <p className="mt-0.5 font-ui text-xs italic text-dnd-parchment-muted/80">
                Escolha raça e classe para ver o retrato.
              </p>
            )}
          </div>
          <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto overscroll-contain px-4 py-4">
            {detailsBody}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/55 backdrop-blur-[2px] lg:hidden"
          aria-label="Fechar resumo"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div className={cn('shrink-0 border-t border-dnd-gold/15 bg-dnd-obsidian/95 lg:hidden', open && 'relative z-30')}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
          aria-expanded={open}
        >
          <div className="min-w-0 flex-1">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-wider text-dnd-gold">
              Resumo
            </p>
            <p className="truncate font-display text-sm text-dnd-parchment">{name || 'Herói sem nome'}</p>
            {subtitleParts.length > 0 ? (
              <p className="truncate font-ui text-xs text-dnd-parchment-muted">{subtitleParts.join(' · ')}</p>
            ) : null}
          </div>
          {!open && hasAttributes && currentStep >= 2 ? (
            <div className="flex shrink-0 gap-1">
              {ATTRIBUTE_ORDER.slice(0, 3).map((attr) => {
                const score = attributeSource?.[attr.key];
                if (score === undefined) return null;
                return (
                  <span
                    key={attr.key}
                    className="rounded border border-dnd-gold/15 px-1.5 py-0.5 font-ui text-[10px] text-dnd-parchment"
                  >
                    {attr.label} {score}
                  </span>
                );
              })}
            </div>
          ) : null}
          <ChevronUp
            className={cn('h-4 w-4 shrink-0 text-dnd-gold transition-transform', !open && 'rotate-180')}
            aria-hidden
          />
        </button>
        {open ? (
          <div className="max-h-[40dvh] overflow-y-auto overscroll-contain border-t border-dnd-gold/10 px-3 pb-3 pt-2">
            {detailsBody}
          </div>
        ) : null}
      </div>
    </>
  );
}
