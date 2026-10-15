'use client';

import React, { useState } from 'react';
import { Dice5 } from 'lucide-react';
import { DndButton, DndCard } from '@/components/primitives';
import {
  DndGameModalShell,
  dndModalFieldClass,
  dndModalHintClass,
  dndModalLabelClass,
} from '@/features/gameplay/modals/DndGameModalShell';

interface SkillCheckModalProps {
  skillName: string;
  promptHint?: string;
  onConfirm: (description: string) => void;
  onClose: () => void;
}

const SkillCheckModal: React.FC<SkillCheckModalProps> = ({
  skillName,
  promptHint,
  onConfirm,
  onClose,
}) => {
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(description);
  };

  const formBody = (
    <>
      {promptHint ? (
        <DndCard padding="sm" hover={false} className="mb-4 border-dnd-gold/25 bg-dnd-gold/5">
          <p className={dndModalHintClass}>
            <span className="text-dnd-gold">Sugestão do mestre:</span> {promptHint}
          </p>
        </DndCard>
      ) : null}
      <label htmlFor="skill-description" className={dndModalLabelClass}>
        Como você quer usar esta perícia?
      </label>
      <textarea
        id="skill-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
        className={dndModalFieldClass}
        placeholder='Ex: "para intimidar o guarda" ou "para procurar armadilhas"'
      />
      <p className={dndModalHintClass}>Deixe em branco para uma tentativa geral.</p>
    </>
  );

  const footer = (
    <div className="flex flex-wrap justify-end gap-2">
      <DndButton type="button" variant="ghost" onClick={onClose}>
        Cancelar
      </DndButton>
      <DndButton type="submit" form="skill-check-form" variant="ember">
        <Dice5 className="h-4 w-4" />
        Confirmar
      </DndButton>
    </div>
  );

  return (
    <form id="skill-check-form" onSubmit={handleSubmit}>
      <DndGameModalShell
        eyebrow="Teste de perícia"
        title={skillName}
        onClose={onClose}
        footer={footer}
      >
        <div className="p-4 md:p-5">{formBody}</div>
      </DndGameModalShell>
    </form>
  );
};

export default SkillCheckModal;
