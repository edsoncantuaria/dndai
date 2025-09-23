'use client';
import React from 'react';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';
import { Icons } from '../Icons';
import NewFeatCard from './NewFeatCard';

interface Props {
    hook: ReturnType<typeof useNewCharacterCreation>;
    prevStep: () => void;
    nextStep: () => void;
}

const NewStep7_Feats: React.FC<Props> = ({ hook, prevStep, nextStep }) => {
    const { 
        allFeats, 
        racialFeats, 
        chosenFeats, 
        handleFeatChange, 
        finalAttributes,
        isFeatsLoading,
        race,
    } = hook;

    // A regra do Humano Variante concede 1 talento no nível 1.
    const isVariantHuman = race === 'human'; // Simplificado. Idealmente, haveria uma sub-raça ou checkbox.
    const generalFeatSlots = isVariantHuman ? 1 : 0;
    
    const chosenGeneralFeatsCount = chosenFeats.filter(featIndex => 
        !racialFeats.some(rf => rf.index === featIndex)
    ).length;

    const canProceed = chosenGeneralFeatsCount >= generalFeatSlots;

    if (isFeatsLoading) {
        return <div className="text-center text-stone-400"><Icons.Spinner className="mx-auto h-8 w-8" />Carregando Talentos...</div>;
    }

    if (allFeats.length === 0 && racialFeats.length === 0) {
        return (
            <div className="space-y-8 animate-fadeIn">
                <div className="text-center text-stone-400 italic p-8 bg-stone-900/50 rounded-lg">
                    <p>Nenhum talento disponível para sua raça ou para escolha neste nível.</p>
                </div>
                <div className="flex justify-end pt-8">
                    <button type="button" onClick={nextStep} className="menu-button btn-new max-w-xs">
                        Avançar
                        <Icons.Play className="h-6 w-6 ml-3 transform -rotate-90 scale-y-150" />
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="space-y-8 animate-fadeIn">
            <div>
                <h3 className="text-xl font-semibold text-stone-300 mb-2">Talentos (Feats)</h3>
                <p className="text-sm text-stone-400">Humanos (Variante) podem escolher um talento no nível 1. Outras raças podem conceder talentos específicos.</p>
            </div>

            {racialFeats.length > 0 && (
                <div className="space-y-4">
                    <h4 className="font-semibold text-amber-300 border-b border-stone-700 pb-2">Talentos Raciais Concedidos</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {racialFeats.map(feat => (
                            <NewFeatCard key={feat.index} feat={feat} isSelected={false} isGranted={true} isSelectable={false} onToggle={() => {}} />
                        ))}
                    </div>
                </div>
            )}
            
            {generalFeatSlots > 0 && (
                 <div className="space-y-4">
                    <h4 className="font-semibold text-amber-300 border-b border-stone-700 pb-2">Escolha de Talento Geral ({chosenGeneralFeatsCount}/{generalFeatSlots})</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {allFeats.map(feat => {
                            const isGranted = racialFeats.some(rf => rf.index === feat.index);
                            const canSelect = !isGranted && feat.prerequisites.every(pre => finalAttributes[pre.ability_score.index as keyof typeof finalAttributes] >= pre.minimum_score);
                            const isSelected = chosenFeats.includes(feat.index);

                            return (
                                <NewFeatCard 
                                    key={feat.index}
                                    feat={feat}
                                    isSelected={isSelected}
                                    isGranted={isGranted}
                                    isSelectable={canSelect && (isSelected || chosenGeneralFeatsCount < generalFeatSlots)}
                                    onToggle={() => handleFeatChange(feat.index)}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex justify-between pt-8">
                <button type="button" onClick={prevStep} className="menu-button btn-import max-w-xs">
                    <Icons.Play className="h-6 w-6 mr-3 transform rotate-90 scale-y-150" />
                    Voltar
                </button>
                <button
                    type="button"
                    onClick={nextStep}
                    disabled={!canProceed}
                    className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {canProceed ? 'Avançar' : 'Selecione um talento'}
                    <Icons.Play className="h-6 w-6 ml-3 transform -rotate-90 scale-y-150" />
                </button>
            </div>
        </div>
    );
};

export default NewStep7_Feats;
