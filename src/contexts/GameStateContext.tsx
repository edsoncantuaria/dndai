'use client';

import React, { createContext, useContext } from 'react';
import { useNewGameState } from '../hooks/newUseGameState';

export type GameStateContextType = ReturnType<typeof useNewGameState>;

const GameStateContext = createContext<GameStateContextType | null>(null);

export const GameStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const gameState = useNewGameState(); 
    return (
        <GameStateContext.Provider value={gameState}>
            {children}
        </GameStateContext.Provider>
    );
};

export const useGameStateContext = (): GameStateContextType => {
    const context = useContext(GameStateContext);
    if (!context) {
        throw new Error('useGameStateContext deve ser usado dentro de um GameStateProvider');
    }
    return context;
};

    