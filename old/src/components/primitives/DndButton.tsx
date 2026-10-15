'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

const dndButtonVariants = cva(
  'relative inline-flex min-h-[44px] items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-md font-ui text-sm font-medium transition-all duration-[var(--dnd-duration-ui)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dnd-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-dnd-obsidian disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        ember:
          'bg-dnd-ember text-white uppercase tracking-[0.08em] shadow-[0_6px_24px_var(--dnd-ember-muted)] hover:bg-dnd-ember-hover hover:shadow-[0_8px_28px_var(--dnd-ember-glow)] active:scale-[0.98]',
        goldOutline:
          'border border-dnd-gold/60 bg-transparent text-dnd-gold hover:border-dnd-gold hover:bg-dnd-gold/10',
        ghost:
          'bg-transparent text-dnd-parchment hover:bg-dnd-mist',
        parchment:
          'bg-dnd-parchment text-dnd-obsidian hover:bg-dnd-parchment-muted',
      },
      size: {
        sm: 'h-9 min-h-9 px-3 text-xs',
        default: 'h-11 px-5',
        lg: 'h-12 px-8 text-base',
        icon: 'h-11 w-11 min-h-11 p-0',
      },
    },
    defaultVariants: {
      variant: 'ember',
      size: 'default',
    },
  }
);

export interface DndButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof dndButtonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

type Ripple = { id: number; x: number; y: number };

const DndButton = React.forwardRef<HTMLButtonElement, DndButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading,
      children,
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const reducedMotion = usePrefersReducedMotion();
    const [ripples, setRipples] = React.useState<Ripple[]>([]);
    const Comp = asChild ? Slot : 'button';

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (
        variant === 'ember' &&
        !reducedMotion &&
        !disabled &&
        !loading &&
        e.currentTarget
      ) {
        const rect = e.currentTarget.getBoundingClientRect();
        const id = Date.now();
        setRipples((prev) => [
          ...prev,
          { id, x: e.clientX - rect.left, y: e.clientY - rect.top },
        ]);
        window.setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== id));
        }, 600);
      }
      onClick?.(e);
    };

    return (
      <Comp
        className={cn(dndButtonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        onClick={asChild ? onClick : handleClick}
        {...props}
      >
        {variant === 'ember' && !reducedMotion
          ? ripples.map((r) => (
              <span
                key={r.id}
                className="dnd-ember-ripple pointer-events-none absolute rounded-full bg-white/35"
                style={{
                  left: r.x,
                  top: r.y,
                  width: 8,
                  height: 8,
                  marginLeft: -4,
                  marginTop: -4,
                }}
                aria-hidden
              />
            ))
          : null}
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </Comp>
    );
  }
);
DndButton.displayName = 'DndButton';

export { DndButton, dndButtonVariants };
