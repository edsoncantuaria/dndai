'use client';

import { useEffect } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { HUB_AMBIENT_SOUND_ID, isHubGameStage } from '@/lib/stageAmbientSound';
import type { GameStage } from '@/types/gameStage';

/**
 * Define trilha ambiente do hub ao navegar fora do jogo.
 * Ao entrar em `playing`, o motor deriva o som a partir do mundo.
 */
export function useStageAmbientSound(gameStage: GameStage) {
  const { setAmbientSound, ambientSound } = useGameStateContext();

  useEffect(() => {
    if (gameStage === 'playing') return;
    if (!isHubGameStage(gameStage)) return;
    if (ambientSound !== HUB_AMBIENT_SOUND_ID) {
      setAmbientSound(HUB_AMBIENT_SOUND_ID);
    }
  }, [gameStage, ambientSound, setAmbientSound]);
}
