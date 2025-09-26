'use client';
import React from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import type { Relationship, Quest } from '../types';
import { Users } from 'lucide-react';

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
            <h5 className={`font-semibold ${isCompleted ? 'text-green-400 line-through' : 'text-amber-300'}`}>{quest.title}</h5>
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

const NewRelationships: React.FC = () => {
    const { character } = useGameStateContext();

    if (!character || !character.relationships || character.relationships.length === 0) {
        return (
            <div className="p-4 space-y-4">
                <h3 className="text-lg font-bold font-garamond text-amber-300 flex items-center gap-2">
                    <Users />
                    Relacionamentos e Missões
                </h3>
                <div className="text-center text-stone-400 italic p-8 bg-stone-800/50 rounded-lg">
                    <p>Você ainda não formou nenhum relacionamento significativo.</p>
                    <p className="text-sm">Suas interações com as pessoas neste mundo serão refletidas aqui, assim como as missões que você receber.</p>
                </div>
            </div>
        );
    }
    
    const activeQuests = character.relationships.flatMap(r => r.quests.filter(q => q.status === 'active'));
    const completedQuests = character.relationships.flatMap(r => r.quests.filter(q => q.status === 'completed'));


    return (
        <div className="p-4 space-y-6">
            <h3 className="text-lg font-bold font-garamond text-amber-300 flex items-center gap-2">
                <Users />
                Relacionamentos e Missões
            </h3>

            {/* Active Quests Section */}
            <div>
                <h4 className="text-md font-semibold text-amber-200 border-b border-stone-700 pb-1 mb-3">Missões Ativas</h4>
                {activeQuests.length > 0 ? (
                    <div className="space-y-4">
                        {activeQuests.map(q => <QuestItem key={q.id} quest={q} />)}
                    </div>
                ) : (
                    <p className="text-sm text-stone-400 italic">Você não tem missões ativas.</p>
                )}
            </div>

            {/* Relationships Section */}
            <div>
                <h4 className="text-md font-semibold text-stone-300 border-b border-stone-700 pb-1 mb-3">Personagens Conhecidos</h4>
                <div className="space-y-4">
                    {character.relationships.map(rel => (
                        <div key={rel.npcId} className="bg-stone-800/70 p-4 rounded-lg border border-stone-700 space-y-3">
                            <div>
                                <div className="flex justify-between items-baseline">
                                    <h5 className="font-semibold text-stone-200 text-lg">{rel.name}</h5>
                                    <span className={`px-2 py-1 text-xs font-bold rounded-full text-white/90 ${statusMap[rel.status].color}`}>{statusMap[rel.status].label}</span>
                                </div>
                                <p className="text-sm text-stone-400 italic">{rel.description}</p>
                            </div>
                            <AffinityBar affinity={rel.affinity} />
                        </div>
                    ))}
                </div>
            </div>

             {/* Completed Quests Section */}
            {completedQuests.length > 0 && (
                <div>
                    <h4 className="text-md font-semibold text-green-400 border-b border-stone-700 pb-1 mb-3">Missões Concluídas</h4>
                    <div className="space-y-3 opacity-70">
                        {completedQuests.map(q => <QuestItem key={q.id} quest={q} />)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewRelationships;
