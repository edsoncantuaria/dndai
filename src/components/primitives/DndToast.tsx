'use client';

import { cn } from '@/lib/utils';
import { DndCard } from './DndCard';

export interface DndToastProps {
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'danger';
  onDismiss?: () => void;
}

const variantBorder = {
  default: 'border-dnd-gold/30',
  success: 'border-dnd-success/50',
  danger: 'border-dnd-danger/50',
};

export function DndToast({ title, description, variant = 'default', onDismiss }: DndToastProps) {
  return (
    <DndCard padding="sm" className={cn('min-w-[280px] max-w-sm', variantBorder[variant])}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-sm text-dnd-gold">{title}</p>
          {description ? (
            <p className="mt-1 font-ui text-xs text-dnd-parchment-muted">{description}</p>
          ) : null}
        </div>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} className="text-dnd-parchment-muted hover:text-dnd-parchment">
            ×
          </button>
        ) : null}
      </div>
    </DndCard>
  );
}
