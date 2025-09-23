// src/components/NewCreationCharacter/NewStep8_Finalize.tsx
import React from 'react';
import { Icons } from '../Icons';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';
import { normalizeProficiencyName, translateApiString, translateAttribute } from '@/utils/translator';
import type { Attributes } from '@/types';

interface Props {
    hook: ReturnType<typeof useNewCharacterCreation>;
    prevStep: () => void;
    handleFinalize: () => void;
}

const attributeOrder: (keyof Attributes)[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

const NewStep8_Finalize: React.FC<Props> = ({
    hook,
    prevStep,
    handleFinalize,
}) => {
    const {
        name,
        setName,
        isComplete,
        race,
        subrace,
        characterClass,
        background,
        alignment,
        finalAttributes,
        allFixedProficiencies,
        proficiencySelections,
        allProficiencyChoices,
        chosenClassSpells,
        classSpellOptions,
        chosenRacialSpells,
        racialSpellOptions,
        raceDetails
    } = hook;

    const finalSkills = Array.from(allFixedProficiencies.values())
        .filter(p => p.index.startsWith('skill-'))
        .map(p => normalizeProficiencyName(p.name));
        
    for (const key in proficiencySelections) {
        for (const profIndex of proficiencySelections[key]) {
             const choiceGroup = allProficiencyChoices.find(c => c.id === key);
             if (choiceGroup) {
                 const option = choiceGroup.options.find(o => o.index === profIndex);
                 if (option && option.index.startsWith('skill-')) {
                     finalSkills.push(normalizeProficiencyName(option.name));
                 }
             }
        }
    }

    const finalSpells = [
        ...chosenClassSpells,
        ...Object.values(chosenRacialSpells).flat()
    ].map(spellIndex => {
        const spell = [...classSpellOptions, ...racialSpellOptions].find(s => s.index === spellIndex);
        return spell ? translateApiString(spell.name) : null;
    }).filter(Boolean);

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="text-center">
                <h3 className="text-2xl font-semibold text-stone-200 mb-2 font-garamond">O Toque Final</h3>
                <p className="text-sm text-stone-400">Revise as escolhas do seu herói e dê a ele um nome digno de lendas.</p>
            </div>
            
             {/* Character Sheet Summary */}
            <div className="bg-stone-900/50 p-4 sm:p-6 rounded-lg border-2 border-stone-700 space-y-6 shadow-lg">
                
                {/* Name Input */}
                <div className="w-full mb-6">
                    <label htmlFor="character-name" className="sr-only">Nome do Personagem</label>
                    <input
                        type="text"
                        id="character-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nome do Personagem..."
                        className="w-full bg-transparent border-b-2 border-stone-600 focus:border-amber-500 pb-2 text-stone-100 text-3xl text-center font-bold font-garamond focus:ring-0 transition-colors"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    {/* Basic Info */}
                    <div className="md:col-span-1 space-y-2">
                        <div className="bg-stone-800/50 p-3 rounded-md">
                            <strong className="text-stone-400 block text-xs uppercase tracking-wider">Raça</strong> 
                            <span className="text-stone-100 text-lg font-semibold">{translateApiString(race)} {subrace && `(${translateApiString(subrace)})`}</span>
                        </div>
                        <div className="bg-stone-800/50 p-3 rounded-md">
                            <strong className="text-stone-400 block text-xs uppercase tracking-wider">Classe</strong> 
                            <span className="text-stone-100 text-lg font-semibold">{translateApiString(characterClass)}</span>
                        </div>
                         <div className="bg-stone-800/50 p-3 rounded-md">
                            <strong className="text-stone-400 block text-xs uppercase tracking-wider">Antecedente</strong> 
                            <span className="text-stone-100 text-lg font-semibold">{translateApiString(background)}</span>
                        </div>
                         <div className="bg-stone-800/50 p-3 rounded-md">
                            <strong className="text-stone-400 block text-xs uppercase tracking-wider">Alinhamento</strong> 
                            <span className="text-stone-100 text-lg font-semibold">{translateApiString(alignment)}</span>
                        </div>
                    </div>

                    {/* Attributes */}
                    <div className="md:col-span-2">
                         <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-center">
                            {attributeOrder.map(attr => (
                                <div key={attr} className="bg-stone-800/50 p-3 rounded-md border border-stone-700/70">
                                    <div className="text-sm font-bold text-stone-300">{translateAttribute(attr).substring(0,3).toUpperCase()}</div>
                                    <div className="font-bold text-4xl text-amber-300 my-1">{finalAttributes[attr]}</div>
                                    <div className="text-lg text-amber-400/80 bg-stone-900/50 rounded-full w-10 h-10 flex items-center justify-center mx-auto">{Math.floor((finalAttributes[attr] - 10) / 2) >= 0 ? `+${Math.floor((finalAttributes[attr] - 10) / 2)}` : Math.floor((finalAttributes[attr] - 10) / 2)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Skills */}
                    {finalSkills.length > 0 && (
                        <div className="bg-stone-800/50 p-4 rounded-md">
                            <h4 className="font-semibold text-amber-300 border-b border-stone-700 pb-2 mb-2">Perícias</h4>
                            <ul className="columns-2 text-sm text-stone-300 space-y-1 list-disc list-inside">
                                {finalSkills.sort().map(skill => <li key={skill}>{skill}</li>)}
                            </ul>
                        </div>
                    )}

                    {/* Spells */}
                    {finalSpells.length > 0 && (
                         <div className="bg-stone-800/50 p-4 rounded-md">
                            <h4 className="font-semibold text-amber-300 border-b border-stone-700 pb-2 mb-2">Magias Conhecidas (Nível 1)</h4>
                             <ul className="columns-2 text-sm text-stone-300 space-y-1 list-disc list-inside">
                                {finalSpells.sort().map(spell => <li key={spell}>{spell}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-6">
                <button
                    type="button"
                    onClick={prevStep}
                    className="menu-button btn-import max-w-xs"
                >
                    <Icons.Play className="h-6 w-6 mr-3 transform rotate-90 scale-y-150" />
                    Voltar
                </button>
                <button
                    type="button"
                    onClick={handleFinalize}
                    disabled={!isComplete}
                    className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isComplete ? 'Iniciar Aventura' : 'Preencha os campos'}
                    <Icons.Play className="h-6 w-6 ml-3 transform -rotate-90 scale-y-150" />
                </button>
            </div>
        </div>
    );
};

export default NewStep8_Finalize;
