'use client';

import React, { useState } from 'react';
import { Dice5 } from 'lucide-react';
import { isUiV2Enabled } from '@/lib/uiV2';
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
  const isV2 = isUiV2Enabled();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(description);
  };

  const formBody = (
    <>
      {promptHint ? (
        isV2 ? (
          <DndCard padding="sm" hover={false} className="mb-4 border-dnd-gold/25 bg-dnd-gold/5">
            <p className={dndModalHintClass}>
              <span className="text-dnd-gold">Sugestão do mestre:</span> {promptHint}
            </p>
          </DndCard>
        ) : (
          <p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            Sugestão do Mestre: {promptHint}
          </p>
        )
      ) : null}
      <label htmlFor="skill-description" className={isV2 ? dndModalLabelClass : 'text-xs uppercase tracking-[0.35em] text-stone-400'}>
        Como você quer usar esta perícia?
      </label>
      <textarea
        id="skill-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
        className={
          isV2
            ? dndModalFieldClass
            : 'w-full rounded-2xl border border-white/15 bg-black/40 p-3 text-stone-100 focus:border-transparent focus:ring-2 focus:ring-amber-400'
        }
        placeholder='Ex: "para intimidar o guarda" ou "para procurar armadilhas"'
      />
      <p className={isV2 ? dndModalHintClass : 'text-xs text-stone-500'}>Deixe em branco para uma tentativa geral.</p>
    </>
  );

  const footer = (
    <div className="flex flex-wrap justify-end gap-2">
      {isV2 ? (
        <>
          <DndButton type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </DndButton>
          <DndButton type="submit" form="skill-check-form" variant="ember">
            <Dice5 className="h-4 w-4" />
            Confirmar
          </DndButton>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 px-5 py-2 text-stone-200 hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="skill-check-form"
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-2 font-semibold text-stone-900"
          >
            Confirmar
            <Dice5 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );

  if (isV2) {
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
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fadeIn items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-[#080b12]/95 shadow-[0_40px_80px_rgba(0,0,0,0.65)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.5em] text-amber-300">Teste de perícia</p>
            <h2 className="mt-1 font-serif text-2xl text-white">{skillName}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/20 p-2 text-stone-300">
            &times;
          </button>
        </header>
        <form id="skill-check-form" onSubmit={handleSubmit}>
          <main className="space-y-4 p-6 text-sm text-stone-200">{formBody}</main>
          <footer className="flex flex-wrap justify-end gap-3 border-t border-white/10 bg-white/5 p-6">
            {footer}
          </footer>
        </form>
      </div>
    </div>
  );
};

export default SkillCheckModal;
