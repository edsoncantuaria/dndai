// src/components/NewCreationCharacter/NewStep1_RaceClass.tsx
import React, { useState, useEffect } from 'react';
import type { ApiListItem, ApiTrait, ApiRace } from '@/types';
import { translateApiString } from '@/utils/translator';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';
import { Dice5, ArrowRight, Loader2 } from 'lucide-react';
import * as DndApiService from '@/services/dndApiService';

interface DraconicAncestryChoiceProps {
    hook: ReturnType<typeof useNewCharacterCreation>;
}

const DraconicAncestryChoice: React.FC<DraconicAncestryChoiceProps> = ({ hook }) => {
    const { draconicAncestry, setDraconicAncestry, raceDetails } = hook;
    const [ancestryOptions, setAncestryOptions] = useState<ApiListItem[]>([]);
    
    useEffect(() => {
        // As opções de ancestralidade estão dentro de uma das características (traits) do draconato.
        const ancestryTraitChoice = raceDetails?.traits.find(t => t.index === 'draconic-ancestry');
        
        // As opções reais estão em `trait_specific`
        const fetchAncestryOptions = async () => {
            if (ancestryTraitChoice) {
                const traitDetails = await DndApiService.getTraitDetails(ancestryTraitChoice.index);
                if (traitDetails?.trait_specific?.subfeature_options?.options) {
                    const options = traitDetails.trait_specific.subfeature_options.options.map((opt: any) => opt.item);
                    setAncestryOptions(options);
                }
            }
        };

        if (raceDetails?.index === 'dragonborn') {
            fetchAncestryOptions();
        }

    }, [raceDetails]);

    if (raceDetails?.index !== 'dragonborn') {
        return null;
    }

    if (ancestryOptions.length === 0) {
        return <p className="text-center text-stone-400 mt-4">Carregando ancestralidades...</p>;
    }

    return (
        <div className="animate-fadeIn mt-6">
            <h4 className="text-lg font-semibold text-stone-300 mb-2">Ancestralidade Dracônica</h4>
            <p className="text-sm text-stone-400 mb-4">Sua linhagem determina seu tipo de dano e arma de sopro.</p>
            <select
                value={draconicAncestry}
                onChange={(e) => setDraconicAncestry(e.target.value)}
                className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
                <option value="" disabled>Escolha sua linhagem...</option>
                {ancestryOptions.map(opt => (
                    <option key={opt.index} value={opt.index}>
                        {translateApiString(opt.name.replace('Draconic Ancestry: ', ''))}
                    </option>
                ))}
            </select>
        </div>
    );
};


interface Props {
    hook: ReturnType<typeof useNewCharacterCreation>;
    races: ApiListItem[];
    classes: ApiListItem[];
    nextStep: () => void;
}

const TraitChoice: React.FC<{
    trait: ApiTrait;
    hook: ReturnType<typeof useNewCharacterCreation>;
}> = ({ trait, hook }) => {
    const { traitSelections, handleTraitSelection } = hook;
    const choice = trait.trait_specific?.subfeature_options;
    if (!choice) return null;

    const selection = traitSelections[trait.index];

    return (
        <div className="mt-2 pl-4 border-l-2 border-stone-600">
            <label className="text-sm font-semibold text-stone-300">{choice.desc}</label>
            <select
                value={selection || ''}
                onChange={(e) => handleTraitSelection(trait.index, e.target.value)}
                className="w-full mt-1 bg-stone-700/80 border border-stone-600 rounded-md p-2 text-sm text-stone-200"
            >
                <option value="" disabled>Selecione uma opção...</option>
                {choice.from.options.map((opt: any) => (
                    <option key={opt.item.index} value={opt.item.index}>
                        {translateApiString(opt.item.name)}
                    </option>
                ))}
            </select>
        </div>
    );
};

