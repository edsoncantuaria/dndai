'use client';

import { useEffect, useRef, useState } from 'react';
import type { Character, CombatState } from '@/types';

function resolveHeroHp(
    character: Character | null | undefined,
    combatState: CombatState | undefined,
): { current: number; max: number } | null {
    const player = combatState?.isActive
        ? combatState.combatants.find(c => c.isPlayer)
        : null;
    const current = player?.hp?.current ?? character?.hp?.current ?? character?.attributes?.hp;
    const max = player?.hp?.max ?? character?.hp?.max ?? character?.attributes?.maxHp;
    if (current == null || max == null || max <= 0) return null;
    return { current, max };
}

/** Flash vermelho quando o HP cai antes da narração (mechanicalStateUpdate). */
export function useHeroDamageFlash(
    character: Character | null | undefined,
    combatState: CombatState | undefined,
): boolean {
    const [flash, setFlash] = useState(false);
    const prevHpRef = useRef<number | null>(null);

    useEffect(() => {
        const hp = resolveHeroHp(character, combatState);
        if (!hp) {
            prevHpRef.current = null;
            return;
        }

        const prev = prevHpRef.current;
        if (prev != null && hp.current < prev) {
            const drop = prev - hp.current;
            const threshold = Math.max(3, Math.round(hp.max * 0.08));
            if (drop >= threshold) {
                setFlash(true);
                const timer = window.setTimeout(() => setFlash(false), 720);
                prevHpRef.current = hp.current;
                return () => window.clearTimeout(timer);
            }
        }

        prevHpRef.current = hp.current;
    }, [character, combatState]);

    return flash;
}
