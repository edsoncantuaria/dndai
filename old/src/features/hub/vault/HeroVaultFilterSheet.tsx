'use client';

import { useEffect, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { DndButton, DndInput } from '@/components/primitives';
import { hubSelectClassName } from '../HubLayout';

export type VaultFilters = {
  classFilter: string;
  raceFilter: string;
  levelMin: string;
};

export const emptyVaultFilters: VaultFilters = {
  classFilter: '',
  raceFilter: '',
  levelMin: '',
};

export function countVaultFilters(filters: VaultFilters): number {
  return [filters.classFilter, filters.raceFilter, filters.levelMin].filter(Boolean).length;
}

export interface HeroVaultFilterSheetProps {
  open: boolean;
  onClose: () => void;
  applied: VaultFilters;
  onApply: (filters: VaultFilters) => void;
  classes: string[];
  races: string[];
}

export function HeroVaultFilterSheet({
  open,
  onClose,
  applied,
  onApply,
  classes,
  races,
}: HeroVaultFilterSheetProps) {
  const [draft, setDraft] = useState<VaultFilters>(applied);

  useEffect(() => {
    if (open) setDraft(applied);
  }, [open, applied]);

  const setField = <K extends keyof VaultFilters>(key: K, value: VaultFilters[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const handleClear = () => {
    setDraft(emptyVaultFilters);
    onApply(emptyVaultFilters);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Fechar filtros"
        className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-filter-title"
        className="fixed inset-x-0 bottom-0 z-50 max-h-[min(88vh,640px)] overflow-y-auto rounded-t-2xl border-t border-dnd-gold/20 bg-dnd-obsidian shadow-[0_-16px_48px_rgba(0,0,0,0.5)] pb-[calc(1rem+var(--dnd-safe-bottom))] md:inset-x-auto md:right-4 md:bottom-4 md:left-auto md:w-[min(100%,24rem)] md:rounded-2xl md:border"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-dnd-gold/12 bg-dnd-obsidian px-4 py-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-dnd-gold" aria-hidden />
            <h2 id="vault-filter-title" className="font-display text-lg text-dnd-parchment">
              Filtrar heróis
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-dnd-parchment-muted transition hover:bg-dnd-mist hover:text-dnd-parchment"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-4">
          <div>
            <label className="mb-2 block font-ui text-xs font-medium uppercase tracking-wider text-dnd-parchment-muted">
              Classe
            </label>
            <select
              value={draft.classFilter}
              onChange={(e) => setField('classFilter', e.target.value)}
              className={hubSelectClassName}
              disabled={classes.length === 0}
            >
              <option value="">Todas as classes</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block font-ui text-xs font-medium uppercase tracking-wider text-dnd-parchment-muted">
              Raça
            </label>
            <select
              value={draft.raceFilter}
              onChange={(e) => setField('raceFilter', e.target.value)}
              className={hubSelectClassName}
              disabled={races.length === 0}
            >
              <option value="">Todas as raças</option>
              {races.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <DndInput
            label="Nível mínimo"
            type="number"
            min={1}
            max={20}
            value={draft.levelMin}
            onChange={(e) => setField('levelMin', e.target.value)}
            placeholder="Qualquer nível"
          />

          {classes.length === 0 && races.length === 0 ? (
            <p className="rounded-xl border border-dnd-gold/15 bg-dnd-obsidian-raised/60 px-3 py-2 font-ui text-xs text-dnd-parchment-muted">
              Crie heróis para liberar filtros por classe e raça.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-dnd-gold/12 px-4 py-4">
          <DndButton variant="ember" className="w-full" onClick={handleApply}>
            Aplicar filtros
          </DndButton>
          <DndButton variant="ghost" className="w-full" onClick={handleClear}>
            Limpar tudo
          </DndButton>
        </div>
      </div>
    </>
  );
}
