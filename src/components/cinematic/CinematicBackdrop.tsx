'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

export interface CinematicBackdropProps {
  image: string;
  imageAlt?: string;
  /** Quão escuro o overlay (legibilidade do texto). */
  intensity?: 'light' | 'medium' | 'strong';
  /** Pan/zoom lento na imagem (estilo trailer). */
  kenBurns?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const overlayByIntensity = {
  light:
    'bg-gradient-to-b from-dnd-obsidian/55 via-dnd-obsidian/75 to-dnd-obsidian/92',
  medium:
    'bg-gradient-to-b from-dnd-obsidian/70 via-dnd-obsidian/82 to-dnd-obsidian/95',
  strong:
    'bg-gradient-to-t from-dnd-obsidian via-dnd-obsidian/88 to-dnd-obsidian/55',
};

export function CinematicBackdrop({
  image,
  imageAlt = '',
  intensity = 'medium',
  kenBurns = true,
  className,
  children,
}: CinematicBackdropProps) {
  const reducedMotion = usePrefersReducedMotion();
  const animate = kenBurns && !reducedMotion;

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div className="absolute inset-0" aria-hidden>
        <Image
          src={image}
          alt=""
          fill
          priority
          sizes="100vw"
          className={cn(
            'object-cover object-center',
            animate && 'motion-safe:animate-dnd-ken-burns'
          )}
        />
        <div className={cn('absolute inset-0', overlayByIntensity[intensity])} />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(228, 7, 18, 0.22), transparent 55%)',
          }}
        />
        <div className="dnd-film-grain opacity-[0.06]" />
        <div
          className="absolute inset-0"
          style={{ boxShadow: 'inset 0 0 100px 40px rgba(0, 0, 0, 0.65)' }}
        />
      </div>
      {children ? <div className="relative z-10">{children}</div> : null}
      <span className="sr-only">{imageAlt}</span>
    </div>
  );
}
