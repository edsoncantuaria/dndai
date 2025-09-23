'use client';

// contexts/GameStateContext.tsx
import React, { createContext, useContext } from 'react';
import { useGameState } from '@/hooks/useGameState';

// The context is now a Client Component
export type GameStateContextType = ReturnType<typeof useGameState> | null;

const GameStateContext = createContext<GameStateContextType>(null);

export const GameStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const gameState = useGameState();
    return (
        <GameStateContext.Provider value={gameState}>
            {children}
        </GameStateContext.Provider>
    );
};

export const useGameStateContext = () => {
    const context = useContext(GameStateContext);
    if (!context) {
        throw new Error('useGameStateContext deve ser usado dentro de um GameStateProvider');
    }
    return context;
};
