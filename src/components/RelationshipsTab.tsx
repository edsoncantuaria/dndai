// components/RelationshipsTab.tsx
import React, { useState } from 'react';
import { Icons } from './Icons';
import { useGameStateContext } from '../contexts/GameStateContext';
import { Relationship, Quest } from '../types';

const statusMap: Record<Relationship['status'], { label: string, color: string }> = {
    'hostile': { label: 'Hostil', color: 'bg-red-600' },
    'unfriendly': { label: 'Inamistoso', color: 'bg-orange-600' },
    'neutral': { label: 'Neutro', color: 'bg-yellow-500' },
    'friendly': { label: 'Amigável', color: 'bg-cyan-500' },
    'ally': { label: 'Aliado', color: 'bg-green-500' },
};

const AffinityBar: React.FC<{ affinity: number }> = ({ affinity }) => {
    const percentage = ((affinity + 100) / 200) * 100;
    
    let color = 'bg-yellow-500';
    if (affinity <= -50) color = 'bg-red-600';
    else if (affinity < 0) color = 'bg-orange-500';
    else if (affinity >= 50) color = 'bg-green-500';
    else if (affinity > 0) color = 'bg-cyan-500';

    return (
        <div>
            <div className="flex justify-between text-xs text-stone-400 font-mono">
                <span>-100</span>
                <span>{affinity}</span>
                <span>+100</span>
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

const QuestItem: React.FC<{ quest: Quest }> = ({ quest }) => {
    const isCompleted = quest.status === 'completed';
    return (
        <div className={`pl-4 border-l-2 ${isCompleted ? 'border-green-700' : 'border-amber-600'}`}>
            <h5 className={`font-semibold ${isCompleted ? 'text-green-400' : 'text-amber-300'}`}>{quest.title}</h5>
            {!isCompleted && quest.objectives.length > 0 && (
                 <ul className="list-disc list-inside text-sm text-stone-300 pl-2 mt-1 space-y-1">
                    {quest.objectives.map((obj, i) => (
                        <li key={i}>{obj}</li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const RelationshipsTab: React.FC = () => {
    const { character } = useGameStateContext();

    if (!character) return null;

    return (
        <div className="p-4 space-y-4">
            <h3 className="text-lg font-bold font-garamond text-amber-300 flex items-center gap-2">
                <Icons.Users />
                Relacionamentos
            </h3>
            {character.relationships.length === 0 ? (
                <div className="text-center text-stone-400 italic p-8 bg-stone-800/50 rounded-lg">
                    <p>Você ainda não formou nenhum relacionamento significativo.</p>
                    <p className="text-sm">Suas interações com as pessoas neste mundo serão refletidas aqui.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {character.relationships.map(rel => (
                        <div key={rel.npcId} className="bg-stone-800/70 p-4 rounded-lg border border-stone-700 space-y-3">
                            <div>
                                <h4 className="font-semibold text-stone-200 text-lg">{rel.name}</h4>
                                <p className="text-sm text-stone-400 italic">{rel.description}</p>
                            </div>
                            <AffinityBar affinity={rel.affinity} />
                            {rel.quests && rel.quests.length > 0 && (
                                <div>
                                    <h5 className="font-bold text-stone-300 text-sm mb-2 border-t border-stone-700 pt-3">Missões</h5>
                                    <div className="space-y-3">
                                        {rel.quests.map(q => <QuestItem key={q.id} quest={q} />)}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RelationshipsTab;
