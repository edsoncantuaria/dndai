'use client';

import { MapPin, ScrollText } from 'lucide-react';
import { DndCard } from '@/components/primitives';
import type { PenaiSessionCampaign } from '@/services/penaiApi';

type Props = {
    quests: PenaiSessionCampaign['activeQuests'];
    onOpenMap?: (regionSlug: string) => void;
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

export function QuestTrackerCard({ quests, onOpenMap }: Props) {
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
                    {here.length > 0 ? (
                        <div>
                            <p className="mb-2 font-ui text-[10px] uppercase tracking-wider text-emerald-400/90">
                                Aqui
                            </p>
                            <ul className="space-y-2">
                                {here.map(q => (
                                    <QuestRow key={q.questSlug} q={q} onOpenMap={onOpenMap} />
                                ))}
                            </ul>
                        </div>
                    ) : null}
                    {elsewhere.length > 0 ? (
                        <div>
                            <p className="mb-2 font-ui text-[10px] uppercase tracking-wider text-amber-400/90">
                                Em outro lugar
                            </p>
                            <ul className="space-y-2">
                                {elsewhere.map(q => (
                                    <QuestRow key={q.questSlug} q={q} onOpenMap={onOpenMap} />
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </div>
            )}
        </DndCard>
    );
}
