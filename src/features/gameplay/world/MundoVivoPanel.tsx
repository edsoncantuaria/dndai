'use client';

import { useEffect, useState } from 'react';
import { Globe2, Radio } from 'lucide-react';
import { DndCard } from '@/components/primitives';
import { fetchSessionWorldEvents } from '@/services/penaiApi';
import { apiClient } from '@/services/apiClient';
import { useToast } from '@/hooks/use-toast';

type Props = {
    sessionId: number | null;
    worldPulse: string[];
    currentRegionSlug?: string | null;
};

export function MundoVivoPanel({ sessionId, worldPulse, currentRegionSlug }: Props) {
    const { toast } = useToast();
    const [timeline, setTimeline] = useState<
        Array<{ type: string; createdAt: string; summary: string }>
    >([]);

    useEffect(() => {
        if (!sessionId) return;
        void fetchSessionWorldEvents(sessionId)
            .then(res => {
                setTimeline(
                    res.events.map(ev => ({
                        type: ev.type,
                        createdAt: new Date(ev.createdAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                        }),
                        summary:
                            typeof ev.payload?.summary === 'string'
                                ? ev.payload.summary
                                : ev.type,
                    })),
                );
            })
            .catch(() => setTimeline([]));
    }, [sessionId, worldPulse.length]);

    return (
        <DndCard padding="md" hover={false}>
            <p className="flex items-center gap-2 font-ui text-[10px] uppercase tracking-wider text-dnd-gold">
                <Globe2 className="h-4 w-4" />
                Mundo Vivo
            </p>
            {currentRegionSlug ? (
                <p className="mt-1 text-xs text-dnd-parchment/80">
                    Região atual: <span className="text-dnd-gold">{currentRegionSlug}</span>
                </p>
            ) : null}

            {worldPulse.length > 0 ? (
                <ul className="mt-3 space-y-2">
                    {worldPulse.map((pulse, i) => (
                        <li
                            key={`pulse-${i}`}
                            className="flex items-start gap-2 rounded border border-dnd-gold/15 bg-black/20 px-2 py-1.5 text-xs text-dnd-parchment"
                        >
                            <Radio className="mt-0.5 h-3 w-3 shrink-0 text-dnd-gold" />
                            {pulse}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-3 text-xs text-dnd-parchment/60">Nenhum pulso recente do mundo.</p>
            )}

            {timeline.length > 0 ? (
                <div className="mt-4 max-h-[200px] overflow-y-auto space-y-2">
                    {timeline.map((ev, i) => (
                        <div
                            key={`${ev.type}-${i}`}
                            className="border-l-2 border-dnd-gold/30 pl-2 text-xs"
                        >
                            <span className="text-dnd-gold/80">[{ev.createdAt}]</span>{' '}
                            <span className="text-dnd-parchment">{ev.summary}</span>
                        </div>
                    ))}
                </div>
            ) : null}

            {sessionId && currentRegionSlug ? (
                <button
                    type="button"
                    className="mt-3 w-full rounded border border-dnd-gold/30 px-2 py-1.5 text-xs text-dnd-gold hover:bg-dnd-gold/10"
                    onClick={() => {
                        void apiClient(`/v2/sessions/${sessionId}/canon/proposals`, {
                            method: 'POST',
                            body: JSON.stringify({
                                kind: 'poi',
                                displayName: `Descoberta em ${currentRegionSlug}`,
                                regionSlug: currentRegionSlug,
                            }),
                        })
                            .then(() =>
                                toast({
                                    title: 'Proposta enviada',
                                    description: 'Sugestão canônica enviada ao mestre.',
                                }),
                            )
                            .catch(() =>
                                toast({
                                    variant: 'destructive',
                                    description: 'Falha ao enviar proposta canônica.',
                                }),
                            );
                    }}
                >
                    Sugerir canon desta região
                </button>
            ) : null}
        </DndCard>
    );
}
