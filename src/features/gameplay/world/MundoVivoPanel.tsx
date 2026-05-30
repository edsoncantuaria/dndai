'use client';

import { useEffect, useState } from 'react';
import { Globe2, Radio } from 'lucide-react';
import { DndCard } from '@/components/primitives';
import { fetchSessionWorldEvents } from '@/services/penaiApi';
import { useSessionCampaign } from '@/hooks/useSessionCampaign';
import { QuestTrackerCard } from '../campaign/QuestTrackerCard';

type Props = {
    sessionId: number | null;
    worldPulse: string[];
    worldPulseHeadline?: string | null;
    currentRegionSlug?: string | null;
    /** Incrementa refetch (ex.: fim de narração ou novo worldPulse). */
    refreshKey?: number;
};

export function MundoVivoPanel({
    sessionId,
    worldPulse,
    worldPulseHeadline,
    currentRegionSlug,
    refreshKey = 0,
}: Props) {
    const { campaign } = useSessionCampaign(sessionId, refreshKey);
    const [timeline, setTimeline] = useState<
        Array<{ category: string; subject?: string; createdAt: string; summary: string }>
    >([]);

    useEffect(() => {
        if (!sessionId) return;
        void fetchSessionWorldEvents(sessionId)
            .then(res => {
                setTimeline(
                    res.events.map(ev => ({
                        category: ev.category,
                        subject: ev.subject,
                        createdAt: new Date(ev.at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                        }),
                        summary: ev.summary,
                    })),
                );
            })
            .catch(() => setTimeline([]));
    }, [sessionId, worldPulse.length, refreshKey]);

    return (
        <DndCard padding="md" hover={false} className="border-dnd-gold/20 bg-dnd-obsidian-raised/90">
            <p className="flex items-center gap-2 font-display text-xs tracking-wide text-dnd-gold">
                <Globe2 className="h-4 w-4" />
                Mundo Vivo
            </p>
            {currentRegionSlug ? (
                <p className="mt-1 font-ui text-xs text-dnd-parchment-muted">
                    Região: <span className="text-dnd-gold">{currentRegionSlug}</span>
                </p>
            ) : null}

            {worldPulseHeadline ? (
                <p className="mt-3 rounded-md border border-dnd-gold/25 bg-dnd-gold/5 px-3 py-2 font-narrative text-sm leading-snug text-dnd-parchment">
                    {worldPulseHeadline}
                </p>
            ) : null}

            {worldPulse.length > 0 ? (
                <ul className="mt-3 space-y-2" aria-live="polite">
                    {worldPulse.map((pulse, i) => {
                        if (worldPulseHeadline && i === 0 && pulse === worldPulseHeadline) {
                            return null;
                        }
                        return (
                            <li
                                key={`pulse-${i}`}
                                className="flex items-start gap-2 rounded-md border border-dnd-gold/15 bg-dnd-obsidian px-2 py-1.5 font-ui text-xs text-dnd-parchment"
                            >
                                <Radio className="mt-0.5 h-3 w-3 shrink-0 text-dnd-ember" />
                                {pulse}
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="mt-3 font-ui text-xs text-dnd-parchment-muted">
                    Nenhum pulso recente — viaje ou descanse para mover o mundo.
                </p>
            )}

            <div className="mt-4 border-t border-dnd-gold/10 pt-3">
                <QuestTrackerCard quests={campaign?.activeQuests ?? []} />
            </div>

            {timeline.length > 0 ? (
                <div className="mt-4 max-h-[220px] space-y-2 overflow-y-auto border-t border-dnd-gold/10 pt-3">
                    <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">
                        Timeline regional
                    </p>
                    {timeline.map((ev, i) => (
                        <div
                            key={`${ev.category}-${i}`}
                            className="border-l-2 border-dnd-gold/30 pl-2 font-ui text-xs"
                        >
                            <span className="text-dnd-parchment-muted">[{ev.createdAt}]</span>{' '}
                            <span className="uppercase text-dnd-gold/90">
                                {ev.category}
                                {ev.subject ? ` · ${ev.subject}` : ''}
                            </span>
                            <p className="mt-0.5 leading-snug text-dnd-parchment">{ev.summary}</p>
                        </div>
                    ))}
                </div>
            ) : null}
        </DndCard>
    );
}
