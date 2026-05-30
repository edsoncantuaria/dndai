'use client';

import { useEffect, useState } from 'react';
import { BookMarked, Loader2 } from 'lucide-react';
import { DndCard } from '@/components/primitives';
import { apiClient } from '@/services/apiClient';

type JournalEntry = {
    id: number;
    title: string;
    body: string;
    tags: string[];
    createdAt: string;
};

export function PenaiJournalPanel({ sessionId }: { sessionId: number }) {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        void apiClient<{ sessionId: number; entries: JournalEntry[] }>(
            `/v2/sessions/${sessionId}/journal`,
        )
            .then(res => {
                if (!cancelled) setEntries(res.entries ?? []);
            })
            .catch(() => {
                if (!cancelled) setError('Não foi possível carregar o diário.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [sessionId]);

    return (
        <DndCard padding="md" hover={false}>
            <p className="flex items-center gap-2 font-ui text-[10px] uppercase tracking-wider text-dnd-gold">
                <BookMarked className="h-4 w-4" />
                Diário PENAI
            </p>
            <div className="mt-3 max-h-[240px] space-y-2 overflow-y-auto pr-1">
                {loading ? (
                    <p className="flex items-center gap-2 text-xs text-dnd-parchment/60">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Carregando entradas…
                    </p>
                ) : error ? (
                    <p className="text-xs text-red-300">{error}</p>
                ) : entries.length === 0 ? (
                    <p className="text-xs text-dnd-parchment/60">
                        Nenhuma entrada de diário ainda — eventos importantes aparecerão aqui.
                    </p>
                ) : (
                    entries.map(entry => (
                        <article
                            key={entry.id}
                            className="rounded border border-dnd-gold/10 bg-black/25 px-3 py-2"
                        >
                            <header className="text-[10px] uppercase tracking-wide text-dnd-gold/80">
                                {entry.title}
                                <span className="ml-2 text-dnd-parchment/50">
                                    {new Date(entry.createdAt).toLocaleString('pt-BR')}
                                </span>
                            </header>
                            <p className="mt-1 text-sm leading-relaxed text-dnd-parchment">
                                {entry.body}
                            </p>
                            {entry.tags.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {entry.tags.map(tag => (
                                        <span
                                            key={`${entry.id}-${tag}`}
                                            className="rounded-full border border-dnd-gold/20 px-2 py-0.5 text-[10px] text-dnd-gold/90"
                                        >
                                            {tag}
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
