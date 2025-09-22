// Arquivo principal da sua aplicação (Anteriormente App.tsx)
import React from 'react';
import { GameStateProvider } from '@/contexts/GameStateContext';
import Game from './_components/Game';

const HomePage: React.FC = () => {
    return (
        <GameStateProvider>
            <Game />
        </GameStateProvider>
    );
};

export default HomePage;
