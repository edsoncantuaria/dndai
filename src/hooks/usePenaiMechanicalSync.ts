'use client';

import { useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { usePenaiGameplay } from '@/contexts/PenaiGameplayContext';
import { applyPenaiMechanicalInteractionSlice } from '@/lib/penaiMechanicalHydrate';
import type { Character, LevelUpState, ProgressionFeedItem } from '@/types';

/**
 * Aplica `lastMechanical` do WS PENAI no estado legado (ficha, combate, rolagem).
 */
export function usePenaiMechanicalSync() {
    const penai = usePenaiGameplay();
    const {
        setCombatState,
        setRequest,
        setActionOptions,
        setCharacter,
        setProgressionFeed,
    } = useGameStateContext();

    const appliedMechanicalKeyRef = useRef<string>('');

    useEffect(() => {
        if (!penai.active || !penai.lastMechanical) {
            appliedMechanicalKeyRef.current = '';
            return;
        }

        const m = penai.lastMechanical;
        const mechanicalKey = JSON.stringify(m);
        if (appliedMechanicalKeyRef.current === mechanicalKey) {
            return;
        }
        appliedMechanicalKeyRef.current = mechanicalKey;

        applyPenaiMechanicalInteractionSlice(m, {
            setCombatState,
            setRequest: args => setRequest(args as Parameters<typeof setRequest>[0]),
        });

        if (Array.isArray(m.actionOptions)) {
            setActionOptions(m.actionOptions);
        }

        if (Array.isArray(m.progressionFeed) && m.progressionFeed.length > 0) {
            const incoming = (m.progressionFeed as Array<Record<string, unknown>>).map(ev => ({
                id: uuidv4(),
                type: (ev.type === 'level_up' ? 'level_up' : 'xp_gain') as ProgressionFeedItem['type'],
                summary: String(ev.summary ?? ''),
                source: typeof ev.source === 'string' ? ev.source : undefined,
                detail: typeof ev.detail === 'string' ? ev.detail : undefined,
                xp: typeof ev.xp === 'number' ? ev.xp : undefined,
                level: typeof ev.level === 'number' ? ev.level : undefined,
                timestamp: new Date().toISOString(),
            }));
            setProgressionFeed(prev => {
                const merged = [...prev];
                for (const item of incoming) {
                    if (!merged.some(m => m.summary === item.summary && m.type === item.type)) {
                        merged.push(item);
                    }
                }
                return merged.slice(-10);
            });
        }

        const levelUp = m.levelUpState as LevelUpState | null | undefined;
        if (levelUp?.isPending) {
            setRequest({ type: 'levelUp', request: levelUp });
        }

        const charFromM = m.character as Record<string, unknown> | undefined;
        if (!charFromM) return;

        const attrs = charFromM.attributes as Record<string, unknown> | undefined;
        const hp = attrs?.hp ?? charFromM.hp;
        const maxHp = attrs?.maxHp ?? charFromM.maxHp;
        const level = charFromM.level;
        const nome = charFromM.nome ?? charFromM.name;

        setCharacter((prev) => {
            if (!prev) return prev;

            const next: Character = { ...prev };

            if (nome != null && String(nome).trim()) {
                next.nome = String(nome);
            }
            if (level != null && Number.isFinite(Number(level))) {
                next.level = Number(level);
            }

            const xp = charFromM.xp;
            const xpToNext = charFromM.xpToNextLevel;
            if (xp != null && Number.isFinite(Number(xp))) {
                next.xp = Number(xp);
            }
            if (xpToNext != null && Number.isFinite(Number(xpToNext))) {
                next.xpToNextLevel = Number(xpToNext);
            }

            if (Array.isArray(charFromM.classLevelsData) && charFromM.classLevelsData.length > 0) {
                next.classLevelsData = charFromM.classLevelsData as Character['classLevelsData'];
            }
            if (Array.isArray(charFromM.subclassLevelsData) && charFromM.subclassLevelsData.length > 0) {
                next.subclassLevelsData = charFromM.subclassLevelsData as Character['subclassLevelsData'];
            }

            if (hp != null || maxHp != null) {
                const curHp = hp != null ? Number(hp) : prev.attributes?.hp;
                const curMax = maxHp != null ? Number(maxHp) : prev.attributes?.maxHp;
                next.attributes = {
                    ...prev.attributes,
                    ...(curHp != null && Number.isFinite(curHp) ? { hp: curHp } : {}),
                    ...(curMax != null && Number.isFinite(curMax) ? { maxHp: curMax } : {}),
                };
            }

            const inv = charFromM.inventory as Character['inventory'] | undefined;
            if (Array.isArray(inv) && inv.length > 0) {
                next.inventory = inv;
            }

            const spells = charFromM.spells as Character['spells'] | undefined;
            if (spells && typeof spells === 'object') {
                next.spells = spells;
            }

            const spellSlots = charFromM.spellSlots as Character['spellSlots'] | undefined;
            if (spellSlots && typeof spellSlots === 'object') {
                next.spellSlots = spellSlots;
            }

            const prof = charFromM.proficiencies as Character['proficiencies'] | undefined;
            if (prof && typeof prof === 'object') {
                next.proficiencies = prof;
            }

            const features = charFromM.features as Character['features'] | undefined;
            if (Array.isArray(features)) {
                next.features = features;
            }

            const classFeatures = charFromM.classFeatures as Character['classFeatures'] | undefined;
            if (Array.isArray(classFeatures)) {
                next.classFeatures = classFeatures;
            }

            const racialTraits = charFromM.racialTraits as Character['racialTraits'] | undefined;
            if (Array.isArray(racialTraits)) {
                next.racialTraits = racialTraits;
            }

            const backgroundFeatures = charFromM.backgroundFeatures as
                | Character['backgroundFeatures']
                | undefined;
            if (Array.isArray(backgroundFeatures)) {
                next.backgroundFeatures = backgroundFeatures;
            }

            const feats = charFromM.feats as Character['feats'] | undefined;
            if (Array.isArray(feats)) {
                next.feats = feats;
            }

            const equipment = charFromM.equipment as Character['equipment'] | undefined;
            if (Array.isArray(equipment)) {
                next.equipment = equipment;
            }

            const worldState =
                (m.worldState as Character['worldState'] | undefined) ??
                (charFromM?.worldState as Character['worldState'] | undefined);
            const regionSlug =
                typeof m.currentRegionSlug === 'string'
                    ? m.currentRegionSlug
                    : typeof m.regionSlug === 'string'
                      ? m.regionSlug
                      : undefined;

            if (worldState || regionSlug) {
                next.worldState = {
                    ...(prev.worldState ?? {}),
                    ...(worldState ?? {}),
                    ...(regionSlug ? { regionSlug } : {}),
                };
            }

            const currentRegion =
                (worldState?.currentRegion as string | undefined) ??
                (charFromM?.currentRegion as string | undefined);
            if (currentRegion) {
                next.currentRegion = currentRegion;
            }

            return next;
        });
    }, [
        penai.active,
        penai.lastMechanical,
        setCombatState,
        setRequest,
        setActionOptions,
        setCharacter,
        setProgressionFeed,
    ]);
}

