import React from 'react';
import { useCharacterCreation } from '../../hooks/useCharacterCreation';
import { ApiListItem } from '../../types';
import { translateLanguage } from '../../utils/translator';

interface LanguageSelectionProps {
    hook: ReturnType<typeof useCharacterCreation>;
    allLanguages: ApiListItem[];
}

const LanguageSelection: React.FC<LanguageSelectionProps> = ({ hook, allLanguages }) => {
    const { 
        race, 
        background, 
        baseLanguages, 
        languageChoicesCount, 
        chosenLanguages, 
        handleLanguageChange 
    } = hook;

    // Do not render this section until the necessary data is available
    if (!race || !background) return null;
    if (baseLanguages.length === 0 && languageChoicesCount === 0) return null;

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold font-garamond text-amber-300 border-b border-stone-700 pb-2 text-shadow-amber">Idiomas</h3>
            
            {baseLanguages.length > 0 && (
                 <div>
                    <h4 className="font-semibold text-stone-300 mb-2">Idiomas Conhecidos:</h4>
                    <ul className="list-disc list-inside text-stone-400 space-y-1">
                        {baseLanguages.map(lang => <li key={lang}>{translateLanguage(lang)}</li>)}
                    </ul>
                </div>
            )}
           
            {languageChoicesCount > 0 && Array.from({ length: languageChoicesCount }).map((_, index) => {
                // Languages that are already fixed for the character or selected in another dropdown
                const unavailableOptions = new Set([...baseLanguages, ...chosenLanguages.filter((_, i) => i !== index)]);
                const availableLanguageOptions = allLanguages.filter(lang => !unavailableOptions.has(lang.name));

                return (
                    <div key={index}>
                        <label htmlFor={`lang-choice-${index}`} className="block text-stone-300 font-semibold mb-2">Escolha de Idioma Adicional</label>
                        <select
                            id={`lang-choice-${index}`}
                            value={chosenLanguages[index] || ''}
                            onChange={(e) => handleLanguageChange(index, e.target.value)}
                            required
                            className="w-full bg-stone-700 border border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500"
                        >
                            <option value="" disabled>Selecione um idioma...</option>
                            {availableLanguageOptions.map(lang => (
                                <option key={lang.index} value={lang.name}>{translateLanguage(lang.name)}</option>
                            ))}
                        </select>
                    </div>
                );
            })}
        </div>
    );
};

export default LanguageSelection;
