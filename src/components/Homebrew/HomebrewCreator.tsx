// src/components/Homebrew/HomebrewCreator.tsx
'use client';
import React, { useState } from 'react';
import * as HomebrewService from '@/services/homebrewService';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, FlaskConical, Loader2, Plus, Trash2 } from 'lucide-react';
import { translateApiString } from '@/utils/translator';
import { DND_API_BASE } from '@/services/dndApiService'; // Assuming this is exported

const CONTENT_TYPES: HomebrewService.HomebrewContentType[] = [
    'race', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat'
];

interface Props {
    onContentCreated: () => void;
    onCancel: () => void;
}

// Sub-component for Race creation form
const RaceForm: React.FC<{ setRaceData: (data: any) => void }> = ({ setRaceData }) => {
    const [name, setName] = useState('');
    const [speed, setSpeed] = useState(30);
    const [abilityBonuses, setAbilityBonuses] = useState<{ ability_score: { index: string; name: string }; bonus: number }[]>([]);

    // This would be expanded to handle all race properties
    const handleSubmit = () => {
        const raceData = {
            index: name.toLowerCase().replace(/\s+/g, '-'),
            name,
            speed,
            ability_bonuses: abilityBonuses.map(b => ({
                ...b,
                ability_score: {
                    ...b.ability_score,
                    url: `${DND_API_BASE}/ability-scores/${b.ability_score.index}`
                }
            })),
            // Default values for other required fields based on OpenAPI
            alignment: "No typical alignment for this custom race.",
            age: "Maturity and lifespan are defined by culture.",
            size: "Medium",
            size_description: "Varies.",
            starting_proficiencies: [],
            languages: [],
            language_desc: "",
            traits: [],
            subraces: []
        };
        setRaceData(raceData);
    };
    
    const addBonus = () => {
        setAbilityBonuses([...abilityBonuses, { ability_score: { index: 'str', name: 'STR' }, bonus: 1 }]);
    };

    const removeBonus = (index: number) => {
        setAbilityBonuses(abilityBonuses.filter((_, i) => i !== index));
    };

    const updateBonus = (index: number, field: string, value: string | number) => {
        const newBonuses = [...abilityBonuses];
        if(field === 'ability_score') {
            newBonuses[index].ability_score = { index: value as string, name: (value as string).toUpperCase() };
        } else {
            newBonuses[index].bonus = Number(value);
        }
        setAbilityBonuses(newBonuses);
    };

    // Simulate submission on change to update the parent state
    React.useEffect(() => {
        handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name, speed, abilityBonuses]);

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="race-name" className="block text-sm font-medium text-stone-300 mb-1">Nome da Raça</label>
                <input id="race-name" type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
            </div>
            <div>
                <label htmlFor="race-speed" className="block text-sm font-medium text-stone-300 mb-1">Velocidade</label>
                <input id="race-speed" type="number" value={speed} onChange={e => setSpeed(Number(e.target.value))} required className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
            </div>
            <div>
                <h5 className="text-sm font-medium text-stone-300 mb-2">Bônus de Atributo</h5>
                <div className="space-y-2">
                    {abilityBonuses.map((bonus, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-stone-900/50 rounded-md">
                            <select value={bonus.ability_score.index} onChange={e => updateBonus(index, 'ability_score', e.target.value)} className="bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200">
                                <option value="str">Força</option>
                                <option value="dex">Destreza</option>
                                <option value="con">Constituição</option>
                                <option value="int">Inteligência</option>
                                <option value="wis">Sabedoria</option>
                                <option value="cha">Carisma</option>
                            </select>
                            <input type="number" value={bonus.bonus} onChange={e => updateBonus(index, 'bonus', e.target.value)} className="w-20 bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200" />
                            <button type="button" onClick={() => removeBonus(index)} className="text-red-400 hover:text-red-300"><Trash2 className="h-5 w-5" /></button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={addBonus} className="mt-2 text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"><Plus className="h-4 w-4" /> Adicionar Bônus</button>
            </div>
        </div>
    )
}

const HomebrewCreator: React.FC<Props> = ({ onContentCreated, onCancel }) => {
    const [name, setName] = useState('');
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
                description: 'Por favor, preencha o nome do conteúdo.',
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
                return <RaceForm setRaceData={setContentData} />;
            // Add cases for other types here later
            // case 'class': return <ClassForm />;
            default:
                return <p className="text-stone-400 italic text-center py-8">O editor para o tipo '{translateApiString(type)}' ainda não foi implementado. Você pode contribuir para adicioná-lo!</p>
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
                        onChange={(e) => setType(e.target.value as HomebrewService.HomebrewContentType)}
                        className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200"
                    >
                        {CONTENT_TYPES.map(t => <option key={t} value={t} className="capitalize">{translateApiString(t)}</option>)}
                    </select>
                </div>
                
                {/* Dynamic form based on type */}
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
