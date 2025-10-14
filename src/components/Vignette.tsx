'use client';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { cn } from '@/lib/utils';
import React from 'react';

const Vignette: React.FC = () => {
    const { character } = useGameStateContext();

    if (!character || !character.hp || character.hp.max <= 0) {
        return null;
    }

    const hpPercentage = (character.hp.current / character.hp.max) * 100;

    let vignetteClass = '';
    if (hpPercentage <= 25) {
        vignetteClass = 'vignette-danger';
    } else if (hpPercentage <= 50) {
        vignetteClass = 'vignette-warning';
    }

    return (
        <div 
            className={cn(
                "fixed inset-0 pointer-events-none z-[100] transition-all duration-1000",
                vignetteClass
            )}
        />
    );
};

export default Vignette;
