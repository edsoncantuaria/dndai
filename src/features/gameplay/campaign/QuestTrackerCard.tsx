'use client';

import { ScrollText } from 'lucide-react';
import { DndCard } from '@/components/primitives';
import type { PenaiSessionCampaign } from '@/services/penaiApi';

type Props = {
    quests: PenaiSessionCampaign['activeQuests'];
};

export function QuestTrackerCard({ quests }: Props) {
    return (
        <DndCard padding="md" hover={false}>
            <p className="flex items-center gap-2 font-ui text-[10px] uppercase tracking-wider text-dnd-gold">
                <ScrollText className="h-4 w-4" />
                Missões ativas
            </p>
            {quests.length === 0 ? (
                <p className="mt-3 text-xs text-dnd-parchment/60">
                    Nenhuma missão registrada ainda. O mundo pode gerar objetivos após descanso longo ou
                    viagem.
                </p>
            ) : (
                <ul className="mt-3 space-y-2">
                    {quests.map(q => (
                        <li
                            key={q.questSlug}
                            className="rounded border border-dnd-gold/15 bg-black/20 px-3 py-2"
                        >
                            <p className="font-display text-sm text-dnd-parchment">{q.title}</p>
                            <p className="mt-0.5 font-ui text-[10px] uppercase tracking-wide text-dnd-gold/80">
                                Estágio {q.stage} · {q.status}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </DndCard>
    );
}
