// src/components/Homebrew/forms/SkillForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import * as DndApiService from '@/services/dndApiService';
import { useAuth } from '@/contexts/AuthContext';
import { ApiListItem } from '@/types';
import { Loader2 } from 'lucide-react';

interface Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

const SkillForm: React.FC<Props> = ({ onDataChange, initialData }) => {
    const { user } = useAuth();
    const [skillData, setSkillData] = useState(() => ({
        name: '',
        desc: [''],
        official_index: '',
        ability_score: { index: 'str', name: 'STR' },
        ...initialData,
        desc: initialData?.desc || [''],
    }));
    
    const [allSkills, setAllSkills] = useState<ApiListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSkills = async () => {
            setIsLoading(true);
            const skills = await DndApiService.getSkills();
            setAllSkills(skills?.results || []);
            setIsLoading(false);
        };
        fetchSkills();
    }, []);

    useEffect(() => {
        // Envia os dados para o componente pai, garantindo que o index esteja correto
        const fullData = {
            ...skillData,
            index: skillData.official_index || (skillData.name || '').toLowerCase().replace(/\s+/g, '-') || `custom-skill-${Date.now()}`,
        };
        const { official_index, ...finalData } = fullData; // Remove o campo auxiliar
        onDataChange(finalData);
    }, [skillData, onDataChange]);
    
    const handleFieldChange = (field: keyof typeof skillData, value: any) => {
        setSkillData(prev => ({ ...prev, [field]: value }));
    };

    const handleOfficialIndexChange = async (index: string) => {
        handleFieldChange('official_index', index);
        if (index) {
            const details = await DndApiService.getSkillDetails(index);
            if (details) {
                setSkillData(prev => ({
                    ...prev,
                    name: prev.name || details.name, // Mantém o nome digitado, se houver
                    desc: details.desc,
                    ability_score: details.ability_score,
                }));
            }
        }
    };
    
    if (user?.id !== 1) {
        return (
            <div className="text-center p-8 bg-stone-800 rounded-lg">
                <p className="text-red-400 font-semibold">Apenas administradores podem traduzir ou editar perícias.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {isLoading ? (
                <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
            ) : (
                <div>
                    <label htmlFor="official_index" className="block text-sm font-medium text-stone-300 mb-1">Perícia Oficial para Traduzir</label>
                    <select 
                        id="official_index" 
                        value={skillData.official_index} 
                        onChange={e => handleOfficialIndexChange(e.target.value)} 
                        className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200"
                    >
                        <option value="">Selecione a perícia original...</option>
                        {allSkills.map(skill => (
                            <option key={skill.index} value={skill.index}>{skill.name}</option>
                        ))}
                    </select>
                </div>
            )}
            <div>
                <label htmlFor="skill-name" className="block text-sm font-medium text-stone-300 mb-1">Nome Traduzido da Perícia</label>
                <input 
                    id="skill-name" 
                    type="text" 
                    value={skillData.name} 
                    onChange={e => handleFieldChange('name', e.target.value)} 
                    required 
                    className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" 
                    placeholder="Ex: Atletismo"
                />
            </div>
            <div>
                <label htmlFor="skill-desc" className="block text-sm font-medium text-stone-300 mb-1">Descrição</label>
                <textarea 
                    id="skill-desc" 
                    value={skillData.desc[0]} 
                    onChange={e => handleFieldChange('desc', [e.target.value])} 
                    rows={4}
                    className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" 
                    placeholder="Descrição da perícia em português."
                />
            </div>
        </div>
    );
};

export default SkillForm;
