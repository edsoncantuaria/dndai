// src/components/Homebrew/HomebrewCreator.tsx
'use client';
import React, { useState } from 'react';
import * as HomebrewService from '@/services/homebrewService';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, FlaskConical, Loader2, Plus, Trash2 } from 'lucide-react';
import { translateApiString } from '@/utils/translator';
import TraitSelector from './TraitSelector';
import type { ApiListItem } from '@/types';
import * as characterUtils from '@/utils/characterUtils';

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
            
            {['personality_traits', 'ideals', 'bonds', 'flaws'].map(type => (
                <div key={type}>
                    <h4 className="text-lg font-bold text-amber-300 border-b border-amber-800 pb-2 capitalize">{type.replace('_', ' de ')}</h4>
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
            default:
                return <p className="text-stone-400 italic text-center py-8">O editor para o tipo '{translateApiString(type)}' ainda não foi implementado. Você pode contribuir para adicioná-lo!</p>;
        }
    }

    return (
        <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col animate-fadeIn p-4 sm:p-6">
            <header className="mb-8">
                <h1 className="text-4xl md:text-5xl font-bold text-amber-50 font-serif text-shadow-amber text-center">
                    Criador de Homebrew
                </h1>
                <p className="text-stone-400 mt-2 text-center">Dê vida às suas ideias. Preencha os campos para criar seu conteúdo customizado.</p>
            </header>

            <form onSubmit={handleSubmit} className="bg-stone-900/50 p-6 rounded-lg border border-stone-700 space-y-6">
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

                <footer className="flex justify-between items-center pt-4 border-t border-stone-700">
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
                </footer>
            </form>
        </div>
    );
};

export default HomebrewCreator;
