'use client';

import { Scroll } from 'lucide-react';

export function SessionCover({ title }: { title: string }) {
  const initial = title.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="relative h-28 w-full overflow-hidden sm:h-32">
      <div
        className="absolute inset-0 bg-gradient-to-br from-dnd-ember/40 via-dnd-obsidian-raised to-dnd-gold/25"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 80%, rgba(201,162,39,0.35), transparent 50%)',
        }}
        aria-hidden
      />
      <div className="absolute inset-0 flex items-center justify-between px-4">
        <span className="font-display text-5xl font-bold text-dnd-gold/25">{initial}</span>
        <Scroll className="h-10 w-10 text-dnd-parchment/20" aria-hidden />
      </div>
    </div>
  );
}
