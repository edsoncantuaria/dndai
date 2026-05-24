'use client';

import { cn } from '@/lib/utils';

export function LoadingOracle({ label = 'O oráculo consulta os dados do destino…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 py-12', className)}>
      <div className="relative h-16 w-16">
        <span className="absolute inset-0 animate-ping rounded-full border border-dnd-gold/30" />
        <span className="absolute inset-2 animate-pulse rounded-full border-2 border-dnd-gold/60" />
        <span className="absolute inset-0 flex items-center justify-center font-display text-2xl text-dnd-gold">
          ᚱ
        </span>
      </div>
      <p className="max-w-xs text-center font-narrative text-sm italic text-dnd-parchment-muted">{label}</p>
    </div>
  );
}
