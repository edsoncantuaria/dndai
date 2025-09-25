'use client';

import React, { useEffect } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import CharacterCreation from '@/components/CharacterCreation';
import GameScreen from '@/components/GameScreen';
import { Loader2 } from 'lucide-react';

type GameStage = 'menu' | 'creating' | 'created' | 'playing';

interface GameProps {
  startNewGameFlow: () => void;
  onCharacterCreated: () => void;
  onContinueGame: () => void;
  gameStage: GameStage;
}

export default function Game({ startNewGameFlow, onCharacterCreated, onContinueGame, gameStage }: GameProps) {
    const gameStateHook = useGameStateContext();

    // Este useEffect agora SÓ inicia o jogo quando o estágio 'playing' é ativado
    // e o log de aventura está vazio.
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

    // Se o personagem existe e estamos no estágio de jogo, mostra a tela principal ou o carregamento.
    if (gameStateHook.character && gameStage === 'playing') {
        // Se a narração inicial ainda não chegou (log está vazio), mostra um loader.
        if (gameStateHook.log.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center text-stone-300">
                    <Loader2 className="h-12 w-12 animate-spin mb-4" />
                    <h2 className="text-2xl font-bold font-garamond text-amber-300">Aguarde...</h2>
                    <p className="mt-2">O Mestre de Jogo está preparando sua aventura.</p>
                </div>
            )
        }
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