const NewStep1_RaceClass: React.FC<Props> = ({
    hook,
    races,
    classes,
    nextStep,
}) => {
    const {
        race,
        subrace,
        characterClass,
        handleRaceChange,
        handleSubraceChange,
        handleClassChange,
        raceDetails,
        subraceDetails,
        traitChoiceDetails,
        isSpellsLoading,
        handleRandomizeRaceAndClass,
    } = hook;
    
    const canProceed = race && characterClass && traitChoiceDetails.every(t => !t.trait_specific?.subfeature_options || hook.traitSelections[t.index]) && (race !== 'dragonborn' || hook.draconicAncestry);

    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="flex justify-between items-center">
                 <h3 className="text-xl font-semibold text-stone-300">Escolha sua Raça e Classe</h3>
                <button
                    type="button"
                    onClick={() => handleRandomizeRaceAndClass(races, classes)}
                    className="flex items-center gap-1.5 text-xs bg-amber-600/20 hover:bg-amber-600/40 text-amber-200 font-semibold py-1 px-2 rounded-md transition-colors"
                >
                    <Dice5 className="h-4 w-4" />
                    Aleatório
                </button>
            </div>
            
            <div>
                <h4 className="text-lg font-semibold text-stone-300 mb-4">Raça</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {races.map(r => (
                        <button
                            key={r.index}
                            type="button"
                            onClick={() => handleRaceChange(r.index)}
                            className={`p-4 border-2 rounded-lg text-center transition-all duration-200 ${race === r.index ? 'border-amber-500 bg-amber-900/40 shadow-lg shadow-amber-900/30' : 'border-stone-700 bg-stone-800/50 hover:border-amber-600 hover:bg-stone-700/50'}`}
                        >
                            <span className="font-bold text-lg text-stone-100">{translateApiString(r.name)}</span>
                        </button>
                    ))}
                </div>
            </div>

            {race === 'dragonborn' && <DraconicAncestryChoice hook={hook} />}

            {raceDetails?.subraces?.length > 0 && (
                <div className="animate-fadeIn">
                    <h4 className="text-lg font-semibold text-stone-300 mb-4">Sub-raça (Opcional)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {raceDetails.subraces.map((sr: ApiListItem) => (
                            <button
                                key={sr.index}
                                type="button"
                                onClick={() => handleSubraceChange(sr.index)}
                                className={`p-4 border-2 rounded-lg text-center transition-all duration-200 ${subrace === sr.index ? 'border-amber-500 bg-amber-900/40 shadow-lg shadow-amber-900/30' : 'border-stone-700 bg-stone-800/50 hover:border-amber-600 hover:bg-stone-700/50'}`}
                            >
                                <span className="font-bold text-lg text-stone-100">{translateApiString(sr.name)}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            
            {traitChoiceDetails.length > 0 && traitChoiceDetails.filter(t => t.index !== 'draconic-ancestry').map(trait => (
                <div key={trait.index} className="animate-fadeIn p-3 bg-stone-900/40 rounded-md border border-stone-700">
                     <p className="font-semibold text-stone-300">{translateApiString(trait.name)}</p>
                    <p className="text-xs text-stone-400 italic">{trait.desc[0]}</p>
                    {trait.trait_specific?.subfeature_options && (
                        <TraitChoice trait={trait} hook={hook} />
                    )}
                </div>
            ))}


            <div>
                <h4 className="text-lg font-semibold text-stone-300 mb-4">Classe</h4>
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {classes.map(c => (
                        <button
                            key={c.index}
                            type="button"
                            onClick={() => handleClassChange(c.index)}
                            className={`p-4 border-2 rounded-lg text-center transition-all duration-200 ${characterClass === c.index ? 'border-amber-500 bg-amber-900/40 shadow-lg shadow-amber-900/30' : 'border-stone-700 bg-stone-800/50 hover:border-amber-600 hover:bg-stone-700/50'}`}
                        >
                            <span className="font-bold text-lg text-stone-100">{translateApiString(c.name)}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex justify-end pt-8">
                <button
                    type="button"
                    onClick={nextStep}
                    disabled={!canProceed || isSpellsLoading}
                    className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSpellsLoading ? <Loader2 className="mr-3 animate-spin" /> : <ArrowRight className="h-6 w-6 mr-3"/>}
                    {isSpellsLoading ? 'Carregando...' : (canProceed ? 'Avançar' : 'Faça suas escolhas')}
                </button>
            </div>
        </div>
    );
};

export default NewStep1_RaceClass;
