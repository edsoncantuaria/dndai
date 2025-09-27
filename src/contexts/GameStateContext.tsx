'use client';

// contexts/GameStateContext.tsx
import React, { createContext, useContext } from 'react';
// Corrected import path to the new hook
import { useNewGameState } from '@/hooks/newUseGameState'; 

// The context type is now derived directly from the return type of the new hook.
export type GameStateContextType = ReturnType<typeof useNewGameState>;

const GameStateContext = createContext<GameStateContextType | null>(null);

export const GameStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Uses the new hook to provide state.
    const gameState = useNewGameState(); 
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
