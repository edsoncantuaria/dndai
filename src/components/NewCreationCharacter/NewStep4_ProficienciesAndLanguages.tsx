'use client';
import React from 'react';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';
import { normalizeProficiencyName, translateLanguage } from '@/utils/translator';
import { ArrowLeft, ArrowRight, Dice5 } from 'lucide-react';

interface Props {
    hook: ReturnType<typeof useNewCharacterCreation>;
    prevStep: () => void;
    nextStep: () => void;
}

const NewStep4_ProficienciesAndLanguages: React.FC<Props> = ({
    hook,
    prevStep,
    nextStep,
}) => {
    const {
        allProficiencyChoices,
        allFixedProficiencies,
        proficiencySelections,
        unavailableProficiencies,
        handleProficiencyChange,
        canProceedFromProficiencies,
        baseLanguages,
        languageChoicesCount,
        chosenLanguages,
        handleLanguageChange,
        allLanguages,
        handleRandomizeProficiencies,
        handleRandomizeLanguages,
    } = hook;

    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-stone-300 mb-2">Proficiências e Idiomas</h3>
            </div>
            <p className="text-sm text-stone-400 mb-6 -mt-6">Sua raça, classe e antecedente concedem várias perícias, ferramentas e idiomas. Faça suas escolhas abaixo.</p>

            {/* Granted Proficiencies */}
            <div className="bg-stone-900/50 p-4 rounded-lg border border-stone-700">
                <h4 className="font-semibold text-amber-300 mb-3">Concedido Automaticamente</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm text-stone-400">
                    <div>
                        <h5 className="font-bold text-stone-300">Proficiências</h5>
                        <ul className="list-disc list-inside">
                            {Array.from(allFixedProficiencies.values()).filter(p => !p.name.includes("Saving Throw")).map(prof => (
                                prof?.name && <li key={prof.index}>{normalizeProficiencyName(prof.name)}</li>
                            ))}
                        </ul>
                    </div>
                     <div>
                        <h5 className="font-bold text-stone-300">Resistências</h5>
                        <ul className="list-disc list-inside">
                            {Array.from(allFixedProficiencies.values()).filter(p => p.name.includes("Saving Throw")).map(prof => (
                                prof?.name && <li key={prof.index}>{normalizeProficiencyName(prof.name)}</li>
                            ))}
                        </ul>
                    </div>
                     <div>
                        <h5 className="font-bold text-stone-300">Idiomas</h5>
                         <ul className="list-disc list-inside">
                            {baseLanguages.map(lang => (
                                <li key={lang}>{translateLanguage(lang)}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Proficiency Choices */}
            {allProficiencyChoices.length > 0 && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h4 className="font-semibold text-amber-300 text-lg">Escolhas de Proficiência</h4>
                        <button
                            type="button"
                            onClick={handleRandomizeProficiencies}
                            className="flex items-center gap-1.5 text-xs bg-amber-600/20 hover:bg-amber-600/40 text-amber-200 font-semibold py-1 px-2 rounded-md transition-colors"
                        >
                            <Dice5 className="h-4 w-4" />
                            Aleatório
                        </button>
                    </div>
                    {allProficiencyChoices.map((choice) => {
                        const selectedCountInGroup = proficiencySelections[choice.id]?.length || 0;
                        const availableOptions = choice.options.filter(option => !allFixedProficiencies.has(option.index));
                        
                        if(availableOptions.length === 0) return null;

                        return (
                            <div key={choice.id} className="bg-stone-900/50 p-4 rounded-lg border border-stone-700">
                                <h5 className="font-semibold text-amber-300 mb-1">{normalizeProficiencyName(choice.desc)}</h5>
                                <p className="text-sm text-stone-400 mb-4">Fonte: {choice.source} <span className="font-semibold">({selectedCountInGroup}/{choice.choose})</span></p>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {availableOptions.map(option => {
                                        if(!option.name) return null;
                                        const isSelected = !!proficiencySelections[choice.id]?.includes(option.index);
                                        const isUnavailable = !isSelected && unavailableProficiencies.has(option.index);
                                        const isLimitReached = !isSelected && selectedCountInGroup >= choice.choose;
                                        const isDisabled = isUnavailable || isLimitReached;
                                        
                                        let tooltipText = '';
                                        if (isUnavailable) tooltipText = "Já selecionado em outro grupo";
                                        else if (isLimitReached) tooltipText = "Limite de escolhas atingido";

                                        return (
                                            <div key={option.index} className="relative group">
                                                <label 
                                                    className={`flex items-center p-3 rounded-md border text-sm transition-all duration-200 ${
                                                        isSelected 
                                                        ? 'bg-amber-900/50 border-amber-500 shadow-md' 
                                                        : 'bg-stone-800 border-stone-700'
                                                    } ${
                                                        isDisabled 
                                                        ? 'opacity-50 cursor-not-allowed' 
                                                        : 'cursor-pointer hover:bg-stone-700/70 hover:border-stone-600'
                                                    }`}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isSelected} 
                                                        onChange={() => handleProficiencyChange(option.index, choice)} 
                                                        disabled={isDisabled} 
                                                        className="form-checkbox h-4 w-4 text-amber-500 bg-stone-900 border-stone-600 rounded focus:ring-amber-500 focus:ring-offset-stone-800"
                                                    />
                                                    <span className="ml-3 text-stone-200">{normalizeProficiencyName(option.name)}</span>
                                                </label>
                                                {isDisabled && tooltipText && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-stone-950 text-stone-300 text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg border border-stone-700">
                                                        {tooltipText}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            
            {/* Language Choices */}
            {languageChoicesCount > 0 && (
                 <div className="bg-stone-900/50 p-4 rounded-lg border border-stone-700">
                     <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-amber-300 text-lg">Escolhas de Idioma ({chosenLanguages.filter(Boolean).length}/{languageChoicesCount})</h4>
                        <button
                            type="button"
                            onClick={handleRandomizeLanguages}
                            className="flex items-center gap-1.5 text-xs bg-amber-600/20 hover:bg-amber-600/40 text-amber-200 font-semibold py-1 px-2 rounded-md transition-colors"
                        >
                            <Dice5 className="h-4 w-4" />
                            Aleatório
                        </button>
                    </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Array.from({ length: languageChoicesCount }).map((_, index) => {
                            const unavailableOptions = new Set([...baseLanguages, ...chosenLanguages.filter((_, i) => i !== index)]);
                            const availableLanguageOptions = allLanguages.filter(lang => !unavailableOptions.has(lang.name));

                            return (
                                <div key={index}>
                                    <label htmlFor={`lang-choice-${index}`} className="block text-sm font-medium text-stone-300 mb-1">Idioma Adicional {index + 1}</label>
                                    <select
                                        id={`lang-choice-${index}`}
                                        value={chosenLanguages[index] || ''}
                                        onChange={(e) => handleLanguageChange(index, e.target.value)}
                                        required
                                        className="w-full bg-stone-800/70 border border-stone-700 rounded-md p-2 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    >
                                        <option value="" disabled>Selecione...</option>
                                        {availableLanguageOptions.map(lang => (
                                            <option key={lang.index} value={lang.name}>{translateLanguage(lang.name)}</option>
                                        ))}
                                    </select>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}


            <div className="flex justify-between pt-8">
                <button type="button" onClick={prevStep} className="menu-button btn-import max-w-xs">
                    <ArrowLeft className="h-6 w-6 mr-3" />
                    Voltar
                </button>
                <button type="button" onClick={nextStep} disabled={!canProceedFromProficiencies} className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed">
                    {canProceedFromProficiencies ? 'Avançar' : 'Faça suas escolhas'}
                    <ArrowRight className="h-6 w-6 ml-3" />
                </button>
            </div>
        </div>
    );
};

export default NewStep4_ProficienciesAndLanguages;
