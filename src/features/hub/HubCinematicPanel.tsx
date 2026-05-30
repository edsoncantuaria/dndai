'use client';

import type { ReactNode } from 'react';
import { CinematicBackdrop } from '@/components/cinematic';
import { cn } from '@/lib/utils';

export interface HubCinematicPanelProps {
  eyebrow: string;
  title: string;
  description?: string;
  image: string;
  imageAlt: string;
  children?: ReactNode;
  className?: string;
}

export function HubCinematicPanel({
  eyebrow,
  title,
  description,
  image,
  imageAlt,
  children,
  className,
}: HubCinematicPanelProps) {
  return (
    <section
      className={cn(
        'dnd-hero-card dnd-ornate-corners shadow-[var(--dnd-shadow-hero)]',
        className,
      )}
      aria-labelledby="hub-cinematic-title"
    >
      <span className="dnd-corner dnd-corner-tl" aria-hidden />
      <span className="dnd-corner dnd-corner-tr" aria-hidden />
      <span className="dnd-corner dnd-corner-bl" aria-hidden />
      <span className="dnd-corner dnd-corner-br" aria-hidden />
      <CinematicBackdrop
        image={image}
        imageAlt={imageAlt}
        intensity="strong"
        kenBurns
        className="min-h-[260px] sm:min-h-[300px]"
      >
        <div className="relative flex min-h-[260px] flex-col justify-end p-6 sm:min-h-[300px] sm:p-8">
          <div className="dnd-brand-accent-wide mb-4 max-w-[8rem]" aria-hidden />
          <p className="font-ui text-[11px] font-bold uppercase tracking-[0.28em] text-dnd-ember">
            {eyebrow}
          </p>
          <h2
            id="hub-cinematic-title"
            className="mt-2 font-display text-3xl leading-tight text-dnd-parchment drop-shadow-[0_2px_16px_rgba(0,0,0,0.8)] sm:text-4xl"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-3 max-w-2xl font-narrative text-sm leading-relaxed text-dnd-parchment-muted sm:text-base">
              {description}
            </p>
          ) : null}
          {children ? <div className="mt-6">{children}</div> : null}
        </div>
      </CinematicBackdrop>
    </section>
  );
}
