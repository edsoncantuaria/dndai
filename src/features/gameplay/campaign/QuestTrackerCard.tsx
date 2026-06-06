'use client';

import { useState } from 'react';
import { ChevronDown, MapPin, ScrollText } from 'lucide-react';
import { DndCard } from '@/components/primitives';
import type { PenaiSessionCampaign } from '@/services/penaiApi';

type Props = {
    quests: PenaiSessionCampaign['activeQuests'];
    onOpenMap?: (regionSlug: string) => void;
    maxVisiblePerGroup?: number;
};

function QuestRow({
    q,
    onOpenMap,
}: {
    q: PenaiSessionCampaign['activeQuests'][number];
    onOpenMap?: (regionSlug: string) => void;
}) {
    return (
        <li className="rounded border border-dnd-gold/15 bg-black/20 px-3 py-2">
            <p className="font-display text-sm text-dnd-parchment">{q.title}</p>
            {q.synopsis ? (
                <p className="mt-1 font-ui text-xs leading-relaxed text-dnd-parchment/70">
                    {q.synopsis}
                </p>
            ) : null}
            <p className="mt-1 font-ui text-[10px] uppercase tracking-wide text-dnd-gold/80">
                {q.stageLabel} · estágio {q.stage}
            </p>
            {q.regionName ? (
                <p className="mt-1 flex items-center gap-1 font-ui text-xs text-dnd-parchment/60">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {q.regionName}
                </p>
            ) : null}
            {q.regionSlug && onOpenMap ? (
                <button
                    type="button"
                    onClick={() => onOpenMap(q.regionSlug!)}
                    className="mt-2 font-ui text-[10px] uppercase tracking-wide text-dnd-gold underline hover:text-dnd-gold/80"
                >
                    Ver no mapa
                </button>
            ) : null}
        </li>
    );
}

function QuestGroup({
    title,
    toneClass,
    quests,
    onOpenMap,
    maxVisible,
}: {
    title: string;
    toneClass: string;
    quests: PenaiSessionCampaign['activeQuests'];
    onOpenMap?: (regionSlug: string) => void;
    maxVisible: number;
}) {
    const [open, setOpen] = useState(true);
    const [showAll, setShowAll] = useState(false);
    if (!quests.length) return null;

    const visible = showAll ? quests : quests.slice(0, maxVisible);
    const hidden = quests.length - maxVisible;

    return (
        <div>
            <button
                type="button"
                className="mb-2 flex w-full items-center justify-between gap-2 text-left"
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
            >
                <p className={`font-ui text-[10px] uppercase tracking-wider ${toneClass}`}>
                    {title} ({quests.length})
                </p>
                <ChevronDown
                    className={`h-3.5 w-3.5 text-dnd-gold/70 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open ? (
                <>
                    <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {visible.map(q => (
                            <QuestRow key={q.questSlug} q={q} onOpenMap={onOpenMap} />
                        ))}
                    </ul>
                    {hidden > 0 && !showAll ? (
                        <button
                            type="button"
                            onClick={() => setShowAll(true)}
                            className="mt-2 font-ui text-[10px] uppercase tracking-wide text-dnd-gold underline hover:text-dnd-gold/80"
                        >
                            Ver mais ({hidden})
                        </button>
                    ) : null}
                    {showAll && quests.length > maxVisible ? (
                        <button
                            type="button"
                            onClick={() => setShowAll(false)}
                            className="mt-2 font-ui text-[10px] uppercase tracking-wide text-dnd-parchment-muted underline hover:text-dnd-parchment"
                        >
                            Mostrar menos
                        </button>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}

export function QuestTrackerCard({ quests, onOpenMap, maxVisiblePerGroup = 3 }: Props) {
    const here = quests.filter(q => q.isHere);
    const elsewhere = quests.filter(q => !q.isHere);

    return (
        <DndCard padding="md" hover={false}>
            <p className="flex items-center gap-2 font-ui text-[10px] uppercase tracking-wider text-dnd-gold">
                <ScrollText className="h-4 w-4" />
                Livro de missões
            </p>
            {quests.length === 0 ? (
                <p className="mt-3 text-xs text-dnd-parchment/60">
                    Nenhuma missão registrada. O mundo pode gerar objetivos na criação da sessão ou após
                    viagem e descanso longo.
                </p>
            ) : (
                <div className="mt-3 space-y-4">
                    <QuestGroup
                        title="Aqui"
                        toneClass="text-emerald-400/90"
                        quests={here}
                        onOpenMap={onOpenMap}
                        maxVisible={maxVisiblePerGroup}
                    />
                    <QuestGroup
                        title="Em outro lugar"
                        toneClass="text-amber-400/90"
                        quests={elsewhere}
                        onOpenMap={onOpenMap}
                        maxVisible={maxVisiblePerGroup}
                    />
                </div>
            )}
        </DndCard>
    );
}
