'use client';

import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

export interface AmbientBackgroundProps {
  variant?: 'ember' | 'midnight' | 'parchment';
  className?: string;
  showVignette?: boolean;
}

const gradients = {
  ember: [
    'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(196, 30, 58, 0.35), transparent)',
    'radial-gradient(ellipse 60% 40% at 100% 100%, rgba(201, 162, 39, 0.12), transparent)',
    'linear-gradient(180deg, #0a0a0c 0%, #141418 45%, #0a0a0c 100%)',
  ].join(', '),
  midnight: [
    'radial-gradient(ellipse 70% 50% at 20% 0%, rgba(72, 120, 200, 0.2), transparent)',
    'linear-gradient(160deg, #05070d, #0a0a0c 60%, #021018)',
  ].join(', '),
  parchment: [
    'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(244, 232, 208, 0.08), transparent)',
    'linear-gradient(180deg, #0a0a0c, #1a1510)',
  ].join(', '),
};

export function AmbientBackground({
  variant = 'ember',
  className,
  showVignette = true,
}: AmbientBackgroundProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)} aria-hidden>
      <div
        className="absolute inset-0"
        style={{ background: gradients[variant] }}
      />
      {!reducedMotion ? (
        <div
          className="absolute inset-0 opacity-40 animate-pulse"
          style={{
            background:
              'radial-gradient(circle at 30% 70%, rgba(201, 162, 39, 0.06) 0%, transparent 50%)',
            animationDuration: '8s',
          }}
        />
      ) : null}
      {showVignette ? (
        <div
          className="absolute inset-0"
          style={{
            boxShadow: 'inset 0 0 120px 40px rgba(0, 0, 0, 0.75)',
          }}
        />
      ) : null}
    </div>
  );
}
