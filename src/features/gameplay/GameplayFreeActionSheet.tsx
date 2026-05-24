'use client';

import { useEffect, useRef } from 'react';
import { DndButton, DndSheet, DndTextarea } from '@/components/primitives';

export interface GameplayFreeActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function GameplayFreeActionSheet({
  open,
  onOpenChange,
  value,
  onChange,
  onSubmit,
}: GameplayFreeActionSheetProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => textareaRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [open]);

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSubmit();
  };

  return (
    <DndSheet open={open} onOpenChange={onOpenChange} title="Ação livre">
      <p className="mb-4 font-narrative text-sm leading-relaxed text-dnd-parchment-muted">
        Descreva o que seu herói tenta fazer. O Mestre interpreta com base nas regras e na cena atual.
      </p>
      <DndTextarea
        ref={textareaRef}
        label="Descreva sua ação"
        placeholder="Ex.: investigo os símbolos na porta da taverna…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="min-h-[100px]"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />
      <p className="mt-2 font-ui text-[11px] text-dnd-parchment-muted/80">
        Ctrl+Enter para enviar
      </p>
      <div className="mt-5 flex gap-2">
        <DndButton variant="ghost" className="min-h-[48px] flex-1" onClick={() => onOpenChange(false)}>
          Cancelar
        </DndButton>
        <DndButton
          variant="ember"
          className="min-h-[48px] flex-1"
          onClick={handleSubmit}
          disabled={!value.trim()}
        >
          Enviar
        </DndButton>
      </div>
    </DndSheet>
  );
}
