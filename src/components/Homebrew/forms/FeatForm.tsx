// src/components/Homebrew/forms/FeatForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import * as characterUtils from '@/utils/characterUtils';
import type { Attributes } from '@/types';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Prerequisite {
    ability_score: { index: string; name: string, url: string };
    minimum_score: number;
}

interface Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

const FeatForm: React.FC<Props> = ({ onDataChange, initialData }) => {
    const { user } = useAuth();
    const [featData, setFeatData] = useState(() => ({
        name: '',
        desc: [''],
        prerequisites: [],
        official_index: '',
        ...initialData,
        desc: initialData?.desc || [''],
    }));

    useEffect(() => {
        if (initialData && Object.keys(initialData).length > 0) {
            setFeatData(prev => ({
                ...prev,
                ...initialData,
                desc: initialData.desc || [''],
                prerequisites: initialData.prerequisites || [],
            }));
        }
    }, [initialData]);

    useEffect(() => {
        onDataChange(featData);
    }, [featData]);

    const handleFieldChange = (field: keyof typeof featData, value: any) => {
        setFeatData(prev => ({ ...prev, [field]: value }));
    };

    const handlePrerequisiteChange = (index: number, field: 'ability_score' | 'minimum_score', value: string | number) => {
        const newPrerequisites = [...featData.prerequisites];
        const abilityScoreIndex = value as string;
        if (field === 'ability_score') {
            newPrerequisites[index].ability_score = { index: abilityScoreIndex, name: (abilityScoreIndex as string).toUpperCase(), url: `/api/ability-scores/${abilityScoreIndex}` };
        } else {
            newPrerequisites[index].minimum_score = Number(value);
        }
        handleFieldChange('prerequisites', newPrerequisites);
    };

    const addPrerequisite = () => {
        handleFieldChange('prerequisites', [...featData.prerequisites, { ability_score: { index: 'str', name: 'STR', url:'' }, minimum_score: 13 }]);
    };

    const removePrerequisite = (index: number) => {
        handleFieldChange('prerequisites', featData.prerequisites.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="feat-name" className="block text-sm font-medium text-stone-300 mb-1">Nome do Talento</label>
                <input id="feat-name" type="text" value={featData.name} onChange={e => handleFieldChange('name', e.target.value)} required className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" placeholder="Ex: Mestre de Armas de Haste"/>
            </div>
            {user?.id === 1 && (
                <div>
                    <label htmlFor="official_index" className="block text-sm font-medium text-stone-300 mb-1">Índice Oficial (para Sobrescrever)</label>
                    <input id="official_index" type="text" value={featData.official_index} onChange={e => handleFieldChange('official_index', e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" placeholder="Ex: grappler (opcional)"/>
                </div>
            )}
            <div>
                <label htmlFor="feat-desc" className="block text-sm font-medium text-stone-300 mb-1">Descrição</label>
                <textarea id="feat-desc" value={featData.desc[0]} onChange={e => handleFieldChange('desc', [e.target.value])} required rows={5} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" placeholder="Descreva os benefícios e as regras do talento."/>
            </div>
            
            <div className="pt-4 border-t border-stone-700/60">
                 <h5 className="text-sm font-medium text-stone-300 mb-2">Pré-requisitos</h5>
                 <div className="space-y-2">
                    {featData.prerequisites.map((prereq, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-stone-900/50 rounded-md">
                            <select 
                                value={prereq.ability_score.index} 
                                onChange={e => handlePrerequisiteChange(index, 'ability_score', e.target.value)} 
                                className="bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200"
                            >
                                {Object.keys(characterUtils.ATTRIBUTE_SHORT_MAP).map(attr => (
                                    <option key={attr} value={attr}>{attr.toUpperCase()}</option>
                                ))}
                            </select>
                            <input 
                                type="number" 
                                value={prereq.minimum_score} 
                                onChange={e => handlePrerequisiteChange(index, 'minimum_score', e.target.value)} 
                                className="w-24 bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200"
                                placeholder="Pontos"
                            />
                            <button type="button" onClick={() => removePrerequisite(index)} className="p-2 text-red-500 hover:text-red-400">
                                <Trash2 className="h-4 w-4"/>
                            </button>
                        </div>
                    ))}
                 </div>
                 <button type="button" onClick={addPrerequisite} className="mt-2 text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1">
                    <Plus className="h-4 w-4"/> Adicionar Pré-requisito
                </button>
            </div>
        </div>
    );
};

export default FeatForm;
