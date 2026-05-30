'use client';

import { ScrollText } from 'lucide-react';
import { DndCard } from '@/components/primitives';
import type { PenaiStoryEntry } from '@/hooks/usePenaiTurnPipeline';

export function PenaiStoryFeed({ entries }: { entries: PenaiStoryEntry[] }) {
    return (
        <DndCard padding="md" hover={false}>
            <p className="flex items-center gap-2 font-ui text-[10px] uppercase tracking-wider text-dnd-gold">
                <ScrollText className="h-4 w-4" />
                Crônica ao vivo (PENAI)
            </p>
            <div className="mt-3 max-h-[320px] space-y-3 overflow-y-auto pr-1">
                {entries.length === 0 ? (
                    <p className="text-xs text-dnd-parchment/60">
                        Aguardando narração do motor PENAI…
                    </p>
                ) : (
                    entries.map((entry, i) => (
                        <article
                            key={`story-${i}-${entry.timestamp}`}
                            className="rounded border border-dnd-gold/10 bg-black/25 px-3 py-2"
                        >
                            <header className="text-[10px] uppercase tracking-wide text-dnd-gold/90">
                                [{entry.timestamp}]
                                {entry.tone ? ` · ${entry.tone}` : ''}
                            </header>
                            <p className="mt-1 text-sm leading-relaxed text-dnd-parchment">
                                {entry.content}
                            </p>
                            {entry.consequences && entry.consequences.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {entry.consequences.map((chip, j) => (
                                        <span
                                            key={`c-${j}`}
                                            className="rounded-full border border-amber-700/40 bg-amber-950/40 px-2 py-0.5 text-[10px] text-amber-200"
                                        >
                                            {chip}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                        </article>
                    ))
                )}
            </div>
        </DndCard>
    );
}
