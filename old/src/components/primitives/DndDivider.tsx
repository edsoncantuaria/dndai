'use client';

import { cn } from '@/lib/utils';

export function DndDivider({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 py-2', className)} role="separator">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-dnd-gold/40 to-transparent" />
      <span className="rotate-45 text-dnd-gold text-xs" aria-hidden>
        ◆
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-dnd-gold/40 to-transparent" />
    </div>
  );
}
