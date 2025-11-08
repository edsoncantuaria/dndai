// components/CharacterSheet.tsx
import React, { useState } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import type { Attributes, Proficiency, ApiListItem } from '../types';
import * as characterUtils from '../utils/characterUtils';
import { AlertTriangle, ChevronDown, Coffee, BedDouble, MapPin, Cloud, Clock } from 'lucide-react';
import DeathSavesTracker from './CharacterSheet/DeathSavesTracker';
import SkillItem from './CharacterSheet/SkillItem';

const GLASS_CARD = 'rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]';

const CollapsibleSection: React.FC<{ title: string, children: React.ReactNode, defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
    const [isExpanded, setIsExpanded] = useState(defaultOpen);
    return (
        <div className="pt-4">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between text-left py-2"
                aria-expanded={isExpanded}
            >
                <span className="text-xs font-semibold uppercase tracking-[0.4em] text-stone-300">{title}</span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-amber-200">
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </span>
            </button>
            <div className={`transition-all ease-in-out duration-300 overflow-hidden ${isExpanded ? 'max-h-[1200px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-stone-200 shadow-inner shadow-black/40">
                    {children}
                </div>
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
        <div className="space-y-6 text-sm text-stone-200">
            <div className={`${GLASS_CARD} p-5 space-y-3 text-center`}>
                <p className="text-[11px] uppercase tracking-[0.35em] text-amber-200">Ficha do Herói</p>
                <h2 className="text-3xl font-serif text-white leading-tight">{character.name}</h2>
                <p className="text-sm text-stone-300">{character.race} {character.characterClass} • Nível {character.level}</p>
                <div className="grid grid-cols-3 gap-3 text-xs mt-4">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-3 flex flex-col items-center gap-1">
                        <MapPin className="h-4 w-4 text-amber-200" />
                        <span className="uppercase tracking-wider text-stone-400">Região</span>
                        <span className="font-semibold text-white">{character.worldState?.currentRegion || character.currentRegion || 'Desconhecida'}</span>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-3 flex flex-col items-center gap-1">
                        <Clock className="h-4 w-4 text-amber-200" />
                        <span className="uppercase tracking-wider text-stone-400">Momento</span>
                        <span className="font-semibold text-white">{character.worldState?.timeOfDay || 'Indefinido'}</span>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-3 flex flex-col items-center gap-1">
                        <Cloud className="h-4 w-4 text-amber-200" />
                        <span className="uppercase tracking-wider text-stone-400">Clima</span>
                        <span className="font-semibold text-white">{character.worldState?.weather || 'Desconhecido'}</span>
                    </div>
                </div>
            </div>
            
            <DeathSavesTracker />

            {conditions && conditions.length > 0 && (
                <div className={`${GLASS_CARD} p-5`}>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-200 mb-3">Condições Ativas</h3>
                    <div className="flex flex-wrap gap-2 text-xs">
                        {conditions.map(condition => (
                            <div key={condition.index} className="relative group">
                                <span className="flex items-center gap-1 bg-red-500/20 text-red-200 font-semibold px-2 py-1 rounded-full border border-red-500/40">
                                    <AlertTriangle className="h-3 w-3" />
                                    {condition.name}
                                </span>
                                {condition.desc && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-black/90 text-stone-200 text-xs rounded-xl py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg border border-white/10">
                                    <h4 className="font-bold text-red-300 mb-1">{condition.name}</h4>
                                    {condition.desc.map((d: string, i: number) => <p key={i} className="mb-1 last:mb-0">{d}</p>)}
                                </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className={`${GLASS_CARD} p-5`}>
                <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-stone-400 mb-4">Atributos Fundamentais</h3>
                <div className="grid grid-cols-3 gap-4">
                {coreAttributeKeys.map((key) => {
                    const value = attributes[key as keyof typeof attributes];
                    return (
                        <div key={key} className="rounded-3xl border border-white/10 bg-black/40 p-4 text-center shadow-inner shadow-black/40">
                            <div className="font-semibold text-[10px] uppercase tracking-[0.45em] text-stone-500">{key.substring(0,3)}</div>
                            <div className="text-3xl font-serif font-bold text-white my-1">{String(value)}</div>
                            <div className="text-sm text-amber-300 bg-white/10 rounded-full w-10 h-10 flex items-center justify-center mx-auto">
                                {modifiers[key as keyof Attributes] >= 0 ? `+${modifiers[key as keyof Attributes]}` : modifiers[key as keyof Attributes]}
                            </div>
                        </div>
                    );
                })}
            </div>
            </div>

            <CollapsibleSection title="Perícias">
                <div className="space-y-1 divide-y divide-white/5">
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
                 <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => processPlayerAction("Tentar fazer um descanso curto.")}
                        disabled={isLoading || (combatState && combatState.isActive)}
                        className="text-center w-full bg-gradient-to-br from-stone-800/80 to-stone-700/60 hover:from-stone-700 hover:to-stone-600 border border-white/10 text-stone-100 font-semibold py-2.5 px-4 rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Coffee className="h-4 w-4" />
                        Descanso Curto
                    </button>
                    <button
                        onClick={() => processPlayerAction("Tentar fazer um descanso longo.")}
                        disabled={isLoading || (combatState && combatState.isActive)}
                        className="text-center w-full bg-gradient-to-br from-stone-800/80 to-stone-700/60 hover:from-stone-700 hover:to-stone-600 border border-white/10 text-stone-100 font-semibold py-2.5 px-4 rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <BedDouble className="h-4 w-4" />
                        Descanso Longo
                    </button>
                </div>
                 <div className="bg-black/40 border border-white/10 p-3 rounded-2xl text-center mt-3">
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-[0.35em]">Dados de Vida</span>
                    <p className="font-bold text-lg text-stone-100 mt-1">{(hitDice || { current: 0 }).current} / {(hitDice || { total: 0 }).total} <span className="text-sm text-stone-400">d{character.hitDie || 0}</span></p>
                </div>
            </CollapsibleSection>
            
            <CollapsibleSection title="Características e Proficiências">
                 <div className="space-y-4 text-sm">
                    {proficiencies.filter(p => p?.name && !p.name.toLowerCase().includes('skill:') && !p.name.toLowerCase().includes('saving throw:')).length > 0 && (
                        <div>
                            <h4 className="font-semibold text-stone-100 uppercase tracking-wider text-xs mb-1">Proficiências</h4>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {proficiencies.filter(p => p?.name && !p.name.toLowerCase().includes('skill:') && !p.name.toLowerCase().includes('saving throw:')).map(prof => (
                                    <span key={prof.index || prof.name} className="bg-white/10 border border-white/10 text-stone-100 text-xs font-semibold px-3 py-1 rounded-full">
                                        {prof.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {traits && traits.length > 0 && (
                        <div>
                             <h4 className="font-semibold text-stone-100 uppercase tracking-wider text-xs mt-2">Traços Raciais</h4>
                            <ul className="list-disc list-inside text-stone-200 space-y-1 text-sm mt-1">
                                {traits.map((trait: ApiListItem) => (
                                    <li key={trait.index}>{trait.name}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {languages && languages.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-stone-100 uppercase tracking-wider text-xs mt-2">Idiomas</h4>
                            <p className="text-sm text-stone-200">{languages.join(', ')}</p>
                        </div>
                    )}
                 </div>
            </CollapsibleSection>
            
            <CollapsibleSection title="Personalidade">
                <div className="space-y-2 text-sm text-stone-200">
                    {character.personalityTraits && character.personalityTraits.length > 0 && (
                        <p><strong className="text-stone-100">Traços:</strong> {character.personalityTraits.join(' ')}</p>
                    )}
                    <p><strong className="text-stone-100">Ideal:</strong> {character.ideal}</p>
                    <p><strong className="text-stone-100">Vínculo:</strong> {character.bond}</p>
                    <p><strong className="text-stone-100">Defeito:</strong> {character.flaw}</p>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="História">
                <p className="text-sm text-stone-200 whitespace-pre-wrap bg-black/40 p-4 rounded-2xl border border-white/10">{character.backstory}</p>
            </CollapsibleSection>

            {character.storySoFar && (
                <CollapsibleSection title="Crônicas da Aventura">
                    <p className="text-sm text-stone-200 whitespace-pre-wrap bg-black/40 p-4 rounded-2xl border border-white/10">{character.storySoFar}</p>
                </CollapsibleSection>
            )}
        </div>
    );
};

export default CharacterSheet;
