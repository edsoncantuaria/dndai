// components/ProgressionTab.tsx
import React from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import LevelCard from './LevelCard';
import { TrendingUp, Users } from 'lucide-react';
import WorldStatePanel from './WorldStatePanel';

const ProgressionTab: React.FC = () => {
    const { character } = useGameStateContext();

    if (!character) return null;

    const xpPercentage = (character.xp / character.xpToNextLevel) * 100;
    const allLevels = Array.from({ length: 20 }, (_, i) => i + 1);

    return (
        <div className="p-4 space-y-6">
            <div>
                <h3 className="text-lg font-bold font-garamond text-amber-300 flex items-center gap-2">
                    <TrendingUp />
                    Progresso
                </h3>
                <div className="mt-2">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="font-semibold text-stone-300">Nível {character.level}</span>
                        <span className="font-mono text-stone-400">{character.xp} / {character.xpToNextLevel} XP</span>
                    </div>
                    <div className="w-full bg-stone-700 rounded-full h-4 border border-stone-600 overflow-hidden relative">
                        <div 
                            className="bg-purple-600 h-full rounded-full transition-all duration-300" 
                            style={{ width: `${xpPercentage}%`}}
                        ></div>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-lighten">
                            {character.xp} / {character.xpToNextLevel} XP
                        </span>
                    </div>
                    <p className="text-xs text-stone-400 text-center mt-1">
                        {character.xpToNextLevel - character.xp} XP para o próximo nível.
                    </p>
                </div>
            </div>

            <WorldStatePanel />
             
            <div className="space-y-3 pt-4 border-t border-stone-700">
                <h4 className="text-md font-semibold text-amber-200 border-b border-stone-700 pb-1">Linha de Progressão</h4>
                {allLevels.map(level => {
                    const classLevelData = character.classLevelsData.find(l => l.level === level);
                    const subclassLevelData = character.subclassLevelsData?.find(l => l.level === level);
                    
                    if (!classLevelData) return null;
                    
                    return (
                        <LevelCard 
                            key={level}
                            level={level}
                            classLevelData={classLevelData}
                            subclassLevelData={subclassLevelData}
                            isCurrent={level === character.level}
                            isPast={level < character.level}
                        />
                    )
                })}
             </div>
        </div>
    );
};

export default ProgressionTab;
