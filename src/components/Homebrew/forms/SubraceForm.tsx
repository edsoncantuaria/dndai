// src/components/Homebrew/forms/SubraceForm.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import type { ApiListItem } from '@/types';
import * as DndApiService from '@/services/dndApiService';
import * as HomebrewService from '@/services/homebrewService';
import { translateApiString } from '@/utils/translator';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import TraitSelector from '../TraitSelector';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

const SubraceForm: React.FC<Props> = ({ onDataChange, initialData }) => {
    const { user } = useAuth();
    const [subraceData, setSubraceData] = useState(() => ({
        name: '',
        desc: '',
        race: { index: '', name: '', url: '' },
        ability_bonuses: [],
        racial_traits: [],
        starting_proficiencies: [],
        languages: [],
        dependencies: [],
        official_index: '',
        ...(initialData || {}),
    }));
    const [races, setRaces] = useState<ApiListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchRaces = useCallback(async () => {
        setIsLoading(true);
        try {
            const officialRaces = await DndApiService.getRaces();
            const homebrewRacesPromise = HomebrewService.listHomebrewContent('public', undefined, 'race');
            const myHomebrewRacesPromise = user ? HomebrewService.listHomebrewContent('mine', undefined, 'race') : Promise.resolve([]);

            const [homebrewRaces, myHomebrewRaces] = await Promise.all([homebrewRacesPromise, myHomebrewRacesPromise]);

            const all = [...(officialRaces?.results || [])];
            const myIds = new Set(myHomebrewRaces.map(r => r.id));

            all.push(...myHomebrewRaces.map(r => ({ index: r.id, name: `(Meu) ${r.name}`, url: '' })));
            all.push(...homebrewRaces.filter(r => !myIds.has(r.id)).map(r => ({ index: r.id, name: `(H) ${r.name}`, url: '' })));

            setRaces(all.sort((a,b) => a.name.localeCompare(b.name)));
            
            if (initialData?.race.index && !all.some(r => r.index === initialData.race.index)) {
                setRaces(prev => [initialData.race, ...prev]);
            }

        } catch (error) {
            console.error("Failed to fetch races:", error);
        } finally {
            setIsLoading(false);
        }
    }, [user, initialData]);

    useEffect(() => {
        fetchRaces();
    }, [fetchRaces]);


    useEffect(() => {
        const fullData = {
            ...subraceData,
            index: subraceData.official_index || (subraceData.name || '').toLowerCase().replace(/\s+/g, '-') || `custom-subrace-${Date.now()}`
        };
        const { official_index, ...finalData } = fullData;
        onDataChange(finalData);
    }, [subraceData]);

    const handleFieldChange = (field: keyof typeof subraceData, value: any) => {
        setSubraceData(prev => ({ ...prev, [field]: value }));
    };

    const handleRaceChange = (raceIndex: string) => {
        const selectedRace = races.find(r => r.index === raceIndex);
        if (selectedRace) {
            handleFieldChange('race', selectedRace);
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raceIndex)) {
                setSubraceData(prev => ({ ...prev, dependencies: [raceIndex] }));
            } else {
                setSubraceData(prev => ({ ...prev, dependencies: [] }));
            }
        }
    };
    
    const handleTraitsChange = (newTraits: ApiListItem[]) => {
        const traitIds = newTraits.map(t => t.index);
        const homebrewTraitIds = traitIds.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
        const raceDep = subraceData.dependencies.filter(dep => !dep.startsWith('feat-'));
        
        setSubraceData(prev => ({
            ...prev,
            racial_traits: newTraits,
            dependencies: Array.from(new Set([...raceDep, ...homebrewTraitIds]))
        }));
    };

    const handleBonusChange = (index: number, field: 'ability_score' | 'bonus', value: string | number) => {
        const newBonuses = [...subraceData.ability_bonuses];
        const abilityScoreIndex = value as string;
        if (field === 'ability_score') {
            newBonuses[index].ability_score = { index: abilityScoreIndex, name: abilityScoreIndex.toUpperCase(), url: `/api/ability-scores/${abilityScoreIndex}` };
        } else {
            newBonuses[index].bonus = Number(value);
        }
        handleFieldChange('ability_bonuses', newBonuses);
    };

    const addBonus = () => {
        handleFieldChange('ability_bonuses', [...subraceData.ability_bonuses, { ability_score: { index: 'str', name: 'STR', url: '/api/ability-scores/str' }, bonus: 1 }]);
    };

    const removeBonus = (index: number) => {
        handleFieldChange('ability_bonuses', subraceData.ability_bonuses.filter((_, i) => i !== index));
    };

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <label htmlFor="subrace-name" className="block text-sm font-medium text-stone-300 mb-1">Nome da Sub-raça</label>
                <input id="subrace-name" type="text" value={subraceData.name} onChange={e => handleFieldChange('name', e.target.value)} required className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" placeholder="Ex: Elfo da Floresta, Anão Cinzento"/>
            </div>
            {user?.id === 1 && (
                <div>
                    <label htmlFor="official_index" className="block text-sm font-medium text-stone-300 mb-1">Índice Oficial (para Sobrescrever)</label>
                    <input id="official_index" type="text" value={subraceData.official_index} onChange={e => handleFieldChange('official_index', e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" placeholder="Ex: high-elf (opcional)"/>
                </div>
            )}
            <div>
                <label htmlFor="subrace-parent-race" className="block text-sm font-medium text-stone-300 mb-1">Raça Principal</label>
                <select id="subrace-parent-race" value={subraceData.race.index} onChange={e => handleRaceChange(e.target.value)} required className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200">
                    <option value="" disabled>Selecione a raça principal...</option>
                    {races.map(r => <option key={r.index} value={r.index}>{translateApiString(r.name)}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="subrace-desc" className="block text-sm font-medium text-stone-300 mb-1">Descrição</label>
                <textarea id="subrace-desc" value={subraceData.desc} onChange={e => handleFieldChange('desc', e.target.value)} required rows={3} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" placeholder="Descreva as características únicas desta sub-raça."/>
            </div>
             <div>
                <h5 className="text-sm font-medium text-stone-300 mb-2">Bônus de Atributo</h5>
                <div className="space-y-2">
                    {subraceData.ability_bonuses.map((bonus, index) => (
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
                    selectedTraits={subraceData.racial_traits}
                    onSelectionChange={handleTraitsChange}
                />
            </div>
        </div>
    );
};

export default SubraceForm;
