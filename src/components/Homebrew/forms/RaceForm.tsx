// src/components/Homebrew/forms/RaceForm.tsx
'use client';
import React, { useState } from 'react';
import type { ApiListItem } from '@/types';
import { Plus, Trash2 } from 'lucide-react';
import TraitSelector from '../TraitSelector';

interface Props {
    onDataChange: (data: any) => void;
}

const RaceForm: React.FC<Props> = ({ onDataChange }) => {
    const [raceData, setRaceData] = useState({
        name: '',
        speed: 30,
        ability_bonuses: [] as { ability_score: { index: string; name: string }; bonus: number }[],
        traits: [] as ApiListItem[],
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

export default RaceForm;
