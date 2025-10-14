// src/components/Homebrew/forms/MonsterForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { translateApiString, translateAttribute } from '@/utils/translator';
import { Attributes } from '@/types';

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
        speed: { walk: '30 ft.'},
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
    });

    useEffect(() => {
        const fullData = {
            ...monsterData,
            index: monsterData.name.toLowerCase().replace(/\s+/g, '-') || `custom-monster-${Date.now()}`
        };
        onDataChange(fullData);
    }, [monsterData, onDataChange]);

    const handleFieldChange = (field: keyof typeof monsterData, value: any) => {
        setMonsterData(prev => ({ ...prev, [field]: value }));
    };
    
    const handleSpeedChange = (speedType: 'walk' | 'swim' | 'fly' | 'burrow' | 'climb', value: string) => {
        const newSpeed = { ...monsterData.speed, [speedType]: value };
        if (!value) delete newSpeed[speedType];
        handleFieldChange('speed', newSpeed);
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
        </div>
    );
};

export default MonsterForm;
