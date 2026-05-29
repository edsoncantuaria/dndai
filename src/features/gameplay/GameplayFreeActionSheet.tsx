'use client';

import { useEffect, useRef } from 'react';
import { DndButton, DndSheet, DndTextarea } from '@/components/primitives';
import { cn } from '@/lib/utils';

export interface GameplayFreeActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function GameplayFreeActionSheet({
  open,
  onOpenChange,
  value,
  onChange,
  onSubmit,
  disabled,
}: GameplayFreeActionSheetProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => textareaRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [open]);

  const handleSubmit = () => {
    if (disabled) return;
    if (!value.trim()) return;
    onSubmit();
  };

  return (
    <DndSheet open={open} onOpenChange={onOpenChange} title="Ação livre">
      {disabled ? (
        <div className="mb-3 rounded-lg border border-dnd-gold/15 bg-dnd-obsidian/70 px-3 py-2 text-center font-ui text-xs text-dnd-parchment-muted">
          Input bloqueado: aguarde o Mestre concluir a última ação.
        </div>
      ) : null}
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
        className={cn('min-h-[100px]', disabled && 'opacity-60')}
        disabled={disabled}
        onKeyDown={(e) => {
          if (disabled) return;
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
          disabled={Boolean(disabled) || !value.trim()}
        >
          Enviar
        </DndButton>
      </div>
    </DndSheet>
  );
}
