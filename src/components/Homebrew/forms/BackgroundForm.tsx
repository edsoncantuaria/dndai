// src/components/Homebrew/forms/BackgroundForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import type { ApiListItem } from '@/types';
import * as characterUtils from '@/utils/characterUtils';
import { translateApiString } from '@/utils/translator';

interface Props {
    onDataChange: (data: any) => void;
}

const BackgroundForm: React.FC<Props> = ({ onDataChange }) => {
    const [bgData, setBgData] = useState({
        name: '',
        starting_proficiencies: [] as ApiListItem[],
        feature: { name: '', desc: [''] },
        personality_traits: { choose: 2, type: 'personality_traits', from: { option_set_type: 'options_array', options: Array(8).fill('').map(() => ({option_type: 'string', string: ''}))}},
        ideals: { choose: 1, type: 'ideals', from: { option_set_type: 'options_array', options: Array(6).fill('').map(() => ({option_type: 'ideal', desc: ''}))}},
        bonds: { choose: 1, type: 'bonds', from: { option_set_type: 'options_array', options: Array(6).fill('').map(() => ({option_type: 'string', string: ''}))}},
        flaws: { choose: 1, type: 'flaws', from: { option_set_type: 'options_array', options: Array(6).fill('').map(() => ({option_type: 'string', string: ''}))}},
        language_options: { choose: 0, type: 'languages', from: { option_set_type: "resource_list", resource_list_url: "/api/languages" } },
        starting_equipment: [],
        starting_equipment_options: [],
    });

     const updateParent = (newData: any) => {
        const fullData = {
            ...newData,
            index: newData.name.toLowerCase().replace(/\s+/g, '-') || `custom-bg-${Date.now()}`
        };
        onDataChange(fullData);
    };

    const handleFieldChange = (field: keyof typeof bgData, value: any) => {
        const newData = { ...bgData, [field]: value };
        setBgData(newData);
        updateParent(newData);
    };

    const handleListChange = (type: 'personality_traits' | 'ideals' | 'bonds' | 'flaws', index: number, value: string) => {
        const newOptions = [...bgData[type].from.options];
        const key = newOptions[index].option_type === 'ideal' ? 'desc' : 'string';
        newOptions[index][key] = value;
        handleFieldChange(type, { ...bgData[type], from: { ...bgData[type].from, options: newOptions }});
    }

    const typeLabels: Record<string, string> = {
        personality_traits: 'Traços de Personalidade',
        ideals: 'Ideais',
        bonds: 'Vínculos',
        flaws: 'Defeitos'
    };

    return (
        <div className="space-y-6">
            <h4 className="text-lg font-bold text-amber-300 border-b border-amber-800 pb-2">Informações Básicas</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-stone-300 mb-1">Nome do Antecedente</label>
                    <input type="text" value={bgData.name} onChange={e => handleFieldChange('name', e.target.value)} required className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-stone-300 mb-1">Idiomas Adicionais</label>
                    <input type="number" min="0" max="4" value={bgData.language_options.choose} onChange={e => handleFieldChange('language_options', {...bgData.language_options, choose: Number(e.target.value) })} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">Proficiências em Perícias</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {characterUtils.ALL_SKILLS.map(skill => {
                        const skillIndex = `skill-${skill.toLowerCase().replace(/ /g, '-')}`;
                        const isChecked = bgData.starting_proficiencies.some(p => p.index === skillIndex);
                        return (
                            <label key={skillIndex} className={`flex items-center gap-2 p-2 rounded-md border text-sm transition-colors ${isChecked ? 'bg-amber-900/50 border-amber-700' : 'bg-stone-800/80 border-stone-700'}`}>
                                <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                        const newProfs = e.target.checked 
                                            ? [...bgData.starting_proficiencies, { index: skillIndex, name: `Skill: ${skill}`, url: `/api/proficiencies/${skillIndex}` }]
                                            : bgData.starting_proficiencies.filter(p => p.index !== skillIndex);
                                        handleFieldChange('starting_proficiencies', newProfs);
                                    }}
                                    className="form-checkbox text-amber-500 bg-stone-700 border-stone-600 rounded"
                                />
                                {translateApiString(skill)}
                            </label>
                        )
                    })}
                </div>
            </div>

            <h4 className="text-lg font-bold text-amber-300 border-b border-amber-800 pb-2">Característica</h4>
             <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">Nome da Característica</label>
                <input type="text" value={bgData.feature.name} onChange={e => handleFieldChange('feature', {...bgData.feature, name: e.target.value})} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
            </div>
             <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">Descrição da Característica</label>
                <textarea value={bgData.feature.desc[0]} onChange={e => handleFieldChange('feature', {...bgData.feature, desc: [e.target.value]})} rows={3} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
            </div>
            
            {Object.keys(typeLabels).map((type) => (
                <div key={type}>
                    <h4 className="text-lg font-bold text-amber-300 border-b border-amber-800 pb-2">{typeLabels[type]}</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        {bgData[type as keyof typeof bgData].from.options.map((opt: any, index: number) => (
                             <input key={index} type="text" value={opt.string || opt.desc} onChange={(e) => handleListChange(type as any, index, e.target.value)} placeholder={`Opção ${index + 1}`} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200 text-sm"/>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
};

export default BackgroundForm;
