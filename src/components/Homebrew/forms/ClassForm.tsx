// src/components/Homebrew/forms/ClassForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import * as characterUtils from '@/utils/characterUtils';
import { translateAttribute, translateApiString } from '@/utils/translator';
import type { ApiListItem } from '@/types';

interface Props {
    onDataChange: (data: any) => void;
}

const HIT_DICE_OPTIONS = [6, 8, 10, 12];
const ALL_ARMOR_PROFS: ApiListItem[] = [
    { index: 'light-armor', name: 'Light Armor', url: '/api/proficiencies/light-armor'},
    { index: 'medium-armor', name: 'Medium Armor', url: '/api/proficiencies/medium-armor'},
    { index: 'heavy-armor', name: 'Heavy Armor', url: '/api/proficiencies/heavy-armor'},
    { index: 'shields', name: 'Shields', url: '/api/proficiencies/shields'},
];
const ALL_WEAPON_PROFS: ApiListItem[] = [
    { index: 'simple-weapons', name: 'Simple Weapons', url: '/api/proficiencies/simple-weapons'},
    { index: 'martial-weapons', name: 'Martial Weapons', url: '/api/proficiencies/martial-weapons'},
]

const ClassForm: React.FC<Props> = ({ onDataChange }) => {
    const [classData, setClassData] = useState({
        name: '',
        hit_die: 8,
        proficiencies: [] as ApiListItem[],
        proficiency_choices: [] as any[],
        saving_throws: [] as ApiListItem[],
    });

    // Update parent component whenever data changes
    useEffect(() => {
        const fullData = {
            ...classData,
            index: classData.name.toLowerCase().replace(/\s+/g, '-') || `custom-class-${Date.now()}`
        };
        onDataChange(fullData);
    }, [classData, onDataChange]);

    const handleFieldChange = (field: keyof typeof classData, value: any) => {
        setClassData(prev => ({ ...prev, [field]: value }));
    };

    const handleSavingThrowToggle = (attrIndex: string) => {
        const newSavingThrows = [...classData.saving_throws];
        const existingIndex = newSavingThrows.findIndex(st => st.index === attrIndex);

        if (existingIndex > -1) {
            newSavingThrows.splice(existingIndex, 1);
        } else if (newSavingThrows.length < 2) {
            newSavingThrows.push({
                index: attrIndex,
                name: attrIndex.toUpperCase(),
                url: `/api/ability-scores/${attrIndex}`
            });
        }
        handleFieldChange('saving_throws', newSavingThrows);
    }
    
    const handleProficiencyToggle = (prof: ApiListItem) => {
        const newProfs = [...classData.proficiencies];
        const existingIndex = newProfs.findIndex(p => p.index === prof.index);
        if (existingIndex > -1) {
            newProfs.splice(existingIndex, 1);
        } else {
            newProfs.push(prof);
        }
        handleFieldChange('proficiencies', newProfs);
    }

    const handleSkillChoiceChange = (
        field: 'choose' | 'options', 
        value: number | string[]
    ) => {
        const newChoices = [...classData.proficiency_choices];
        let skillChoiceGroup = newChoices.find(c => c.type === 'proficiencies' && c.desc.includes("skills"));
        if (!skillChoiceGroup) {
            skillChoiceGroup = { 
                desc: 'Choose skills from the class list', 
                type: 'proficiencies', 
                choose: 2, 
                from: { option_set_type: 'options_array', options: [] }
            };
            newChoices.push(skillChoiceGroup);
        }

        if (field === 'choose') {
            skillChoiceGroup.choose = value as number;
        } else if (field === 'options') {
            skillChoiceGroup.from.options = (value as string[]).map(skillIndex => ({
                option_type: 'reference',
                item: {
                    index: `skill-${skillIndex.toLowerCase().replace(/\s/g, '-')}`,
                    name: `Skill: ${skillIndex}`,
                    url: `/api/proficiencies/skill-${skillIndex.toLowerCase().replace(/\s/g, '-')}`
                }
            }));
        }
        handleFieldChange('proficiency_choices', newChoices);
    };

    const skillChoiceGroup = classData.proficiency_choices.find(c => c.type === 'proficiencies' && c.desc.includes("skills"));
    const selectedSkillOptions = skillChoiceGroup?.from.options.map((opt:any) => opt.item.name.replace('Skill: ', '')) || [];


    return (
        <div className="space-y-6">
             <div>
                <label htmlFor="class-name" className="block text-sm font-medium text-stone-300 mb-1">
                    Nome da Classe
                </label>
                <input 
                    id="class-name" 
                    type="text" 
                    value={classData.name}
                    onChange={e => handleFieldChange('name', e.target.value)}
                    placeholder="Ex: Mestre das Lâminas"
                    required 
                    className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500" 
                />
            </div>
            <div>
                <label htmlFor="hit-die" className="block text-sm font-medium text-stone-300 mb-1">
                    Dado de Vida
                </label>
                <select 
                    id="hit-die"
                    value={classData.hit_die}
                    onChange={e => handleFieldChange('hit_die', Number(e.target.value))}
                    className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200"
                >
                    {HIT_DICE_OPTIONS.map(d => <option key={d} value={d}>d{d}</option>)}
                </select>
            </div>
            {/* Saving Throws */}
            <div>
                <label className="block text-sm font-medium text-stone-300 mb-2">Testes de Resistência (Escolha 2)</label>
                <div className="grid grid-cols-3 gap-2">
                    {Object.keys(characterUtils.ATTRIBUTE_SHORT_MAP).map(attr => (
                        <label key={attr} className={`flex items-center gap-2 p-2 rounded-md border text-sm transition-colors cursor-pointer ${classData.saving_throws.some(s => s.index === attr) ? 'bg-amber-900/50 border-amber-700' : 'bg-stone-800/80 border-stone-700'}`}>
                            <input type="checkbox"
                                checked={classData.saving_throws.some(s => s.index === attr)}
                                onChange={() => handleSavingThrowToggle(attr)}
                                disabled={classData.saving_throws.length >= 2 && !classData.saving_throws.some(s => s.index === attr)}
                                className="form-checkbox text-amber-500 bg-stone-700 border-stone-600 rounded"
                            />
                            {translateAttribute(characterUtils.ATTRIBUTE_SHORT_MAP[attr])}
                        </label>
                    ))}
                </div>
            </div>
             {/* Proficiencies */}
            <div>
                <label className="block text-sm font-medium text-stone-300 mb-2">Proficiências com Equipamentos</label>
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        {ALL_ARMOR_PROFS.map(prof => (
                            <label key={prof.index} className={`flex items-center gap-2 p-2 rounded-md border text-sm transition-colors cursor-pointer ${classData.proficiencies.some(p => p.index === prof.index) ? 'bg-amber-900/50 border-amber-700' : 'bg-stone-800/80 border-stone-700'}`}>
                                <input type="checkbox"
                                    checked={classData.proficiencies.some(p => p.index === prof.index)}
                                    onChange={() => handleProficiencyToggle(prof)}
                                    className="form-checkbox text-amber-500 bg-stone-700 border-stone-600 rounded"
                                />
                                {translateApiString(prof.name)}
                            </label>
                        ))}
                    </div>
                     <div className="grid grid-cols-2 gap-2">
                        {ALL_WEAPON_PROFS.map(prof => (
                            <label key={prof.index} className={`flex items-center gap-2 p-2 rounded-md border text-sm transition-colors cursor-pointer ${classData.proficiencies.some(p => p.index === prof.index) ? 'bg-amber-900/50 border-amber-700' : 'bg-stone-800/80 border-stone-700'}`}>
                                <input type="checkbox"
                                    checked={classData.proficiencies.some(p => p.index === prof.index)}
                                    onChange={() => handleProficiencyToggle(prof)}
                                    className="form-checkbox text-amber-500 bg-stone-700 border-stone-600 rounded"
                                />
                                {translateApiString(prof.name)}
                            </label>
                        ))}
                    </div>
                </div>
            </div>
             {/* Skill Choices */}
             <div>
                <label className="block text-sm font-medium text-stone-300 mb-2">Escolhas de Perícia</label>
                <div className="flex items-center gap-4 mb-2 bg-stone-800/80 p-2 rounded-md">
                    <label htmlFor="skill-choice-count" className="text-sm text-stone-300">Nº de escolhas:</label>
                    <input 
                        id="skill-choice-count"
                        type="number" 
                        min="0" 
                        max="4" 
                        value={skillChoiceGroup?.choose || 2}
                        onChange={e => handleSkillChoiceChange('choose', Number(e.target.value))}
                        className="w-20 bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200 text-center"
                    />
                </div>
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {characterUtils.ALL_SKILLS.map(skill => (
                        <label key={skill} className={`flex items-center gap-2 p-2 rounded-md border text-sm transition-colors cursor-pointer ${selectedSkillOptions.includes(skill) ? 'bg-amber-900/50 border-amber-700' : 'bg-stone-800/80 border-stone-700'}`}>
                            <input
                                type="checkbox"
                                checked={selectedSkillOptions.includes(skill)}
                                onChange={() => {
                                    const newSkills = selectedSkillOptions.includes(skill)
                                        ? selectedSkillOptions.filter(s => s !== skill)
                                        : [...selectedSkillOptions, skill];
                                    handleSkillChoiceChange('options', newSkills);
                                }}
                                className="form-checkbox text-amber-500 bg-stone-700 border-stone-600 rounded"
                            />
                            {translateApiString(skill)}
                        </label>
                    ))}
                 </div>
             </div>
        </div>
    );
};

export default ClassForm;
