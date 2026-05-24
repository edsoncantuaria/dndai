// src/components/NewCreationCharacter/NewStep7_Feats.tsx
'use client';
import React, { useEffect } from 'react';
import { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import type { Feat } from '@/types';
import PremiumLoader from '@/components/ui/PremiumLoader';

interface Props {
    hook: ReturnType<typeof useCharacterCreator>;
    prevStep: () => void;
    nextStep: () => void;
    hideNav?: boolean;
}

const NewStep7_Feats: React.FC<Props> = ({ hook, prevStep, nextStep, hideNav }) => {
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

    useEffect(() => {
        if (!isVariantHuman && !hideNav) {
            nextStep();
        }
    }, [isVariantHuman, nextStep, hideNav]);

    if (!isVariantHuman) {
        return null;
    }

    const isLoadingFeats = loadingStates.isLoading && availableFeats.length === 0;

    if (isLoadingFeats) {
        return (
            <PremiumLoader
                title="Consultando talentos disponíveis"
                subtitle="Buscando feitos lendários liberados para Humanos Variantes."
                description="Listando talentos e preparando descrições completas..."
                statusLabel={loadingStates.message || 'Carregando talentos'}
                progress={loadingStates.progress}
                showSkeletons={false}
            />
        );
    }

    return (
        <div className="space-y-10 animate-fadeIn">
            <section className="rounded-[32px] border border-white/5 bg-stone-950/70 p-6 shadow-2xl shadow-black/40">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-stone-900 text-amber-200">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-[0.5em] text-amber-400/80">Versatilidade Humana</p>
                        <h3 className="text-3xl font-semibold text-amber-50">Escolha seu talento inicial</h3>
                        <p className="text-sm text-stone-400">Como Humano Variante, você libera um talento no nível 1.</p>
                    </div>
                </div>

                <div className="mt-6 max-h-[55vh] space-y-4 overflow-y-auto pr-2">
                    {availableFeats.map((feat: Feat) => {
                        const isSelected = selectedFeat === feat.index;
                        return (
                            <label
                                key={feat.index}
                                className={`flex cursor-pointer items-start gap-4 rounded-3xl border px-4 py-3 transition ${
                                    isSelected
                                        ? 'border-amber-400/70 bg-amber-500/10 text-amber-100 shadow-lg shadow-amber-500/20'
                                        : 'border-white/5 bg-stone-950/50 text-stone-100 hover:border-amber-400/40'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="feat-selection"
                                    checked={isSelected}
                                    onChange={() => setField('selectedFeat', feat.index)}
                                    className="mt-1 h-5 w-5 rounded-full border-white/20 bg-stone-900 text-amber-400 focus:ring-amber-400"
                                />
                                <div>
                                    <h4 className="text-lg font-semibold">{feat.name}</h4>
                                    <p className="mt-1 text-sm text-stone-300">{feat.desc.join(' ')}</p>
                                </div>
                            </label>
                        );
                    })}
                </div>
            </section>

            {!hideNav ? (
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    onClick={prevStep}
                    className="flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-stone-100 transition hover:border-white/40 hover:bg-white/5"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para Magias
                </button>
                <button
                    type="button"
                    onClick={nextStep}
                    disabled={!selectedFeat}
                    className="flex items-center justify-center gap-3 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/80 to-rose-500/70 px-6 py-3 text-base font-semibold text-stone-950 shadow-lg shadow-amber-500/30 transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {selectedFeat ? 'Prosseguir para Finalização' : 'Selecione um talento'}
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
            ) : null}
        </div>
    );
};

export default NewStep7_Feats;
