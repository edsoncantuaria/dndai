// src/components/NewCreationCharacter/NewStep3_Background.tsx
import React from 'react';
import type { ApiListItem } from '@/types';
import { translateApiString } from '@/utils/translator';
import { Icons } from '../Icons';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';

// Usamos as props do hook e os dados passados pelo orquestrador
interface Props {
    hook: ReturnType<typeof useNewCharacterCreation>;
    backgrounds: ApiListItem[];
    alignments: ApiListItem[];
    prevStep: () => void;
    nextStep: () => void;
}

const NewStep3_Background: React.FC<Props> = ({
    hook,
    backgrounds,
    alignments,
    prevStep,
    nextStep,
}) => {
    const {
        background,
        handleBackgroundChange,
        backgroundDetails,
        alignment,
        setAlignment,
        backstory,
        setBackstory,
        personalityTraits,
        handlePersonalityTraitChange,
        ideal,
        setIdeal,
        bond,
        setBond,
        flaw,
        setFlaw,
        handleRandomizeBackground,
    } = hook;

    const canProceed = background && alignment;
    const personalityTraitLimit = backgroundDetails?.personality_traits?.choose || 0;

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Seção de Antecedente */}
            <div className="flex justify-between items-center">
                 <h3 className="text-xl font-semibold text-stone-300">Escolha seu Antecedente e Personalidade</h3>
                <button
                    type="button"
                    onClick={() => handleRandomizeBackground(backgrounds)}
                    className="flex items-center gap-1.5 text-xs bg-amber-600/20 hover:bg-amber-600/40 text-amber-200 font-semibold py-1 px-2 rounded-md transition-colors"
                >
                    <Icons.Dice className="h-4 w-4" />
                    Aleatório
                </button>
            </div>
            <div>
                <label htmlFor="background" className="block text-stone-300 font-semibold mb-2">Antecedente</label>
                <p className="text-sm text-stone-400 mb-4">Seu passado moldou quem você é. De onde você veio?</p>
                <select
                    id="background"
                    value={background}
                    onChange={(e) => handleBackgroundChange(e.target.value)}
                    className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                    <option value="" disabled>Selecione um antecedente...</option>
                    {backgrounds.map(b => <option key={b.index} value={b.index}>{translateApiString(b.name)}</option>)}
                </select>
                {backgroundDetails && (
                    <div className="mt-4 p-4 bg-stone-900/50 border border-stone-700/50 rounded-lg">
                        <h4 className="font-bold text-amber-300">{backgroundDetails.feature.name}</h4>
                        <p className="text-sm text-stone-300 mt-1">{backgroundDetails.feature.desc.join(' ')}</p>
                    </div>
                )}
            </div>

            {/* Seção de Personalidade - só aparece se um antecedente for escolhido */}
            {backgroundDetails && (
                <div className="space-y-6 animate-fadeIn">
                    {backgroundDetails.personality_traits && (
                        <div>
                            <h4 className="font-semibold text-stone-300 mb-2">Traços de Personalidade <span className="text-stone-400 font-normal text-sm">({personalityTraits.length}/{personalityTraitLimit})</span></h4>
                            <div className="space-y-2">
                                {backgroundDetails.personality_traits.from.options.map((opt: any, i: number) => (
                                    <label key={i} className={`flex items-start p-3 rounded-md border text-sm transition-colors cursor-pointer ${personalityTraits.includes(opt.string) ? 'bg-amber-900/40 border-amber-600' : 'bg-stone-800/60 border-stone-700 hover:bg-stone-700/60'}`}>
                                        <input
                                            type="checkbox"
                                            checked={personalityTraits.includes(opt.string)}
                                            onChange={() => handlePersonalityTraitChange(opt.string)}
                                            disabled={!personalityTraits.includes(opt.string) && personalityTraits.length >= personalityTraitLimit}
                                            className="form-checkbox h-4 w-4 text-amber-500 bg-stone-700 border-stone-600 rounded focus:ring-amber-500 mt-0.5"
                                        />
                                        <span className="ml-3 text-stone-300">{opt.string}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Campos para Ideal, Vínculo e Defeito */}
                    {['ideals', 'bonds', 'flaws'].map(type => {
                        const options = backgroundDetails[type as keyof typeof backgroundDetails]?.from.options;
                        const stateValue = { ideals: ideal, bonds: bond, flaws: flaw }[type as 'ideals'|'bonds'|'flaws'];
                        const setState = { ideals: setIdeal, bonds: setBond, flaws: setFlaw }[type as 'ideals'|'bonds'|'flaws'];
                        const label = { ideals: "Ideal", bonds: "Vínculo", flaws: "Defeito" }[type as 'ideals'|'bonds'|'flaws'];
                        
                        if (!options) return null;

                        return (
                            <div key={type}>
                                <h4 className="font-semibold text-stone-300 mb-2">{label} <span className="text-stone-400 font-normal text-sm">(Escolha 1)</span></h4>
                                <div className="space-y-2">
                                    {options.map((opt: any, i: number) => (
                                        <label key={i} className={`flex items-start p-3 rounded-md border text-sm transition-colors cursor-pointer ${stateValue === (opt.string || opt.desc) ? 'bg-amber-900/40 border-amber-600' : 'bg-stone-800/60 border-stone-700 hover:bg-stone-700/60'}`}>
                                            <input
                                                type="radio"
                                                name={type}
                                                checked={stateValue === (opt.string || opt.desc)}
                                                onChange={() => setState(opt.string || opt.desc)}
                                                className="form-radio h-4 w-4 text-amber-500 bg-stone-700 border-stone-600 focus:ring-amber-500 mt-0.5"
                                            />
                                            <span className="ml-3 text-stone-300">{opt.string || opt.desc}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Seção de Alinhamento */}
            <div>
                <h3 className="text-xl font-semibold text-stone-300 mb-2">Alinhamento</h3>
                <p className="text-sm text-stone-400 mb-4">Como seu personagem vê o mundo e age nele?</p>
                 <select
                    id="alignment"
                    value={alignment}
                    onChange={e => setAlignment(e.target.value)}
                    required
                    className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                    <option value="">Selecione um alinhamento...</option>
                    {alignments.map(a => <option key={a.index} value={a.name}>{translateApiString(a.name)}</option>)}
                </select>
            </div>
            
            {/* Seção de História de Fundo */}
            <div>
                 <h3 className="text-xl font-semibold text-stone-300 mb-2">História (Opcional)</h3>
                 <p className="text-sm text-stone-400 mb-4">Quem é você, além de seus feitos? Conte-nos um pouco sobre seu passado.</p>
                 <textarea
                    id="backstory"
                    value={backstory}
                    onChange={e => setBackstory(e.target.value)}
                    rows={5}
                    className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="Escreva sobre suas origens, motivações, medos ou o que o trouxe até o caminho da aventura..."
                />
            </div>


            {/* Navegação */}
            <div className="flex justify-between pt-8">
                <button type="button" onClick={prevStep} className="menu-button btn-import max-w-xs">
                    <Icons.Play className="h-6 w-6 mr-3 transform rotate-90 scale-y-150" />
                    Voltar
                </button>
                <button type="button" onClick={nextStep} disabled={!canProceed} className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed">
                    Avançar
                    <Icons.Play className="h-6 w-6 ml-3 transform -rotate-90 scale-y-150" />
                </button>
            </div>
        </div>
    );
};

export default NewStep3_Background;

    