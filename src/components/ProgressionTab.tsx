// components/ProgressionTab.tsx
import React from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import LevelCard from './LevelCard';
import { TrendingUp, Users } from 'lucide-react';

const ReputationBar: React.FC<{ name: string; score: number }> = ({ name, score }) => {
    // Clamps the score between -10 and 10 and then normalizes it to a 0-100 scale.
    const clampedScore = Math.max(-10, Math.min(10, score));
    const percentage = ((clampedScore + 10) / 20) * 100;
    
    let color = 'bg-yellow-500'; // Neutro
    if (clampedScore <= -7) color = 'bg-red-700';
    else if (clampedScore <= -3) color = 'bg-orange-600';
    else if (clampedScore >= 7) color = 'bg-green-500';
    else if (clampedScore >= 3) color = 'bg-cyan-500';

    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-stone-300">{name}</span>
                <span className={`font-bold ${color.replace('bg-', 'text-')}`}>{score}</span>
            </div>
            <div className="w-full bg-stone-700 rounded-full h-2.5 border border-stone-600 overflow-hidden">
                <div 
                    className={`${color} h-full rounded-full transition-all duration-300`} 
                    style={{ width: `${percentage}%`}}
                ></div>
            </div>
        </div>
    )
}

const ProgressionTab: React.FC = () => {
    const { character } = useGameStateContext();

    if (!character) return null;

    const xpPercentage = (character.xp / character.xpToNextLevel) * 100;
    const allLevels = Array.from({ length: 20 }, (_, i) => i + 1);
    const hasFactions = character.factionReputation && Object.keys(character.factionReputation).length > 0;

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
             
            {hasFactions && (
                 <div className="space-y-4">
                    <h4 className="text-md font-semibold text-amber-200 border-b border-stone-700 pb-1 flex items-center gap-2">
                        <Users className="h-4 w-4"/>
                        Reputação com Facções
                    </h4>
                    <div className="space-y-3">
                        {Object.entries(character.factionReputation!).map(([faction, score]) => (
                            <ReputationBar key={faction} name={faction} score={score} />
                        ))}
                    </div>
                 </div>
            )}

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
