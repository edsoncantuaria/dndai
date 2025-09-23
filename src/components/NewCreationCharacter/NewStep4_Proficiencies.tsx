// src/components/NewCreationCharacter/NewStep4_Proficiencies.tsx
// Esta é a quarta etapa do "wizard", focada nas escolhas de perícias e proficiências.
// A lógica complexa de quais proficiências estão disponíveis, quais já foram escolhidas,
// e o que vem da Raça vs. Classe, é toda gerenciada pelo hook `useCharacterCreation`.
// Este componente apenas renderiza as opções de forma clara para o jogador.

import React from 'react';
import { normalizeProficiencyName } from '@/utils/translator';
import { Icons } from '../Icons';
import { ProficiencyChoiceWithSource } from '@/hooks/newUseCharacterCreation';
import type { Proficiency } from '@/types';

interface Props {
    allProficiencyChoices: ProficiencyChoiceWithSource[];
    allFixedProficiencies: Map<string, Proficiency>;
    proficiencySelections: Record<string, string[]>;
    unavailableProficiencies: Set<string>;
    handleProficiencyChange: (profIndex: string, choiceGroup: ProficiencyChoiceWithSource) => void;
    prevStep: () => void;
    nextStep: () => void;
}

const NewStep4_Proficiencies: React.FC<Props> = ({
    allProficiencyChoices,
    allFixedProficiencies,
    proficiencySelections,
    unavailableProficiencies,
    handleProficiencyChange,
    prevStep,
    nextStep,
}) => {
    // Validação para saber se todas as escolhas obrigatórias foram feitas
    const canProceed = allProficiencyChoices.every(choice =>
        (proficiencySelections[choice.id]?.length || 0) === choice.choose
    );

    return (
        <div className="space-y-8 animate-fadeIn">
            <div>
                <h3 className="text-xl font-semibold text-stone-300 mb-2">Escolha suas Proficiências</h3>
                <p className="text-sm text-stone-400 mb-6">Seu antecedente, raça e classe lhe concedem várias perícias. Escolha as opções disponíveis abaixo.</p>
            </div>

            {/* Proficiências Concedidas */}
            {allFixedProficiencies.size > 0 && (
                <div className="bg-stone-900/50 p-4 rounded-lg border border-stone-700">
                    <h4 className="font-semibold text-amber-300 mb-3">Proficiências Concedidas</h4>
                    <ul className="list-disc list-inside text-stone-400 space-y-1 text-sm columns-2 md:columns-3">
                        {Array.from(allFixedProficiencies.values()).map(prof => (
                            <li key={prof.index}>{normalizeProficiencyName(prof.name)}</li>
                        ))}
                    </ul>
                </div>
            )}

            {allProficiencyChoices.length === 0 ? (
                 <div className="text-center text-stone-400 italic p-8 bg-stone-900/50 rounded-lg">
                    <p>Nenhuma escolha de proficiência necessária para suas seleções atuais.</p>
                 </div>
            ) : (
                <div className="space-y-6">
                    {allProficiencyChoices.map((choice) => {
                        const selectedCountInGroup = proficiencySelections[choice.id]?.length || 0;
                        
                        return (
                            <div key={choice.id} className="bg-stone-900/50 p-4 rounded-lg border border-stone-700">
                                <h4 className="font-semibold text-amber-300 mb-1">{normalizeProficiencyName(choice.desc)}</h4>
                                <p className="text-sm text-stone-400 mb-4">Fonte: {choice.source} <span className="font-semibold">({selectedCountInGroup}/{choice.choose})</span></p>
                                
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {choice.options.map(option => {
                                        const isSelected = !!proficiencySelections[choice.id]?.includes(option.index);
                                        const isUnavailable = !isSelected && unavailableProficiencies.has(option.index);
                                        const isLimitReached = !isSelected && selectedCountInGroup >= choice.choose;
                                        const isDisabled = isUnavailable || isLimitReached;
                                        
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
                                                {isDisabled && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-stone-950 text-stone-300 text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg border border-stone-700">
                                                        {isUnavailable ? "Já proficiente de outra fonte" : "Limite de escolhas atingido"}
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

            <div className="flex justify-between pt-8">
                <button type="button" onClick={prevStep} className="menu-button btn-import max-w-xs">
                    <Icons.Play className="h-6 w-6 mr-3 transform rotate-90 scale-y-150" />
                    Voltar
                </button>
                <button type="button" onClick={nextStep} disabled={!canProceed} className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed">
                    {canProceed ? 'Avançar' : 'Selecione as proficiências'}
                    <Icons.Play className="h-6 w-6 ml-3 transform -rotate-90 scale-y-150" />
                </button>
            </div>
        </div>
    );
};

export default NewStep4_Proficiencies;
