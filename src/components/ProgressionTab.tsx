// components/ProgressionTab.tsx
import React from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import LevelCard from './LevelCard';
import { TrendingUp, Users, Sparkles } from 'lucide-react';
import WorldStatePanel from './WorldStatePanel';

const PANEL = 'rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]';

const ProgressionTab: React.FC = () => {
    const { character } = useGameStateContext();

    if (!character) return null;

    const xpPercentage = character.xpToNextLevel > 0 ? (character.xp / character.xpToNextLevel) * 100 : 0;
    const allLevels = Array.from({ length: 20 }, (_, i) => i + 1);

    return (
        <div className="p-5 space-y-6 text-sm text-stone-200">
            <div className={`${PANEL} p-5 space-y-3`}>
                <div className="flex items-center gap-3">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-black/40 border border-white/10 text-amber-200">
                        <TrendingUp className="h-6 w-6" />
                    </span>
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.35em] text-amber-200">Trajeto de Poder</p>
                        <h3 className="text-2xl font-serif text-white leading-tight">Progresso do Herói</h3>
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-xs uppercase tracking-[0.35em] text-stone-400 mb-1">
                        <span>Nível {character.level}</span>
                        <span className="tracking-normal font-mono text-stone-200">{character.xp} / {character.xpToNextLevel} XP</span>
                    </div>
                    <div className="h-4 rounded-full border border-white/10 overflow-hidden bg-black/40 relative">
                        <div 
                            className="h-full rounded-full bg-gradient-to-r from-purple-400 via-rose-400 to-amber-400 transition-all duration-300" 
                            style={{ width: `${xpPercentage}%`}}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white mix-blend-lighten">
                            {character.xp} / {character.xpToNextLevel} XP
                        </span>
                    </div>
                    <p className="text-xs text-stone-400 text-right mt-1">
                        {character.xpToNextLevel - character.xp} XP para o próximo nível.
                    </p>
                </div>
            </div>

            <WorldStatePanel />
             
            <div className={`${PANEL} p-4 space-y-3`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-200 uppercase tracking-widest">
                    <Sparkles className="h-4 w-4" /> Linha de Progressão
                </div>
                {allLevels.map(level => {
                    const classLevelData = character.classLevelsData?.find(l => l.level === level);
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
