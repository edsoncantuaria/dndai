'use client';

import React, { useEffect } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import CharacterCreation from '@/components/CharacterCreation';
import GameScreen from '@/components/GameScreen';

type GameStage = 'menu' | 'creating' | 'created' | 'playing';

interface GameProps {
  startNewGameFlow: () => void;
  onCharacterCreated: () => void;
  onContinueGame: () => void;
  gameStage: GameStage;
}

export default function Game({ startNewGameFlow, onCharacterCreated, onContinueGame, gameStage }: GameProps) {
    const gameStateHook = useGameStateContext();

    // Este useEffect agora SÓ inicia o jogo quando o estágio 'playing' é ativado.
    // Isso acontece APÓS o usuário clicar em "Continuar" na tela intermediária.
    useEffect(() => {
        if (
            gameStage === 'playing' &&
            gameStateHook.character && 
            gameStateHook.log.length === 0 && 
            !gameStateHook.isLoading
        ) {
            gameStateHook.startGame();
        }
    }, [
        gameStage, // A dependência principal que controla o fluxo
        gameStateHook.character, 
        gameStateHook.log.length, 
        gameStateHook.isLoading, 
        gameStateHook.startGame
    ]);

    // Se o personagem existe e estamos no estágio de jogo, mostra a tela principal.
    if (gameStateHook.character && gameStage === 'playing') {
      return <GameScreen />;
    }

    // Caso contrário, mostra a tela de menu/criação.
    return (
        <CharacterCreation 
            startNewGameFlow={startNewGameFlow} 
            onCharacterCreated={onCharacterCreated} 
            onContinueGame={onContinueGame}
            isCreating={gameStage === 'creating'}
        />
    );
};
