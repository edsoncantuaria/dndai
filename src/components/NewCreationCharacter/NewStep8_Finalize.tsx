// src/components/NewCreationCharacter/NewStep8_Finalize.tsx
import React from 'react';
import { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import type { Attributes } from '@/types';
import { ArrowLeft, Play, Shield, Heart, Dices } from 'lucide-react';
import * as characterUtils from '@/utils/characterUtils';
import { normalizeProficiencyName } from '@/utils/translator';


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
        finalProficiencies,
        ac,
        hp,
        speed,
        hitDie,
    } = hook;

    // Fallback in case modifiers aren't calculated yet in the hook during the first render
    const modifiers = hook.modifiers || characterUtils.calculateModifiers(finalAttributes);
    const proficiencyBonus = hook.proficiencyBonus || 2;


    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="text-center">
                <h3 className="text-2xl font-semibold text-stone-200 mb-2 font-garamond">Ficha do Personagem</h3>
                <p className="text-sm text-stone-400">Revise seu herói e dê a ele um nome. Sua aventura está prestes a começar!</p>
            </div>
            
            <div className="bg-stone-900/50 p-4 sm:p-6 rounded-lg border-2 border-stone-700 space-y-6 shadow-lg">
                
                {/* === CABEÇALHO === */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b-2 border-stone-700 pb-6">
                    <div className="md:col-span-1">
                        <input
                            type="text"
                            id="character-name"
                            value={name}
                            onChange={(e) => setField('name', e.target.value)}
                            placeholder="Nome do Personagem"
                            className="w-full bg-transparent border-b-2 border-stone-600 focus:border-amber-500 pb-2 text-stone-100 text-3xl font-bold font-garamond focus:ring-0 transition-colors"
                        />
                    </div>
                    <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <div className="bg-stone-800/60 p-2 rounded-md">
                            <div className="text-xs text-stone-400">Classe & Nível</div>
                            <div className="font-semibold text-stone-200">{characterClass || 'N/A'}, Nv 1</div>
                        </div>
                         <div className="bg-stone-800/60 p-2 rounded-md">
                            <div className="text-xs text-stone-400">Antecedente</div>
                            <div className="font-semibold text-stone-200">{background || 'N/A'}</div>
                        </div>
                         <div className="bg-stone-800/60 p-2 rounded-md">
                            <div className="text-xs text-stone-400">Raça</div>
                            <div className="font-semibold text-stone-200">{race || 'N/A'} {subrace ? `(${subrace})` : ''}</div>
                        </div>
                         <div className="bg-stone-800/60 p-2 rounded-md">
                            <div className="text-xs text-stone-400">Alinhamento</div>
                            <div className="font-semibold text-stone-200">{alignment || 'N/A'}</div>
                        </div>
                    </div>
                </div>

                {/* === SEÇÃO PRINCIPAL === */}
                <div className="grid grid-cols-12 gap-6">
                    
                    {/* Coluna Esquerda: Atributos, Perícias */}
                    <div className="col-span-12 md:col-span-4 space-y-6">
                        {/* Atributos */}
                        <div className="space-y-2">
                             {attributeOrder.map(attr => {
                                const total = finalAttributes[attr];
                                const modifier = Math.floor((total - 10) / 2);
                                return (
                                    <div key={attr} className="bg-stone-800/60 p-2 rounded-lg border border-stone-700 text-center">
                                        <div className="font-bold text-sm text-stone-300">{attr.charAt(0).toUpperCase() + attr.slice(1)}</div>
                                        <div className="font-bold text-3xl text-amber-300">{modifier >= 0 ? `+${modifier}` : modifier}</div>
                                        <div className="text-xs text-stone-400 font-mono border border-stone-600 rounded-full w-8 h-8 flex items-center justify-center mx-auto -mt-1 bg-stone-900">{total}</div>
                                    </div>
                                )
                            })}
                        </div>
                        {/* Perícias */}
                         <div className="space-y-2">
                            <h4 className="font-semibold text-amber-200">Perícias</h4>
                            {characterUtils.ALL_SKILLS.map(skill => {
                                const prof = finalProficiencies.find(p => p.name.includes(skill));
                                const attr = characterUtils.SKILL_ATTRIBUTE_MAP[skill as keyof typeof characterUtils.SKILL_ATTRIBUTE_MAP];
                                const modifier = finalAttributes[attr] ? (modifiers[attr] || 0) + (prof ? proficiencyBonus : 0) : 0;
                                return (
                                    <div key={skill} className="flex items-center text-xs border-b border-stone-800 pb-1">
                                        <div className={`w-3 h-3 rounded-full border-2 mr-2 ${prof ? 'bg-amber-400 border-amber-300' : 'bg-stone-700 border-stone-600'}`}></div>
                                        <span className="font-mono">{modifier >= 0 ? `+${modifier}`: modifier}</span>
                                        <span className="ml-2 text-stone-300">{skill} <span className="text-stone-500">({attr.substring(0,3)})</span></span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Coluna Direita: Combate, Aparência, Personalidade */}
                    <div className="col-span-12 md:col-span-8 space-y-6">
                        
                        {/* Status de Combate */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
                            <div className="bg-stone-800/60 p-3 rounded-lg border border-stone-700">
                                <div className="text-xs text-stone-400 flex items-center justify-center gap-1"><Shield className="h-3 w-3"/> CA</div>
                                <div className="font-bold text-3xl text-stone-200">{ac.value}</div>
                            </div>
                            <div className="bg-stone-800/60 p-3 rounded-lg border border-stone-700">
                                <div className="text-xs text-stone-400">Iniciativa</div>
                                <div className="font-bold text-3xl text-stone-200">{modifiers.dexterity >= 0 ? `+${modifiers.dexterity}`: modifiers.dexterity}</div>
                            </div>
                            <div className="bg-stone-800/60 p-3 rounded-lg border border-stone-700">
                                <div className="text-xs text-stone-400">Velocidade</div>
                                <div className="font-bold text-3xl text-stone-200">{speed} pés</div>
                            </div>
                            <div className="bg-red-900/40 p-3 rounded-lg border border-red-700/60">
                                <div className="text-xs text-red-300 flex items-center justify-center gap-1"><Heart className="h-3 w-3"/> Pontos de Vida</div>
                                <div className="font-bold text-3xl text-red-200">{hp.max}</div>
                            </div>
                             <div className="bg-stone-800/60 p-3 rounded-lg border border-stone-700 col-span-2 lg:col-span-4">
                                <div className="text-xs text-stone-400 flex items-center justify-center gap-1"><Dices className="h-3 w-3"/> Dado de Vida</div>
                                <div className="font-bold text-xl text-stone-200">1d{hitDie}</div>
                            </div>
                        </div>

                         {/* Aparência */}
                        <div>
                             <h4 className="font-semibold text-amber-200 mb-2">Aparência</h4>
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
                                            {item.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* Personalidade */}
                        <div className="space-y-3">
                             <h4 className="font-semibold text-amber-200 mb-2">Personalidade</h4>
                             {hook.personalityTraits.length > 0 && <div><strong className="text-stone-400">Traços:</strong> <span className="text-stone-300 italic">"{hook.personalityTraits.join(' ')}"</span></div>}
                            <div><strong className="text-stone-400">Ideal:</strong> <span className="text-stone-300 italic">"{hook.ideal}"</span></div>
                            <div><strong className="text-stone-400">Vínculo:</strong> <span className="text-stone-300 italic">"{hook.bond}"</span></div>
                            <div><strong className="text-stone-400">Defeito:</strong> <span className="text-stone-300 italic">"{hook.flaw}"</span></div>
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
