'use client';

import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

export interface AmbientBackgroundProps {
  variant?: 'ember' | 'midnight' | 'parchment' | 'cinematic';
  className?: string;
  showVignette?: boolean;
}

const gradients: Record<NonNullable<AmbientBackgroundProps['variant']>, string> = {
  cinematic: 'var(--dnd-bg-cinematic)',
  ember: [
    'radial-gradient(ellipse 100% 55% at 50% -15%, rgba(228, 7, 18, 0.32), transparent 60%)',
    'radial-gradient(ellipse 50% 40% at 100% 100%, rgba(212, 175, 55, 0.1), transparent)',
    'linear-gradient(180deg, #050506 0%, #0a0a0c 50%, #080608 100%)',
  ].join(', '),
  midnight: [
    'radial-gradient(ellipse 70% 50% at 20% 0%, rgba(72, 120, 200, 0.18), transparent)',
    'linear-gradient(160deg, #030408, #0a0a0c 60%, #021018)',
  ].join(', '),
  parchment: [
    'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(247, 240, 227, 0.06), transparent)',
    'linear-gradient(180deg, #050506, #14100c)',
  ].join(', '),
};

export function AmbientBackground({
  variant = 'cinematic',
  className,
  showVignette = true,
}: AmbientBackgroundProps) {
  const reducedMotion = usePrefersReducedMotion();
  const bg = gradients[variant];

  return (
    <div className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)} aria-hidden>
      <div className="absolute inset-0" style={{ background: bg }} />
      <div className="dnd-film-grain" aria-hidden />
      {!reducedMotion ? (
        <>
          <div
            className="absolute -left-1/4 top-0 h-[55vh] w-[70vw] rounded-full opacity-30 blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(228, 7, 18, 0.35) 0%, transparent 70%)',
              animation: 'dnd-ambient-drift 14s ease-in-out infinite alternate',
            }}
          />
          <div
            className="absolute -right-1/4 bottom-0 h-[40vh] w-[50vw] rounded-full opacity-25 blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(212, 175, 55, 0.2) 0%, transparent 70%)',
              animation: 'dnd-ambient-drift 18s ease-in-out infinite alternate-reverse',
            }}
          />
        </>
      ) : null}
      {showVignette ? (
        <div
          className="absolute inset-0"
          style={{
            boxShadow: 'inset 0 0 140px 50px rgba(0, 0, 0, 0.82)',
          }}
        />
      ) : null}
    </div>
  );
}
