'use client';

import { BookOpen, Pencil, Play, Trash2 } from 'lucide-react';
import type { Character } from '@/types';
import { DndButton, DndCard } from '@/components/primitives';
import { cn } from '@/lib/utils';

export interface HeroCardProps {
  character: Character;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewSessions?: () => void;
}

function heroInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function HeroCard({ character, onPlay, onEdit, onDelete, onViewSessions }: HeroCardProps) {
  const initials = heroInitials(character.name);

  return (
    <DndCard
      padding="none"
      hover
      className="group relative flex flex-col overflow-hidden border-dnd-gold/20 bg-dnd-obsidian-raised/70"
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-dnd-ember/90 via-dnd-gold/70 to-transparent opacity-80"
        aria-hidden
      />

      <div className="flex flex-1 flex-col p-4 md:p-5">
        <div className="flex gap-4">
          <div
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
              'bg-gradient-to-br from-dnd-gold/20 to-dnd-ember/10',
              'font-display text-lg tracking-wide text-dnd-gold ring-1 ring-dnd-gold/20'
            )}
            aria-hidden
          >
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-display text-xl text-dnd-parchment">{character.name}</h3>
                <p className="mt-0.5 truncate font-ui text-sm text-dnd-parchment/85">
                  {character.race} · {character.characterClass}
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-dnd-gold/12 px-2 py-1 font-ui text-xs font-semibold tabular-nums text-dnd-gold">
                Nv. {character.level}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-md border border-dnd-gold/10 bg-dnd-obsidian/80 px-2 py-0.5 font-ui text-[11px] text-dnd-parchment/80">
                CA {character.ac?.value ?? 10}
              </span>
              {character.background ? (
                <span className="max-w-[10rem] truncate rounded-md border border-dnd-gold/10 bg-dnd-obsidian/80 px-2 py-0.5 font-ui text-[11px] text-dnd-parchment/80">
                  {character.background}
                </span>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onDelete}
            className="-mr-1 shrink-0 rounded-lg p-2 text-dnd-parchment-muted opacity-60 transition hover:bg-dnd-danger/12 hover:text-dnd-danger hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
            aria-label={`Excluir ${character.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex gap-2">
          <DndButton variant="ember" size="sm" className="min-h-[44px] flex-1" onClick={onPlay}>
            <Play className="h-4 w-4" />
            Jogar
          </DndButton>
          <DndButton
            variant="goldOutline"
            size="sm"
            className="min-h-[44px] min-w-[44px] px-3"
            onClick={onEdit}
            aria-label={`Editar ${character.name}`}
          >
            <Pencil className="h-4 w-4" />
          </DndButton>
          {onViewSessions ? (
            <DndButton
              variant="goldOutline"
              size="sm"
              className="min-h-[44px] min-w-[44px] px-3"
              onClick={onViewSessions}
              aria-label="Ver sessões"
            >
              <BookOpen className="h-4 w-4" />
            </DndButton>
          ) : null}
        </div>
      </div>
    </DndCard>
  );
}
