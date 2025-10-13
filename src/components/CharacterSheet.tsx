
// components/CharacterSheet.tsx
import React, { useState } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import { translateAttribute, translateApiString, translateCondition } from '../utils/translator';
import { Attributes, Proficiency, ApiTrait } from '../types';
import * as characterUtils from '../utils/characterUtils';
import { AlertTriangle, ChevronDown, Coffee, BedDouble, Dice5, ShieldCheck, Heart, Zap, Footprints } from 'lucide-react';

const DeathSavesTracker: React.FC = () => {
    const { character } = useGameStateContext();
    if (!character || !character.hp || character.hp.current > 0) return null;

    const { successes, failures } = character.deathSaves || { successes: 0, failures: 0 };

    return (
        <div className="bg-red-900/40 p-3 rounded-lg border border-red-700/60 mt-4">
            <h3 className="text-lg font-bold font-garamond text-red-300 mb-2">Testes de Morte</h3>
            <div className="flex justify-around">
                <div className="text-center">
                    <span className="text-sm text-stone-300">Sucessos</span>
                    <div className="flex gap-2 mt-1">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className={`h-4 w-4 rounded-full border-2 ${i < successes ? 'bg-green-500 border-green-400' : 'bg-stone-700 border-stone-600'}`}></div>
                        ))}
                    </div>
                </div>
                <div className="text-center">
                    <span className="text-sm text-stone-300">Falhas</span>
                    <div className="flex gap-2 mt-1">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className={`h-4 w-4 rounded-full border-2 ${i < failures ? 'bg-red-600 border-red-500' : 'bg-stone-700 border-stone-600'}`}></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

const SkillItem: React.FC<{ skillName: string, onUse?: () => void }> = ({ skillName, onUse }) => {
    const { isLoading, character, setSkillCheckRequest, playerRollRequest } = useGameStateContext();
    
    if (!character) return null;
    
    const isProficient = (character.proficiencies || []).some(p => p?.name?.toLowerCase().includes(skillName.toLowerCase()));
    const attribute = characterUtils.SKILL_ATTRIBUTE_MAP[skillName as keyof typeof characterUtils.SKILL_ATTRIBUTE_MAP];
    const modifier = (character.modifiers ? character.modifiers[attribute] : 0) + (isProficient ? (character.proficiencyBonus || 0) : 0);

    const handleSkillUse = () => {
        if (onUse) onUse();
        setSkillCheckRequest({ skillName });
    }
    
    return (
        <div className="flex items-center justify-between text-sm py-1">
            <div className="flex items-center gap-2">
                 <div className={`w-3 h-3 rounded-full border-2 ${isProficient ? 'bg-amber-400 border-amber-300' : 'bg-stone-600 border-stone-500'}`} title={isProficient ? 'Proficiente' : 'Não Proficiente'}></div>
                <span className="text-stone-300">{translateApiString(`Skill: ${skillName}`)}</span>
                <span className="text-xs text-stone-500">({translateAttribute(attribute).substring(0, 3)})</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-amber-300">{modifier >= 0 ? `+${modifier}`: modifier}</span>
                <button onClick={handleSkillUse} disabled={isLoading || !!playerRollRequest} className="px-1 py-0.5 bg-stone-700/80 hover:bg-stone-600 border border-stone-600 rounded text-xs text-stone-300 disabled:opacity-50 flex items-center gap-1">
                    <Dice5 className="h-3 w-3"/> Usar
                </button>
            </div>
        </div>
    )
}

