
// src/components/Homebrew/forms/BackgroundForm.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import type { ApiListItem, ApiEquipmentOption } from '@/types';
import * as characterUtils from '@/utils/creationHelpers';
import * as DndApiService from '@/services/dndApiService';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import * as CharUtils from '@/utils/characterUtils';

interface Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

const defaultBgData = {
    name: '',
    starting_proficiencies: [] as ApiListItem[],
    feature: { name: '', desc: [''] },
    personality_traits: { choose: 2, type: 'personality_traits', from: { option_set_type: 'options_array', options: Array(8).fill('').map(() => ({option_type: 'string', string: ''}))}},
    ideals: { choose: 1, type: 'ideals', from: { option_set_type: 'options_array', options: Array(6).fill('').map(() => ({option_type: 'ideal', desc: ''}))}},
    bonds: { choose: 1, type: 'bonds', from: { option_set_type: 'options_array', options: Array(6).fill('').map(() => ({option_type: 'string', string: ''}))}},
    flaws: { choose: 1, type: 'flaws', from: { option_set_type: 'options_array', options: Array(6).fill('').map(() => ({option_type: 'string', string: ''}))}},
    language_options: { choose: 0, type: 'languages', from: { option_set_type: "resource_list", resource_list_url: "/api/languages" } },
    starting_equipment: [] as { equipment: ApiListItem, quantity: number }[],
    starting_equipment_options: [] as { choose: number, type: string, from: { option_set_type: string, options: ApiEquipmentOption[] } }[],
    official_index: '',
};

