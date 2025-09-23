// src/components/NewCreationCharacter/NewStep2_Attributes.tsx
// Esta é a segunda etapa do "wizard", focada na distribuição de pontos de atributo.
// Ela consome a lógica do hook useCharacterCreation para exibir e modificar os atributos.
import React from 'react';
import type { Attributes } from '@/types';
import { translateAttribute } from '@/utils/translator';
import { getCostOfNextLevel } from '@/utils/creationHelpers';
import { Icons } from '../Icons';

interface Props {
    baseAttributes: Attributes;
    points: number;
    racialBonuses: Partial<Attributes>;
    finalAttributes: Attributes;
    handleAttributeChange: (attr: keyof Attributes, delta: 1 | -1) => void;
    handleSuggestAttributes: () => void;
    characterClass: string;
    prevStep: () => void;
    nextStep: () => void;
}

const attributeOrder: (keyof Attributes)[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

const NewStep2_Attributes: React.FC<Props> = ({
    baseAttributes,
    points,
    racialBonuses,
    finalAttributes,
    handleAttributeChange,
    handleSuggestAttributes,
    characterClass,
    prevStep,
    nextStep,
}) => {
    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="flex justify-between items-center flex-wrap gap-4 bg-stone-900/50 p-4 rounded-lg border border-stone-700">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-stone-300">Distribua seus Pontos de Atributo</h3>
                    <button
                        type="button"
                        onClick={handleSuggestAttributes}
                        disabled={!characterClass}
                        title={!characterClass ? "Selecione uma classe primeiro" : "Sugerir atributos para a classe selecionada"}
                        className="flex items-center gap-1.5 text-xs bg-amber-600/20 hover:bg-amber-600/40 text-amber-200 font-semibold py-1 px-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Icons.Sparkles className="h-4 w-4" />
                        Sugerir
                    </button>
                </div>
                <div className="text-right">
                    <p className="font-bold text-amber-400 text-2xl">{points}</p>
                    <p className="text-sm text-stone-400">Pontos Restantes</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {attributeOrder.map(attr => {
                    const bonus = racialBonuses[attr] || 0;
                    const total = finalAttributes[attr];
                    const modifier = Math.floor((total - 10) / 2);
                    const modifierString = modifier >= 0 ? `+${modifier}` : modifier.toString();

                    return (
                        <div key={attr} className="bg-stone-800/60 p-4 rounded-lg border border-stone-700 text-center flex flex-col justify-between">
                            <label className="font-bold text-lg text-stone-200 font-garamond">{translateAttribute(attr)}</label>
                            <div className="flex items-center justify-center gap-3 my-3">
                                <button
                                    type="button"
                                    onClick={() => handleAttributeChange(attr, -1)}
                                    disabled={baseAttributes[attr] <= 8}
                                    className="p-2 rounded-full bg-stone-700 hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Icons.Minus className="h-5 w-5" />
                                </button>
                                <div className="flex-grow">
                                    <p className="text-4xl font-bold text-amber-300">
                                        {total}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleAttributeChange(attr, 1)}
                                    disabled={baseAttributes[attr] >= 15 || points < getCostOfNextLevel(baseAttributes[attr])}
                                    className="p-2 rounded-full bg-stone-700 hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Icons.Plus className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="text-xs text-stone-400">
                                {baseAttributes[attr]} Base {bonus > 0 ? `+ ${bonus} Bônus` : ''}
                            </div>
                             <div className="mt-2 text-amber-400/80 font-bold text-lg border-t border-stone-700/50 pt-2">
                                Modificador: {modifierString}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-between pt-8">
                 <button
                    type="button"
                    onClick={prevStep}
                    className="menu-button btn-import max-w-xs"
                >
                    <Icons.Play className="h-6 w-6 mr-3 transform rotate-90 scale-y-150"/>
                    Voltar
                </button>
                <button
                    type="button"
                    onClick={nextStep}
                    disabled={points > 0}
                    className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {points > 0 ? `${points} pontos restantes` : 'Avançar'}
                    <Icons.Play className="h-6 w-6 ml-3 transform -rotate-90 scale-y-150"/>
                </button>
            </div>
        </div>
    );
};

export default NewStep2_Attributes;
