'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const headingVariants = cva('text-dnd-parchment', {
  variants: {
    variant: {
      hero: 'font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-5xl lg:text-7xl dnd-text-gradient-gold drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)]',
      section: 'font-display text-xl font-bold tracking-wide md:text-2xl lg:text-3xl text-dnd-gold',
      label: 'font-ui text-[11px] font-bold uppercase tracking-[0.28em] text-dnd-ember',
    },
  },
  defaultVariants: {
    variant: 'section',
  },
});

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'p';

export interface DndHeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  as?: HeadingTag;
}

export function DndHeading({ className, variant, as, children, ...props }: DndHeadingProps) {
  const Tag = as ?? (variant === 'hero' ? 'h1' : variant === 'label' ? 'p' : 'h2');
  return (
    <Tag className={cn(headingVariants({ variant }), className)} {...props}>
      {children}
    </Tag>
  );
}
