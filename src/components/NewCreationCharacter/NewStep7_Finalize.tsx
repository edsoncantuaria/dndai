// src/components/NewCreationCharacter/NewStep7_Finalize.tsx
import React from 'react';
import { Icons } from '../Icons';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';
import { normalizeProficiencyName, translateApiString, translateAttribute } from '@/utils/translator';
import { Attributes } from '@/types';

interface Props {
    hook: ReturnType<typeof useNewCharacterCreation>;
    prevStep: () => void;
    handleFinalize: () => void;
}

const attributeOrder: (keyof Attributes)[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

const NewStep7_Finalize: React.FC<Props> = ({
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
        racialSpellOptions
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
        <div className="space-y-8 animate-fadeIn">
            <div className="text-center">
                <h3 className="text-2xl font-semibold text-stone-300 mb-2 font-garamond">O Toque Final</h3>
                <p className="text-sm text-stone-400 mb-6">Seu herói está quase pronto. Revise suas escolhas e dê a ele um nome digno de lendas.</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Coluna do Resumo */}
                <div className="bg-stone-900/50 p-4 rounded-lg border border-stone-700 space-y-4">
                    <h4 className="text-xl font-bold font-garamond text-amber-300 text-shadow-amber border-b border-stone-700 pb-2">Resumo do Personagem</h4>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><strong className="text-stone-400 block">Raça:</strong> <span className="text-stone-200">{translateApiString(race)} {subrace && `(${translateApiString(subrace)})`}</span></div>
                        <div><strong className="text-stone-400 block">Classe:</strong> <span className="text-stone-200">{translateApiString(characterClass)}</span></div>
                        <div><strong className="text-stone-400 block">Antecedente:</strong> <span className="text-stone-200">{translateApiString(background)}</span></div>
                        <div><strong className="text-stone-400 block">Alinhamento:</strong> <span className="text-stone-200">{alignment}</span></div>
                    </div>

                    <div>
                        <strong className="text-stone-400 block mb-2">Atributos Finais:</strong>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            {attributeOrder.map(attr => (
                                <div key={attr} className="bg-stone-800/60 p-2 rounded-md">
                                    <div className="text-xs font-bold text-stone-400">{translateAttribute(attr).substring(0,3).toUpperCase()}</div>
                                    <div className="font-bold text-lg text-stone-100">{finalAttributes[attr]}</div>
                                    <div className="text-sm text-amber-400">{Math.floor((finalAttributes[attr] - 10) / 2) >= 0 ? `+${Math.floor((finalAttributes[attr] - 10) / 2)}` : Math.floor((finalAttributes[attr] - 10) / 2)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {finalSkills.length > 0 && (
                        <div>
                            <strong className="text-stone-400 block mb-2">Perícias:</strong>
                            <p className="text-sm text-stone-300 columns-2">{finalSkills.sort().join(', ')}</p>
                        </div>
                    )}

                    {finalSpells.length > 0 && (
                         <div>
                            <strong className="text-stone-400 block mb-2">Magias Conhecidas (Nível 1):</strong>
                            <p className="text-sm text-stone-300 columns-2">{finalSpells.sort().join(', ')}</p>
                        </div>
                    )}
                </div>

                {/* Coluna do Nome e Ações */}
                <div className="space-y-8 flex flex-col items-center text-center">
                     <div className="w-full">
                        <label htmlFor="character-name" className="block text-stone-300 font-semibold mb-3">Nome do Personagem</label>
                        <input
                            type="text"
                            id="character-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Digite o nome aqui..."
                            className="w-full bg-stone-900/70 border-2 border-stone-600 rounded-lg p-4 text-stone-100 text-2xl text-center font-bold font-garamond focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                        />
                    </div>
                     <div className="flex justify-center gap-4 pt-4 w-full">
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
            </div>
        </div>
    );
};

export default NewStep7_Finalize;
