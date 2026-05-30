'use client';

import type { PenaiSessionCampaign } from '@/services/penaiApi';

export function SharedWorldShardCard({
    shard,
    timelineRecent,
}: {
    shard: PenaiSessionCampaign['shard'];
    timelineRecent: PenaiSessionCampaign['timelineRecent'];
}) {
    if (!shard) {
        return (
            <section className="rounded-lg border border-dnd-gold/20 bg-dnd-ink/40 p-3">
                <h3 className="text-sm font-semibold text-dnd-gold">Mundo compartilhado (região)</h3>
                <p className="mt-1 text-xs text-dnd-parchment/60">
                    Nenhum shard atribuído ainda — viaje ou inicie a campanha para vincular a região
                    canônica.
                </p>
            </section>
        );
    }

    return (
        <section className="rounded-lg border border-dnd-gold/20 bg-dnd-ink/40 p-3 space-y-2">
            <h3 className="text-sm font-semibold text-dnd-gold">Mundo compartilhado (região)</h3>
            <p className="text-sm text-dnd-parchment">
                {shard.displayName}{' '}
                <span className="text-dnd-parchment/50 text-xs">v{shard.version}</span>
            </p>
            <p className="text-xs text-dnd-parchment/70">
                Política regional: <span className="text-dnd-gold">{shard.politicsLabel}</span>
            </p>
            {timelineRecent.length > 0 ? (
                <ul className="mt-2 space-y-1 border-t border-dnd-gold/10 pt-2">
                    {timelineRecent.map(entry => (
                        <li key={entry.eventId} className="text-xs text-dnd-parchment/80">
                            <span className="text-dnd-parchment/50">D{entry.worldDay}</span>{' '}
                            {entry.summary}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-xs text-dnd-parchment/50">Sem eventos recentes na timeline.</p>
            )}
        </section>
    );
}
