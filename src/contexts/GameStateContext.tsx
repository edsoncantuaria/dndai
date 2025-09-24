'use client';

// contexts/GameStateContext.tsx
import React, { createContext, useContext } from 'react';
// Corrected import path to the new hook
import { useNewGameState } from '@/hooks/newUseGameState'; 

// O tipo de contexto agora é derivado diretamente do tipo de retorno do novo hook.
export type GameStateContextType = ReturnType<typeof useNewGameState>;

const GameStateContext = createContext<GameStateContextType | null>(null);

export const GameStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Usa o novo hook para prover o estado.
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
