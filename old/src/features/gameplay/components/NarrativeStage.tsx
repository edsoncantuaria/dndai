'use client';

import { DndCard, DndDivider } from '@/components/primitives';
import { cn } from '@/lib/utils';

export interface NarrativeEntry {
  id: string;
  text: string;
  kind?: 'narration' | 'dialogue' | 'system';
}

export interface NarrativeStageProps {
  entries: NarrativeEntry[];
  className?: string;
}

export function NarrativeStage({ entries, className }: NarrativeStageProps) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-3 py-4 md:px-5',
        className
      )}
    >
      {entries.map((entry, index) => (
        <article key={entry.id} className="animate-fadeInSlideUp" style={{ animationDelay: `${index * 80}ms` }}>
          <DndCard padding="md" hover={false} className="border-dnd-gold/10">
            {entry.kind === 'dialogue' ? (
              <p className="font-narrative text-lg italic leading-relaxed text-dnd-parchment">
                &ldquo;{entry.text}&rdquo;
              </p>
            ) : entry.kind === 'system' ? (
              <p className="font-ui text-xs uppercase tracking-wider text-dnd-parchment-muted">{entry.text}</p>
            ) : (
              <p className="font-narrative text-base leading-relaxed text-dnd-parchment md:text-lg">
                {entry.text}
              </p>
            )}
          </DndCard>
          {index < entries.length - 1 ? <DndDivider className="my-1 opacity-50" /> : null}
        </article>
      ))}
    </div>
  );
}
