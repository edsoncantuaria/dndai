'use client';

// contexts/GameStateContext.tsx
import { createContext, useContext } from 'react';
import type { useGameState } from '@/hooks/useGameState';

// O contexto agora é um Client Component
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
