'use client';

import { useEffect, useState } from 'react';
import { Globe2, Radio } from 'lucide-react';
import { DndCard } from '@/components/primitives';
import {
    fetchPenaiWorldRegistro,
    fetchSessionWorldEvents,
    type PenaiWorldRegistroEntry,
} from '@/services/penaiApi';
import { useSessionCampaign } from '@/hooks/useSessionCampaign';
import { QuestTrackerCard } from '../campaign/QuestTrackerCard';
import { CollapsibleItemList } from '../campaign/CollapsibleItemList';

type Props = {
    sessionId: number | null;
    worldPulse: string[];
    worldPulseHeadline?: string | null;
    currentRegionSlug?: string | null;
    /** Incrementa refetch (ex.: fim de narração ou novo worldPulse). */
    refreshKey?: number;
};

function parseRegistroContent(content: string): { tag: string | null; body: string } {
    const trimmed = content.trim();
    const match = trimmed.match(/^\[([^\]]+)\]\s*(.*)$/s);
    if (!match) return { tag: null, body: trimmed };
    return { tag: match[1], body: match[2].trim() || trimmed };
}

function RegistroRow({ entry }: { entry: PenaiWorldRegistroEntry }) {
    const { tag, body } = parseRegistroContent(entry.content);
    return (
        <div className="border-l-2 border-dnd-gold/25 pl-2 font-ui text-xs">
            <span className="text-dnd-parchment-muted">[{entry.timestamp}]</span>
            {tag ? (
                <span className="ml-1 rounded border border-dnd-gold/15 px-1 py-0.5 text-[9px] uppercase tracking-wider text-dnd-parchment-muted">
                    {tag}
                </span>
            ) : null}
            <p className="mt-0.5 leading-snug text-dnd-parchment">{body}</p>
        </div>
    );
}

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
    const [registro, setRegistro] = useState<PenaiWorldRegistroEntry[]>([]);
    const [showAllPulse, setShowAllPulse] = useState(false);

    useEffect(() => {
        if (!sessionId) return;
        void fetchPenaiWorldRegistro(sessionId)
            .then(res => setRegistro(res.entries))
            .catch(() => setRegistro([]));
    }, [sessionId, refreshKey]);

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

    const pulseItems = worldPulse.filter(
        (pulse, i) => !(worldPulseHeadline && i === 0 && pulse === worldPulseHeadline),
    );
    const visiblePulse = showAllPulse ? pulseItems : pulseItems.slice(0, 4);
    const hiddenPulse = pulseItems.length - 4;

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

            {pulseItems.length > 0 ? (
                <div className="mt-3">
                    <ul className="max-h-40 space-y-2 overflow-y-auto pr-1" aria-live="polite">
                        {visiblePulse.map((pulse, i) => (
                            <li
                                key={`pulse-${i}`}
                                className="flex items-start gap-2 rounded-md border border-dnd-gold/15 bg-dnd-obsidian px-2 py-1.5 font-ui text-xs text-dnd-parchment"
                            >
                                <Radio className="mt-0.5 h-3 w-3 shrink-0 text-dnd-ember" />
                                {pulse}
                            </li>
                        ))}
                    </ul>
                    {hiddenPulse > 0 && !showAllPulse ? (
                        <button
                            type="button"
                            onClick={() => setShowAllPulse(true)}
                            className="mt-2 font-ui text-[10px] uppercase tracking-wide text-dnd-gold underline hover:text-dnd-gold/80"
                        >
                            Ver mais pulsos ({hiddenPulse})
                        </button>
                    ) : null}
                </div>
            ) : (
                <p className="mt-3 font-ui text-xs text-dnd-parchment-muted">
                    Nenhum pulso recente — viaje ou descanse para mover o mundo.
                </p>
            )}

            <div className="mt-4 border-t border-dnd-gold/10 pt-3">
                <QuestTrackerCard quests={campaign?.activeQuests ?? []} />
            </div>

            <CollapsibleItemList
                title="Registro do mundo"
                items={registro}
                itemKey={entry => String(entry.id)}
                maxVisible={4}
                maxHeightClass="max-h-52"
                renderItem={entry => <RegistroRow entry={entry} />}
            />

            <CollapsibleItemList
                title="Timeline regional"
                items={timeline}
                itemKey={(ev, i) => `${ev.category}-${ev.createdAt}-${i}`}
                maxVisible={5}
                maxHeightClass="max-h-56"
                renderItem={ev => (
                    <div className="border-l-2 border-dnd-gold/30 pl-2 font-ui text-xs">
                        <span className="text-dnd-parchment-muted">[{ev.createdAt}]</span>{' '}
                        <span className="uppercase text-dnd-gold/90">
                            {ev.category}
                            {ev.subject ? ` · ${ev.subject}` : ''}
                        </span>
                        <p className="mt-0.5 leading-snug text-dnd-parchment">{ev.summary}</p>
                    </div>
                )}
            />
        </DndCard>
    );
}
