'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { DndCard } from '@/components/primitives';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { fetchSessionCast, type SessionCastMemberDto } from '@/services/sessionCastService';
import type { PenaiSessionCampaign } from '@/services/penaiApi';
import type { Relationship } from '@/types';
import { CollapsibleItemList } from './CollapsibleItemList';

const STATUS_LABEL: Record<Relationship['status'], string> = {
    hostile: 'Hostil',
    unfriendly: 'Antipático',
    neutral: 'Neutro',
    friendly: 'Amigável',
    ally: 'Aliado',
};

const STATUS_TONE: Record<Relationship['status'], string> = {
    hostile: 'text-red-400',
    unfriendly: 'text-orange-400',
    neutral: 'text-dnd-parchment-muted',
    friendly: 'text-emerald-400',
    ally: 'text-dnd-gold',
};

type NpcRow = {
    key: string;
    name: string;
    statusLabel: string;
    statusTone: string;
    affinity: number | null;
    reputationScore: number | null;
    discovery: string;
    description?: string;
};

type Props = {
    sessionId: number;
    heroReputation?: PenaiSessionCampaign['heroReputation'];
    refreshKey?: number;
};

function affinityTier(affinity: number): string {
    if (affinity >= 60) return 'Grande amizade';
    if (affinity >= 25) return 'Confiança';
    if (affinity <= -60) return 'Inimizade';
    if (affinity <= -25) return 'Desconfiança';
    return 'Neutro';
}

export function NpcRelationshipsPanel({ sessionId, heroReputation = [], refreshKey = 0 }: Props) {
    const { character } = useGameStateContext();
    const [cast, setCast] = useState<SessionCastMemberDto[]>([]);

    const reloadCast = useCallback(async () => {
        try {
            const data = await fetchSessionCast(sessionId);
            setCast(data.cast.filter(m => m.role !== 'pc'));
        } catch {
            setCast([]);
        }
    }, [sessionId]);

    useEffect(() => {
        void reloadCast();
    }, [reloadCast, refreshKey, character?.relationships?.length]);

    const reputationBySlug = useMemo(() => {
        const map = new Map<string, number>();
        for (const entry of heroReputation) {
            map.set(entry.targetSlug, entry.score);
        }
        return map;
    }, [heroReputation]);

    const rows = useMemo(() => {
        const byKey = new Map<string, NpcRow>();

        for (const rel of character?.relationships ?? []) {
            const rep = rel.npcId ? reputationBySlug.get(rel.npcId) ?? null : null;
            byKey.set(rel.npcId || rel.name, {
                key: rel.npcId || String(rel.id),
                name: rel.name,
                statusLabel: STATUS_LABEL[rel.status] ?? rel.status,
                statusTone: STATUS_TONE[rel.status] ?? STATUS_TONE.neutral,
                affinity: rel.affinity,
                reputationScore: rep,
                discovery: 'Conhecido',
                description: rel.description,
            });
        }

        for (const member of cast) {
            const slug = member.displayName.toLowerCase().replace(/\s+/g, '_');
            const alreadyKnown = [...byKey.values()].some(
                row => row.name.toLowerCase() === member.displayName.toLowerCase(),
            );
            if (alreadyKnown) continue;
            byKey.set(slug, {
                key: String(member.id),
                name: member.displayName,
                statusLabel: member.role === 'enemy' ? 'Ameaça' : 'No elenco',
                statusTone: member.role === 'enemy' ? 'text-red-400' : 'text-cyan-400/90',
                affinity: null,
                reputationScore: reputationBySlug.get(slug) ?? null,
                discovery: 'Visto na sessão',
            });
        }

        return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }, [cast, character?.relationships, reputationBySlug]);

    return (
        <DndCard padding="md" hover={false}>
            <p className="flex items-center gap-2 font-ui text-[10px] uppercase tracking-wider text-dnd-gold">
                <Users className="h-4 w-4" />
                Relações com NPCs
            </p>
            <p className="mt-1 font-ui text-xs text-dnd-parchment-muted">
                Personagens que o herói conhece, com tom da relação e reputação quando disponível.
            </p>

            {rows.length === 0 ? (
                <p className="mt-3 font-ui text-xs italic text-dnd-parchment-muted">
                    Nenhum NPC registrado ainda — converse, explore ou cumpra favores para construir
                    laços.
                </p>
            ) : (
                <CollapsibleItemList
                    title="Personagens"
                    items={rows}
                    itemKey={row => row.key}
                    maxVisible={5}
                    maxHeightClass="max-h-64"
                    defaultSectionOpen
                    renderItem={row => (
                        <div className="rounded border border-dnd-gold/15 bg-black/20 px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-display text-sm text-dnd-parchment">{row.name}</span>
                                <span className={`font-ui text-[10px] uppercase tracking-wide ${row.statusTone}`}>
                                    {row.statusLabel}
                                </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-ui text-[10px] text-dnd-parchment-muted">
                                <span>{row.discovery}</span>
                                {row.affinity !== null ? (
                                    <span>
                                        Afinidade: {row.affinity > 0 ? '+' : ''}
                                        {row.affinity} · {affinityTier(row.affinity)}
                                    </span>
                                ) : null}
                                {row.reputationScore !== null ? (
                                    <span>
                                        Reputação: {row.reputationScore > 0 ? '+' : ''}
                                        {row.reputationScore}
                                    </span>
                                ) : null}
                            </div>
                            {row.description ? (
                                <p className="mt-1 font-narrative text-xs leading-snug text-dnd-parchment/75">
                                    {row.description}
                                </p>
                            ) : null}
                        </div>
                    )}
                />
            )}
        </DndCard>
    );
}
