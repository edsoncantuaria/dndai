'use client';

import { HeartHandshake } from 'lucide-react';
import { DndCard } from '@/components/primitives';
import type { PenaiSessionCampaign } from '@/services/penaiApi';

type Props = {
    reputation: PenaiSessionCampaign['heroReputation'];
};

export function ReputationStrip({ reputation }: Props) {
    const top = reputation.slice(0, 3);

    return (
        <DndCard padding="md" hover={false}>
            <p className="flex items-center gap-2 font-ui text-[10px] uppercase tracking-wider text-dnd-gold">
                <HeartHandshake className="h-4 w-4" />
                Reputação
            </p>
            {top.length === 0 ? (
                <p className="mt-3 text-xs text-dnd-parchment/60">
                    Suas ações ainda não ecoaram o suficiente nesta campanha.
                </p>
            ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                    {top.map(r => (
                        <li
                            key={r.targetSlug}
                            className="rounded-full border border-dnd-gold/20 bg-black/25 px-3 py-1 font-ui text-[11px] text-dnd-parchment"
                        >
                            <span className="text-dnd-gold/90">{r.targetSlug.replace(/-/g, ' ')}</span>
                            <span className="ml-2 text-dnd-ember">{r.score > 0 ? '+' : ''}{r.score}</span>
                        </li>
                    ))}
                </ul>
            )}
        </DndCard>
    );
}
