// src/components/Homebrew/forms/MonsterForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { Attributes } from '@/types';
import * as DndApiService from '@/services/dndApiService';
import type { ApiListItem } from '@/types';
import { Loader2, Plus, Trash2, Edit } from 'lucide-react';
import * as characterUtils from '@/utils/characterUtils';
import ActionCreator from './ActionCreator';
import { useAuth } from '@/contexts/AuthContext';
import { hb, hbChipClass } from '@/features/homebrew/forms/formUi';


interface Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

const defaultMonsterData = {
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
    special_abilities: [] as any[],
    actions: [] as any[],
    legendary_actions: [] as any[],
    official_index: '',
};

const SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
const TYPES = ["Aberration", "Beast", "Celestial", "Construct", "Dragon", "Elemental", "Fey", "Fiend", "Giant", "Humanoid", "Monstrosity", "Ooze", "Plant", "Undead"];
const ALIGNMENTS = [
    "Lawful Good", "Neutral Good", "Chaotic Good",
    "Lawful Neutral", "True Neutral", "Chaotic Neutral",
    "Lawful Evil", "Neutral Evil", "Chaotic Evil",
    "Unaligned"
];
const attributeOrder: (keyof Attributes)[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];


const MonsterForm: React.FC<Props> = ({ onDataChange, initialData }) => {
    const { user } = useAuth();
    const [monsterData, setMonsterData] = useState({
        ...defaultMonsterData,
        ...(initialData || {}),
    });
    
    const [damageTypes, setDamageTypes] = useState<ApiListItem[]>([]);
    const [conditions, setConditions] = useState<ApiListItem[]>([]);
    const [skills, setSkills] = useState<ApiListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [creatorModal, setCreatorModal] = useState<{ open: boolean, type: 'actions' | 'special_abilities' | 'legendary_actions' | null, data?: any, index?: number }>({ open: false, type: null });


    useEffect(() => {
        onDataChange(monsterData);
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
                newProfs.push({ proficiency: { index: skill.index, name: skill.name, url: skill.url }, value: profValue });
            }
        }
        handleFieldChange('proficiencies', newProfs);
    };

    const handleActionCreated = (newAction: any) => {
        if (!creatorModal.type) return;

        if(creatorModal.index !== undefined) {
             const updatedActions = [...monsterData[creatorModal.type]];
             updatedActions[creatorModal.index] = newAction;
             handleFieldChange(creatorModal.type, updatedActions);
        } else {
             handleFieldChange(creatorModal.type, [...monsterData[creatorModal.type], newAction]);
        }
    };

    const handleRemoveAction = (type: 'actions' | 'special_abilities' | 'legendary_actions', index: number) => {
        const newActions = monsterData[type].filter((_, i) => i !== index);
        handleFieldChange(type, newActions);
    };
    
    const openEditModal = (type: 'actions' | 'special_abilities' | 'legendary_actions', index: number) => {
        const actionToEdit = monsterData[type][index];
        setCreatorModal({ open: true, type, data: actionToEdit, index });
    };


    const renderDamageTypeSelector = (field: 'damage_vulnerabilities' | 'damage_resistances' | 'damage_immunities', label: string) => (
        <div>
            <h5 className={hb.headingSm}>{label}</h5>
             <div className="flex flex-wrap gap-2">
                {damageTypes.map(type => {
                    const isSelected = monsterData[field].includes(type.index);
                    return (
                        <button key={type.index} type="button" onClick={() => handleMultiSelectChange(field, type.index)} className={`px-2 py-1 text-xs rounded-full border transition-colors ${hbChipClass(isSelected )}`}>
                            {type.name}
                        </button>
                    )
                })}
            </div>
        </div>
    );

    const renderActionList = (type: 'actions' | 'special_abilities' | 'legendary_actions', title: string) => (
        <div className={hb.dividerSection}>
            <div className="flex justify-between items-center mb-4">
                <h4 className={hb.heading}>{title}</h4>
                <button type="button" onClick={() => setCreatorModal({ open: true, type, index: undefined, data: null })} className={hb.btnAdd}>
                    <Plus className="h-4 w-4" /> Adicionar
                </button>
            </div>
            <div className="space-y-2">
                {monsterData[type].map((action, index) => (
                    <div key={index} className={hb.rowBetween}>
                        <div>
                            <p className="font-ui text-sm font-semibold text-dnd-parchment">{action.name}</p>
                            <p className="mt-1 font-ui text-xs text-dnd-parchment-muted">{action.desc}</p>
                        </div>
                        <div className="flex gap-2">
                             <button type="button" onClick={() => openEditModal(type, index)} className="ml-2 text-blue-400 hover:text-blue-300 flex-shrink-0">
                                <Edit className="h-4 w-4"/>
                            </button>
                            <button type="button" onClick={() => handleRemoveAction(type, index)} className={hb.btnDanger}>
                                <Trash2 className="h-4 w-4"/>
                            </button>
                        </div>
                    </div>
                ))}
                {monsterData[type].length === 0 && (
                    <p className={hb.empty}>Nenhuma definida.</p>
                )}
            </div>
        </div>
    );
    
    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className={hb.loader}/></div>
    }


    return (
        <div className={hb.root}>
            <div>
                <label htmlFor="monster-name" className={hb.label}>
                    Nome do Monstro
                </label>
                <input
                    id="monster-name"
                    type="text"
                    value={monsterData.name}
                    onChange={e => handleFieldChange('name', e.target.value)}
                    placeholder="Ex: Devorador de Pântano"
                    required
                    className={hb.control}
                />
            </div>
            {user?.id === 1 && (
                <div>
                    <label htmlFor="official_index" className={hb.label}>Índice Oficial (para Sobrescrever)</label>
                    <input id="official_index" type="text" value={monsterData.official_index} onChange={e => handleFieldChange('official_index', e.target.value)} className={hb.control} placeholder="Ex: goblin (opcional)"/>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="monster-size" className={hb.label}>Tamanho</label>
                    <select
                        id="monster-size"
                        value={monsterData.size}
                        onChange={e => handleFieldChange('size', e.target.value)}
                        className={hb.control}
                    >
                        {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="monster-type" className={hb.label}>Tipo</label>
                    <select
                        id="monster-type"
                        value={monsterData.type}
                        onChange={e => handleFieldChange('type', e.target.value)}
                        className={hb.control}
                    >
                        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="monster-alignment" className={hb.label}>Alinhamento</label>
                    <select
                        id="monster-alignment"
                        value={monsterData.alignment}
                        onChange={e => handleFieldChange('alignment', e.target.value)}
                        className={hb.control}
                    >
                        {ALIGNMENTS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
            </div>
            
            <div className={hb.dividerSection}>
                 <h4 className={hb.heading}>Estatísticas de Combate</h4>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="armor_class" className={hb.label}>Classe de Armadura</label>
                        <input id="armor_class" type="number" value={monsterData.armor_class} onChange={e => handleFieldChange('armor_class', Number(e.target.value))} className={hb.control} />
                    </div>
                    <div>
                        <label htmlFor="hit_points" className={hb.label}>Pontos de Vida</label>
                        <input id="hit_points" type="number" value={monsterData.hit_points} onChange={e => handleFieldChange('hit_points', Number(e.target.value))} className={hb.control} />
                    </div>
                    <div>
                        <label htmlFor="hit_dice" className={hb.label}>Dado de Vida</label>
                        <input id="hit_dice" type="text" value={monsterData.hit_dice} onChange={e => handleFieldChange('hit_dice', e.target.value)} placeholder="Ex: 2d8" className={hb.control} />
                    </div>
                 </div>
            </div>

            <div className={hb.dividerSection}>
                <h4 className={hb.heading}>Atributos</h4>
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {attributeOrder.map(attr => (
                        <div key={attr}>
                            <label htmlFor={attr} className={hb.label}>{attr.substring(0,3).toUpperCase()}</label>
                            <input id={attr} type="number" value={monsterData[attr]} onChange={e => handleFieldChange(attr, Number(e.target.value))} className={`${hb.control} text-center`} />
                        </div>
                    ))}
                </div>
            </div>

             <div className={hb.dividerSection}>
                <h4 className={hb.heading}>Velocidade</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {(['walk', 'fly', 'swim', 'burrow', 'climb'] as const).map(speedType => (
                         <div key={speedType}>
                            <label htmlFor={`speed-${speedType}`} className={hb.label}>{speedType}</label>
                            <input id={`speed-${speedType}`} type="text" value={monsterData.speed[speedType] || ''} onChange={e => handleSpeedChange(speedType, e.target.value)} placeholder="Ex: 30 ft." className={hb.control} />
                        </div>
                    ))}
                </div>
            </div>

             <div className={hb.dividerSection}>
                <h4 className={hb.heading}>Perícias</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {skills.map(skill => {
                        const prof = monsterData.proficiencies.find(p => p.proficiency.index === skill.index);
                        return (
                             <div key={skill.index} className="flex items-center gap-2">
                                <label htmlFor={`skill-${skill.index}`} className={`flex-1 ${hb.muted}`}>{skill.name.replace('Skill: ', '')}</label>
                                <input id={`skill-${skill.index}`} type="number" value={prof?.value || ''} onChange={(e) => handleProficiencyChange(skill.index, e.target.value)} placeholder="+0" className={`${hb.controlSm} w-20 text-center`} />
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className={`${hb.dividerSection} space-y-4`}>
                <h4 className={hb.heading}>Resistências, Vulnerabilidades e Imunidades</h4>
                {renderDamageTypeSelector('damage_vulnerabilities', 'Vulnerabilidades a Dano')}
                {renderDamageTypeSelector('damage_resistances', 'Resistências a Dano')}
                {renderDamageTypeSelector('damage_immunities', 'Imunidades a Dano')}
                <div>
                     <h5 className={hb.headingSm}>Imunidades a Condição</h5>
                    <div className="flex flex-wrap gap-2">
                        {conditions.map(cond => {
                            const isSelected = monsterData.condition_immunities.some(ci => ci.index === cond.index);
                            return (
                                <button key={cond.index} type="button" onClick={() => handleMultiSelectChange('condition_immunities', cond.index)} className={`px-2 py-1 text-xs rounded-full border transition-colors ${hbChipClass(isSelected )}`}>
                                    {cond.name}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
            
            <div className={hb.dividerSection}>
                 <h4 className={hb.heading}>Sentidos e Idiomas</h4>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                     <div>
                        <label htmlFor="senses-darkvision" className={hb.label}>Visão no Escuro</label>
                        <input id="senses-darkvision" type="text" value={monsterData.senses.darkvision || ''} onChange={e => handleSensesChange('darkvision', e.target.value)} placeholder="Ex: 60 ft." className={hb.control} />
                    </div>
                    <div>
                        <label htmlFor="senses-blindsight" className={hb.label}>Visão Cega</label>
                        <input id="senses-blindsight" type="text" value={monsterData.senses.blindsight || ''} onChange={e => handleSensesChange('blindsight', e.target.value)} placeholder="Ex: 10 ft." className={hb.control} />
                    </div>
                     <div>
                        <label htmlFor="senses-tremorsense" className={hb.label}>Sentido Sísmico</label>
                        <input id="senses-tremorsense" type="text" value={monsterData.senses.tremorsense || ''} onChange={e => handleSensesChange('tremorsense', e.target.value)} placeholder="Ex: 30 ft." className={hb.control} />
                    </div>
                      <div>
                        <label htmlFor="senses-truesight" className={hb.label}>Visão Verdadeira</label>
                        <input id="senses-truesight" type="text" value={monsterData.senses.truesight || ''} onChange={e => handleSensesChange('truesight', e.target.value)} placeholder="Ex: 120 ft." className={hb.control} />
                    </div>
                     <div>
                        <label htmlFor="senses-passive_perception" className={hb.label}>Percepção Passiva</label>
                        <input id="senses-passive_perception" type="number" value={monsterData.senses.passive_perception} onChange={e => handleSensesChange('passive_perception', e.target.value)} className={hb.control} />
                    </div>
                 </div>
                 <div className="mt-4">
                    <label htmlFor="monster-languages" className={hb.label}>Idiomas</label>
                    <input id="monster-languages" type="text" value={monsterData.languages} onChange={e => handleFieldChange('languages', e.target.value)} placeholder="Ex: Comum, Dracônico, telepatia 120 ft." className={hb.control} />
                </div>
            </div>

            {renderActionList('special_abilities', 'Habilidades Especiais')}
            {renderActionList('actions', 'Ações')}
            {renderActionList('legendary_actions', 'Ações Lendárias')}

            {creatorModal.open && (
                <ActionCreator 
                    isOpen={creatorModal.open}
                    onClose={() => setCreatorModal({ open: false, type: null })}
                    onActionCreated={handleActionCreated}
                    initialData={creatorModal.data}
                />
            )}
        </div>
    );
};

export default MonsterForm;
