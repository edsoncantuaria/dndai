// components/CharacterSheet.tsx
import React, { useState } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import { translateAttribute, translateApiString, translateCondition, translateEquipment } from '../utils/translator';
import { Attributes, Proficiency } from '../types';
import * as characterUtils from '../utils/characterUtils';
import { AlertTriangle, ChevronDown, Coffee, BedDouble, Dice5 } from 'lucide-react';
import SkillCheckModal from './ui/SkillCheckModal';

const DeathSavesTracker: React.FC = () => {
    const { character } = useGameStateContext();
    if (!character || character.hp.current > 0) return null;

    const { successes, failures } = character.deathSaves;

    return (
        <div className="bg-red-900/40 p-3 rounded-lg border border-red-700/60">
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

const SkillItem: React.FC<{ skillName: string, characterProfs: Proficiency[], modifiers: Attributes, profBonus: number }> = ({ skillName, characterProfs, modifiers, profBonus }) => {
    const { isLoading, character, setSkillCheckRequest, playerRollRequest } = useGameStateContext();
    
    if (!character) return null;
    
    const isProficient = character.proficiencies.some(p => p.name.toLowerCase().includes(skillName.toLowerCase()));
    const attribute = characterUtils.SKILL_ATTRIBUTE_MAP[skillName as keyof typeof characterUtils.SKILL_ATTRIBUTE_MAP];
    const modifier = modifiers[attribute] + (isProficient ? profBonus : 0);
    
    return (
        <div className="flex items-center justify-between text-sm py-1">
            <div className="flex items-center gap-2">
                 <div className={`w-3 h-3 rounded-full border-2 ${isProficient ? 'bg-amber-400 border-amber-300' : 'bg-stone-600 border-stone-500'}`} title={isProficient ? 'Proficiente' : 'Não Proficiente'}></div>
                <span className="text-stone-300">{translateApiString(`Skill: ${skillName}`)}</span>
                <span className="text-xs text-stone-500">({translateAttribute(attribute).substring(0, 3)})</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-amber-300">{modifier >= 0 ? `+${modifier}`: modifier}</span>
                <button onClick={() => setSkillCheckRequest({ skillName })} disabled={isLoading || !!playerRollRequest} className="px-1 py-0.5 bg-stone-700/80 hover:bg-stone-600 border border-stone-600 rounded text-xs text-stone-300 disabled:opacity-50 flex items-center gap-1">
                    <Dice5 className="h-3 w-3"/> Usar
                </button>
            </div>
        </div>
    )
}

const CollapsibleSection: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    return (
        <div>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex justify-between items-center"
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

const CharacterSheet: React.FC = () => {
    const { character, processPlayerAction, isLoading, combatState } = useGameStateContext();

    if (!character) return null;

    const { attributes, modifiers, proficiencies, languages, conditions, currency, hitDice } = character;
    const equippedItems = character.inventory.filter(i => i.equipped);
    const initiativeBonus = modifiers.dexterity;

    return (
        <div className="p-4 space-y-4">
            <DeathSavesTracker />
            
            <div>
                <h3 className="text-lg font-bold font-garamond text-amber-300 mb-2 text-shadow-amber">Informações Básicas</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm bg-stone-800/50 p-3 rounded-md">
                    <div className="text-stone-400">Raça: <span className="font-semibold text-stone-200">{character.race}{character.subrace && ` (${character.subrace})`}</span></div>
                    <div className="text-stone-400">Classe: <span className="font-semibold text-stone-200">{character.characterClass}</span></div>
                    <div className="text-stone-400">Subclasse: <span className="font-semibold text-stone-200">{character.subclass || 'Nenhuma'}</span></div>
                    <div className="text-stone-400">Antecedente: <span className="font-semibold text-stone-200">{character.background}</span></div>
                    <div className="text-stone-400 col-span-2">Alinhamento: <span className="font-semibold text-stone-200">{character.alignment}</span></div>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold font-garamond text-amber-300 mb-2 text-shadow-amber">Atributos</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                    {(Object.keys(attributes) as Array<keyof Attributes>).map(attr => (
                        <div key={attr} className="bg-stone-800/50 p-2 rounded-md">
                            <div className="text-xs font-bold text-stone-400">{translateAttribute(attr).substring(0, 3).toUpperCase()}</div>
                            <div className="font-bold text-lg text-stone-200">{attributes[attr]}</div>
                            <div className="text-sm text-amber-400">{modifiers[attr] >= 0 ? `+${modifiers[attr]}` : modifiers[attr]}</div>
                        </div>
                    ))}
                </div>
            </div>

            {conditions.length > 0 && (
                <div>
                    <h3 className="text-lg font-bold font-garamond text-amber-300 mb-2 text-shadow-amber">Condições Ativas</h3>
                    <div className="flex flex-wrap gap-2">
                        {conditions.map(condition => (
                            <div key={condition.index} className="relative group">
                                <span className="flex items-center gap-1 bg-red-900/70 text-red-300 text-xs font-semibold px-2 py-1 rounded-full border border-red-700/80">
                                    <AlertTriangle className="h-3 w-3" />
                                    {translateCondition(condition.name)}
                                </span>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-stone-900 text-stone-300 text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg border border-stone-600">
                                    <h4 className="font-bold text-red-400 mb-1">{translateCondition(condition.name)}</h4>
                                    {condition.desc.map((d, i) => <p key={i} className="mb-1 last:mb-0">{d}</p>)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h3 className="text-lg font-bold font-garamond text-amber-300 mb-2 text-shadow-amber">Perícias</h3>
                <div className="bg-stone-800/50 p-3 rounded-md space-y-1 divide-y divide-stone-700/50">
                    {characterUtils.ALL_SKILLS.map(skill => (
                        <SkillItem 
                            key={skill}
                            skillName={skill}
                            characterProfs={character.proficiencies}
                            modifiers={character.modifiers}
                            profBonus={character.proficiencyBonus}
                        />
                    ))}
                </div>
            </div>
            
            <div>
                <h3 className="text-lg font-bold font-garamond text-amber-300 mb-2 text-shadow-amber">Combate & Recursos</h3>
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-stone-800/50 p-2 rounded-md text-center">
                        <span className="text-xs font-bold text-stone-400">Iniciativa</span>
                        <p className="font-bold text-2xl text-stone-200">{initiativeBonus >= 0 ? `+${initiativeBonus}`: initiativeBonus}</p>
                    </div>
                    <div className="bg-stone-800/50 p-2 rounded-md text-center">
                        <span className="text-xs font-bold text-stone-400">Deslocamento</span>
                        <p className="font-bold text-2xl text-stone-200">{character.speed} <span className="text-base">ft</span></p>
                    </div>
                    <div className="bg-stone-800/50 p-2 rounded-md">
                        <span className="text-xs font-bold text-stone-400">Dados de Vida</span>
                        <p className="font-bold text-lg text-stone-200">{hitDice.current} / {hitDice.total} <span className="text-sm text-stone-400">d{character.hitDie}</span></p>
                    </div>
                    <div className="bg-stone-800/50 p-2 rounded-md">
                        <span className="text-xs font-bold text-stone-400">Moedas</span>
                        <div className="flex gap-2 items-baseline">
                            <div className="text-amber-400 font-mono">
                                <span className="font-bold text-lg">{currency.gp}</span>
                                <span className="text-sm">gp</span>
                            </div>
                            <div className="text-slate-400 font-mono">
                                <span className="font-bold text-lg">{currency.sp}</span>
                                <span className="text-sm">sp</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold font-garamond text-amber-300 mb-2 text-shadow-amber">Ações de Descanso</h3>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => processPlayerAction("Tentar fazer um descanso curto.")}
                        disabled={isLoading || combatState.isActive}
                        className="text-center w-full bg-stone-700/80 hover:bg-stone-600 border border-stone-600 text-stone-300 font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Coffee className="h-4 w-4" />
                        Descanso Curto
                    </button>
                    <button
                        onClick={() => processPlayerAction("Tentar fazer um descanso longo.")}
                        disabled={isLoading || combatState.isActive}
                        className="text-center w-full bg-stone-700/80 hover:bg-stone-600 border border-stone-600 text-stone-300 font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <BedDouble className="h-4 w-4" />
                        Descanso Longo
                    </button>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold font-garamond text-amber-300 mb-2 text-shadow-amber">Equipamento Vestido</h3>
                {equippedItems.length > 0 ? (
                    <ul className="list-disc list-inside text-stone-300 space-y-1 text-sm">
                        {equippedItems.map(item => <li key={item.id}>{translateEquipment(item).name}</li>)}
                    </ul>
                ) : (
                    <p className="text-stone-400 italic text-sm">Nenhum item equipado.</p>
                )}
            </div>
            
            <div>
                <h3 className="text-lg font-bold font-garamond text-amber-300 mb-2 text-shadow-amber">Outras Proficiências</h3>
                <div className="flex flex-wrap gap-2">
                    {proficiencies.filter(p => !p.name.toLowerCase().includes('skill:') && !p.name.toLowerCase().includes('saving throw:')).map(prof => (
                        <span key={prof.name} className="bg-stone-700 text-stone-300 text-xs font-semibold px-2 py-1 rounded-full">
                            {translateApiString(prof.name)}
                        </span>
                    ))}
                </div>
            </div>
            <div>
                <h3 className="text-lg font-bold font-garamond text-amber-300 mb-2 text-shadow-amber">Idiomas</h3>
                <p className="text-stone-300">{languages.join(', ')}</p>
            </div>
            <CollapsibleSection title="Personalidade">
                <div className="space-y-1">
                    <p className="text-sm text-stone-400"><strong className="text-stone-300">Traços:</strong> {character.personalityTraits.join(' ')}</p>
                    <p className="text-sm text-stone-400"><strong className="text-stone-300">Ideal:</strong> {character.ideal}</p>
                    <p className="text-sm text-stone-400"><strong className="text-stone-300">Vínculo:</strong> {character.bond}</p>
                    <p className="text-sm text-stone-400"><strong className="text-stone-300">Defeito:</strong> {character.flaw}</p>
                </div>
            </CollapsibleSection>
            <CollapsibleSection title="História de Fundo">
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
