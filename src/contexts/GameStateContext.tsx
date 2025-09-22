// contexts/GameStateContext.tsx
import { createContext, useContext } from 'react';
import type { useGameState } from '../hooks/useGameState';

// The context will hold the return value of our useGameState hook
type GameStateContextType = ReturnType<typeof useGameState> | null;

const GameStateContext = createContext<GameStateContextType>(null);

export const GameStateProvider = GameStateContext.Provider;

export const useGameStateContext = () => {
    const context = useContext(GameStateContext);
    if (!context) {
        throw new Error('useGameStateContext must be used within a GameStateProvider');
    }
    return context;
};