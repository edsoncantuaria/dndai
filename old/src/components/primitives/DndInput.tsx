'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DndInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const DndInput = React.forwardRef<HTMLInputElement, DndInputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex w-full flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="font-ui text-xs font-semibold uppercase tracking-wider text-dnd-parchment"
          >
            {label}
          </label>
        ) : null}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'dnd-input-field min-h-[44px] w-full rounded-md border px-4 py-2',
            'border-dnd-gold/40 bg-dnd-obsidian-raised text-dnd-parchment',
            'font-ui text-base shadow-inner',
            'placeholder:text-dnd-parchment-muted',
            'transition-colors duration-[var(--dnd-duration-ui)]',
            'focus:border-dnd-gold focus:outline-none focus:ring-2 focus:ring-dnd-gold/35',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-dnd-danger focus:border-dnd-danger focus:ring-dnd-danger/30',
            className
          )}
          {...props}
        />
        {error ? <p className="font-ui text-xs text-dnd-danger">{error}</p> : null}
      </div>
    );
  }
);
DndInput.displayName = 'DndInput';
