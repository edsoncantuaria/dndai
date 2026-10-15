'use client';

import React, { useState } from 'react';
import type { ApiSpell } from '@/types';
import { Sparkles } from 'lucide-react';
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(spell, description);
  };

  const formBody = (
    <>
      {slotLevel && slotLevel > 0 ? (
        <DndCard padding="sm" hover={false} className="mb-4 border-dnd-gold/15">
          <p className={dndModalHintClass}>
            Espaço de magia nível {slotLevel}:{' '}
            {slotsBefore ? `${slotsBefore.current}/${slotsBefore.max}` : '—'}
          </p>
          <p className={'mt-1 ' + dndModalHintClass}>
            Ao confirmar, este espaço será consumido.
          </p>
        </DndCard>
      ) : (
        <p className={dndModalHintClass}>Truques não consomem espaços de magia.</p>
      )}
      <label htmlFor="spell-description" className={dndModalLabelClass}>
        Como você quer usar esta magia? (opcional)
      </label>
      <textarea
        id="spell-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className={dndModalFieldClass}
        placeholder='Ex: "no goblin mais próximo" ou "para criar uma ponte de gelo"'
      />
      <p className={'mt-2 ' + dndModalHintClass}>Deixe em branco para conjuração padrão.</p>
    </>
  );

  const footer = (
    <div className="flex flex-wrap justify-end gap-2">
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
    </div>
  );

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
};

export default SpellCastModal;
