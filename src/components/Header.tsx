// components/Header.tsx
import React from 'react';
// FIX: Corrected import path for local module.
import { useGameStateContext } from '../contexts/GameStateContext';
import { Icons } from './Icons';

const Header: React.FC = () => {
    const { character } = useGameStateContext();

    if (!character) return null;

    const { name, characterClass, subclass, level, hp, ac } = character;
    const hpPercentage = (hp.current / hp.max) * 100;

    let hpBarColor = 'bg-green-600';
    let hpGlowColor = 'shadow-green-900/50';
    if (hpPercentage < 25) {
        hpBarColor = 'bg-red-600';
        hpGlowColor = 'shadow-red-900/50';
    } else if (hpPercentage < 50) {
        hpBarColor = 'bg-yellow-500';
        hpGlowColor = 'shadow-yellow-900/50';
    }
    
    const classDisplay = subclass ? `${characterClass} (${subclass})` : characterClass;

    return (
        <div className="flex-shrink-0 bg-stone-800/60 backdrop-blur-sm p-3 rounded-lg border border-stone-700/80 flex flex-col sm:flex-row flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-stone-700 rounded-full flex items-center justify-center border-2 border-stone-600">
                    <Icons.User className="h-8 w-8 sm:h-10 sm:w-10 text-stone-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold font-garamond text-stone-100 text-shadow-amber">{name}</h2>
                    <p className="text-amber-400 font-semibold">{`Nível ${level} ${classDisplay}`}</p>
                </div>
            </div>

            <div className="w-full sm:w-auto sm:flex-grow flex items-center justify-end gap-4 sm:gap-6">
                <div className="w-full max-w-xs flex-grow">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="font-semibold text-stone-300">Pontos de Vida</span>
                        <span className="font-mono text-stone-200">{hp.current} / {hp.max}</span>
                    </div>
                    <div className={`w-full bg-stone-700 rounded-full h-4 border border-stone-600 overflow-hidden relative shadow-lg ${hpGlowColor}`}>
                        <div 
                            className={`${hpBarColor} h-full rounded-full transition-all duration-300`} 
                            style={{ width: `${hpPercentage}%`}}
                        ></div>
                         <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-lighten">
                            {hp.current} / {hp.max}
                        </span>
                    </div>
                </div>

                <div className="text-center">
                    <div className="flex items-center gap-1 text-stone-400">
                        <Icons.Shield />
                        <span className="text-xs font-bold">CA</span>
                    </div>
                    <p className="font-bold text-2xl text-stone-200">{ac.value}</p>
                </div>
            </div>
        </div>
    );
};

export default Header;