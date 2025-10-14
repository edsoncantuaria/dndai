// src/components/Homebrew/forms/MonsterForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { translateApiString, translateAttribute } from '@/utils/translator';
import { Attributes } from '@/types';
import * as DndApiService from '@/services/dndApiService';
import type { ApiListItem } from '@/types';
import { Loader2 } from 'lucide-react';
import * as characterUtils from '@/utils/characterUtils';


interface Props {
    onDataChange: (data: any) => void;
}

const SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
const TYPES = ["Aberration", "Beast", "Celestial", "Construct", "Dragon", "Elemental", "Fey", "Fiend", "Giant", "Humanoid", "Monstrosity", "Ooze", "Plant", "Undead"];
const ALIGNMENTS = [
    "Lawful Good", "Neutral Good", "Chaotic Good",
    "Lawful Neutral", "True Neutral", "Chaotic Neutral",
    "Lawful Evil", "Neutral Evil", "Chaotic Evil",
    "Unaligned"
];
const attributeOrder: (keyof Attributes)[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];


const MonsterForm: React.FC<Props> = ({ onDataChange }) => {
    const [monsterData, setMonsterData] = useState({
        name: '',
        size: 'Medium',
        type: 'Beast',
        alignment: 'Unaligned',
        armor_class: 10,
        hit_points: 10,
        hit_dice: '2d8',
        speed: { walk: '30 ft.'} as Record<string, string>,
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
        proficiencies: [] as { proficiency: { index: string, name: string }, value: number }[],
        damage_vulnerabilities: [] as string[],
        damage_resistances: [] as string[],
        damage_immunities: [] as string[],
        condition_immunities: [] as { index: string, name: string }[],
        senses: { passive_perception: 10 } as Record<string, any>,
        languages: '',
    });
    
    const [damageTypes, setDamageTypes] = useState<ApiListItem[]>([]);
    const [conditions, setConditions] = useState<ApiListItem[]>([]);
    const [skills, setSkills] = useState<ApiListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fullData = {
            ...monsterData,
            index: monsterData.name.toLowerCase().replace(/\s+/g, '-') || `custom-monster-${Date.now()}`
        };
        onDataChange(fullData);
    }, [monsterData, onDataChange]);

     useEffect(() => {
        const fetchOptions = async () => {
            setIsLoading(true);
            try {
                const [damageTypesData, conditionsData, skillsData] = await Promise.all([
                    DndApiService.getDamageTypes(),
                    DndApiService.getConditions(),
                    DndApiService.getSkills(),
                ]);
                setDamageTypes(damageTypesData?.results || []);
                setConditions(conditionsData?.results || []);
                setSkills(skillsData?.results || []);
            } catch (error) {
                console.error("Failed to fetch monster form options:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchOptions();
    }, []);

    const handleFieldChange = (field: keyof typeof monsterData, value: any) => {
        setMonsterData(prev => ({ ...prev, [field]: value }));
    };
    
    const handleSpeedChange = (speedType: 'walk' | 'swim' | 'fly' | 'burrow' | 'climb', value: string) => {
        const newSpeed = { ...monsterData.speed };
        if (value) {
            newSpeed[speedType] = value;
        } else {
            delete newSpeed[speedType];
        }
        handleFieldChange('speed', newSpeed);
    }
    
    const handleSensesChange = (sense: string, value: string) => {
        const newSenses = { ...monsterData.senses, [sense]: value };
        if (!value) delete newSenses[sense];
        handleFieldChange('senses', newSenses);
    }

    const handleMultiSelectChange = (field: 'damage_vulnerabilities' | 'damage_resistances' | 'damage_immunities' | 'condition_immunities', value: string) => {
        const currentValues = (monsterData[field] as any[]).map(item => typeof item === 'object' ? item.index : item);
        const newValues = currentValues.includes(value)
            ? currentValues.filter(v => v !== value)
            : [...currentValues, value];

        if (field === 'condition_immunities') {
            const newObjects = newValues.map(index => conditions.find(c => c.index === index)).filter(Boolean);
            handleFieldChange(field, newObjects);
        } else {
            handleFieldChange(field, newValues);
        }
    };
    
    const handleProficiencyChange = (skillIndex: string, value: string) => {
        const newProfs = [...monsterData.proficiencies];
        const existingIndex = newProfs.findIndex(p => p.proficiency.index === skillIndex);
        const profValue = parseInt(value, 10);

        if (existingIndex > -1) {
            if (isNaN(profValue) || profValue <= 0) {
                newProfs.splice(existingIndex, 1);
            } else {
                newProfs[existingIndex].value = profValue;
            }
        } else if (!isNaN(profValue) && profValue > 0) {
            const skill = skills.find(s => s.index === skillIndex);
            if (skill) {
                newProfs.push({ proficiency: { index: skill.index, name: skill.name }, value: profValue });
            }
        }
        handleFieldChange('proficiencies', newProfs);
    };


    const renderDamageTypeSelector = (field: 'damage_vulnerabilities' | 'damage_resistances' | 'damage_immunities', label: string) => (
        <div>
            <h5 className="text-sm font-medium text-stone-300 mb-2">{label}</h5>
             <div className="flex flex-wrap gap-2">
                {damageTypes.map(type => {
                    const isSelected = monsterData[field].includes(type.index);
                    return (
                        <button key={type.index} type="button" onClick={() => handleMultiSelectChange(field, type.index)} className={`px-2 py-1 text-xs rounded-full border transition-colors ${isSelected ? 'bg-amber-600/30 border-amber-500 text-amber-200' : 'bg-stone-700/50 border-stone-600 text-stone-300 hover:border-stone-500'}`}>
                            {translateApiString(type.name)}
                        </button>
                    )
                })}
            </div>
        </div>
    );
    
    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="animate-spin h-8 w-8 text-amber-300"/></div>
    }


    return (
        <div className="space-y-6">
            <div>
                <label htmlFor="monster-name" className="block text-sm font-medium text-stone-300 mb-1">
                    Nome do Monstro
                </label>
                <input
                    id="monster-name"
                    type="text"
                    value={monsterData.name}
                    onChange={e => handleFieldChange('name', e.target.value)}
                    placeholder="Ex: Devorador de Pântano"
                    required
                    className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500"
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="monster-size" className="block text-sm font-medium text-stone-300 mb-1">Tamanho</label>
                    <select
                        id="monster-size"
                        value={monsterData.size}
                        onChange={e => handleFieldChange('size', e.target.value)}
                        className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200"
                    >
                        {SIZES.map(s => <option key={s} value={s}>{translateApiString(s)}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="monster-type" className="block text-sm font-medium text-stone-300 mb-1">Tipo</label>
                    <select
                        id="monster-type"
                        value={monsterData.type}
                        onChange={e => handleFieldChange('type', e.target.value)}
                        className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200"
                    >
                        {TYPES.map(t => <option key={t} value={t}>{translateApiString(t)}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="monster-alignment" className="block text-sm font-medium text-stone-300 mb-1">Alinhamento</label>
                    <select
                        id="monster-alignment"
                        value={monsterData.alignment}
                        onChange={e => handleFieldChange('alignment', e.target.value)}
                        className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200"
                    >
                        {ALIGNMENTS.map(a => <option key={a} value={a}>{translateApiString(a)}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="pt-4 border-t border-stone-700/50">
                 <h4 className="text-lg font-bold text-amber-300 mb-4">Estatísticas de Combate</h4>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="armor_class" className="block text-sm font-medium text-stone-300 mb-1">Classe de Armadura</label>
                        <input id="armor_class" type="number" value={monsterData.armor_class} onChange={e => handleFieldChange('armor_class', Number(e.target.value))} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
                    </div>
                    <div>
                        <label htmlFor="hit_points" className="block text-sm font-medium text-stone-300 mb-1">Pontos de Vida</label>
                        <input id="hit_points" type="number" value={monsterData.hit_points} onChange={e => handleFieldChange('hit_points', Number(e.target.value))} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
                    </div>
                    <div>
                        <label htmlFor="hit_dice" className="block text-sm font-medium text-stone-300 mb-1">Dado de Vida</label>
                        <input id="hit_dice" type="text" value={monsterData.hit_dice} onChange={e => handleFieldChange('hit_dice', e.target.value)} placeholder="Ex: 2d8" className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
                    </div>
                 </div>
            </div>

            <div className="pt-4 border-t border-stone-700/50">
                <h4 className="text-lg font-bold text-amber-300 mb-4">Atributos</h4>
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {attributeOrder.map(attr => (
                        <div key={attr}>
                            <label htmlFor={attr} className="block text-sm font-medium text-stone-300 mb-1">{translateAttribute(attr).substring(0,3).toUpperCase()}</label>
                            <input id={attr} type="number" value={monsterData[attr]} onChange={e => handleFieldChange(attr, Number(e.target.value))} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-center text-stone-200" />
                        </div>
                    ))}
                </div>
            </div>

             <div className="pt-4 border-t border-stone-700/50">
                <h4 className="text-lg font-bold text-amber-300 mb-4">Velocidade</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {(['walk', 'fly', 'swim', 'burrow', 'climb'] as const).map(speedType => (
                         <div key={speedType}>
                            <label htmlFor={`speed-${speedType}`} className="block text-sm font-medium text-stone-300 mb-1 capitalize">{translateApiString(speedType)}</label>
                            <input id={`speed-${speedType}`} type="text" value={monsterData.speed[speedType] || ''} onChange={e => handleSpeedChange(speedType, e.target.value)} placeholder="Ex: 30 ft." className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
                        </div>
                    ))}
                </div>
            </div>

             <div className="pt-4 border-t border-stone-700/50">
                <h4 className="text-lg font-bold text-amber-300 mb-4">Perícias</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {skills.map(skill => {
                        const prof = monsterData.proficiencies.find(p => p.proficiency.index === skill.index);
                        return (
                             <div key={skill.index} className="flex items-center gap-2">
                                <label htmlFor={`skill-${skill.index}`} className="flex-1 text-sm text-stone-300">{translateApiString(skill.name.replace('Skill: ', ''))}</label>
                                <input id={`skill-${skill.index}`} type="number" value={prof?.value || ''} onChange={(e) => handleProficiencyChange(skill.index, e.target.value)} placeholder="+0" className="w-20 bg-stone-800 border-stone-700 rounded-md p-1 text-center text-stone-200" />
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="pt-4 border-t border-stone-700/50 space-y-4">
                <h4 className="text-lg font-bold text-amber-300">Resistências, Vulnerabilidades e Imunidades</h4>
                {renderDamageTypeSelector('damage_vulnerabilities', 'Vulnerabilidades a Dano')}
                {renderDamageTypeSelector('damage_resistances', 'Resistências a Dano')}
                {renderDamageTypeSelector('damage_immunities', 'Imunidades a Dano')}
                <div>
                     <h5 className="text-sm font-medium text-stone-300 mb-2">Imunidades a Condição</h5>
                    <div className="flex flex-wrap gap-2">
                        {conditions.map(cond => {
                            const isSelected = monsterData.condition_immunities.some(ci => ci.index === cond.index);
                            return (
                                <button key={cond.index} type="button" onClick={() => handleMultiSelectChange('condition_immunities', cond.index)} className={`px-2 py-1 text-xs rounded-full border transition-colors ${isSelected ? 'bg-amber-600/30 border-amber-500 text-amber-200' : 'bg-stone-700/50 border-stone-600 text-stone-300 hover:border-stone-500'}`}>
                                    {translateApiString(cond.name)}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
            
            <div className="pt-4 border-t border-stone-700/50">
                 <h4 className="text-lg font-bold text-amber-300 mb-4">Sentidos e Idiomas</h4>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                     <div>
                        <label htmlFor="senses-darkvision" className="block text-sm font-medium text-stone-300 mb-1">Visão no Escuro</label>
                        <input id="senses-darkvision" type="text" value={monsterData.senses.darkvision || ''} onChange={e => handleSensesChange('darkvision', e.target.value)} placeholder="Ex: 60 ft." className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
                    </div>
                    <div>
                        <label htmlFor="senses-blindsight" className="block text-sm font-medium text-stone-300 mb-1">Visão Cega</label>
                        <input id="senses-blindsight" type="text" value={monsterData.senses.blindsight || ''} onChange={e => handleSensesChange('blindsight', e.target.value)} placeholder="Ex: 10 ft." className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
                    </div>
                     <div>
                        <label htmlFor="senses-tremorsense" className="block text-sm font-medium text-stone-300 mb-1">Sentido Sísmico</label>
                        <input id="senses-tremorsense" type="text" value={monsterData.senses.tremorsense || ''} onChange={e => handleSensesChange('tremorsense', e.target.value)} placeholder="Ex: 30 ft." className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
                    </div>
                      <div>
                        <label htmlFor="senses-truesight" className="block text-sm font-medium text-stone-300 mb-1">Visão Verdadeira</label>
                        <input id="senses-truesight" type="text" value={monsterData.senses.truesight || ''} onChange={e => handleSensesChange('truesight', e.target.value)} placeholder="Ex: 120 ft." className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
                    </div>
                     <div>
                        <label htmlFor="senses-passive_perception" className="block text-sm font-medium text-stone-300 mb-1">Percepção Passiva</label>
                        <input id="senses-passive_perception" type="number" value={monsterData.senses.passive_perception} onChange={e => handleSensesChange('passive_perception', e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
                    </div>
                 </div>
                 <div className="mt-4">
                    <label htmlFor="monster-languages" className="block text-sm font-medium text-stone-300 mb-1">Idiomas</label>
                    <input id="monster-languages" type="text" value={monsterData.languages} onChange={e => handleFieldChange('languages', e.target.value)} placeholder="Ex: Comum, Dracônico, telepatia 120 ft." className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
                </div>
            </div>

        </div>
    );
};

export default MonsterForm;
