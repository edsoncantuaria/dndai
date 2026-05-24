'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { getBeatImage, beatChapterLabel, type NarrativeBeatVisual } from '@/lib/cinematicAssets';

export interface NarrativeBeatCardProps {
  type: NarrativeBeatVisual;
  children: React.ReactNode;
  className?: string;
  /** Faixa de imagem no topo (altura). */
  stripHeight?: 'sm' | 'md';
}

const stripHeights = {
  sm: 'h-[4.5rem]',
  md: 'h-[5.5rem]',
};

export function NarrativeBeatCard({
  type,
  children,
  className,
  stripHeight = 'sm',
}: NarrativeBeatCardProps) {
  const image = getBeatImage(type);
  const label = beatChapterLabel[type];

  const accentBorder =
    type === 'combat'
      ? 'border-dnd-ember/25'
      : type === 'insight'
        ? 'border-purple-500/20'
        : type === 'system'
          ? 'border-dnd-gold/25'
          : 'border-dnd-gold/12';

  return (
    <article
      className={cn(
        'overflow-hidden rounded-xl border bg-dnd-obsidian-raised/40 shadow-[var(--dnd-shadow-card)]',
        accentBorder,
        className
      )}
    >
      <div className={cn('relative w-full overflow-hidden', stripHeights[stripHeight])}>
        <Image src={image} alt="" fill sizes="(max-width: 768px) 100vw, 640px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-dnd-obsidian via-dnd-obsidian/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-dnd-obsidian/30 to-transparent" />
        <p className="absolute bottom-2 left-3 font-ui text-[9px] font-bold uppercase tracking-[0.32em] text-dnd-ember">
          {label}
        </p>
      </div>
      <div className="px-4 py-3.5">{children}</div>
    </article>
  );
}
