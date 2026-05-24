'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const headingVariants = cva('text-dnd-parchment', {
  variants: {
    variant: {
      hero: 'font-display text-3xl font-bold tracking-wide md:text-5xl lg:text-6xl dnd-text-gradient-gold',
      section: 'font-display text-xl font-bold tracking-wide md:text-2xl text-dnd-gold',
      label: 'font-ui text-xs font-semibold uppercase tracking-[0.2em] text-dnd-parchment-muted',
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
