// src/components/Homebrew/forms/ClassForm.tsx
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import * as characterUtils from '@/utils/characterUtils';
import type { ApiListItem } from '@/types';
import { Loader2, Plus, Trash2, Edit } from 'lucide-react';
import FeatureCreator from './FeatureCreator';
import { useAuth } from '@/contexts/AuthContext';
import { hb, hbTileClass } from '@/features/homebrew/forms/formUi';

interface Props {
    onDataChange: (data: any) => void;
    initialData?: any;
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

const ClassForm: React.FC<Props> = ({ onDataChange, initialData }) => {
    const { user } = useAuth();
    const [classData, setClassData] = useState(() => ({
        name: '',
        hit_die: 8,
        proficiencies: [],
        proficiency_choices: [],
        saving_throws: [],
        features: [],
        official_index: '',
        ...initialData,
    }));
    const [isFeatureCreatorOpen, setIsFeatureCreatorOpen] = useState(false);
    const [editingFeature, setEditingFeature] = useState<{feature: any, index: number} | null>(null);


    useEffect(() => {
        if (initialData && Object.keys(initialData).length > 0) {
            setClassData(prev => ({
                ...prev,
                ...initialData,
                proficiencies: initialData.proficiencies || [],
                proficiency_choices: initialData.proficiency_choices || [],
                saving_throws: initialData.saving_throws || [],
                features: initialData.features || [],
            }));
        }
    }, [initialData]);

    // Update parent component whenever data changes
    useEffect(() => {
        const fullData = {
            ...classData,
            index: classData.official_index || (classData.name || '').toLowerCase().replace(/\s+/g, '-') || `custom-class-${Date.now()}`
        };
        const { official_index, ...finalData } = fullData; // Remove o campo auxiliar
        onDataChange(finalData);
    }, [classData, onDataChange]);

    const handleFieldChange = (field: keyof typeof classData, value: any) => {
        setClassData(prev => ({ ...prev, [field]: value }));
    };
    
    const handleFeatureCreated = (feature: any) => {
        if (editingFeature !== null) {
            const updatedFeatures = [...classData.features];
            updatedFeatures[editingFeature.index] = feature;
            handleFieldChange('features', updatedFeatures.sort((a, b) => a.level - b.level));
        } else {
            const updatedFeatures = [...classData.features, feature].sort((a, b) => a.level - b.level);
            handleFieldChange('features', updatedFeatures);
        }
    }

    const handleRemoveFeature = (featureIndex: number) => {
        handleFieldChange('features', classData.features.filter((_, i) => i !== featureIndex));
    }
    
    const openEditModal = (feature: any, index: number) => {
        setEditingFeature({ feature, index });
        setIsFeatureCreatorOpen(true);
    };

    const openCreateModal = () => {
        setEditingFeature(null);
        setIsFeatureCreatorOpen(true);
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

    const skillChoiceGroup = classData.proficiency_choices.find((c: any) => c.type === 'proficiencies' && c.desc.includes("skills"));
    const selectedSkillOptions = skillChoiceGroup?.from.options.map((opt:any) => opt.item.name.replace('Skill: ', '')) || [];
    
    const groupedFeatures = useMemo(() => {
        if (!classData.features) return {};
        return classData.features.reduce((acc: any, feature: any) => {
            const level = `Nível ${feature.level}`;
            if (!acc[level]) {
                acc[level] = [];
            }
            acc[level].push(feature);
            return acc;
        }, {} as Record<string, any[]>);
    }, [classData.features]);


    return (
        <div className={hb.root}>
             <div>
                <label htmlFor="class-name" className={hb.label}>
                    Nome da Classe
                </label>
                <input 
                    id="class-name" 
                    type="text" 
                    value={classData.name}
                    onChange={e => handleFieldChange('name', e.target.value)}
                    placeholder="Ex: Mestre das Lâminas"
                    required 
                    className={hb.control} 
                />
            </div>
            {user?.id === 1 && (
                <div>
                    <label htmlFor="official_index" className={hb.label}>Índice Oficial (para Sobrescrever/Traduzir)</label>
                    <input id="official_index" type="text" value={classData.official_index} onChange={e => handleFieldChange('official_index', e.target.value)} className={hb.control} placeholder="Ex: barbarian (opcional)"/>
                </div>
            )}
            <div>
                <label htmlFor="hit-die" className={hb.label}>
                    Dado de Vida
                </label>
                <select 
                    id="hit-die"
                    value={classData.hit_die}
                    onChange={e => handleFieldChange('hit_die', Number(e.target.value))}
                    className={hb.control}
                >
                    {HIT_DICE_OPTIONS.map(d => <option key={d} value={d}>d{d}</option>)}
                </select>
            </div>
            {/* Saving Throws */}
            <div>
                <label className={hb.headingSm}>Testes de Resistência (Escolha 2)</label>
                <div className="grid grid-cols-3 gap-2">
                    {Object.keys(characterUtils.ATTRIBUTE_SHORT_MAP).map(attr => (
                        <label key={attr} className={`flex items-center gap-2 p-2 rounded-md border text-sm transition-colors cursor-pointer ${hbTileClass(classData.saving_throws.some((s:any) => s.index === attr) )}`}>
                            <input type="checkbox"
                                checked={classData.saving_throws.some((s:any) => s.index === attr)}
                                onChange={() => handleSavingThrowToggle(attr)}
                                disabled={classData.saving_throws.length >= 2 && !classData.saving_throws.some((s:any) => s.index === attr)}
                                className={hb.checkbox}
                            />
                            {attr.toUpperCase()}
                        </label>
                    ))}
                </div>
            </div>
             {/* Proficiencies */}
            <div>
                <label className={hb.headingSm}>Proficiências com Equipamentos</label>
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        {ALL_ARMOR_PROFS.map(prof => (
                            <label key={prof.index} className={`flex items-center gap-2 p-2 rounded-md border text-sm transition-colors cursor-pointer ${hbTileClass(classData.proficiencies.some((p:any) => p.index === prof.index) )}`}>
                                <input type="checkbox"
                                    checked={classData.proficiencies.some((p:any) => p.index === prof.index)}
                                    onChange={() => handleProficiencyToggle(prof)}
                                    className={hb.checkbox}
                                />
                                {prof.name}
                            </label>
                        ))}
                    </div>
                     <div className="grid grid-cols-2 gap-2">
                        {ALL_WEAPON_PROFS.map(prof => (
                            <label key={prof.index} className={`flex items-center gap-2 p-2 rounded-md border text-sm transition-colors cursor-pointer ${hbTileClass(classData.proficiencies.some((p:any) => p.index === prof.index) )}`}>
                                <input type="checkbox"
                                    checked={classData.proficiencies.some((p:any) => p.index === prof.index)}
                                    onChange={() => handleProficiencyToggle(prof)}
                                    className={hb.checkbox}
                                />
                                {prof.name}
                            </label>
                        ))}
                    </div>
                </div>
            </div>
             {/* Skill Choices */}
             <div>
                <label className={hb.headingSm}>Escolhas de Perícia</label>
                <div className={`mb-2 flex items-center gap-4 rounded-md bg-dnd-obsidian-raised/50 p-2`}>
                    <label htmlFor="skill-choice-count" className={hb.muted}>Nº de escolhas:</label>
                    <input 
                        id="skill-choice-count"
                        type="number" 
                        min="0" 
                        max="4" 
                        value={skillChoiceGroup?.choose || 2}
                        onChange={e => handleSkillChoiceChange('choose', Number(e.target.value))}
                        className={`${hb.controlSm} w-20 text-center`}
                    />
                </div>
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {characterUtils.ALL_SKILLS.map(skill => (
                        <label key={skill} className={`flex items-center gap-2 p-2 rounded-md border text-sm transition-colors cursor-pointer ${hbTileClass(selectedSkillOptions.includes(skill) )}`}>
                            <input
                                type="checkbox"
                                checked={selectedSkillOptions.includes(skill)}
                                onChange={() => {
                                    const newSkills = selectedSkillOptions.includes(skill)
                                        ? selectedSkillOptions.filter(s => s !== skill)
                                        : [...selectedSkillOptions, skill];
                                    handleSkillChoiceChange('options', newSkills);
                                }}
                                className={hb.checkbox}
                            />
                            {skill}
                        </label>
                    ))}
                 </div>
             </div>
             {/* Features Section */}
             <div className={hb.dividerSection}>
                <div className="flex justify-between items-center mb-2">
                    <h4 className={hb.heading}>Características de Classe</h4>
                    <button type="button" onClick={openCreateModal} className={hb.btnAdd}>
                        <Plus className="h-4 w-4" /> Adicionar
                    </button>
                </div>
                <div className={hb.root}>
                    {Object.keys(groupedFeatures).length > 0 ? (
                        Object.keys(groupedFeatures).map(level => (
                            <div key={level}>
                                <h5 className={`${hb.sectionTitle} border-b border-dnd-gold/20 pb-1 mb-2`}>{level}</h5>
                                <div className="space-y-2">
                                {groupedFeatures[level].map((feature: any, index: number) => (
                                    <div key={feature.index || index} className={hb.rowBetween}>
                                        <div>
                                            <p className="font-ui text-sm font-semibold text-dnd-parchment">{feature.name}</p>
                                            <p className="mt-1 font-ui text-xs text-dnd-parchment-muted">{feature.desc[0].substring(0, 100)}...</p>
                                        </div>
                                        <div className="flex flex-shrink-0 ml-2 gap-2">
                                            <button type="button" onClick={() => openEditModal(feature, classData.features.findIndex(f => f.name === feature.name && f.level === feature.level))} className="text-blue-400 hover:text-blue-300">
                                                <Edit className="h-4 w-4"/>
                                            </button>
                                            <button type="button" onClick={() => handleRemoveFeature(classData.features.findIndex(f => f.name === feature.name && f.level === feature.level))} className={hb.btnDanger}>
                                                <Trash2 className="h-4 w-4"/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className={hb.empty}>Nenhuma característica adicionada ainda.</p>
                    )}
                </div>
             </div>
             <FeatureCreator
                isOpen={isFeatureCreatorOpen}
                onClose={() => setIsFeatureCreatorOpen(false)}
                onFeatureCreated={handleFeatureCreated}
                classId={classData.name.toLowerCase().replace(/\s+/g, '-')}
                initialData={editingFeature?.feature}
            />
        </div>
    );
};

export default ClassForm;
