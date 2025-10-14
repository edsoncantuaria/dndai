// src/components/CharacterSheet/DeathSavesTracker.tsx
import React from 'react';
import { useGameStateContext } from '../../contexts/GameStateContext';

const DeathSavesTracker: React.FC = () => {
    const { character } = useGameStateContext();
    if (!character || !character.hp || character.hp.current > 0) return null;

    const { successes, failures } = character.deathSaves || { successes: 0, failures: 0 };

    return (
        <div className="bg-red-900/40 p-3 rounded-lg border border-red-700/60 mt-4">
            <h3 className="text-lg font-bold font-garamond text-red-300 mb-2">Testes de Morte</h3>
            <div className="flex justify-around">
                <div className="text-center">
                    <span className="text-sm text-stone-300">Sucessos</span>
                    <div className="flex gap-2 mt-1">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className={`h-4 w-4 rounded-full border-2 ${i < successes ? 'bg-green-500 border-green-400' : 'bg-stone-700 border-stone-600'}`}></div>
                        ))}
                    </div>
                </div>
                <div className="text-center">
                    <span className="text-sm text-stone-300">Falhas</span>
                    <div className="flex gap-2 mt-1">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className={`h-4 w-4 rounded-full border-2 ${i < failures ? 'bg-red-600 border-red-500' : 'bg-stone-700 border-stone-600'}`}></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DeathSavesTracker;
