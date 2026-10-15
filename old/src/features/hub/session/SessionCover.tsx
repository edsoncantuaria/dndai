'use client';

import { Scroll } from 'lucide-react';

export function SessionCover({ title }: { title: string }) {
  const initial = title.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="relative h-20 w-full overflow-hidden sm:h-24">
      <div
        className="absolute inset-0 bg-gradient-to-br from-dnd-ember/25 via-dnd-obsidian-raised to-dnd-gold/15"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 85% 20%, rgba(201,162,39,0.2), transparent 55%)',
        }}
        aria-hidden
      />
      <div className="absolute inset-0 flex items-center justify-between px-4">
        <span className="font-display text-4xl font-bold text-dnd-gold/20 sm:text-5xl">{initial}</span>
        <Scroll className="h-8 w-8 text-dnd-parchment/15 sm:h-9 sm:w-9" aria-hidden />
      </div>
    </div>
  );
}
