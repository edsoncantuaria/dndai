'use client';

import React, { useState } from 'react';
import type { ApiSpell } from '@/types';
import { Sparkles } from 'lucide-react';
import { isUiV2Enabled } from '@/lib/uiV2';
import { DndButton } from '@/components/primitives';
import {
  DndGameModalShell,
  dndModalFieldClass,
  dndModalHintClass,
  dndModalLabelClass,
} from '@/features/gameplay/modals/DndGameModalShell';
import { DndCard } from '@/components/primitives';

interface SpellCastModalProps {
  spell: ApiSpell;
  slotLevel?: number;
  slotsBefore?: { current: number; max: number };
  onConfirm: (spell: ApiSpell, description: string) => void;
  onClose: () => void;
}

const SpellCastModal: React.FC<SpellCastModalProps> = ({
  spell,
  slotLevel,
  slotsBefore,
  onConfirm,
  onClose,
}) => {
  const [description, setDescription] = useState('');
  const isV2 = isUiV2Enabled();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(spell, description);
  };

  const formBody = (
    <>
      {slotLevel && slotLevel > 0 ? (
        <DndCard padding="sm" hover={false} className="mb-4 border-dnd-gold/15">
          <p className={isV2 ? dndModalHintClass : 'text-sm text-stone-300'}>
            Espaço de magia nível {slotLevel}:{' '}
            {slotsBefore ? `${slotsBefore.current}/${slotsBefore.max}` : '—'}
          </p>
          <p className={isV2 ? 'mt-1 ' + dndModalHintClass : 'mt-1 text-xs text-stone-500'}>
            Ao confirmar, este espaço será consumido.
          </p>
        </DndCard>
      ) : (
        <p className={isV2 ? dndModalHintClass : 'text-xs text-stone-500'}>
          Truques não consomem espaços de magia.
        </p>
      )}
      <label htmlFor="spell-description" className={isV2 ? dndModalLabelClass : 'mt-2 block text-stone-300'}>
        Como você quer usar esta magia? (opcional)
      </label>
      <textarea
        id="spell-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className={
          isV2
            ? dndModalFieldClass
            : 'mt-1 w-full rounded-md border border-stone-600 bg-stone-800 p-3 text-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500'
        }
        placeholder='Ex: "no goblin mais próximo" ou "para criar uma ponte de gelo"'
      />
      <p className={isV2 ? 'mt-2 ' + dndModalHintClass : 'text-xs text-stone-500'}>
        Deixe em branco para conjuração padrão.
      </p>
    </>
  );

  const footer = (
    <div className="flex flex-wrap justify-end gap-2">
      {isV2 ? (
        <>
          <DndButton type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </DndButton>
          <DndButton
            type="submit"
            form="spell-cast-form"
            variant="ember"
            disabled={Boolean(slotLevel && slotLevel > 0 && slotsBefore && slotsBefore.current <= 0)}
          >
            <Sparkles className="h-4 w-4" />
            Conjurar
          </DndButton>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-stone-700 px-6 py-2 font-semibold text-stone-200 hover:bg-stone-600"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="spell-cast-form"
            disabled={Boolean(slotLevel && slotLevel > 0 && slotsBefore && slotsBefore.current <= 0)}
            className="flex items-center gap-2 rounded-md bg-amber-600 px-6 py-2 font-semibold text-stone-900 hover:bg-amber-700 disabled:opacity-50"
          >
            Conjurar
            <Sparkles className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );

  if (isV2) {
    return (
      <form id="spell-cast-form" onSubmit={handleSubmit}>
        <DndGameModalShell
          eyebrow="Conjuração"
          title={spell.name}
          onClose={onClose}
          footer={footer}
          closeOnBackdrop
        >
          <div className="p-4 md:p-5">{formBody}</div>
        </DndGameModalShell>
      </form>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fadeIn items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col rounded-lg border border-amber-500 bg-stone-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-stone-700 p-4">
          <h2 className="font-garamond text-xl font-bold text-amber-300">Conjurar: {spell.name}</h2>
          <button type="button" onClick={onClose} className="text-2xl text-stone-400 hover:text-white">
            &times;
          </button>
        </header>
        <form id="spell-cast-form" onSubmit={handleSubmit}>
          <main className="space-y-4 p-6">{formBody}</main>
          <footer className="flex items-center justify-end gap-4 rounded-b-lg bg-stone-950/50 p-4">
            {footer}
          </footer>
        </form>
      </div>
    </div>
  );
};

export default SpellCastModal;