const CollapsibleSection: React.FC<{ title: string, children: React.ReactNode, defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
    const [isExpanded, setIsExpanded] = useState(defaultOpen);
    return (
        <div className="border-t border-stone-700 pt-3">
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

    const { attributes, modifiers, proficiencies, languages, conditions, currency, hitDice, traits, damage_resistances } = character;
    const equippedItems = (character.inventory || []).filter(i => i.equipped);
    const initiativeBonus = modifiers?.dexterity ?? 0;

    return (
        <div className="p-4 space-y-4">
            <div className="text-center mb-4">
                <h2 className="text-2xl font-bold font-garamond text-stone-100">{character.name}</h2>
                <p className="text-sm text-stone-400">{translateApiString(character.race)} {translateApiString(character.characterClass)} de Nível {character.level}</p>
            </div>

            {/* Combat Stats Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
                 <div className="bg-red-900/30 p-2 rounded-md border border-red-800">
                    <div className="text-xs font-bold text-red-200 flex items-center justify-center gap-1"><Heart className="h-3 w-3"/> VIDA</div>
                    <div className="font-bold text-xl text-stone-100">{character.hp.current} / {character.hp.max}</div>
                </div>
                 <div className="bg-blue-900/30 p-2 rounded-md border border-blue-800">
                    <div className="text-xs font-bold text-blue-200 flex items-center justify-center gap-1"><ShieldCheck className="h-3 w-3"/> CA</div>
                    <div className="font-bold text-xl text-stone-100">{character.ac.value}</div>
                </div>
                 <div className="bg-green-900/30 p-2 rounded-md border border-green-800">
                    <div className="text-xs font-bold text-green-200 flex items-center justify-center gap-1"><Zap className="h-3 w-3"/> INICIATIVA</div>
                    <div className="font-bold text-xl text-stone-100">{initiativeBonus >= 0 ? `+${initiativeBonus}`: initiativeBonus}</div>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-center">
                 <div className="bg-stone-800/50 p-2 rounded-md">
                    <div className="text-xs font-bold text-stone-400 flex items-center justify-center gap-1"><Footprints className="h-3 w-3" /> Deslocamento</div>
                    <p className="font-bold text-lg text-stone-200">{character.speed ?? 0}m</p>
                </div>
                <div className="bg-stone-800/50 p-2 rounded-md">
                    <div className="text-xs font-bold text-stone-400">Bônus de Prof.</div>
                    <p className="font-bold text-lg text-amber-300">+{character.proficiencyBonus}</p>
                </div>
            </div>

            <DeathSavesTracker />

            {/* Attributes & Skills */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {(Object.keys(attributes) as Array<keyof Attributes>).map(attr => (
                    <div key={attr} className="bg-stone-800/50 p-3 rounded-lg text-center">
                        <div className="font-bold text-lg text-amber-300">{translateAttribute(attr)}</div>
                        <div className="text-3xl font-bold text-stone-100 my-1">{attributes[attr]}</div>
                        <div className="text-md text-amber-400 bg-stone-900/50 rounded-full w-10 h-10 flex items-center justify-center mx-auto">{modifiers[attr] >= 0 ? `+${modifiers[attr]}` : modifiers[attr]}</div>
                    </div>
                ))}
            </div>

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
            
             <CollapsibleSection title="Características e Traços">
                 <div className="space-y-3 bg-stone-800/50 p-3 rounded-md">
                     {damage_resistances && damage_resistances.length > 0 && (
                        <div>
                             <h4 className="font-semibold text-stone-300">Resistências a Dano</h4>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {damage_resistances.map(res => (
                                    <span key={res} className="bg-stone-700 text-stone-300 text-xs font-semibold px-2 py-1 rounded-full">
                                        {translateApiString(res)}
                                    </span>
                                ))}
                            </div>
                        </div>
                     )}
                     {traits && traits.length > 0 && (
                        <div>
                             <h4 className="font-semibold text-stone-300">Traços Raciais</h4>
                            <ul className="list-disc list-inside text-stone-300 space-y-1 text-sm mt-1">
                                {traits.map(trait => <li key={trait.index}>{translateApiString(trait.name)}</li>)}
                            </ul>
                        </div>
                    )}
                    {languages && (
                        <div>
                            <h4 className="font-semibold text-stone-300">Idiomas</h4>
                            <p className="text-sm text-stone-300">{(languages || []).map(translateApiString).join(', ')}</p>
                        </div>
                    )}
                 </div>
            </CollapsibleSection>
            
            <CollapsibleSection title="Personalidade">
                <div className="space-y-1 bg-stone-800/50 p-3 rounded-md text-sm text-stone-400">
                    <p><strong className="text-stone-300">Traços:</strong> {(character.personalityTraits || []).join(' ')}</p>
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

    