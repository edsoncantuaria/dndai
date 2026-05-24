'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DndTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const DndTextarea = React.forwardRef<HTMLTextAreaElement, DndTextareaProps>(
  ({ className, label, id, ...props }, ref) => {
    const areaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex w-full flex-col gap-1.5">
        {label ? (
          <label htmlFor={areaId} className="font-ui text-xs uppercase tracking-wider text-dnd-parchment-muted">
            {label}
          </label>
        ) : null}
        <textarea
          id={areaId}
          ref={ref}
          className={cn(
            'min-h-[120px] w-full resize-y rounded-md border border-dnd-gold/25 bg-dnd-obsidian-raised/90 px-4 py-3',
            'font-narrative text-base leading-relaxed text-dnd-parchment placeholder:text-dnd-parchment-muted/60',
            'transition-colors duration-[var(--dnd-duration-ui)]',
            'focus:border-dnd-gold/60 focus:outline-none focus:ring-2 focus:ring-dnd-gold/25',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
DndTextarea.displayName = 'DndTextarea';
