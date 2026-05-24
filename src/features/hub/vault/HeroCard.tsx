'use client';

import { BookOpen, Crown, Play, Shield, Trash2 } from 'lucide-react';
import type { Character, SessaoIA } from '@/types';
import { DndBadge, DndButton, DndCard } from '@/components/primitives';

export interface HeroCardProps {
  character: Character;
  onPlay: () => void;
  onDelete: () => void;
  onViewSessions?: () => void;
}

export function HeroCard({ character, onPlay, onDelete, onViewSessions }: HeroCardProps) {
  return (
    <DndCard padding="md" hover className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <DndBadge variant="ember" className="mb-2">
            Ficha de mesa
          </DndBadge>
          <h3 className="font-display text-xl text-dnd-parchment">{character.name}</h3>
          <p className="font-ui text-sm text-dnd-parchment-muted">
            {character.race} · {character.characterClass} · Nv. {character.level}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-2 text-dnd-parchment-muted transition hover:bg-dnd-danger/15 hover:text-dnd-danger"
          aria-label={`Excluir ${character.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-dnd-gold/20 px-2.5 py-1 font-ui text-[10px] text-dnd-parchment-muted">
          <Shield className="h-3 w-3" />
          CA {character.ac?.value ?? 10}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-dnd-gold/20 px-2.5 py-1 font-ui text-[10px] text-dnd-parchment-muted">
          <Crown className="h-3 w-3" />
          {character.background}
        </span>
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <DndButton variant="ember" size="sm" className="flex-1" onClick={onPlay}>
          <Play className="h-4 w-4" />
          Iniciar jornada
        </DndButton>
        {onViewSessions ? (
          <DndButton variant="goldOutline" size="sm" onClick={onViewSessions}>
            <BookOpen className="h-4 w-4" />
          </DndButton>
        ) : null}
      </div>
    </DndCard>
  );
}
