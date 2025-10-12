// src/components/WorldStatePanel.tsx
'use client';
import React from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import { Users, Sun, Moon, Cloud, CloudRain, CloudSnow } from 'lucide-react';
import { translateApiString } from '../utils/translator';

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
    );
};

const WorldStateIcon: React.FC<{ stateKey: string, value?: string }> = ({ stateKey, value }) => {
    if (!value) return null;
    const lowerValue = value.toLowerCase();

    if (stateKey === 'weather') {
        if (lowerValue.includes('rain') || lowerValue.includes('storm')) return <CloudRain className="h-5 w-5 text-blue-400" title={`Clima: ${value}`} />;
        if (lowerValue.includes('snow')) return <CloudSnow className="h-5 w-5 text-cyan-200" title={`Clima: ${value}`} />;
        if (lowerValue.includes('cloud')) return <Cloud className="h-5 w-5 text-stone-400" title={`Clima: ${value}`} />;
        return <Sun className="h-5 w-5 text-yellow-400" title={`Clima: ${value}`} />;
    }
    if (stateKey === 'timeOfDay') {
        if (lowerValue.includes('night') || lowerValue.includes('dusk')) return <Moon className="h-5 w-5 text-indigo-300" title={`Período: ${value}`} />;
        return <Sun className="h-5 w-5 text-yellow-400" title={`Período: ${value}`} />;
    }
    return null;
}

const WorldStatePanel: React.FC = () => {
    const { character } = useGameStateContext();

    // The worldState is now part of the main character object in this context
    const worldState = character?.worldState || {};
    const hasFactions = character?.factionReputation && Object.keys(character.factionReputation).length > 0;
    const hasWorldState = Object.keys(worldState).length > 0;
    
    if (!hasFactions && !hasWorldState) {
        return null; // Don't render the component if there's nothing to show
    }

    return (
        <div className="space-y-4">
             {hasWorldState && (
                 <div className="bg-stone-800/50 p-3 rounded-lg border border-stone-700">
                     <h4 className="font-semibold text-stone-300 text-sm mb-2">Estado do Mundo</h4>
                     <div className="flex items-center justify-around gap-4 text-center">
                        {worldState.timeOfDay && (
                             <div>
                                <WorldStateIcon stateKey="timeOfDay" value={worldState.timeOfDay} />
                                <p className="text-xs text-stone-400 mt-1">{translateApiString(worldState.timeOfDay)}</p>
                            </div>
                        )}
                         {worldState.weather && (
                             <div>
                                <WorldStateIcon stateKey="weather" value={worldState.weather} />
                                <p className="text-xs text-stone-400 mt-1">{translateApiString(worldState.weather)}</p>
                            </div>
                        )}
                        {/* You can add more world state displays here */}
                     </div>
                 </div>
            )}
            
            {hasFactions && (
                 <div className="space-y-4">
                    <h4 className="text-md font-semibold text-amber-200 border-b border-stone-700 pb-1 flex items-center gap-2">
                        <Users className="h-4 w-4"/>
                        Reputação com Facções
                    </h4>
                    <div className="space-y-3 bg-stone-800/50 p-3 rounded-lg border border-stone-700">
                        {Object.entries(character!.factionReputation!).map(([faction, score]) => (
                            <ReputationBar key={faction} name={faction} score={score} />
                        ))}
                    </div>
                 </div>
            )}
        </div>
    );
}

export default WorldStatePanel;
