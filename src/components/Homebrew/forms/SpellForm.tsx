// src/components/Homebrew/forms/SpellForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import * as DndApiService from '@/services/dndApiService';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import type { ApiListItem } from '@/types';
import ItemSelector from '../ItemSelector';
import { useAuth } from '@/contexts/AuthContext';
import { hb, hbChipClass, hbTileClass } from '@/features/homebrew/forms/formUi';

interface Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

type SpellDamage = {
    damage_type: { index: string; name: string };
    damage_at_character_level?: Record<string, string>;
    damage_at_slot_level?: Record<string, string>;
};

type SpellFormState = {
    name: string;
    desc: string[];
    level: number;
    school: { index: string; name: string };
    casting_time: string;
    range: string;
    duration: string;
    concentration: boolean;
    components: string[];
    material: string;
    attack_type: string;
    damage: SpellDamage;
    official_index: string;
    index?: string;
};

const SpellForm: React.FC<Props> = ({ onDataChange, initialData }) => {
    const { user } = useAuth();
    const [spellData, setSpellData] = useState<SpellFormState>(() => {
        const base: SpellFormState = {
            name: '',
            desc: [''],
            level: 0,
            school: { index: '', name: '' },
            casting_time: '1 ação',
            range: 'Toque',
            duration: 'Instantâneo',
            concentration: false,
            components: [],
            material: '',
            attack_type: '',
            damage: {
                damage_type: { index: '', name: '' },
                damage_at_character_level: {},
                damage_at_slot_level: {},
            },
            official_index: '',
        };

        const merged = {
            ...base,
            ...(initialData || {}),
        };

        return {
            ...merged,
            desc: Array.isArray(merged.desc) && merged.desc.length > 0 ? merged.desc : [''],
            components: Array.isArray(merged.components) ? merged.components : [],
            damage: {
                damage_type: merged.damage?.damage_type || { index: '', name: '' },
                damage_at_character_level: merged.damage?.damage_at_character_level || {},
                damage_at_slot_level: merged.damage?.damage_at_slot_level || {},
            },
        };
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
                 if (!spellData.damage?.damage_type?.index && damages?.results?.length > 0) {
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
        const damageTypeIndex = spellData.damage.damage_type?.index;
        const cleanedDamage: SpellDamage | undefined = damageTypeIndex
            ? {
                damage_type: spellData.damage.damage_type,
                ...(Object.keys(spellData.damage.damage_at_character_level || {}).length > 0
                    ? { damage_at_character_level: spellData.damage.damage_at_character_level }
                    : {}),
                ...(Object.keys(spellData.damage.damage_at_slot_level || {}).length > 0
                    ? { damage_at_slot_level: spellData.damage.damage_at_slot_level }
                    : {}),
            }
            : undefined;

        const { official_index, damage, attack_type, ...rest } = spellData;
        const normalizedIndex = official_index
            || (spellData.name || '').toLowerCase().replace(/\s+/g, '-')
            || `custom-spell-${Date.now()}`;

        onDataChange({
            ...rest,
            attack_type: attack_type || undefined,
            damage: attack_type && cleanedDamage ? cleanedDamage : undefined,
            index: normalizedIndex,
        });
    }, [spellData, onDataChange]);

    const handleFieldChange = <K extends keyof SpellFormState>(field: K, value: SpellFormState[K]) => {
        setSpellData(prev => ({ ...prev, [field]: value }));
    };

    const handleDamageChange = <K extends keyof SpellDamage>(field: K, value: SpellDamage[K]) => {
        setSpellData(prev => ({
            ...prev,
            damage: {
                ...prev.damage,
                [field]: value,
            },
        }));
    };

    const handleScalingChange = (type: 'character' | 'slot', index: number, field: 'level' | 'dice', value: string) => {
        const key = type === 'character' ? 'damage_at_character_level' : 'damage_at_slot_level';
        const currentScaling = Object.entries(spellData.damage?.[key] || {}) as Array<[string, string]>;
        
        let newLevel = currentScaling[index]?.[0] || '';
        let newDice = currentScaling[index]?.[1] || '';

        if(field === 'level') newLevel = value;
        if(field === 'dice') newDice = value;
        
        const newScaling: Record<string, string> = {};
        currentScaling.forEach(([levelKey, diceValue], i) => {
            if (i !== index) {
                newScaling[levelKey] = diceValue;
            }
        });
        if(newLevel) newScaling[newLevel] = newDice;

        handleDamageChange(key, newScaling);
    };

    const addScalingEntry = (type: 'character' | 'slot') => {
        const key = type === 'character' ? 'damage_at_character_level' : 'damage_at_slot_level';
        const currentEntries = Object.keys(spellData.damage?.[key] || {});
        const newKey = (currentEntries.length + 1).toString();
        const newScaling = { ...(spellData.damage?.[key] || {}), [newKey]: '' };
        handleDamageChange(key, newScaling);
    };

    const removeScalingEntry = (type: 'character' | 'slot', level: string) => {
        const key = type === 'character' ? 'damage_at_character_level' : 'damage_at_slot_level';
        const currentScaling = { ...(spellData.damage?.[key] || {}) };
        delete currentScaling[level];
        handleDamageChange(key, currentScaling);
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
    const scalingData = spellData.damage?.[scalingType === 'character' ? 'damage_at_character_level' : 'damage_at_slot_level'] || {};

    return (
        <div className={hb.root}>
             <div>
                <label className={hb.label}>Nome da Magia</label>
                <input type="text" value={spellData.name} onChange={e => handleFieldChange('name', e.target.value)} required className={hb.control} />
            </div>
            {user?.id === 1 && (
                <div>
                    <label htmlFor="official_index" className={hb.label}>Índice Oficial (para Sobrescrever)</label>
                    <input id="official_index" type="text" value={spellData.official_index} onChange={e => handleFieldChange('official_index', e.target.value)} className={hb.control} placeholder="Ex: fire-bolt (opcional)"/>
                </div>
            )}
            <div>
                <label className={hb.label}>Descrição</label>
                <textarea value={spellData.desc[0]} onChange={e => handleFieldChange('desc', [e.target.value])} required rows={4} className={hb.control} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className={hb.label}>Nível</label>
                    <select value={spellData.level} onChange={e => handleFieldChange('level', Number(e.target.value))} className={hb.control}>
                        {Array.from({length: 10}).map((_, i) => <option key={i} value={i}>{i === 0 ? 'Truque' : `${i}º Nível`}</option>)}
                    </select>
                </div>
                 <div>
                    <label className={hb.label}>Escola de Magia</label>
                    <select value={spellData.school?.index || ''} onChange={e => { const school = magicSchools.find(s => s.index === e.target.value); if(school) handleFieldChange('school', {index: school.index, name: school.name })}} className={hb.control}>
                        {magicSchools.map(s => <option key={s.index} value={s.index}>{s.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label className={hb.label}>Tempo de Conjuração</label>
                    <select value={spellData.casting_time} onChange={e => handleFieldChange('casting_time', e.target.value)} className={hb.control}>
                        {CASTING_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label className={hb.label}>Alcance</label>
                    <select value={spellData.range} onChange={e => handleFieldChange('range', e.target.value)} className={hb.control}>
                        {RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                 <div>
                    <label className={hb.label}>Duração</label>
                    <select value={spellData.duration} onChange={e => handleFieldChange('duration', e.target.value)} className={hb.control}>
                        {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="space-y-2">
                 <label className={hb.label}>Componentes</label>
                 <div className="flex gap-4">
                    {['V', 'S', 'M'].map(c => ( <label key={c} className={hb.checkLabel}><input type="checkbox" checked={spellData.components.includes(c)} onChange={() => handleComponentChange(c as any)} className={hb.checkbox} />{c}</label>))}
                    <label className={hb.checkLabel}><input type="checkbox" checked={spellData.concentration} onChange={e => handleFieldChange('concentration', e.target.checked)} className={hb.checkbox} />Concentração</label>
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
            
            <div className={hb.dividerSection}>
                 <label className={hb.label}>Tipo de Ataque</label>
                <select value={spellData.attack_type} onChange={e => handleFieldChange('attack_type', e.target.value)} className={hb.control}>
                    <option value="">Nenhum</option>
                    <option value="ranged">À Distância</option>
                    <option value="melee">Corpo a Corpo</option>
                </select>
            </div>
            
            {spellData.attack_type && (
                <div className={`${hb.dividerSection} space-y-4`}>
                    <h5 className={hb.headingSm}>Dano e Escalonamento</h5>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                         <div>
                            <label className={hb.label}>Tipo de Dano</label>
                            <select value={spellData.damage?.damage_type?.index || ''} onChange={e => { const dt = damageTypes.find(d => d.index === e.target.value); if(dt) handleDamageChange('damage_type', { index: dt.index, name: dt.name })}} className={hb.control}>
                                {damageTypes.map(d => <option key={d.index} value={d.index}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>
                     <p className={hb.muted}>Dano base e escalonamento por {scalingLabel}.</p>
                    {Object.entries(scalingData).map(([level, dice], index) => (
                        <div key={index} className={hb.row}>
                             <input type="number" placeholder={scalingLabel} value={level} onChange={(e) => handleScalingChange(scalingType, index, 'level', e.target.value)} className={hb.controlSm} />
                             <input type="text" placeholder="Dado de Dano (ex: 3d8)" value={dice as string} onChange={(e) => handleScalingChange(scalingType, index, 'dice', e.target.value)} className={hb.controlSm}/>
                            <button type="button" onClick={() => removeScalingEntry(scalingType, level)} className={hb.btnDanger}><Trash2 className="h-5 w-5" /></button>
                        </div>
                    ))}
                     <button type="button" onClick={() => addScalingEntry(scalingType)} className={hb.linkBtn}><Plus className="h-4 w-4" /> Adicionar Escalonamento</button>
                </div>
            )}
        </div>
    );
};

export default SpellForm;
