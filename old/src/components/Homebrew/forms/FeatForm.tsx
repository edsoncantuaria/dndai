// src/components/Homebrew/forms/FeatForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import * as characterUtils from '@/utils/characterUtils';
import type { Attributes } from '@/types';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { hb, hbChipClass, hbTileClass } from '@/features/homebrew/forms/formUi';

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
        const fullData = {
            ...featData,
            index: featData.official_index || (featData.name || '').toLowerCase().replace(/\s+/g, '-') || `custom-feat-${Date.now()}`
        };
        const { official_index, ...finalData } = fullData; // Remove o campo auxiliar
        onDataChange(finalData);
    }, [featData, onDataChange]);

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
        <div className={hb.root}>
            <div>
                <label htmlFor="feat-name" className={hb.label}>Nome do Talento</label>
                <input id="feat-name" type="text" value={featData.name} onChange={e => handleFieldChange('name', e.target.value)} required className={hb.control} placeholder="Ex: Mestre de Armas de Haste"/>
            </div>
            {user?.id === 1 && (
                <div>
                    <label htmlFor="official_index" className={hb.label}>Índice Oficial (para Sobrescrever/Traduzir)</label>
                    <input id="official_index" type="text" value={featData.official_index} onChange={e => handleFieldChange('official_index', e.target.value)} className={hb.control} placeholder="Ex: grappler (opcional)"/>
                </div>
            )}
            <div>
                <label htmlFor="feat-desc" className={hb.label}>Descrição</label>
                <textarea id="feat-desc" value={featData.desc[0]} onChange={e => handleFieldChange('desc', [e.target.value])} required rows={5} className={hb.control} placeholder="Descreva os benefícios e as regras do talento."/>
            </div>
            
            <div className={hb.dividerSection}>
                 <h5 className={hb.headingSm}>Pré-requisitos</h5>
                 <div className="space-y-2">
                    {featData.prerequisites.map((prereq, index) => (
                        <div key={index} className={hb.row}>
                            <select 
                                value={prereq.ability_score.index} 
                                onChange={e => handlePrerequisiteChange(index, 'ability_score', e.target.value)} 
                                className={hb.controlSm}
                            >
                                {Object.keys(characterUtils.ATTRIBUTE_SHORT_MAP).map(attr => (
                                    <option key={attr} value={attr}>{attr.toUpperCase()}</option>
                                ))}
                            </select>
                            <input 
                                type="number" 
                                value={prereq.minimum_score} 
                                onChange={e => handlePrerequisiteChange(index, 'minimum_score', e.target.value)} 
                                className={`${hb.controlSm} w-24`}
                                placeholder="Pontos"
                            />
                            <button type="button" onClick={() => removePrerequisite(index)} className={hb.btnDanger}>
                                <Trash2 className="h-4 w-4"/>
                            </button>
                        </div>
                    ))}
                 </div>
                 <button type="button" onClick={addPrerequisite} className={hb.linkBtn}>
                    <Plus className="h-4 w-4"/> Adicionar Pré-requisito
                </button>
            </div>
        </div>
    );
};

export default FeatForm;
