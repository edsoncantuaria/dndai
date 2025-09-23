import React from 'react';
import { useCharacterCreation } from '../../hooks/useCharacterCreation';
import { normalizeProficiencyName, translateApiString } from '../../utils/translator';

interface ProficiencyChoicesProps {
    hook: ReturnType<typeof useCharacterCreation>;
}

const ProficiencyChoices: React.FC<ProficiencyChoicesProps> = ({ hook }) => {
    const { 
        race, 
        characterClass, 
        background, 
        allProficiencyChoices, 
        allFixedProficiencies, 
        proficiencySelections,
        unavailableProficiencies,
        handleProficiencyChange
    } = hook;

    if (!race || !characterClass || !background) return null;

    // Do not render the whole section if there are no choices and no fixed proficiencies to display
    if (allProficiencyChoices.length === 0 && allFixedProficiencies.size === 0) return null;

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold font-garamond text-amber-300 border-b border-stone-700 pb-2 text-shadow-amber">Proficiências</h3>
            
            {allFixedProficiencies.size > 0 && (
                <div>
                    <h4 className="font-semibold text-stone-300 mb-2">Proficiências Concedidas:</h4>
                    <ul className="list-disc list-inside text-stone-400 space-y-1 text-sm columns-2 md:columns-3">
                        {Array.from(allFixedProficiencies.values()).map(prof => 
                            <li key={prof.name}>{normalizeProficiencyName(prof.name)}</li>
                        )}
                    </ul>
                </div>
            )}

            {allProficiencyChoices.map((choice) => {
                if (choice.options.length === 0) return null;

                const selectedCountInGroup = proficiencySelections[choice.id]?.length || 0;
                
                return (
                    <div key={choice.id}>
                        <label className="block text-stone-300 font-semibold mb-2">
                            {translateApiString(choice.desc)} - <span className="font-normal text-stone-400">Fonte: {choice.source} ({selectedCountInGroup}/{choice.choose})</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                            {choice.options.map(option => {
                                const isChecked = proficiencySelections[choice.id]?.includes(option.index);
                                const isUnavailable = !isChecked && unavailableProficiencies.has(option.index);
                                const isLimitReached = !isChecked && selectedCountInGroup >= choice.choose;
                                const isDisabled = isUnavailable || isLimitReached;
                                
                                let tooltipText = '';
                                if (isUnavailable) {
                                    tooltipText = allFixedProficiencies.has(option.index) 
                                        ? "Já concedido pela sua raça ou classe."
                                        : "Já selecionado em outra escolha.";
                                } else if (isLimitReached) {
                                    tooltipText = "Limite de escolhas para este grupo atingido.";
                                }

                                return (
                                    <div key={option.index} className="relative group">
                                        <label 
                                            className={`flex items-center p-2 rounded-md border text-sm transition-colors ${
                                                isChecked 
                                                ? 'bg-amber-800/50 border-amber-600' 
                                                : 'bg-stone-700 border-stone-600'
                                            } ${
                                                isDisabled 
                                                ? 'opacity-50 cursor-not-allowed' 
                                                : 'cursor-pointer hover:bg-stone-600'
                                            }`}>
                                            <input 
                                                type="checkbox" 
                                                checked={isChecked} 
                                                onChange={() => handleProficiencyChange(option.index, choice)} 
                                                disabled={isDisabled} 
                                                className="form-checkbox h-4 w-4 text-amber-500 bg-stone-800 border-stone-600 rounded focus:ring-amber-500 focus:ring-offset-0 focus:ring-offset-transparent"
                                            />
                                            <span className="ml-2 text-stone-200">{normalizeProficiencyName(option.name)}</span>
                                        </label>
                                        {isDisabled && tooltipText && (
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-stone-900 text-stone-300 text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
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
    );
};

export default ProficiencyChoices;
