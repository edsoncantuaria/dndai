'use client';
import React from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { User, Heart, Shield, Save } from 'lucide-react';

const Header: React.FC = () => {
    const { character, saveGameToFile } = useGameStateContext();

    if (!character) {
        return null; // Or a placeholder header
    }

    const { name, level, characterClass, hp } = character;

    return (
        <div className="flex-shrink-0 bg-stone-900/50 backdrop-blur-sm p-2 rounded-lg border border-stone-700 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-stone-700 rounded-full flex items-center justify-center border-2 border-stone-600">
                    <User className="h-8 w-8 text-stone-400" />
                </div>
                <div>
                    <h2 className="font-bold text-lg text-stone-100">{name}</h2>
                    <p className="text-sm text-stone-400">
                        {characterClass} de Nível {level}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                 <div className="text-center flex items-center gap-2">
                    <Heart className="h-6 w-6 text-red-500" />
                    <div>
                        <div className="text-xs text-red-400 font-semibold">VIDA</div>
                        <div className="font-mono font-bold text-xl text-stone-200">{hp.current} / {hp.max}</div>
                    </div>
                </div>
                 <div className="text-center flex items-center gap-2">
                    <Shield className="h-6 w-6 text-blue-500" />
                    <div>
                        <div className="text-xs text-blue-400 font-semibold">CA</div>
                        <div className="font-mono font-bold text-xl text-stone-200">{character.ac.value}</div>
                    </div>
                </div>
                <button 
                    onClick={saveGameToFile}
                    className="p-2 bg-stone-700/80 hover:bg-stone-600 rounded-md transition-colors"
                    title="Salvar Jogo (Download)"
                >
                    <Save className="h-6 w-6 text-amber-300" />
                </button>
            </div>
        </div>
    );
};

export default Header;
