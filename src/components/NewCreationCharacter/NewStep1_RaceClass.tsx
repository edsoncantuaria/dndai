// src/components/NewCreationCharacter/NewStep1_RaceClass.tsx
// Esta é a primeira etapa do novo "wizard", focada na seleção de Raça e Classe.
// Ela consome as funções `handleRaceChange` e `handleClassChange` do hook `useCharacterCreation`
// para atualizar o estado global da criação.

import React from 'react';
import type { ApiListItem } from '@/types';
import { translateApiString } from '@/utils/translator';
import { Icons } from '../Icons';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';

// As props são todas as propriedades e funções do hook `useCharacterCreation`, além dos dados
interface Props {
    hook: ReturnType<typeof useNewCharacterCreation>;
    races: ApiListItem[];
    classes: ApiListItem[];
    nextStep: () => void;
}

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
        isSpellsLoading
    } = hook;
    const canProceed = race && characterClass && (!raceDetails?.subraces.length || subrace);

    return (
        <div className="space-y-8 animate-fadeIn">
            <div>
                <h3 className="text-xl font-semibold text-stone-300 mb-4">Escolha sua Raça</h3>
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

            {raceDetails?.subraces?.length > 0 && (
                <div className="animate-fadeIn">
                    <h3 className="text-xl font-semibold text-stone-300 mb-4">Escolha sua Sub-raça</h3>
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
            
            <div>
                <h3 className="text-xl font-semibold text-stone-300 mb-4">Escolha sua Classe</h3>
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
                    {isSpellsLoading ? <Icons.Spinner className="mr-3" /> : <Icons.Play className="h-6 w-6 mr-3 transform -rotate-90 scale-y-150"/>}
                    {isSpellsLoading ? 'Carregando...' : 'Avançar'}
                </button>
            </div>
        </div>
    );
};

export default NewStep1_RaceClass;
