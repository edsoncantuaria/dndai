// src/components/NewCreationCharacter/NewStep1_RaceClass.tsx
import React, { useState, useMemo } from 'react';
import type { ApiListItem, ApiTrait } from '@/types';
import { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { Dice5, ArrowRight, Loader2, Info, Eye } from 'lucide-react';
import * as DndApiService from '@/services/dndApiService';
import ClassDetailsModal from './ClassDetailsModal';

const TraitDisplay: React.FC<{ trait: ApiListItem }> = ({ trait }) => {
    const [details, setDetails] = useState<ApiTrait | null>(null);

    const fetchDetails = async () => {
        if (!details) {
            const data = await DndApiService.getTraitDetails(trait.index);
            setDetails(data);
        }
    };

    return (
        <div className="relative group text-sm">
            <span onMouseEnter={fetchDetails} className="cursor-help font-semibold text-stone-300 underline decoration-dotted decoration-stone-500">
                {trait.name}
            </span>
            {details && (
                 <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-stone-950 text-stone-300 text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg border border-stone-700">
                    <h4 className="font-bold text-amber-300 mb-1">{details.name}</h4>
                    <div className="space-y-1">
                        {details.desc.map((d, i) => <p key={i}>{d}</p>)}
                    </div>
                </div>
            )}
        </div>
    )
}

const RaceDetailsDisplay: React.FC<Pick<Props, 'hook'>> = ({ hook }) => {
    const { details: { raceDetails, subraceDetails }, racialBonuses } = hook;
    
    if (!raceDetails) return null;

    const finalTraits = Array.from(new Map([...(raceDetails?.traits || []), ...(subraceDetails?.racial_traits || [])].map(item => [item.index, item])).values());

    return (
        <div className="mt-4 p-4 bg-stone-900/50 border border-stone-700 rounded-lg animate-fadeIn space-y-3">
             <h4 className="text-lg font-bold text-amber-300 font-garamond">{raceDetails.name} {subraceDetails ? `(${subraceDetails.name})` : ''}</h4>
             
             <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                 <div>
                    <p className="font-semibold text-stone-400">Bônus de Atributo</p>
                    <p className="text-stone-200">
                        {Object.entries(racialBonuses).map(([attr, bonus]) => `${attr.substring(0,3).toUpperCase()} +${bonus}`).join(', ') || 'Nenhum'}
                    </p>
                </div>
                <div>
                    <p className="font-semibold text-stone-400">Velocidade</p>
                    <p className="text-stone-200">{raceDetails.speed} pés</p>
                </div>
            </div>

            {finalTraits.length > 0 && (
                <div>
                    <p className="font-semibold text-stone-400 text-sm">Traços Raciais</p>
                     <ul className="list-disc list-inside text-stone-300 space-y-1 mt-1 pl-2">
                        {finalTraits.map(trait => <TraitDisplay key={trait.index} trait={trait} /> )}
                    </ul>
                </div>
            )}
        </div>
    )
}

interface Props {
    hook: ReturnType<typeof useCharacterCreator>;
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
        details: { raceDetails, classDetails, draconicAncestryOptions },
        loadingStates,
        handleRandomizeRaceAndClass,
        isVariantHuman,
        setField,
        draconicAncestry,
    } = hook;
    
    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    
    const canProceed = useMemo(() => {
        if (!race || !characterClass) return false;
        if (race === 'dragonborn' && !draconicAncestry) return false;
        return true;
    }, [race, characterClass, draconicAncestry]);

    return (
        <>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {races.map(r => (
                            <button
                                key={r.index}
                                type="button"
                                onClick={() => handleRaceChange(r.index)}
                                className={`p-4 border-2 rounded-lg text-center transition-all duration-200 ${race === r.index ? 'border-amber-500 bg-amber-900/40 shadow-lg shadow-amber-900/30' : 'border-stone-700 bg-stone-800/50 hover:border-amber-600 hover:bg-stone-700/50'}`}
                            >
                                <span className="font-bold text-lg text-stone-100">{r.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
                
                {loadingStates.isLoading && <div className="text-center"><Loader2 className="h-8 w-8 animate-spin text-amber-300" /></div>}
                
                {race && raceDetails && !loadingStates.isLoading && <RaceDetailsDisplay hook={hook} />}

                {race === 'human' && (
                    <div className="animate-fadeIn mt-6 p-4 bg-stone-900/40 rounded-md border border-stone-700">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={isVariantHuman}
                                onChange={(e) => setField('isVariantHuman', e.target.checked)}
                                className="form-checkbox h-5 w-5 text-amber-500 bg-stone-800 border-stone-600 rounded focus:ring-amber-500"
                            />
                            <div>
                                <h4 className="text-lg font-semibold text-stone-300">Humano Variante</h4>
                                <p className="text-sm text-stone-400">Troque o bônus de +1 em todos os atributos por +1 em dois atributos, uma perícia e um talento inicial.</p>
                            </div>
                        </label>
                    </div>
                )}

                {race === 'dragonborn' && draconicAncestryOptions && (
                    <div className="animate-fadeIn mt-6 p-4 bg-stone-900/40 rounded-md border border-stone-700">
                        <h4 className="text-lg font-semibold text-stone-300 mb-2">Ancestralidade Dracônica</h4>
                        <p className="text-sm text-stone-400 mb-4">Sua linhagem determina seu tipo de dano e arma de sopro.</p>
                        <select
                            value={hook.draconicAncestry}
                            onChange={(e) => setField('draconicAncestry', e.target.value)}
                            className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        >
                            <option value="" disabled>Escolha sua linhagem...</option>
                            {draconicAncestryOptions.map(opt => {
                                const dragonName = opt.name.replace('Draconic Ancestry: ', '');
                                const damageType = opt.damage_type || 'Desconhecido';
                                return (
                                    <option key={opt.index} value={opt.index}>
                                        {dragonName} (Sopro de {damageType})
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                )}

                {raceDetails?.subraces?.length > 0 && (
                    <div className="animate-fadeIn">
                        <h4 className="text-lg font-semibold text-stone-300 mb-4">Sub-raça (Opcional)</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {raceDetails.subraces.map((sr: ApiListItem) => (
                                <button
                                    key={sr.index}
                                    type="button"
                                    onClick={() => handleSubraceChange(sr.index)}
                                    className={`p-4 border-2 rounded-lg text-center transition-all duration-200 ${subrace === sr.index ? 'border-amber-500 bg-amber-900/40 shadow-lg shadow-amber-900/30' : 'border-stone-700 bg-stone-800/50 hover:border-amber-600 hover:bg-stone-700/50'}`}
                                >
                                    <span className="font-bold text-lg text-stone-100">{sr.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                <div>
                    <h4 className="text-lg font-semibold text-stone-300 mb-4">Classe</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {classes.map(c => (
                            <button
                                key={c.index}
                                type="button"
                                onClick={() => handleClassChange(c.index)}
                                className={`p-4 border-2 rounded-lg text-center transition-all duration-200 ${characterClass === c.index ? 'border-amber-500 bg-amber-900/40 shadow-lg shadow-amber-900/30' : 'border-stone-700 bg-stone-800/50 hover:border-amber-600 hover:bg-stone-700/50'}`}
                            >
                                <span className="font-bold text-lg text-stone-100">{c.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {loadingStates.isLoading && <div className="text-center"><Loader2 className="h-8 w-8 animate-spin text-amber-300" /></div>}
                
                {characterClass && classDetails && !loadingStates.isLoading && (
                    <div className="flex justify-center mt-4 animate-fadeIn">
                        <button type="button" onClick={() => setIsClassModalOpen(true)} className="flex items-center gap-2 text-amber-300 hover:text-amber-200 underline">
                           <Eye className="h-4 w-4"/> Ver Detalhes da Classe {classDetails.name}
                        </button>
                    </div>
                )}


                <div className="flex justify-end pt-8">
                    <button
                        type="button"
                        onClick={nextStep}
                        disabled={!canProceed}
                        className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ArrowRight className="h-6 w-6 mr-3"/>
                        {canProceed ? 'Avançar' : 'Faça suas escolhas'}
                    </button>
                </div>
            </div>
            {classDetails && (
                <ClassDetailsModal
                    isOpen={isClassModalOpen}
                    onClose={() => setIsClassModalOpen(false)}
                    classDetails={classDetails}
                    classLevels={hook.details.classLevels || []}
                />
            )}
        </>
    );
};

export default NewStep1_RaceClass;