const EquipmentSelector: React.FC<{ onSelect: (item: ApiListItem) => void }> = ({ onSelect }) => {
    const [equipment, setEquipment] = useState<ApiListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchEquipment = async () => {
            try {
                const eqList = await DndApiService.getEquipment();
                setEquipment(eqList.map(e => ({ index: e.index, name: e.name, url: '' })));
            } catch (error) {
                console.error("Failed to fetch equipment", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchEquipment();
    }, []);

    const filteredEquipment = equipment.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (isLoading) return <Loader2 className="animate-spin" />;

    return (
        <div className='bg-stone-900 p-4 rounded-md'>
            <input
                type="text"
                placeholder="Buscar equipamento..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-stone-800 border-stone-600 rounded-md p-2 mb-2"
            />
            <div className="max-h-48 overflow-y-auto">
                {filteredEquipment.map(item => (
                    <button
                        key={item.index}
                        type="button"
                        onClick={() => onSelect(item)}
                        className="w-full text-left p-2 hover:bg-stone-700 rounded"
                    >
                        {item.name}
                    </button>
                ))}
            </div>
        </div>
    );
};


const BackgroundForm: React.FC<Props> = ({ onDataChange, initialData }) => {
    const { user } = useAuth();
    const [bgData, setBgData] = useState({
        ...defaultBgData,
        ...initialData,
        feature: { ...defaultBgData.feature, ...(initialData?.feature || {}) },
        language_options: { ...defaultBgData.language_options, ...(initialData?.language_options || {}) },
        starting_proficiencies: initialData?.starting_proficiencies || [],
        starting_equipment: initialData?.starting_equipment || [],
        starting_equipment_options: initialData?.starting_equipment_options || [],
    });

     useEffect(() => {
        const fullData = {
            ...bgData,
            index: bgData.official_index || (bgData.name || '').toLowerCase().replace(/\s+/g, '-') || `custom-bg-${Date.now()}`
        };
        const { official_index, ...finalData } = fullData;
        onDataChange(finalData);
    }, [bgData, onDataChange]);

    const handleFieldChange = (field: keyof typeof bgData, value: any) => {
        setBgData(prev => ({ ...prev, [field]: value }));
    };
    
    // --- Starting Equipment Handlers ---
    const addStartingEquipment = (item: ApiListItem) => {
        handleFieldChange('starting_equipment', [...bgData.starting_equipment, { equipment: item, quantity: 1 }]);
    };
    const updateStartingEquipmentQty = (index: number, quantity: number) => {
        const newList = [...bgData.starting_equipment];
        if (quantity <= 0) {
            newList.splice(index, 1);
        } else {
            newList[index].quantity = quantity;
        }
        handleFieldChange('starting_equipment', newList);
    };
    const removeStartingEquipment = (index: number) => {
        handleFieldChange('starting_equipment', bgData.starting_equipment.filter((_, i) => i !== index));
    };

    // --- Equipment Options Handlers ---
    const addEquipmentOptionGroup = () => {
        const newGroup = { choose: 1, type: 'equipment', from: { option_set_type: 'options_array', options: [] } };
        handleFieldChange('starting_equipment_options', [...bgData.starting_equipment_options, newGroup]);
    };
    const removeEquipmentOptionGroup = (groupIndex: number) => {
        handleFieldChange('starting_equipment_options', bgData.starting_equipment_options.filter((_, i) => i !== groupIndex));
    };
    const addOptionToGroup = (groupIndex: number, item: ApiListItem) => {
        const newGroups = [...bgData.starting_equipment_options];
        const newOption: ApiEquipmentOption = { option_type: 'counted_reference', count: 1, of: item };
        newGroups[groupIndex].from.options.push(newOption);
        handleFieldChange('starting_equipment_options', newGroups);
    };
    const removeOptionFromGroup = (groupIndex: number, optionIndex: number) => {
        const newGroups = [...bgData.starting_equipment_options];
        newGroups[groupIndex].from.options.splice(optionIndex, 1);
        handleFieldChange('starting_equipment_options', newGroups);
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
                {user?.id === 1 && (
                    <div>
                        <label className="block text-sm font-medium text-stone-300 mb-1">Índice Oficial (para Sobrescrever/Traduzir)</label>
                        <input type="text" value={bgData.official_index} onChange={e => handleFieldChange('official_index', e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" placeholder="Ex: acolyte (opcional)"/>
                    </div>
                )}
                 <div>
                    <label className="block text-sm font-medium text-stone-300 mb-1">Idiomas Adicionais</label>
                    <input type="number" min="0" max="4" value={bgData.language_options.choose} onChange={e => handleFieldChange('language_options', {...bgData.language_options, choose: Number(e.target.value) })} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">Proficiências em Perícias</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CharUtils.ALL_SKILLS.map(skill => {
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
                                {skill}
                            </label>
                        )
                    })}
                </div>
            </div>

            <h4 className="text-lg font-bold text-amber-300 border-b border-amber-800 pb-2">Equipamento</h4>
            <div className='space-y-4'>
                <p className='text-sm text-stone-400'>Adicione os itens que este antecedente concede.</p>
                
                {/* Equipamento Inicial Fixo */}
                <div className='space-y-2'>
                    <label className='block text-sm font-medium text-stone-300'>Itens Iniciais Fixos</label>
                    {bgData.starting_equipment.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 bg-stone-800/50 p-2 rounded-md">
                            <span className="flex-grow text-stone-200">{item.equipment.name}</span>
                            <input type="number" min="1" value={item.quantity} onChange={e => updateStartingEquipmentQty(index, parseInt(e.target.value))} className="w-16 bg-stone-900 border-stone-700 rounded-md p-1 text-center" />
                            <button type="button" onClick={() => removeStartingEquipment(index)} className="text-red-400 hover:text-red-300"><Trash2 className="h-4 w-4"/></button>
                        </div>
                    ))}
                     <EquipmentSelector onSelect={addStartingEquipment} />
                </div>

                {/* Opções de Equipamento */}
                <div className='space-y-2'>
                    <label className='block text-sm font-medium text-stone-300'>Grupos de Escolha de Equipamento</label>
                    {bgData.starting_equipment_options.map((group, groupIndex) => (
                        <div key={groupIndex} className="bg-stone-800/50 p-3 rounded-md border border-stone-700 space-y-2">
                             <div className="flex justify-between items-center">
                                <p className="text-stone-300">Escolha {group.choose} de:</p>
                                <button type="button" onClick={() => removeEquipmentOptionGroup(groupIndex)} className="text-red-400 hover:text-red-300"><Trash2 className="h-4 w-4"/></button>
                            </div>
                            {group.from.options.map((opt, optIndex) => (
                                <div key={optIndex} className="flex items-center gap-2">
                                    <span className="flex-grow text-stone-200">{(opt as any).of.name}</span>
                                     <button type="button" onClick={() => removeOptionFromGroup(groupIndex, optIndex)} className="text-red-400 hover:text-red-300"><Trash2 className="h-4 w-4"/></button>
                                </div>
                            ))}
                             <EquipmentSelector onSelect={(item) => addOptionToGroup(groupIndex, item)} />
                        </div>
                    ))}
                    <button type="button" onClick={addEquipmentOptionGroup} className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"><Plus className="h-4 w-4"/> Adicionar Grupo de Escolha</button>
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
                    <h4 className="text-lg font-bold text-amber-300 border-b border-amber-800 pb-2">{typeLabels[type as keyof typeof typeLabels]}</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        {(bgData[type as keyof typeof bgData] as any).from.options.map((opt: any, index: number) => (
                             <input key={index} type="text" value={opt.string || opt.desc} onChange={(e) => handleListChange(type as any, index, e.target.value)} placeholder={`Opção ${index + 1}`} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200 text-sm"/>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
};

export default BackgroundForm;
