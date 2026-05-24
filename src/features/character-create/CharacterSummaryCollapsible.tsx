'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { DndCard } from '@/components/primitives';
import { cn } from '@/lib/utils';

const ATTRIBUTE_ORDER = [
  { key: 'strength', label: 'FOR' },
  { key: 'dexterity', label: 'DES' },
  { key: 'constitution', label: 'CON' },
  { key: 'intelligence', label: 'INT' },
  { key: 'wisdom', label: 'SAB' },
  { key: 'charisma', label: 'CAR' },
] as const;

export function CharacterSummaryCollapsible({
  hook,
  defaultOpen = false,
}: {
  hook: ReturnType<typeof useCharacterCreator>;
  defaultOpen?: boolean;
}) {
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
  } = hook;

  const attributeSource = (finalAttributes || baseAttributes) as Record<string, number> | undefined;
  const modifierSource = modifiers as Record<string, number> | undefined;
  const wisMod = modifierSource?.wisdom ?? 0;
  const passivePerception = 10 + wisMod;

  const preview = useMemo(
    () => ({
      race: details.raceDetails?.name || race || '—',
      cls: details.classDetails?.name || characterClass || '—',
      bg: details.backgroundDetails?.name || background || '—',
    }),
    [details, race, characterClass, background]
  );

  return (
    <DndCard padding="none" className="overflow-hidden lg:sticky lg:top-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <div>
          <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-gold">Resumo</p>
          <p className="font-display text-sm text-dnd-parchment">{name || 'Herói sem nome'}</p>
        </div>
        <ChevronDown className={cn('h-5 w-5 text-dnd-gold transition', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="space-y-4 border-t border-dnd-gold/15 px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-2 font-ui text-xs">
            <div>
              <span className="text-dnd-parchment-muted">Raça</span>
              <p className="text-dnd-parchment">{preview.race}</p>
            </div>
            <div>
              <span className="text-dnd-parchment-muted">Classe</span>
              <p className="text-dnd-parchment">{preview.cls}</p>
            </div>
            <div>
              <span className="text-dnd-parchment-muted">Antecedente</span>
              <p className="text-dnd-parchment">{preview.bg}</p>
            </div>
            <div>
              <span className="text-dnd-parchment-muted">Alinhamento</span>
              <p className="text-dnd-parchment">{alignment || '—'}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {ATTRIBUTE_ORDER.map((attr) => {
              const score = attributeSource?.[attr.key];
              const mod = modifierSource?.[attr.key];
              return (
                <div
                  key={attr.key}
                  className="rounded-md border border-dnd-gold/15 bg-dnd-obsidian-raised/80 py-2 text-center"
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
              <p className="text-dnd-gold">{ac?.value ?? '—'}</p>
            </div>
            <div className="rounded-md border border-dnd-gold/10 py-2">
              <p className="text-dnd-parchment-muted">PV</p>
              <p className="text-dnd-gold">{hp?.max ?? '—'}</p>
            </div>
            <div className="rounded-md border border-dnd-gold/10 py-2">
              <p className="text-dnd-parchment-muted">Percepção</p>
              <p className="text-dnd-gold">{passivePerception}</p>
            </div>
          </div>
          {proficiencyBonus ? (
            <p className="text-center font-ui text-[10px] text-dnd-parchment-muted">
              Bônus de proficiência +{proficiencyBonus}
            </p>
          ) : null}
        </div>
      ) : null}
    </DndCard>
  );
}
