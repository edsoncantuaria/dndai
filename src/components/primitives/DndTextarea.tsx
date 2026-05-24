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
            'dnd-field min-h-[120px] w-full resize-y rounded-xl border px-4 py-3',
            'font-narrative text-base leading-relaxed',
            'shadow-inner transition-colors duration-[var(--dnd-duration-ui)]',
            'focus:outline-none focus:ring-2 focus:ring-dnd-gold/25',
            className
          )}
          style={{ colorScheme: 'dark' }}
          {...props}
        />
      </div>
    );
  }
);
DndTextarea.displayName = 'DndTextarea';
