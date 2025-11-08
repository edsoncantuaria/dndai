'use client';
import React from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import type { Relationship, Quest } from '../types';
import { Users, HeartHandshake, Target, Trophy } from 'lucide-react';

const PANEL = 'rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]';

const statusMap: Record<Relationship['status'], { label: string, color: string }> = {
    'hostile': { label: 'Hostil', color: 'bg-red-600' },
    'unfriendly': { label: 'Inamistoso', color: 'bg-orange-600' },
    'neutral': { label: 'Neutro', color: 'bg-yellow-500' },
    'friendly': { label: 'Amigável', color: 'bg-cyan-500' },
    'ally': { label: 'Aliado', color: 'bg-green-500' },
};

const AffinityBar: React.FC<{ affinity: number }> = ({ affinity }) => {
    const percentage = ((affinity + 100) / 200) * 100;
    
    let color = 'bg-yellow-500'; // Neutro
    if (affinity <= -50) color = 'bg-red-600';
    else if (affinity < 0) color = 'bg-orange-500';
    else if (affinity >= 50) color = 'bg-green-500';
    else if (affinity > 0) color = 'bg-cyan-500';

    return (
        <div>
            <div className="flex justify-between text-[10px] uppercase tracking-[0.3em] text-stone-500 font-mono">
                <span>-100</span>
                <span>{affinity}</span>
                <span>+100</span>
            </div>
            <div className="w-full bg-black/40 rounded-full h-2.5 border border-white/10 overflow-hidden">
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
        <div className={`pl-4 border-l-2 ${isCompleted ? 'border-emerald-600/70' : 'border-amber-500/70'}`}>
            <h5 className={`font-semibold ${isCompleted ? 'text-emerald-300 line-through' : 'text-amber-200'}`}>{quest.title}</h5>
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
            <div className="p-5 space-y-4 text-sm text-stone-200">
                <div className={`${PANEL} p-5 space-y-2`}>
                    <div className="flex items-center gap-3">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-black/40 border border-white/10 text-amber-200">
                            <Users className="h-6 w-6" />
                        </span>
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.35em] text-amber-200">Rede Social</p>
                            <h3 className="text-2xl font-serif text-white">Relações & Missões</h3>
                        </div>
                    </div>
                </div>
                <div className="text-center text-stone-400 italic p-8 bg-black/30 border border-white/10 rounded-3xl">
                    <p>Você ainda não formou nenhum relacionamento significativo.</p>
                    <p className="text-sm mt-1">Suas interações serão registradas aqui ao encontrar aliados ou rivais.</p>
                </div>
            </div>
        );
    }
    
    const activeQuests = character.relationships.flatMap(r => r.quests?.filter(q => q.status === 'active') || []);
    const completedQuests = character.relationships.flatMap(r => r.quests?.filter(q => q.status === 'completed') || []);


    return (
        <div className="p-5 space-y-5 text-sm text-stone-200">
            <div className={`${PANEL} p-5 space-y-3`}>
                <div className="flex items-center gap-3">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-black/40 border border-white/10 text-amber-200">
                        <Users className="h-6 w-6" />
                    </span>
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.35em] text-amber-200">Rede Social</p>
                        <h3 className="text-2xl font-serif text-white">Relações & Missões</h3>
                    </div>
                </div>
                <p className="text-xs text-stone-400">Conexões vivas definem bônus, aliados e perigos atuais.</p>
            </div>

            <div className={`${PANEL} p-4 space-y-3`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-200 uppercase tracking-widest">
                    <Target className="h-4 w-4" /> Missões Ativas
                </div>
                {activeQuests.length > 0 ? (
                    <div className="space-y-4">
                        {activeQuests.map(q => <QuestItem key={q.id} quest={q} />)}
                    </div>
                ) : (
                    <p className="text-sm text-stone-500 italic">Você não tem missões ativas.</p>
                )}
            </div>

            <div className={`${PANEL} p-4 space-y-4`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-stone-100 uppercase tracking-widest">
                    <HeartHandshake className="h-4 w-4" /> Personagens Conhecidos
                </div>
                <div className="space-y-4">
                    {character.relationships.map(rel => (
                        <div key={rel.npcId} className="rounded-3xl border border-white/10 bg-black/40 p-4 space-y-3">
                            <div className="flex justify-between items-start gap-3">
                                <div>
                                    <h5 className="font-semibold text-stone-100 text-lg">{rel.name}</h5>
                                    <p className="text-sm text-stone-400 italic">{rel.description}</p>
                                </div>
                                <span className={`px-2 py-1 text-xs font-bold rounded-full text-white/90 ${statusMap[rel.status]?.color || 'bg-stone-500'}`}>{statusMap[rel.status]?.label || rel.status}</span>
                            </div>
                            <AffinityBar affinity={rel.affinity} />
                        </div>
                    ))}
                </div>
            </div>

            {completedQuests.length > 0 && (
                <div className={`${PANEL} p-4 space-y-3`}>
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300 uppercase tracking-widest">
                        <Trophy className="h-4 w-4" /> Missões Concluídas
                    </div>
                    <div className="space-y-3 opacity-80">
                        {completedQuests.map(q => <QuestItem key={q.id} quest={q} />)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewRelationships;
