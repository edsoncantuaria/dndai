'use client';

import type { SessaoIA } from '@/types';
import { DndButton } from '@/components/primitives';
import { Plus, Sparkles } from 'lucide-react';
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
  emptyTitle = 'Nenhuma crônica iniciada',
  compact,
}: SessionGridProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-dnd-gold/25 bg-dnd-mist px-6 py-16 text-center">
        <Sparkles className="mb-4 h-12 w-12 text-dnd-gold/50" />
        <h3 className="font-display text-2xl text-dnd-parchment">{emptyTitle}</h3>
        <p className="mt-2 max-w-md font-narrative text-dnd-parchment-muted">
          Nenhuma crônica iniciada — forje seu destino. Crie um herói no cofre e abra a primeira mesa.
        </p>
        {onCreateHero ? (
          <DndButton variant="ember" className="mt-6" onClick={onCreateHero}>
            <Plus className="h-4 w-4" />
            Forjar primeiro herói
          </DndButton>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
