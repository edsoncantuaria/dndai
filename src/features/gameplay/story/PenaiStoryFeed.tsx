'use client';

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ScrollText, Volume2 } from 'lucide-react';
import { DndCard } from '@/components/primitives';
import type { PenaiStoryEntry } from '@/hooks/usePenaiTurnPipeline';
import { speakStoryParagraph } from '@/lib/penaiStoryTts';
import {
    formatStoryTimestamp,
    splitStoryParagraphs,
    storyEntryLabel,
} from './penaiStoryFormat';
import { isVisibleStoryEntry } from './storyEntryVisibility';

export { isVisibleStoryEntry } from './storyEntryVisibility';

const entryMotion = {
    hidden: { opacity: 0, y: 10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    },
};

const paragraphMotion = {
    hidden: { opacity: 0, y: 6 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: 0.08 + i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    }),
};

function StoryEntryBlock({ entry }: { entry: PenaiStoryEntry }) {
    const paragraphs = splitStoryParagraphs(entry.content);
    const timeMark = formatStoryTimestamp(entry.timestamp);
    const [speaking, setSpeaking] = useState(false);

    const handleSpeak = useCallback(async () => {
        if (speaking || !paragraphs.length) return;
        setSpeaking(true);
        try {
            for (const para of paragraphs) {
                await speakStoryParagraph(para);
            }
        } catch {
            /* TTS opcional — servidor pode estar sem Piper */
        } finally {
            setSpeaking(false);
        }
    }, [paragraphs, speaking]);

    return (
        <motion.article
            className="group relative border-l-2 border-dnd-gold/35 pl-4 pr-1 py-1"
            initial="hidden"
            animate="visible"
            variants={entryMotion}
        >
            <header className="mb-2 flex flex-wrap items-center gap-2">
                <time className="font-ui text-[10px] tabular-nums tracking-wide text-dnd-parchment-muted">
                    {timeMark}
                </time>
                <span className="rounded border border-dnd-gold/20 bg-dnd-obsidian-raised/80 px-1.5 py-0.5 font-ui text-[9px] uppercase tracking-widest text-dnd-gold/90">
                    {storyEntryLabel(entry)}
                </span>
                <button
                    type="button"
                    onClick={() => void handleSpeak()}
                    disabled={speaking}
                    className="ml-auto inline-flex items-center gap-1 rounded border border-dnd-gold/15 bg-dnd-obsidian-raised/60 px-2 py-0.5 font-ui text-[10px] text-dnd-parchment-muted opacity-0 transition-opacity hover:border-dnd-gold/40 hover:text-dnd-gold group-hover:opacity-100 focus:opacity-100"
                    aria-label="Ouvir narração"
                >
                    {speaking ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                        <Volume2 className="h-3 w-3" />
                    )}
                    TTS
                </button>
            </header>
            <div className="space-y-3 font-narrative text-[16px] leading-[1.75] text-dnd-parchment md:text-[17px]">
                {paragraphs.map((para, i) => (
                    <motion.p
                        key={`${entry.id ?? entry.timestamp}-p-${i}`}
                        custom={i}
                        initial="hidden"
                        animate="visible"
                        variants={paragraphMotion}
                    >
                        {para}
                    </motion.p>
                ))}
            </div>
            {entry.consequences && entry.consequences.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-dnd-gold/10 pt-3">
                    {entry.consequences.map((chip, j) => (
                        <li
                            key={`c-${j}`}
                            className="list-none rounded-full border border-dnd-ember/30 bg-dnd-ember/10 px-2.5 py-0.5 font-ui text-[10px] text-dnd-parchment-muted"
                        >
                            {chip}
                        </li>
                    ))}
                </ul>
            ) : null}
        </motion.article>
    );
}

export function PenaiStoryFeed({
    entries,
    variant = 'card',
    narrationPending = false,
    hydrated = true,
    workflowId = null,
}: {
    entries: PenaiStoryEntry[];
    variant?: 'card' | 'main';
    narrationPending?: boolean;
    hydrated?: boolean;
    workflowId?: string | null;
}) {
    const visible = entries.filter(isVisibleStoryEntry);

    const pendingHint =
        narrationPending && visible.length > 0 ? (
            <div
                className="flex items-center gap-2 rounded-lg border border-dnd-gold/25 bg-dnd-obsidian-raised/80 px-3 py-2"
                role="status"
            >
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-dnd-gold" />
                <p className="font-ui text-[11px] text-dnd-parchment-muted">
                    O Mestre narra via Temporal
                    {workflowId ? ` · ${workflowId.split(':').pop()}` : ''}…
                </p>
            </div>
        ) : null;

    const list =
        visible.length === 0 ? (
            !hydrated || narrationPending ? (
                <div
                    className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dnd-gold/15 bg-dnd-obsidian-raised/40 px-6 py-12 text-center"
                    role="status"
                >
                    <Loader2 className="h-6 w-6 animate-spin text-dnd-gold" />
                    <p className="font-narrative text-sm italic text-dnd-parchment-muted">
                        O pergaminho aguarda a primeira linha do Mestre…
                    </p>
                </div>
            ) : (
                <p className="rounded-xl border border-dnd-gold/15 bg-dnd-obsidian-raised/50 px-4 py-10 text-center font-narrative text-sm italic text-dnd-parchment-muted">
                    A crônica começa com a sua primeira ação.
                </p>
            )
        ) : (
            <div className="space-y-8">
                {visible.map(entry => (
                    <StoryEntryBlock
                        key={entry.id ?? `${entry.timestamp}-${entry.content.slice(0, 48)}`}
                        entry={entry}
                    />
                ))}
            </div>
        );

    if (variant === 'main') {
        return (
            <div className="gameplay-narrative-scroll flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto bg-dnd-obsidian/30 px-1 py-2 pr-2">
                {list}
                {pendingHint}
            </div>
        );
    }

    return (
        <DndCard padding="md" hover={false} className="bg-dnd-obsidian-raised/90">
            <p className="flex items-center gap-2 font-display text-xs tracking-wide text-dnd-gold">
                <ScrollText className="h-4 w-4" />
                Crônica da sessão
            </p>
            <div className="mt-4 max-h-[min(420px,50vh)] space-y-6 overflow-y-auto pr-1">
                {list}
                {pendingHint}
            </div>
        </DndCard>
    );
}
