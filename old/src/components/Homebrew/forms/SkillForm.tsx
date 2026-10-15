// src/components/Homebrew/forms/SkillForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import * as DndApiService from '@/services/dndApiService';
import { useAuth } from '@/contexts/AuthContext';
import { ApiListItem } from '@/types';
import { Loader2 } from 'lucide-react';
import { hb, hbChipClass, hbTileClass } from '@/features/homebrew/forms/formUi';

interface Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

type SkillFormState = {
    name: string;
    desc: string[];
    official_index: string;
    ability_score: { index: string; name: string };
    index?: string;
};

const SkillForm: React.FC<Props> = ({ onDataChange, initialData }) => {
    const { user } = useAuth();
    const [skillData, setSkillData] = useState<SkillFormState>(() => {
        const base: SkillFormState = {
            name: '',
            desc: [''],
            official_index: '',
            ability_score: { index: 'str', name: 'STR' },
        };

        const merged = {
            ...base,
            ...(initialData || {}),
        };

        return {
            ...merged,
            desc: Array.isArray(merged.desc) && merged.desc.length > 0 ? merged.desc : [''],
        };
    });
    
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
    
    const handleFieldChange = <K extends keyof SkillFormState>(field: K, value: SkillFormState[K]) => {
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
            <div className={`${hb.section} text-center p-8`}>
                <p className="font-ui text-sm text-dnd-danger">Apenas administradores podem traduzir ou editar perícias.</p>
            </div>
        );
    }

    return (
        <div className={hb.root}>
            {isLoading ? (
                <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
            ) : (
                <div>
                    <label htmlFor="official_index" className={hb.label}>Perícia Oficial para Traduzir</label>
                    <select 
                        id="official_index" 
                        value={skillData.official_index} 
                        onChange={e => handleOfficialIndexChange(e.target.value)} 
                        className={hb.control}
                    >
                        <option value="">Selecione a perícia original...</option>
                        {allSkills.map(skill => (
                            <option key={skill.index} value={skill.index}>{skill.name}</option>
                        ))}
                    </select>
                </div>
            )}
            <div>
                <label htmlFor="skill-name" className={hb.label}>Nome Traduzido da Perícia</label>
                <input 
                    id="skill-name" 
                    type="text" 
                    value={skillData.name} 
                    onChange={e => handleFieldChange('name', e.target.value)} 
                    required 
                    className={hb.control} 
                    placeholder="Ex: Atletismo"
                />
            </div>
            <div>
                <label htmlFor="skill-desc" className={hb.label}>Descrição</label>
                <textarea 
                    id="skill-desc" 
                    value={skillData.desc[0]} 
                    onChange={e => handleFieldChange('desc', [e.target.value])} 
                    rows={4}
                    className={hb.control} 
                    placeholder="Descrição da perícia em português."
                />
            </div>
        </div>
    );
};

export default SkillForm;
