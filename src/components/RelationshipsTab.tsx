// components/RelationshipsTab.tsx
import React from 'react';
import { Icons } from './Icons';
import { useGameStateContext } from '../contexts/GameStateContext';
import { Relationship } from '../types';

const statusMap: Record<Relationship['status'], { label: string, color: string, value: number }> = {
    'hostile': { label: 'Hostil', color: 'bg-red-600', value: 10 },
    'unfriendly': { label: 'Inamistoso', color: 'bg-orange-600', value: 30 },
    'neutral': { label: 'Neutro', color: 'bg-yellow-500', value: 50 },
    'friendly': { label: 'Amigável', color: 'bg-cyan-500', value: 75 },
    'ally': { label: 'Aliado', color: 'bg-green-500', value: 100 },
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
                <div className="space-y-3">
                    {character.relationships.map(rel => {
                        const statusInfo = statusMap[rel.status];
                        return (
                            <div key={rel.npcId} className="bg-stone-800/70 p-3 rounded-lg border border-stone-700">
                                <h4 className="font-semibold text-stone-200">{rel.name}</h4>
                                <p className="text-sm text-stone-400 italic mb-2">{rel.description}</p>
                                <div className="w-full bg-stone-700 rounded-full h-4 border border-stone-600 overflow-hidden relative">
                                    <div 
                                        className={`${statusInfo.color} h-full rounded-full transition-all duration-300`} 
                                        style={{ width: `${statusInfo.value}%`}}
                                    ></div>
                                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-lighten">
                                        {statusInfo.label}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
};

export default RelationshipsTab;