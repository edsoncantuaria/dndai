'use client';

import { useMemo } from 'react';
import { Heart, Shield } from 'lucide-react';
import { DndBadge } from '@/components/primitives';
import { cn } from '@/lib/utils';
import type { Character, CombatState, InventoryItem } from '@/types';

const CORE_ATTRS = ['strength', 'dexterity', 'constitution'] as const;

const ATTR_LABELS: Record<(typeof CORE_ATTRS)[number], string> = {
    strength: 'FOR',
    dexterity: 'DES',
    constitution: 'CON',
};

export interface HeroVitalsStripProps {
    character: Character;
    combatState?: CombatState;
    className?: string;
}

function EquippedTooltip({ items }: { items: InventoryItem[] }) {
    if (!items.length) {
        return <span className="text-dnd-parchment-muted">Nenhum item equipado</span>;
    }
    return (
        <ul className="space-y-0.5">
            {items.map(item => (
                <li key={String(item.id)}>{item.name}</li>
            ))}
        </ul>
    );
}

export function HeroVitalsStrip({ character, combatState, className }: HeroVitalsStripProps) {
    const playerCombatant = useMemo(() => {
        if (!combatState?.isActive) return null;
        return combatState.combatants.find(c => c.isPlayer);
    }, [combatState]);

    const currentHp = playerCombatant?.hp?.current ?? character.hp.current;
    const maxHp = playerCombatant?.hp?.max ?? character.hp.max;
    const currentAc = playerCombatant?.ac ?? character.ac.value;
    const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;

    const equippedItems = useMemo(
        () => (character.inventory ?? []).filter(i => i.equipped),
        [character.inventory],
    );

    const hpBarColor =
        hpPercent > 50 ? 'bg-dnd-success' : hpPercent > 25 ? 'bg-dnd-gold' : 'bg-dnd-danger';

    return (
        <div
            className={cn(
                'flex min-w-0 flex-wrap items-center gap-2 md:gap-3',
                className,
            )}
            aria-label="Status do personagem"
        >
            <div className="flex min-w-[120px] max-w-[180px] flex-1 items-center gap-2">
                <Heart className="h-3.5 w-3.5 shrink-0 text-dnd-danger" aria-hidden />
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-1">
                        <span className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">
                            PV
                        </span>
                        <span className="font-mono text-xs text-dnd-parchment">
                            {currentHp}/{maxHp}
                        </span>
                    </div>
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-dnd-obsidian">
                        <div
                            className={cn('h-full rounded-full transition-all duration-500', hpBarColor)}
                            style={{ width: `${hpPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            <div
                className="group relative flex items-center gap-1.5 rounded-md border border-dnd-gold/20 bg-dnd-obsidian/60 px-2 py-1"
                title={`CA ${currentAc}${character.ac.source ? ` (${character.ac.source})` : ''}`}
            >
                <Shield className="h-3.5 w-3.5 text-dnd-gold" aria-hidden />
                <span className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">
                    CA
                </span>
                <span className="font-mono text-sm font-semibold text-dnd-gold">{currentAc}</span>
                <div className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden min-w-[160px] rounded-md border border-dnd-gold/20 bg-dnd-obsidian-raised p-2 text-xs text-dnd-parchment shadow-elevated group-hover:block group-focus-within:block">
                    <p className="mb-1 font-ui text-[10px] uppercase tracking-wider text-dnd-gold">
                        Equipado
                    </p>
                    <EquippedTooltip items={equippedItems} />
                </div>
            </div>

            <div className="hidden items-center gap-1 sm:flex">
                {CORE_ATTRS.map(attr => {
                    const score = character.attributes?.[attr];
                    if (score == null) return null;
                    const mod = character.modifiers?.[attr];
                    const modLabel = mod != null && mod >= 0 ? `+${mod}` : String(mod ?? '');
                    return (
                        <DndBadge key={attr} variant="muted" className="font-mono text-[10px]">
                            {ATTR_LABELS[attr]} {score}
                            {modLabel ? ` (${modLabel})` : ''}
                        </DndBadge>
                    );
                })}
            </div>
        </div>
    );
}
