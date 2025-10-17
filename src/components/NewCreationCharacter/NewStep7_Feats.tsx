// src/components/NewCreationCharacter/NewStep7_Feats.tsx
'use client';
import React, { useEffect } from 'react';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import type { Feat } from '@/types';

interface Props {
    hook: ReturnType<typeof useNewCharacterCreation>;
    prevStep: () => void;
    nextStep: () => void;
}

const NewStep7_Feats: React.FC<Props> = ({ hook, prevStep, nextStep }) => {
    const {
        isVariantHuman,
        details: { availableFeats },
        loadingStates,
        selectedFeat,
        setField,
        fetchFeats,
    } = hook;
    
    useEffect(() => {
        if (isVariantHuman) {
            fetchFeats();
        }
    }, [isVariantHuman, fetchFeats]);

    if (!isVariantHuman) {
        React.useEffect(() => {
            nextStep();
        }, [nextStep]);
        return null; // Render nothing, as the effect will navigate away
    }
    
    if (loadingStates.feats) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-stone-400">
                <Loader2 className="h-12 w-12 animate-spin" />
                <p className="mt-4">Carregando talentos...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            <div>
                <h3 className="text-xl font-semibold text-stone-300 mb-2">Escolha seu Talento</h3>
                <p className="text-sm text-stone-400 mb-6">Como Humano Variante, você ganha um talento no nível 1. Escolha um da lista abaixo.</p>
            </div>
            
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                {availableFeats.map((feat: Feat) => (
                    <div key={feat.index} className={`bg-stone-800 p-3 rounded-md border-2 transition-all duration-200 ${selectedFeat === feat.index ? 'border-amber-500' : 'border-stone-700'}`}>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="radio"
                                name="feat-selection"
                                checked={selectedFeat === feat.index}
                                onChange={() => setField('selectedFeat', feat.index)}
                                className="form-radio h-5 w-5 text-amber-500 bg-stone-900 border-stone-600 focus:ring-amber-500 mt-1"
                            />
                            <div>
                                <h4 className="font-semibold text-stone-100">{feat.name}</h4>
                                <p className="text-xs text-stone-400 mt-1">{feat.desc.join(' ')}</p>
                            </div>
                        </label>
                    </div>
                ))}
            </div>

            <div className="flex justify-between pt-8">
                <button type="button" onClick={prevStep} className="menu-button btn-import max-w-xs">
                    <ArrowLeft className="h-6 w-6 mr-3" />
                    Voltar
                </button>
                <button type="button" onClick={nextStep} disabled={!selectedFeat} className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed">
                    {selectedFeat ? 'Avançar' : 'Selecione um talento'}
                    <ArrowRight className="h-6 w-6 ml-3" />
                </button>
            </div>
        </div>
    );
};

export default NewStep7_Feats;
