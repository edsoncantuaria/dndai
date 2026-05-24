'use client';

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
  return (
    <DndSheet open={open} onOpenChange={onOpenChange} title="Ação livre">
      <DndTextarea
        label="Descreva sua ação"
        placeholder="O que seu herói faz?"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
      />
      <div className="mt-4 flex gap-2">
        <DndButton variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>
          Cancelar
        </DndButton>
        <DndButton variant="ember" className="flex-1" onClick={onSubmit} disabled={!value.trim()}>
          Enviar
        </DndButton>
      </div>
    </DndSheet>
  );
}
