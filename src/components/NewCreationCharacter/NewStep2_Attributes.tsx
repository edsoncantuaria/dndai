// src/components/NewCreationCharacter/NewStep2_Attributes.tsx
import React from 'react';
import type { Attributes } from '@/types';
import { translateAttribute } from '@/utils/translator';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';
import { Minus, Plus, ArrowLeft, ArrowRight, RefreshCw, Star, PlusSquare } from 'lucide-react';
import { getCostForScore } from '@/utils/creationHelpers';

interface Props {
    hook: ReturnType<typeof useNewCharacterCreation>;
    prevStep: () => void;
    nextStep: () => void;
}

const attributeOrder: (keyof Attributes)[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

const PointBuySection: React.FC<Pick<Props, 'hook'>> = ({ hook }) => {
    const { baseAttributes, points, handleAttributeChange, handleSuggestAttributes } = hook;

    return (
        <div className="space-y-4">
             <div className="flex justify-between items-center flex-wrap gap-4 bg-stone-900/50 p-4 rounded-lg border border-stone-700">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-stone-300">Compra de Pontos</h3>
                    <button
                        type="button"
                        onClick={handleSuggestAttributes}
                        disabled={!hook.characterClass}
                        title={!hook.characterClass ? "Selecione uma classe primeiro" : "Sugerir atributos para a classe selecionada"}
                        className="flex items-center gap-1.5 text-xs bg-amber-600/20 hover:bg-amber-600/40 text-amber-200 font-semibold py-1 px-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Star className="h-4 w-4" />
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
                    const currentScore = baseAttributes[attr];
                    const costToIncrease = getCostForScore(currentScore + 1);

                    return (
                        <div key={attr} className="bg-stone-800/60 p-4 rounded-lg border border-stone-700 text-center flex flex-col justify-between">
                            <label className="font-bold text-lg text-stone-200 font-garamond">{translateAttribute(attr)}</label>
                            <div className="flex items-center justify-center gap-3 my-3">
                                <button type="button" onClick={() => handleAttributeChange(attr, -1)} disabled={currentScore <= 8} className="p-2 rounded-full bg-stone-700 hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                    <Minus className="h-5 w-5" />
                                </button>
                                <p className="text-4xl font-bold text-amber-300 w-16">{currentScore}</p>
                                <button type="button" onClick={() => handleAttributeChange(attr, 1)} disabled={currentScore >= 15 || points < costToIncrease} className="p-2 rounded-full bg-stone-700 hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                    <Plus className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="text-xs text-stone-400">
                                Custo para {currentScore + 1}: {costToIncrease > 2 ? 'N/A' : costToIncrease} ponto(s)
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const RollDiceSection: React.FC<Pick<Props, 'hook'>> = ({ hook }) => {
    const { baseAttributes, handleRollAttributes } = hook;
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-4 bg-stone-900/50 p-4 rounded-lg border border-stone-700">
                <h3 className="text-xl font-semibold text-stone-300">Rolagem de Dados (4d6, descarte o menor)</h3>
                <button type="button" onClick={handleRollAttributes} className="flex items-center gap-1.5 text-sm bg-amber-600/20 hover:bg-amber-600/40 text-amber-200 font-semibold py-2 px-4 rounded-md transition-colors">
                    <RefreshCw className="h-4 w-4" />
                    Rolar Novamente
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {attributeOrder.map(attr => (
                     <div key={attr} className="bg-stone-800/60 p-4 rounded-lg border border-stone-700 text-center">
                        <label className="font-bold text-lg text-stone-200 font-garamond">{translateAttribute(attr)}</label>
                        <p className="text-5xl font-bold text-amber-300 my-2">{baseAttributes[attr]}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const NewStep2_Attributes: React.FC<Props> = ({ hook, prevStep, nextStep }) => {
    const { 
        attributeMethod, 
        setField,
        racialBonuses, 
        finalAttributes, 
        points, 
        isVariantHuman, 
        variantHumanBonusSelections,
        handleVariantHumanBonusSelection,
    } = hook;
    const canProceed = (attributeMethod === 'roll' || (attributeMethod === 'point-buy' && points === 0)) && (!isVariantHuman || variantHumanBonusSelections.length === 2);

    return (
        <div className="space-y-8 animate-fadeIn">
             {!attributeMethod ? (
                <div className="text-center space-y-4">
                    <h3 className="text-xl font-semibold text-stone-300">Como você quer determinar seus atributos?</h3>
                    <div className="flex justify-center gap-4">
                        <button onClick={() => setField('attributeMethod', 'point-buy')} className="menu-button btn-new">Compra de Pontos</button>
                        <button onClick={() => setField('attributeMethod', 'roll')} className="menu-button btn-import">Rolar Dados</button>
                    </div>
                </div>
            ) : (
                <>
                    {attributeMethod === 'point-buy' && <PointBuySection hook={hook} />}
                    {attributeMethod === 'roll' && <RollDiceSection hook={hook} />}
                </>
            )}

            {isVariantHuman && attributeMethod && (
                <div className="bg-stone-900/50 p-4 rounded-lg border border-stone-700 mt-8">
                    <h4 className="text-lg font-semibold text-stone-300 mb-2">Bônus de Humano Variante</h4>
                    <p className="text-sm text-stone-400 mb-4">Escolha dois atributos diferentes para aumentar em +1. ({variantHumanBonusSelections.length}/2)</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                        {attributeOrder.map(attr => {
                            const isSelected = variantHumanBonusSelections.includes(attr);
                            const isDisabled = !isSelected && variantHumanBonusSelections.length >= 2;
                            return (
                                <button
                                    key={attr}
                                    onClick={() => hook.setField('variantHumanBonusSelections', (prev: any) => {
                                        if (isSelected) return prev.filter((a: any) => a !== attr);
                                        if (prev.length < 2) return [...prev, attr];
                                        return prev;
                                    })}
                                    disabled={isDisabled}
                                    className={`p-2 rounded-md border-2 transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed ${isSelected ? 'bg-amber-800/70 border-amber-500' : 'bg-stone-800/50 border-stone-700 hover:border-amber-600'}`}
                                >
                                    <PlusSquare className="mx-auto h-5 w-5 mb-1" />
                                    <span className="font-bold text-sm">{translateAttribute(attr).substring(0,3).toUpperCase()}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {attributeMethod && (
                <div className="bg-stone-900/50 p-4 rounded-lg border border-stone-700 mt-8">
                     <h4 className="text-lg font-semibold text-stone-300 mb-4 text-center">Atributos Finais (com Bônus Racial)</h4>
                     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
                        {attributeOrder.map(attr => {
                            const bonus = racialBonuses[attr] || 0;
                            const total = finalAttributes[attr];
                            const modifier = Math.floor((total - 10) / 2);
                            const modifierString = modifier >= 0 ? `+${modifier}` : modifier.toString();

                            return (
                                <div key={attr}>
                                    <label className="text-sm font-bold text-stone-400">{translateAttribute(attr).substring(0,3).toUpperCase()}</label>
                                    <p className="font-bold text-3xl text-stone-100">{total}</p>
                                    <p className="text-xs text-amber-400">{`(${hook.baseAttributes[attr]} ${bonus > 0 ? `+ ${bonus}`: ''})`}</p>
                                    <p className="text-lg font-bold text-amber-300 mt-1">{modifierString}</p>
                                </div>
                            )
                        })}
                     </div>
                </div>
            )}

            <div className="flex justify-between pt-8">
                 <button type="button" onClick={prevStep} className="menu-button btn-import max-w-xs">
                    <ArrowLeft className="h-6 w-6 mr-3"/>
                    Voltar
                </button>
                <button type="button" onClick={nextStep} disabled={!canProceed} className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed">
                    {canProceed ? 'Avançar' : 'Faça suas escolhas'}
                    <ArrowRight className="h-6 w-6 ml-3"/>
                </button>
            </div>
        </div>
    );
};

export default NewStep2_Attributes;
