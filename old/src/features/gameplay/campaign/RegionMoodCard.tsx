'use client';

import { Activity } from 'lucide-react';
import { DndCard } from '@/components/primitives';
import type { PenaiSessionCampaign } from '@/services/penaiApi';

type Props = {
    regionSlug: string | null;
    regionState: PenaiSessionCampaign['regionState'];
};

function moodLabel(fear: number, crime: number): string {
    if (fear >= 65) return 'A região está tensa — medo alto entre os locais.';
    if (crime >= 60) return 'Crime em alta; guardas e taverneiros cochicham.';
    if (fear <= 25 && crime <= 35) return 'Clima relativamente calmo por aqui.';
    return 'O clima regional oscila com rumores e eventos recentes.';
}

function Bar({ label, value, tone }: { label: string; value: number; tone: string }) {
    const pct = Math.max(0, Math.min(100, value));
    return (
        <div>
            <div className="mb-1 flex justify-between font-ui text-[10px] uppercase tracking-wide text-dnd-parchment/70">
                <span>{label}</span>
                <span>{pct}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/40">
                <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

export function RegionMoodCard({ regionSlug, regionState }: Props) {
    if (!regionState) {
        return (
            <DndCard padding="md" hover={false}>
                <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-gold">
                    Clima da região
                </p>
                <p className="mt-2 text-xs text-dnd-parchment/60">
                    Explore o mapa para registrar o clima desta campanha.
                </p>
            </DndCard>
        );
    }

    return (
        <DndCard padding="md" hover={false}>
            <p className="flex items-center gap-2 font-ui text-[10px] uppercase tracking-wider text-dnd-gold">
                <Activity className="h-4 w-4" />
                Clima da região
            </p>
            {regionSlug ? (
                <p className="mt-1 text-xs text-dnd-parchment/80">
                    {regionSlug.replace(/-/g, ' ')}
                </p>
            ) : null}
            <p className="mt-2 font-narrative text-xs text-dnd-parchment/70">
                {moodLabel(regionState.fear, regionState.crime)}
            </p>
            <div className="mt-4 space-y-3">
                <Bar label="Medo" value={regionState.fear} tone="bg-dnd-ember/80" />
                <Bar label="Prosperidade" value={regionState.prosperity} tone="bg-dnd-gold/80" />
                <Bar label="Crime" value={regionState.crime} tone="bg-red-900/70" />
            </div>
        </DndCard>
    );
}
