// src/components/Game.tsx
'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useGameStateContext } from '@/contexts/GameStateContext';
import GameScreen from '@/components/GameScreen';
import { Loader2 } from 'lucide-react';

const CharacterCreation = dynamic(() => import('@/components/CharacterCreation'), {
    loading: () => (
        <div className="flex flex-col items-center justify-center h-full p-8 text-stone-400">
            <Loader2 className="h-12 w-12 animate-spin" />
            <p className="mt-4">Carregando o criador de heróis...</p>
        </div>
    ),
    ssr: false // A criação de personagem depende de interações do cliente
});


export type GameStage = 'loading' | 'main_menu' | 'session_list' | 'character_vault' | 'creating_character' | 'playing';


interface GameProps {
  onCharacterCreated: () => void;
  returnToMenu: () => void;
  gameStage: GameStage;
}

export default function Game({ onCharacterCreated, returnToMenu, gameStage }: GameProps) {
    const { character, log, isLoading } = useGameStateContext();

    // If we are in the 'playing' stage, always render the GameScreen.
    // The GameScreen itself will handle showing loaders for its internal state.
    if (gameStage === 'playing') {
        return <GameScreen returnToMenu={returnToMenu} />;
    }

    // Otherwise, show the creation screen if that's the stage.
    if(gameStage === 'creating_character') {
      return (
          <CharacterCreation 
              onCharacterCreated={onCharacterCreated} 
          />
      );
    }

    // Fallback or menu state handled by GameContainer
    return null; 
};
