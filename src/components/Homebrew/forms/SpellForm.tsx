// src/components/Homebrew/forms/SpellForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import * as DndApiService from '@/services/dndApiService';
import { translateApiString, translateMagicSchool } from '@/utils/translator';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import type { ApiListItem } from '@/types';
import ItemSelector from '../ItemSelector';

interface Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

const SpellForm: React.FC<Props> = ({ onDataChange, initialData }) => {
    const [spellData, setSpellData] = useState(initialData || {
        name: '',
        desc: [''],
        level: 0,
        school: { index: '', name: '' },
        casting_time: '1 ação',
        range: 'Toque',
        duration: 'Instantâneo',
        concentration: false,
        components: [] as string[],
        material: '',
        attack_type: '',
        damage: {
            damage_type: { index: '', name: ''},
            damage_at_character_level: {} as Record<string, string>,
            damage_at_slot_level: {} as Record<string, string>,
        }
    });
    const [magicSchools, setMagicSchools] = useState<ApiListItem[]>([]);
    const [damageTypes, setDamageTypes] = useState<ApiListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOptions = async () => {
            try {
                setIsLoading(true);
                const [schools, damages] = await Promise.all([
                    DndApiService.getMagicSchools(),
                    DndApiService.getDamageTypes()
                ]);
                
                setMagicSchools(schools?.results || []);
                setDamageTypes(damages?.results || []);

                if (!spellData.school.index && schools?.results?.length > 0) {
                    const defaultSchool = schools.results[0];
                    handleFieldChange('school', { index: defaultSchool.index, name: defaultSchool.name });
                }
                 if (!spellData.damage.damage_type.index && damages?.results?.length > 0) {
                    const defaultDamage = damages.results[0];
                    handleDamageChange('damage_type', { index: defaultDamage.index, name: defaultDamage.name });
                }
            } catch (error) {
                console.error("Falha ao buscar opções de magia:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const fullData = { ...spellData };

        if(!fullData.attack_type) delete fullData.attack_type;
        
        if (!fullData.attack_type || !fullData.damage?.damage_type?.index) {
            delete fullData.damage;
        } else {
             if (Object.keys(fullData.damage.damage_at_character_level || {}).length === 0) delete fullData.damage.damage_at_character_level;
            if (Object.keys(fullData.damage.damage_at_slot_level || {}).length === 0) delete fullData.damage.damage_at_slot_level;
        }

        fullData.index = spellData.name.toLowerCase().replace(/\s+/g, '-') || `custom-spell-${Date.now()}`;
        onDataChange(fullData);
    }, [spellData, onDataChange]);

    const handleFieldChange = (field: keyof typeof spellData, value: any) => {
        setSpellData(prev => ({ ...prev, [field]: value }));
    };
    
    const handleDamageChange = (field: keyof typeof spellData.damage, value: any) => {
        const newDamageData = { ...spellData.damage, [field]: value };
        handleFieldChange('damage', newDamageData);
    };

    const handleScalingChange = (type: 'character' | 'slot', index: number, field: 'level' | 'dice', value: string) => {
        const key = type === 'character' ? 'damage_at_character_level' : 'damage_at_slot_level';
        const currentScaling = Object.entries(spellData.damage[key] || {});
        
        let newLevel = currentScaling[index]?.[0] || '';
        let newDice = currentScaling[index]?.[1] || '';

        if(field === 'level') newLevel = value;
        if(field === 'dice') newDice = value;
        
        const newScaling: Record<string, string> = {};
        currentScaling.forEach((entry, i) => {
            if (i !== index) {
                newScaling[entry[0]] = entry[1];
            }
        });
        if(newLevel) newScaling[newLevel] = newDice;

        handleDamageChange(key, newScaling);
    };

    const addScalingEntry = (type: 'character' | 'slot') => {
        const key = type === 'character' ? 'damage_at_character_level' : 'damage_at_slot_level';
        const currentEntries = Object.keys(spellData.damage[key] || {});
        const newKey = (currentEntries.length + 1).toString();
        const newScaling = {...(spellData.damage[key] || {}), [newKey]: ''};
        handleDamageChange(key, newScaling);
    };
    
    const removeScalingEntry = (type: 'character' | 'slot', level: string) => {
        const key = type === 'character' ? 'damage_at_character_level' : 'damage_at_slot_level';
        const newScaling = {...spellData.damage[key]};
        delete newScaling[level];
        handleDamageChange(key, newScaling);
    };

    const handleComponentChange = (component: 'V' | 'S' | 'M') => {
        const newComponents = spellData.components.includes(component)
            ? spellData.components.filter(c => c !== component)
            : [...spellData.components, component];
        handleFieldChange('components', newComponents);
    };
    
    const CASTING_TIMES = ["1 ação", "1 ação bônus", "1 reação", "1 minuto", "10 minutos", "1 hora", "8 horas", "12 horas", "24 horas"];
    const RANGES = ["Toque", "Pessoal", "Visão", "Ilimitado", "5 pés", "10 pés", "30 pés", "60 pés", "90 pés", "100 pés", "120 pés", "150 pés", "300 pés", "500 pés", "1 milha"];
    const DURATIONS = ["Instantâneo", "1 rodada", "6 rodadas", "1 minuto", "10 minutos", "1 hora", "8 horas", "24 horas", "Até ser dissipado"];

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8" /></div>
    }
    
    const scalingType = spellData.level === 0 ? 'character' : 'slot';
    const scalingLabel = scalingType === 'character' ? 'Nível do Personagem' : 'Nível da Magia';
    const scalingData = spellData.damage[scalingType === 'character' ? 'damage_at_character_level' : 'damage_at_slot_level'] || {};

    return (
        <div className="space-y-4">
             <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">Nome da Magia</label>
                <input type="text" value={spellData.name} onChange={e => handleFieldChange('name', e.target.value)} required className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
            </div>
            <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">Descrição</label>
                <textarea value={spellData.desc[0]} onChange={e => handleFieldChange('desc', [e.target.value])} required rows={4} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-stone-300 mb-1">Nível</label>
                    <select value={spellData.level} onChange={e => handleFieldChange('level', Number(e.target.value))} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200">
                        {Array.from({length: 10}).map((_, i) => <option key={i} value={i}>{i === 0 ? 'Truque' : `${i}º Nível`}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-stone-300 mb-1">Escola de Magia</label>
                    <select value={spellData.school.index} onChange={e => { const school = magicSchools.find(s => s.index === e.target.value); if(school) handleFieldChange('school', {index: school.index, name: school.name })}} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200">
                        {magicSchools.map(s => <option key={s.index} value={s.index}>{translateMagicSchool(s.name)}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-stone-300 mb-1">Tempo de Conjuração</label>
                    <select value={spellData.casting_time} onChange={e => handleFieldChange('casting_time', e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200">
                        {CASTING_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-stone-300 mb-1">Alcance</label>
                    <select value={spellData.range} onChange={e => handleFieldChange('range', e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200">
                        {RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-stone-300 mb-1">Duração</label>
                    <select value={spellData.duration} onChange={e => handleFieldChange('duration', e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200">
                        {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="space-y-2">
                 <label className="block text-sm font-medium text-stone-300">Componentes</label>
                 <div className="flex gap-4">
                    {['V', 'S', 'M'].map(c => ( <label key={c} className="flex items-center gap-2 text-stone-200"><input type="checkbox" checked={spellData.components.includes(c)} onChange={() => handleComponentChange(c as any)} className="form-checkbox text-amber-500 bg-stone-700 border-stone-600 rounded" />{c}</label>))}
                    <label className="flex items-center gap-2 text-stone-200"><input type="checkbox" checked={spellData.concentration} onChange={e => handleFieldChange('concentration', e.target.checked)} className="form-checkbox text-amber-500 bg-stone-700 border-stone-600 rounded" />Concentração</label>
                 </div>
            </div>
            {spellData.components.includes('M') && (
                 <div>
                    <ItemSelector
                        selectedItem={spellData.material}
                        onItemSelect={(itemName) => handleFieldChange('material', itemName)}
                    />
                </div>
            )}
            
            <div className="pt-4 border-t border-stone-700/50">
                 <label className="block text-sm font-medium text-stone-300 mb-1">Tipo de Ataque</label>
                <select value={spellData.attack_type} onChange={e => handleFieldChange('attack_type', e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200">
                    <option value="">Nenhum</option>
                    <option value="ranged">À Distância</option>
                    <option value="melee">Corpo a Corpo</option>
                </select>
            </div>
            
            {spellData.attack_type && (
                <div className="pt-4 border-t border-stone-700/50 space-y-4">
                    <h5 className="text-sm font-medium text-stone-300">Dano e Escalonamento</h5>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                         <div>
                            <label className="block text-sm font-medium text-stone-300 mb-1">Tipo de Dano</label>
                            <select value={spellData.damage.damage_type.index} onChange={e => { const dt = damageTypes.find(d => d.index === e.target.value); if(dt) handleDamageChange('damage_type', { index: dt.index, name: dt.name })}} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200">
                                {damageTypes.map(d => <option key={d.index} value={d.index}>{translateApiString(d.name)}</option>)}
                            </select>
                        </div>
                    </div>
                     <p className="text-xs text-stone-400">Dano base e escalonamento por {scalingLabel}.</p>
                    {Object.entries(scalingData).map(([level, dice], index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-stone-900/50 rounded-md">
                             <input type="number" placeholder={scalingLabel} value={level} onChange={(e) => handleScalingChange(scalingType, index, 'level', e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200" />
                             <input type="text" placeholder="Dado de Dano (ex: 3d8)" value={dice as string} onChange={(e) => handleScalingChange(scalingType, index, 'dice', e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200"/>
                            <button type="button" onClick={() => removeScalingEntry(scalingType, level)} className="text-red-400 hover:text-red-300"><Trash2 className="h-5 w-5" /></button>
                        </div>
                    ))}
                     <button type="button" onClick={() => addScalingEntry(scalingType)} className="mt-2 text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"><Plus className="h-4 w-4" /> Adicionar Escalonamento</button>
                </div>
            )}
        </div>
    );
};

export default SpellForm;
