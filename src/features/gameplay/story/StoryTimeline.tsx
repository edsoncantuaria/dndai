'use client';

import { useMemo } from 'react';
import {
  BookOpen,
  BrainCircuit,
  Dice5,
  Hand,
  Image as ImageIcon,
  Sparkles,
  Swords,
} from 'lucide-react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import type { LogEntry } from '@/types';
import { DndCard } from '@/components/primitives';
import { cn } from '@/lib/utils';

function entryText(entry: LogEntry): string {
  const c = entry.content;
  if (typeof c === 'string') return c.slice(0, 160);
  if (c && typeof c === 'object') {
    if (typeof c.content === 'string') return c.content.slice(0, 160);
    if (typeof c.text === 'string') return c.text.slice(0, 160);
    if (typeof c.prompt === 'string') return c.prompt.slice(0, 160);
  }
  return '';
}

const kindMeta: Record<
  string,
  { icon: React.ReactNode; label: string; border: string }
> = {
  combat: {
    icon: <Swords className="h-3.5 w-3.5" />,
    label: 'Combate',
    border: 'border-dnd-ember/40',
  },
  roll: {
    icon: <Dice5 className="h-3.5 w-3.5" />,
    label: 'Rolagem',
    border: 'border-cyan-500/30',
  },
  narration: {
    icon: <BookOpen className="h-3.5 w-3.5" />,
    label: 'Narração',
    border: 'border-dnd-gold/20',
  },
  system: {
    icon: <Sparkles className="h-3.5 w-3.5" />,
    label: 'Sistema',
    border: 'border-dnd-parchment-muted/30',
  },
  insight: {
    icon: <BrainCircuit className="h-3.5 w-3.5" />,
    label: 'Insight',
    border: 'border-purple-400/30',
  },
  action: {
    icon: <Hand className="h-3.5 w-3.5" />,
    label: 'Ação',
    border: 'border-dnd-gold/30',
  },
  image: {
    icon: <ImageIcon className="h-3.5 w-3.5" />,
    label: 'Cena',
    border: 'border-dnd-gold/25',
  },
};

export function StoryTimeline({ limit = 24 }: { limit?: number }) {
  const { log } = useGameStateContext();

  const entries = useMemo(() => {
    return (log || [])
      .filter((e) => e && e.id && e.type !== 'action')
      .slice(-limit)
      .reverse()
      .map((entry) => ({
        id: entry.id,
        type: entry.type,
        text: entryText(entry),
        time: entry.timestamp,
      }))
      .filter((e) => e.text);
  }, [log, limit]);

  if (!entries.length) {
    return (
      <p className="py-4 text-center font-narrative text-sm italic text-dnd-parchment-muted">
        A crônica ainda não registrou eventos.
      </p>
    );
  }

  return (
    <div className="relative space-y-0 pl-4">
      <div className="absolute bottom-2 left-[7px] top-2 w-px bg-dnd-gold/25" aria-hidden />
      {entries.map((entry) => {
        const meta = kindMeta[entry.type] ?? kindMeta.narration;
        return (
          <div key={entry.id} className="relative pb-3">
            <span
              className={cn(
                'absolute -left-4 top-1 flex h-4 w-4 items-center justify-center rounded-full border bg-dnd-obsidian-raised text-dnd-gold',
                meta.border
              )}
            >
              {meta.icon}
            </span>
            <DndCard padding="sm" hover={false} className={cn('ml-2 border', meta.border)}>
              <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">
                {meta.label}
              </p>
              <p className="mt-0.5 font-narrative text-sm leading-snug text-dnd-parchment line-clamp-3">
                {entry.text}
              </p>
            </DndCard>
          </div>
        );
      })}
    </div>
  );
}
