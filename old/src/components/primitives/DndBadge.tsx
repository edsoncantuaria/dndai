'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 font-ui text-[10px] font-semibold uppercase tracking-wider',
  {
    variants: {
      variant: {
        default: 'bg-dnd-gold/15 text-dnd-gold border border-dnd-gold/30',
        ember: 'bg-dnd-ember/20 text-dnd-ember border border-dnd-ember/40',
        success: 'bg-dnd-success/20 text-emerald-300 border border-dnd-success/40',
        danger: 'bg-dnd-danger/20 text-red-300 border border-dnd-danger/40',
        muted: 'bg-dnd-mist text-dnd-parchment-muted',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface DndBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function DndBadge({ className, variant, ...props }: DndBadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
