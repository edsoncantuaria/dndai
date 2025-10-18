// src/components/NewCreationCharacter/NewStep8_Finalize.tsx
import React from 'react';
import { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { normalizeProficiencyName, translateApiString, translateAttribute } from '@/utils/translator';
import type { Attributes } from '@/types';
import { ArrowLeft, Play } from 'lucide-react';

interface Props {
    hook: ReturnType<typeof useCharacterCreator>;
    prevStep: () => void;
    handleFinalize: () => void;
}

const attributeOrder: (keyof Attributes)[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

const NewStep8_Finalize: React.FC<Props> = ({ hook, prevStep, handleFinalize }) => {
    const {
        name, setField, sex, hairStyle, beardStyle, skinColor,
        isComplete, race, subrace, characterClass, background, alignment,
        finalAttributes,
    } = hook;

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="text-center">
                <h3 className="text-2xl font-semibold text-stone-200 mb-2 font-garamond">O Toque Final</h3>
                <p className="text-sm text-stone-400">Revise as escolhas do seu herói e dê a ele um nome e uma aparência dignos de lendas.</p>
            </div>
            
            <div className="bg-stone-900/50 p-4 sm:p-6 rounded-lg border-2 border-stone-700 space-y-6 shadow-lg">
                
                <div className="w-full mb-6">
                    <label htmlFor="character-name" className="sr-only">Nome do Personagem</label>
                    <input
                        type="text"
                        id="character-name"
                        value={name}
                        onChange={(e) => setField('name', e.target.value)}
                        placeholder="Nome do Personagem..."
                        className="w-full bg-transparent border-b-2 border-stone-600 focus:border-amber-500 pb-2 text-stone-100 text-3xl text-center font-bold font-garamond focus:ring-0 transition-colors"
                    />
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Sexo', value: sex, setter: (v: any) => setField('sex', v), options: ['Masculino', 'Feminino', 'Outro'] },
                        { label: 'Cabelo', value: hairStyle, setter: (v: any) => setField('hairStyle', v), options: ['Careca', 'Curto', 'Médio', 'Longo'] },
                        { label: 'Barba', value: beardStyle, setter: (v: any) => setField('beardStyle', v), options: ['Sem Barba', 'Curta', 'Grande'] },
                        { label: 'Cor da Pele', value: skinColor, setter: (v: any) => setField('skinColor', v), options: ['Branca', 'Parda', 'Negra', 'Indígena', 'Amarela'] },
                    ].map(item => (
                        <div key={item.label}>
                            <label htmlFor={`${item.label}-select`} className="block text-xs font-medium text-stone-400 mb-1">{item.label}</label>
                            <select id={`${item.label}-select`} value={item.value} onChange={e => item.setter(e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200">
                                {item.options.map(opt => <option key={opt}>{opt}</option>)}
                            </select>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                     <div className="md:col-span-1 space-y-2">
                        {/* Summary Items */}
                     </div>
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

            </div>

            <div className="flex justify-between items-center pt-6">
                <button type="button" onClick={prevStep} className="menu-button btn-import max-w-xs">
                    <ArrowLeft className="h-6 w-6 mr-3" />
                    Voltar
                </button>
                <button
                    type="button"
                    onClick={handleFinalize}
                    disabled={!isComplete}
                    className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isComplete ? 'Iniciar Aventura' : 'Preencha os campos'}
                    <Play className="h-6 w-6 ml-3" />
                </button>
            </div>
        </div>
    );
};

export default NewStep8_Finalize;
