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


export type GameStage = 'loading' | 'main_menu' | 'session_list' | 'character_vault' | 'creating_character' | 'playing' | 'homebrew_store';


interface GameProps {
  onCharacterCreated: () => void;
  returnToMenu: () => void;
  gameStage: GameStage;
}

export default function Game({ onCharacterCreated, returnToMenu, gameStage }: GameProps) {
    const { character, isLoading } = useGameStateContext();

    // Se o estágio é 'playing', e o personagem está carregado, mostre a tela de jogo.
    if (gameStage === 'playing' && character) {
        return <GameScreen returnToMenu={returnToMenu} />;
    }

    // Se o estágio é criando personagem, mostre o criador.
    if(gameStage === 'creating_character') {
      return (
          <CharacterCreation 
              onCharacterCreated={onCharacterCreated} 
          />
      );
    }
    
    // Se o estágio é 'playing' mas o personagem ainda não carregou, o GameContainer mostrará o loader.
    // Este componente não deve mais renderizar loaders ou menus, apenas as telas de jogo ou criação.
    return null; 
};
