// components/CharacterSheet.tsx
import React, { useState } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import { translateAttribute, translateApiString, translateCondition } from '../utils/translator';
import type { Attributes, Proficiency, ApiListItem } from '../types';
import * as characterUtils from '../utils/characterUtils';
import { AlertTriangle, ChevronDown, Coffee, BedDouble } from 'lucide-react';
import DeathSavesTracker from './CharacterSheet/DeathSavesTracker';
import SkillItem from './CharacterSheet/SkillItem';

const CollapsibleSection: React.FC<{ title: string, children: React.ReactNode, defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
    const [isExpanded, setIsExpanded] = useState(defaultOpen);
    return (
        <div className="border-t border-stone-700 pt-3 mt-4">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex justify-between items-center text-left"
                aria-expanded={isExpanded}
            >
                <h3 className="text-lg font-bold font-garamond text-amber-300 text-shadow-amber">{title}</h3>
                <ChevronDown className={`h-5 w-5 text-stone-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            <div className={`transition-all ease-in-out duration-300 overflow-hidden ${isExpanded ? 'max-h-[1000px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                {children}
            </div>
        </div>
    );
};

const CharacterSheet: React.FC<{ onModalAction?: () => void }> = ({ onModalAction }) => {
    const { character, processPlayerAction, isLoading, combatState } = useGameStateContext();

    if (!character) return null;

    const { attributes, modifiers, proficiencies, languages, conditions, hitDice, traits } = character;
    
    const coreAttributeKeys = (Object.keys(attributes) as Array<keyof Attributes>).filter(
        key => typeof attributes[key] === 'number' && key !== 'id' && key !== 'characterId' && key !== 'hp' && key !== 'ac'
    );
    
    return (
        <div className="p-4 space-y-4">
            <div className="text-center mb-4">
                <h2 className="text-2xl font-bold font-garamond text-stone-100">{character.name}</h2>
                <p className="text-sm text-stone-400">{translateApiString(character.race)} {translateApiString(character.characterClass)} de Nível {character.level}</p>
            </div>
            
            <DeathSavesTracker />

            {conditions && conditions.length > 0 && (
                <div>
                    <h3 className="text-lg font-bold font-garamond text-amber-300 mb-2 text-shadow-amber">Condições Ativas</h3>
                    <div className="flex flex-wrap gap-2">
                        {conditions.map(condition => (
                            <div key={condition.index} className="relative group">
                                <span className="flex items-center gap-1 bg-red-900/70 text-red-300 text-xs font-semibold px-2 py-1 rounded-full border border-red-700/80">
                                    <AlertTriangle className="h-3 w-3" />
                                    {translateCondition(condition.name)}
                                </span>
                                {condition.desc && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-stone-900 text-stone-300 text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg border border-stone-600">
                                    <h4 className="font-bold text-red-400 mb-1">{translateCondition(condition.name)}</h4>
                                    {condition.desc.map((d: string, i: number) => <p key={i} className="mb-1 last:mb-0">{d}</p>)}
                                </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {coreAttributeKeys.map((key) => {
                    const value = attributes[key as keyof typeof attributes];
                    return (
                        <div key={key} className="bg-stone-800/50 p-3 rounded-lg text-center">
                            <div className="font-bold text-lg text-amber-300">{translateAttribute(key)}</div>
                            <div className="text-3xl font-bold text-stone-100 my-1">{String(value)}</div>
                            <div className="text-md text-amber-400 bg-stone-900/50 rounded-full w-10 h-10 flex items-center justify-center mx-auto">{modifiers[key as keyof Attributes] >= 0 ? `+${modifiers[key as keyof Attributes]}` : modifiers[key as keyof Attributes]}</div>
                        </div>
                    );
                })}
            </div>

            <CollapsibleSection title="Perícias">
                <div className="bg-stone-800/50 p-3 rounded-md space-y-1 divide-y divide-stone-700/50">
                    {characterUtils.ALL_SKILLS.map(skill => (
                        <SkillItem 
                            key={skill}
                            skillName={skill}
                            onUse={onModalAction}
                        />
                    ))}
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Ações de Descanso">
                 <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => processPlayerAction("Tentar fazer um descanso curto.")}
                        disabled={isLoading || (combatState && combatState.isActive)}
                        className="text-center w-full bg-stone-700/80 hover:bg-stone-600 border border-stone-600 text-stone-300 font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Coffee className="h-4 w-4" />
                        Descanso Curto
                    </button>
                    <button
                        onClick={() => processPlayerAction("Tentar fazer um descanso longo.")}
                        disabled={isLoading || (combatState && combatState.isActive)}
                        className="text-center w-full bg-stone-700/80 hover:bg-stone-600 border border-stone-600 text-stone-300 font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <BedDouble className="h-4 w-4" />
                        Descanso Longo
                    </button>
                </div>
                 <div className="bg-stone-800/50 p-2 rounded-md text-center mt-2">
                    <span className="text-xs font-bold text-stone-400">Dados de Vida</span>
                    <p className="font-bold text-lg text-stone-200">{(hitDice || { current: 0 }).current} / {(hitDice || { total: 0 }).total} <span className="text-sm text-stone-400">d{character.hitDie || 0}</span></p>
                </div>
            </CollapsibleSection>
            
            <CollapsibleSection title="Características e Proficiências">
                 <div className="space-y-3 bg-stone-800/50 p-3 rounded-md text-sm">
                    {proficiencies.filter(p => p?.name && !p.name.toLowerCase().includes('skill:') && !p.name.toLowerCase().includes('saving throw:')).length > 0 && (
                        <div>
                            <h4 className="font-semibold text-stone-300">Proficiências</h4>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {proficiencies.filter(p => p?.name && !p.name.toLowerCase().includes('skill:') && !p.name.toLowerCase().includes('saving throw:')).map(prof => (
                                    <span key={prof.index || prof.name} className="bg-stone-700 text-stone-300 text-xs font-semibold px-2 py-1 rounded-full">
                                        {translateApiString(prof.name)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {traits && traits.length > 0 && (
                        <div>
                             <h4 className="font-semibold text-stone-300 mt-2">Traços Raciais</h4>
                            <ul className="list-disc list-inside text-stone-300 space-y-1 text-sm mt-1">
                                {traits.map((trait: ApiListItem) => (
                                    <li key={trait.index}>{translateApiString(trait.name)}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {languages && languages.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-stone-300 mt-2">Idiomas</h4>
                            <p className="text-sm text-stone-300">{languages.map(translateApiString).join(', ')}</p>
                        </div>
                    )}
                 </div>
            </CollapsibleSection>
            
            <CollapsibleSection title="Personalidade">
                <div className="space-y-2 bg-stone-800/50 p-3 rounded-md text-sm text-stone-400">
                    {character.personalityTraits && character.personalityTraits.length > 0 && (
                        <p><strong className="text-stone-300">Traços:</strong> {character.personalityTraits.join(' ')}</p>
                    )}
                    <p><strong className="text-stone-300">Ideal:</strong> {character.ideal}</p>
                    <p><strong className="text-stone-300">Vínculo:</strong> {character.bond}</p>
                    <p><strong className="text-stone-300">Defeito:</strong> {character.flaw}</p>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="História">
                <p className="text-sm text-stone-400 whitespace-pre-wrap bg-stone-800/50 p-3 rounded-md border border-stone-700">{character.backstory}</p>
            </CollapsibleSection>

            {character.storySoFar && (
                <CollapsibleSection title="Crônicas da Aventura">
                    <p className="text-sm text-stone-400 whitespace-pre-wrap bg-stone-800/50 p-3 rounded-md border border-stone-700">{character.storySoFar}</p>
                </CollapsibleSection>
            )}
        </div>
    );
};

export default CharacterSheet;
