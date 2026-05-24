'use client';

import { useCallback, useRef, useState } from 'react';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cn } from '@/lib/utils';

export interface HubHeroParallaxProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Parallax leve no bloco hero (desktop, mouse). Desligado com prefers-reduced-motion.
 */
export function HubHeroParallax({ children, className }: HubHeroParallaxProps) {
  const { isLgUp } = useBreakpoint();
  const reducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isLgUp || reducedMotion || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      setOffset({ x: nx * 10, y: ny * 6 });
    },
    [isLgUp, reducedMotion]
  );

  const onMouseLeave = useCallback(() => {
    setOffset({ x: 0, y: 0 });
  }, []);

  const enabled = isLgUp && !reducedMotion;

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      onMouseMove={enabled ? onMouseMove : undefined}
      onMouseLeave={enabled ? onMouseLeave : undefined}
    >
      {enabled ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-8 -z-10 opacity-60 transition-transform duration-300 ease-out"
          style={{
            transform: `translate(${offset.x * -0.5}px, ${offset.y * -0.5}px)`,
            background:
              'radial-gradient(ellipse 70% 50% at 30% 20%, rgba(201, 162, 39, 0.14), transparent 65%)',
          }}
        />
      ) : null}
      <div
        className={enabled ? 'transition-transform duration-300 ease-out' : undefined}
        style={enabled ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
