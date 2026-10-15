'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

export interface DndCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = {
  none: '',
  sm: 'p-3',
  md: 'p-4 md:p-5',
  lg: 'p-6 md:p-8',
};

export function DndCard({
  className,
  hover = false,
  padding = 'md',
  children,
  ...props
}: DndCardProps) {
  const reducedMotion = usePrefersReducedMotion();
  const hoverEnabled = hover && !reducedMotion;

  return (
    <div
      className={cn(
        'dnd-border-gold dnd-surface-glass rounded-lg',
        'shadow-[var(--dnd-shadow-card)]',
        paddingMap[padding],
        hoverEnabled &&
          'transition-transform duration-[var(--dnd-duration-ui)] hover:-translate-y-0.5 hover:shadow-[var(--dnd-shadow-elevated)]',
        hover && reducedMotion && 'transition-shadow duration-[var(--dnd-duration-ui)] hover:shadow-[var(--dnd-shadow-elevated)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
