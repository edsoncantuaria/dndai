'use client';

import { useEffect } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { deriveAmbientSoundFromWorld } from '@/hooks/game/ambientSound';
import type { GameStage } from '@/types/gameStage';

/**
 * Sincroniza trilha ambiente com região/POI/combate enquanto o jogador está em partida.
 * Cobre legacy (REST) e PENAI (WS) — a derivação fica centralizada aqui.
 */
export function useWorldAmbientSound(gameStage: GameStage) {
    const { character, ambientSound, setAmbientSound, combatState } = useGameStateContext();

    useEffect(() => {
        if (gameStage !== 'playing') return;

        const derived = deriveAmbientSoundFromWorld(character?.worldState, {
            isCombatActive: combatState?.isActive ?? false,
            currentAmbientId: ambientSound,
        });

        if (derived !== ambientSound) {
            setAmbientSound(derived);
        }
    }, [
        gameStage,
        character?.worldState,
        combatState?.isActive,
        ambientSound,
        setAmbientSound,
    ]);
}
