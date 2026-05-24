'use client';

import type { SessaoIA } from '@/types';
import { DndButton } from '@/components/primitives';
import { Plus, Scroll } from 'lucide-react';
import { SessionCard } from './SessionCard';

export interface SessionGridProps {
  sessions: SessaoIA[];
  onPlay: (sessionId: number) => void;
  onManage: (session: SessaoIA) => void;
  onCreateHero?: () => void;
  emptyTitle?: string;
  compact?: boolean;
}

export function SessionGrid({
  sessions,
  onPlay,
  onManage,
  onCreateHero,
  emptyTitle = 'Nenhuma crônica ainda',
  compact,
}: SessionGridProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-dnd-gold/20 bg-dnd-obsidian-raised/30 px-6 py-14 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-dnd-gold/10 text-dnd-gold">
          <Scroll className="h-7 w-7" aria-hidden />
        </div>
        <h3 className="font-display text-xl text-dnd-parchment">{emptyTitle}</h3>
        <p className="mt-2 max-w-sm font-narrative text-sm leading-relaxed text-dnd-parchment-muted">
          Crie um herói no cofre e abra a primeira mesa — sua história começa com um único passo.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {onCreateHero ? (
            <DndButton variant="ember" onClick={onCreateHero}>
              <Plus className="h-4 w-4" />
              Criar herói
            </DndButton>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          compact={compact}
          onPlay={() => onPlay(session.id)}
          onManage={() => onManage(session)}
        />
      ))}
    </div>
  );
}
