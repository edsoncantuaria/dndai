'use client';

import { HeartHandshake, MapPin, Users } from 'lucide-react';
import { DndCard } from '@/components/primitives';
import type { PenaiSessionCampaign } from '@/services/penaiApi';

type Props = {
    reputation: PenaiSessionCampaign['reputation'];
};

const TIER_BAR: Record<string, string> = {
    despised: 'bg-red-800',
    hostile: 'bg-red-600',
    wary: 'bg-orange-600',
    neutral: 'bg-stone-500',
    noted: 'bg-cyan-600',
    respected: 'bg-emerald-600',
    renowned: 'bg-dnd-gold',
};

function tierBarClass(tierId: string): string {
    return TIER_BAR[tierId] ?? TIER_BAR.neutral;
}

function scoreToBarWidth(score: number): string {
    const clamped = Math.max(-100, Math.min(100, score));
    return `${((clamped + 100) / 200) * 100}%`;
}

function ReputationMeter({
    label,
    score,
    tierLabel,
    tierId,
}: {
    label: string;
    score: number;
    tierLabel: string;
    tierId: string;
}) {
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-dnd-parchment">{label}</span>
                <span className="shrink-0 font-ui text-[10px] uppercase tracking-wide text-dnd-gold/90">
                    {tierLabel}
                    <span className="ml-1.5 text-dnd-parchment/70">
                        ({score > 0 ? '+' : ''}
                        {score})
                    </span>
                </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full border border-dnd-gold/15 bg-black/40">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${tierBarClass(tierId)}`}
                    style={{ width: scoreToBarWidth(score) }}
                />
            </div>
        </div>
    );
}

export function ReputationPanel({ reputation }: Props) {
    const { region, factions } = reputation;

    return (
        <DndCard padding="md" hover={false}>
            <p className="flex items-center gap-2 font-ui text-[10px] uppercase tracking-wider text-dnd-gold">
                <HeartHandshake className="h-4 w-4" />
                Reputação
            </p>

            <div className="mt-4 space-y-5">
                <section>
                    <p className="mb-2 flex items-center gap-1.5 font-ui text-[10px] uppercase tracking-wider text-dnd-parchment/55">
                        <MapPin className="h-3.5 w-3.5" />
                        Neste lugar
                    </p>
                    {region ? (
                        <ReputationMeter
                            label={region.displayName}
                            score={region.score}
                            tierLabel={region.tierLabel}
                            tierId={region.tierId}
                        />
                    ) : (
                        <p className="text-xs text-dnd-parchment/55">
                            Viaje ou explore para fixar sua reputação local.
                        </p>
                    )}
                </section>

                <section>
                    <p className="mb-2 flex items-center gap-1.5 font-ui text-[10px] uppercase tracking-wider text-dnd-parchment/55">
                        <Users className="h-3.5 w-3.5" />
                        Guildas e facções
                    </p>
                    {factions.length === 0 ? (
                        <p className="text-xs leading-relaxed text-dnd-parchment/60">
                            Você ainda não conhece guildas ou ordens deste mundo. Ao visitar sedes,
                            ouvir rumores ou cumprir favores, novas facções aparecerão aqui — uma de
                            cada vez, conforme a história.
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {factions.map(f => (
                                <li key={f.factionSlug}>
                                    <ReputationMeter
                                        label={f.displayName}
                                        score={f.score}
                                        tierLabel={f.tierLabel}
                                        tierId={f.tierId}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </DndCard>
    );
}
