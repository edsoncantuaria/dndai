'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DndTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface DndTabsProps {
  items: DndTabItem[];
  value: string;
  onValueChange: (id: string) => void;
  className?: string;
  variant?: 'default' | 'bottomNav';
}

export function DndTabs({ items, value, onValueChange, className, variant = 'default' }: DndTabsProps) {
  return (
    <div
      className={cn(
        'flex gap-1',
        variant === 'bottomNav' && 'justify-around border-t border-dnd-gold/15 bg-dnd-obsidian-glass pb-[var(--dnd-safe-bottom)] pt-1',
        variant === 'default' && 'border-b border-dnd-gold/15',
        className
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(item.id)}
            className={cn(
              'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-2 font-ui text-[10px] uppercase tracking-wide transition-colors duration-[var(--dnd-duration-ui)] md:flex-row md:gap-2 md:text-xs',
              active ? 'text-dnd-gold' : 'text-dnd-parchment-muted hover:text-dnd-parchment'
            )}
          >
            {item.icon ? <span className="text-base md:text-sm">{item.icon}</span> : null}
            <span>{item.label}</span>
            {active && variant === 'default' ? (
              <span className="absolute bottom-0 hidden h-0.5 w-full bg-dnd-gold md:block" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
