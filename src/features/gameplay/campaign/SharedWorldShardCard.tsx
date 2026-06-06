'use client';

import type { PenaiSessionCampaign } from '@/services/penaiApi';
import { CollapsibleItemList } from './CollapsibleItemList';

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
            <CollapsibleItemList
                title="Timeline recente"
                items={timelineRecent}
                itemKey={entry => entry.eventId}
                maxVisible={4}
                maxHeightClass="max-h-48"
                defaultSectionOpen={timelineRecent.length > 0}
                emptyMessage="Sem eventos recentes na timeline."
                renderItem={entry => (
                    <p className="text-xs text-dnd-parchment/80">
                        <span className="text-dnd-parchment/50">D{entry.worldDay}</span> {entry.summary}
                    </p>
                )}
            />
        </section>
    );
}
