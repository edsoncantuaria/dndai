// src/components/Homebrew/HomebrewCreator.tsx
'use client';
import React, { useState, useEffect } from 'react';
import * as HomebrewService from '@/services/homebrewService';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, FlaskConical, Loader2, Plus, Trash2 } from 'lucide-react';
import { translateApiString, translateMagicSchool } from '@/utils/translator';
import TraitSelector from './TraitSelector';
import type { ApiListItem } from '@/types';
import * as characterUtils from '@/utils/characterUtils';
import * as DndApiService from '@/services/dndApiService';


const CONTENT_TYPES: HomebrewService.HomebrewContentType[] = [
    'race', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat'
];

interface Props {
    onContentCreated: () => void;
    onCancel: () => void;
}

// --- SUB-FORMULÁRIOS ---

const RaceForm: React.FC<{ onDataChange: (data: any) => void }> = ({ onDataChange }) => {
    const [raceData, setRaceData] = useState({
        name: '',
        speed: 30,
        ability_bonuses: [] as { ability_score: { index: string; name: string }; bonus: number }[],
        traits: [] as ApiListItem[],
        // Adicionar outros campos conforme o openapi.yaml
        alignment: "No typical alignment.",
        age: "Varies.",
        size: "Medium",
        size_description: "Varies.",
        starting_proficiencies: [],
        language_options: { choose: 0, from: { options: [] } },
        languages: [],
        subraces: [],
    });

    const updateParent = (newData: any) => {
        const fullData = {
            ...newData,
            index: newData.name.toLowerCase().replace(/\s+/g, '-') || `custom-race-${Date.now()}`
        };
        onDataChange(fullData);
    };

    const handleFieldChange = (field: keyof typeof raceData, value: any) => {
        const newData = { ...raceData, [field]: value };
        setRaceData(newData);
        updateParent(newData);
    };

    const handleBonusChange = (index: number, field: 'ability_score' | 'bonus', value: string | number) => {
        const newBonuses = [...raceData.ability_bonuses];
        if (field === 'ability_score') {
            newBonuses[index].ability_score = { index: value as string, name: (value as string).toUpperCase() };
        } else {
            newBonuses[index].bonus = Number(value);
        }
        handleFieldChange('ability_bonuses', newBonuses);
    };

    const addBonus = () => {
        handleFieldChange('ability_bonuses', [...raceData.ability_bonuses, { ability_score: { index: 'str', name: 'STR' }, bonus: 1 }]);
    };

    const removeBonus = (index: number) => {
        handleFieldChange('ability_bonuses', raceData.ability_bonuses.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="race-name" className="block text-sm font-medium text-stone-300 mb-1">Nome da Raça</label>
                <input id="race-name" type="text" value={raceData.name} onChange={e => handleFieldChange('name', e.target.value)} required className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
            </div>
            <div>
                <label htmlFor="race-speed" className="block text-sm font-medium text-stone-300 mb-1">Velocidade</label>
                <input id="race-speed" type="number" value={raceData.speed} onChange={e => handleFieldChange('speed', Number(e.target.value))} required className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
            </div>
            <div>
                <h5 className="text-sm font-medium text-stone-300 mb-2">Bônus de Atributo</h5>
                <div className="space-y-2">
                    {raceData.ability_bonuses.map((bonus, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-stone-900/50 rounded-md">
                            <select value={bonus.ability_score.index} onChange={e => handleBonusChange(index, 'ability_score', e.target.value)} className="bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200">
                                <option value="str">Força</option>
                                <option value="dex">Destreza</option>
                                <option value="con">Constituição</option>
                                <option value="int">Inteligência</option>
                                <option value="wis">Sabedoria</option>
                                <option value="cha">Carisma</option>
                            </select>
                            <input type="number" value={bonus.bonus} onChange={e => handleBonusChange(index, 'bonus', e.target.value)} className="w-20 bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200" />
                            <button type="button" onClick={() => removeBonus(index)} className="text-red-400 hover:text-red-300"><Trash2 className="h-5 w-5" /></button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={addBonus} className="mt-2 text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"><Plus className="h-4 w-4" /> Adicionar Bônus</button>
            </div>
             <div>
                <TraitSelector
                    selectedTraits={raceData.traits}
                    onSelectionChange={(newTraits) => handleFieldChange('traits', newTraits)}
                />
            </div>
        </div>
    );
};


const BackgroundForm: React.FC<{ onDataChange: (data: any) => void }> = ({ onDataChange }) => {
    const [bgData, setBgData] = useState({
        name: '',
        starting_proficiencies: [] as ApiListItem[],
        feature: { name: '', desc: [''] },
        personality_traits: { choose: 2, from: { options: Array(8).fill('').map(() => ({option_type: 'string', string: ''}))}},
        ideals: { choose: 1, from: { options: Array(6).fill('').map(() => ({option_type: 'ideal', desc: ''}))}},
        bonds: { choose: 1, from: { options: Array(6).fill('').map(() => ({option_type: 'string', string: ''}))}},
        flaws: { choose: 1, from: { options: Array(6).fill('').map(() => ({option_type: 'string', string: ''}))}},
        language_options: { choose: 0, from: { option_set_type: "resource_list", resource_list_url: "/api/languages" } },
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
}

const SpellForm: React.FC<{ onDataChange: (data: any) => void }> = ({ onDataChange }) => {
    const [spellData, setSpellData] = useState({
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

     const updateParent = (newData: any) => {
        const fullData = { ...newData };

        // Clean up empty fields before sending
        if(!fullData.attack_type) delete fullData.attack_type;
        
        if (!fullData.attack_type || !fullData.damage?.damage_type?.index || 
            (Object.keys(fullData.damage.damage_at_character_level).length === 0 && 
             Object.keys(fullData.damage.damage_at_slot_level).length === 0)) {
            delete fullData.damage;
        } else {
            if (Object.keys(fullData.damage.damage_at_character_level).length === 0) delete fullData.damage.damage_at_character_level;
            if (Object.keys(fullData.damage.damage_at_slot_level).length === 0) delete fullData.damage.damage_at_slot_level;
        }

        fullData.index = newData.name.toLowerCase().replace(/\s+/g, '-') || `custom-spell-${Date.now()}`;
        onDataChange(fullData);
    };

    const handleFieldChange = (field: keyof typeof spellData, value: any) => {
        const newData = { ...spellData, [field]: value };
        setSpellData(newData);
        updateParent(newData);
    };
    
    const handleDamageChange = (field: keyof typeof spellData.damage, value: any) => {
        const newDamageData = { ...spellData.damage, [field]: value };
        handleFieldChange('damage', newDamageData);
    };

    const handleScalingChange = (type: 'character' | 'slot', index: number, field: 'level' | 'dice', value: string) => {
        const key = type === 'character' ? 'damage_at_character_level' : 'damage_at_slot_level';
        const currentScaling = Object.entries(spellData.damage[key]);
        
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
        const newScaling = {...spellData.damage[key], ['']: ''};
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
                    <label className="block text-sm font-medium text-stone-300 mb-1">Componente Material</label>
                    <input type="text" value={spellData.material} onChange={e => handleFieldChange('material', e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
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
                    {Object.entries(spellData.damage[scalingType === 'character' ? 'damage_at_character_level' : 'damage_at_slot_level']).map(([level, dice], index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-stone-900/50 rounded-md">
                             <input type="number" placeholder={scalingLabel} value={level} onChange={(e) => handleScalingChange(scalingType, index, 'level', e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200" />
                             <input type="text" placeholder="Dado de Dano (ex: 3d8)" value={dice} onChange={(e) => handleScalingChange(scalingType, index, 'dice', e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200"/>
                            <button type="button" onClick={() => removeScalingEntry(scalingType, level)} className="text-red-400 hover:text-red-300"><Trash2 className="h-5 w-5" /></button>
                        </div>
                    ))}
                     <button type="button" onClick={() => addScalingEntry(scalingType)} className="mt-2 text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"><Plus className="h-4 w-4" /> Adicionar Escalonamento</button>
                </div>
            )}
        </div>
    );
};


// --- COMPONENTE PRINCIPAL ---

const HomebrewCreator: React.FC<Props> = ({ onContentCreated, onCancel }) => {
    const [type, setType] = useState<HomebrewService.HomebrewContentType>('race');
    const [contentData, setContentData] = useState<any>(null);
    const [isPublic, setIsPublic] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contentData || !contentData.name) {
             toast({
                variant: 'destructive',
                title: 'Dados Incompletos',
                description: 'Por favor, preencha pelo menos o nome do conteúdo.',
            });
            return;
        }

        setIsLoading(true);
        try {
            await HomebrewService.createHomebrewContent({ name: contentData.name, type, content: contentData, isPublic });
            toast({
                title: 'Conteúdo Criado!',
                description: `"${contentData.name}" foi adicionado ao seu laboratório.`,
            });
            onContentCreated();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Falha ao Criar',
                description: error.message || 'Ocorreu um erro ao salvar seu conteúdo.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const renderFormForType = () => {
        switch (type) {
            case 'race':
                return <RaceForm onDataChange={setContentData} />;
            case 'background':
                return <BackgroundForm onDataChange={setContentData} />;
            case 'spell':
                return <SpellForm onDataChange={setContentData} />;
            default:
                return <p className="text-stone-400 italic text-center py-8">O editor para o tipo '{translateApiString(type)}' ainda não foi implementado. Você pode contribuir para adicioná-lo!</p>;
        }
    }

    return (
        <div className="bg-stone-800/50 p-4 sm:p-6 rounded-lg border border-stone-700 w-full max-w-4xl mx-auto flex flex-col animate-fadeIn max-h-[90vh]">
            <header className="mb-8 flex-shrink-0">
                <h1 className="text-4xl md:text-5xl font-bold text-amber-50 font-serif text-shadow-amber text-center">
                    Criador de Homebrew
                </h1>
                <p className="text-stone-400 mt-2 text-center">Dê vida às suas ideias. Preencha os campos para criar seu conteúdo customizado.</p>
            </header>

            <form onSubmit={handleSubmit} className="bg-stone-900/50 p-6 rounded-lg border border-stone-700 flex flex-col flex-grow overflow-hidden">
                <div className="overflow-y-auto pr-4 space-y-6 flex-grow">
                    <div>
                        <label htmlFor="homebrew-type" className="block text-sm font-medium text-stone-300 mb-1">Tipo de Conteúdo</label>
                        <select
                            id="homebrew-type"
                            value={type}
                            onChange={(e) => {
                                setType(e.target.value as HomebrewService.HomebrewContentType);
                                setContentData(null); // Reseta os dados ao trocar o tipo
                            }}
                            className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200"
                        >
                            {CONTENT_TYPES.map(t => <option key={t} value={t} className="capitalize">{translateApiString(t)}</option>)}
                        </select>
                    </div>
                    
                    {renderFormForType()}
                </div>
                
                <footer className="flex-shrink-0 mt-6 pt-6 border-t border-stone-700 space-y-4">
                    <div className="flex items-center justify-between bg-stone-800/60 p-3 rounded-md">
                        <label htmlFor="homebrew-public" className="flex flex-col">
                            <span className="text-stone-200 font-semibold">Tornar Público?</span>
                            <span className="text-xs text-stone-400">Permitir que outros jogadores vejam e usem sua criação.</span>
                        </label>
                        <button
                            type="button"
                            id="homebrew-public"
                            onClick={() => setIsPublic(p => !p)}
                            className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-800 focus:ring-amber-500 ${isPublic ? 'bg-amber-600' : 'bg-stone-600'}`}
                        >
                            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition ease-in-out duration-200 ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <div className="flex justify-between items-center">
                        <button type="button" onClick={onCancel} className="text-stone-300 hover:text-amber-300 underline flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4"/> Voltar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !contentData}
                            className="menu-button btn-new flex items-center justify-center gap-2 text-lg px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FlaskConical className="h-5 w-5"/>}
                            Salvar Criação
                        </button>
                    </div>
                </footer>
            </form>
        </div>
    );
};

export default HomebrewCreator;
