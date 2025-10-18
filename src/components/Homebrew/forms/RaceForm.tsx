// src/components/Homebrew/forms/RaceForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import type { ApiListItem } from '@/types';
import { Plus, Trash2 } from 'lucide-react';
import TraitSelector from '../TraitSelector';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

const RaceForm: React.FC<Props> = ({ onDataChange, initialData }) => {
    const { user } = useAuth();
    const [raceData, setRaceData] = useState(() => ({
        name: '',
        speed: 30,
        ability_bonuses: [] as { ability_score: { index: string; name: string, url: string }; bonus: number }[],
        traits: [],
        alignment: "Varia muito, mas tende a...",
        age: "Atingem a maturidade por volta dos X anos e vivem até Y.",
        size: "Medium",
        size_description: "Têm entre X e Y de altura e pesam entre A e B.",
        starting_proficiencies: [],
        language_options: { choose: 0, from: { option_set_type: "resource_list", resource_list_url: "/api/languages" } },
        languages: [],
        subraces: [],
        dependencies: [],
        official_index: '',
    }));
    
    useEffect(() => {
        if (initialData && Object.keys(initialData).length > 0) {
            setRaceData(prev => ({
                ...prev,
                ...initialData,
                ability_bonuses: initialData.ability_bonuses || [],
                traits: initialData.traits || [],
            }));
        }
    }, [initialData]);

    useEffect(() => {
        const fullData = { 
            ...raceData,
            index: raceData.official_index || (raceData.name || '').toLowerCase().replace(/\s+/g, '-') || `custom-race-${Date.now()}`
        };
        const traitIds = fullData.traits.map((t: ApiListItem) => t.index);
        const homebrewTraitIds = traitIds.filter((id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
        
        fullData.dependencies = homebrewTraitIds;
        const { official_index, ...finalData } = fullData; // Remove o campo auxiliar antes de enviar
        onDataChange(finalData);
    }, [raceData, onDataChange]);


    const handleFieldChange = (field: keyof typeof raceData, value: any) => {
        setRaceData(prev => ({ ...prev, [field]: value }));
    };
    
    const handleTraitsChange = (newTraits: ApiListItem[]) => {
        handleFieldChange('traits', newTraits);
    };

    const handleBonusChange = (index: number, field: 'ability_score' | 'bonus', value: string | number) => {
        const newBonuses = [...(raceData.ability_bonuses || [])];
        const abilityScoreIndex = value as string;
        if (field === 'ability_score') {
            newBonuses[index].ability_score = { index: abilityScoreIndex, name: abilityScoreIndex.toUpperCase(), url: `/api/ability-scores/${abilityScoreIndex}` };
        } else {
            newBonuses[index].bonus = Number(value);
        }
        handleFieldChange('ability_bonuses', newBonuses);
    };

    const addBonus = () => {
        handleFieldChange('ability_bonuses', [...(raceData.ability_bonuses || []), { ability_score: { index: 'str', name: 'STR', url: '/api/ability-scores/str' }, bonus: 1 }]);
    };

    const removeBonus = (index: number) => {
        handleFieldChange('ability_bonuses', (raceData.ability_bonuses || []).filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="race-name" className="block text-sm font-medium text-stone-300 mb-1">Nome da Raça</label>
                <input id="race-name" type="text" value={raceData.name} onChange={e => handleFieldChange('name', e.target.value)} required className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" placeholder="Ex: Povo Gato, Githzerai"/>
            </div>
             {user?.id === 1 && (
                <div>
                    <label htmlFor="official_index" className="block text-sm font-medium text-stone-300 mb-1">Índice Oficial (para Sobrescrever)</label>
                    <input id="official_index" type="text" value={raceData.official_index} onChange={e => handleFieldChange('official_index', e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" placeholder="Ex: human, half-elf (opcional)"/>
                </div>
            )}
            <div>
                <label htmlFor="race-speed" className="block text-sm font-medium text-stone-300 mb-1">Velocidade</label>
                <input id="race-speed" type="number" value={raceData.speed} onChange={e => handleFieldChange('speed', Number(e.target.value))} required className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
            </div>
            <div>
                <h5 className="text-sm font-medium text-stone-300 mb-2">Bônus de Atributo</h5>
                <div className="space-y-2">
                    {(raceData.ability_bonuses || []).map((bonus, index) => (
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
                    onSelectionChange={handleTraitsChange}
                />
            </div>
             <div>
                 <label className="block text-sm font-medium text-stone-300 mb-1">Descrição de Tamanho</label>
                 <textarea value={raceData.size_description} onChange={e => handleFieldChange('size_description', e.target.value)} rows={2} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200 text-sm" placeholder="Ex: Têm entre 1,5m e 1,8m e constituição esguia."/>
            </div>
             <div>
                 <label className="block text-sm font-medium text-stone-300 mb-1">Descrição de Idade</label>
                 <textarea value={raceData.age} onChange={e => handleFieldChange('age', e.target.value)} rows={2} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200 text-sm" placeholder="Ex: Atingem a maturidade aos 16 e vivem até 80 anos."/>
            </div>
             <div>
                 <label className="block text-sm font-medium text-stone-300 mb-1">Descrição de Alinhamento</label>
                 <textarea value={raceData.alignment} onChange={e => handleFieldChange('alignment', e.target.value)} rows={2} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200 text-sm" placeholder="Ex: Tendem a ser caóticos e bons, valorizando a liberdade."/>
            </div>
        </div>
    );
};

export default RaceForm;
