import React from 'react';
import { useCharacterCreation } from '../../hooks/useCharacterCreation';
import { Attributes } from '../../types';
import { translateAttribute } from '../../utils/translator';
import { Icons } from '../Icons';
import { getCostOfNextLevel } from '../../utils/creationHelpers';

interface AttributeSelectionProps {
    hook: ReturnType<typeof useCharacterCreation>;
}

// Define a ordem padrão dos atributos de D&D.
const attributeOrder: (keyof Attributes)[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

const AttributeSelection: React.FC<AttributeSelectionProps> = ({ hook }) => {
    const { baseAttributes, points, racialBonuses, finalAttributes, handleAttributeChange, handleSuggestAttributes, characterClass } = hook;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-stone-700/50 p-3 rounded-md">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-stone-300 font-garamond text-shadow-amber">Atributos</h3>
                    <button
                        type="button"
                        onClick={handleSuggestAttributes}
                        disabled={!characterClass}
                        title={!characterClass ? "Selecione uma classe primeiro" : "Sugerir atributos para a classe selecionada"}
                        className="flex items-center gap-1 text-xs bg-stone-600 hover:bg-stone-500 text-amber-200 font-semibold py-1 px-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Icons.Sparkles className="h-4 w-4" />
                        Sugerir
                    </button>
                </div>
                <div className="text-right">
                    <p className="font-bold text-amber-400 text-2xl">{points}</p>
                    <p className="text-sm text-stone-400">Pontos Restantes</p>
                </div>
                <div className="relative group">
                    <Icons.InformationCircle className="text-stone-400" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-stone-900 text-stone-300 text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                        Custos: 8-13 custam 1 ponto. 14-15 custam 2 pontos.
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                {/* Itera sobre a lista ordenada para garantir a consistência da UI. */}
                {attributeOrder.map(attr => {
                    const bonus = racialBonuses[attr] || 0;
                    const total = finalAttributes[attr];
                    const modifier = Math.floor((total - 10) / 2);
                    const modifierString = modifier >= 0 ? `+${modifier}` : modifier.toString();

                    return (
                        <div key={attr} className="bg-stone-700 p-3 rounded-md text-center">
                            <label className="font-bold text-stone-200">{translateAttribute(attr)}</label>
                            <div className="flex items-center justify-center gap-2 mt-1">
                                <button 
                                    type="button" 
                                    onClick={() => handleAttributeChange(attr, -1)} 
                                    disabled={baseAttributes[attr] <= 8} 
                                    className="p-1 rounded-full bg-stone-600 hover:bg-stone-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Icons.Minus/>
                                </button>
                                <div className="flex-grow">
                                    <p className="text-2xl font-bold text-amber-300">
                                        {total} <span className="text-lg text-stone-400">[{modifierString}]</span>
                                    </p>
                                    <p className="text-xs text-stone-400">
                                        {baseAttributes[attr]} Base {bonus > 0 ? `+ ${bonus} Bônus` : ''}
                                    </p>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => handleAttributeChange(attr, 1)} 
                                    disabled={baseAttributes[attr] >= 15 || points < getCostOfNextLevel(baseAttributes[attr])} 
                                    className="p-1 rounded-full bg-stone-600 hover:bg-stone-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Icons.Plus/>
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

export default AttributeSelection;
