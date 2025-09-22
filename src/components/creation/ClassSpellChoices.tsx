import React from 'react';
import { useCharacterCreation } from '../../hooks/useCharacterCreation';
import { getCantripsKnown, getSpellsKnown } from '../../utils/characterUtils';
import { Icons } from '../Icons';
import SpellCard from '../SpellCard';

interface ClassSpellChoicesProps {
    hook: ReturnType<typeof useCharacterCreation>;
}

const ClassSpellChoices: React.FC<ClassSpellChoicesProps> = ({ hook }) => {
    const { 
        classDetails, 
        classLevels, 
        finalAttributes,
        isSpellsLoading,
        spellsLoadingProgress,
        classSpellOptions,
        chosenClassSpells,
        handleClassSpellChange
    } = hook;

    if (!classDetails?.spellcasting || !classLevels) return null;

    if (isSpellsLoading || spellsLoadingProgress) {
        return (
            <div className="flex items-center justify-center p-4 text-stone-400">
                <Icons.Spinner />
                <span className="ml-2">{spellsLoadingProgress || 'Consultando grimório...'}</span>
            </div>
        );
    }

    const allCantrips = classSpellOptions.filter(s => s.level === 0);
    const allLevel1Spells = classSpellOptions.filter(s => s.level === 1);
    
    const cantripsKnown = getCantripsKnown(classLevels, 1);
    const spellsKnown = getSpellsKnown(1, classLevels, classDetails, finalAttributes);

    const selectedCantripsCount = chosenClassSpells.filter(sIndex => allCantrips.some(c => c.index === sIndex)).length;
    const selectedSpellsCount = chosenClassSpells.filter(sIndex => allLevel1Spells.some(c => c.index === sIndex)).length;

    if (cantripsKnown === 0 && spellsKnown === 0) return null;

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold font-garamond text-amber-300 border-b border-stone-700 pb-2 text-shadow-amber">Seleção de Magias de Classe</h3>
            
            {cantripsKnown > 0 && (
                 <div>
                    <label className="block text-stone-300 font-semibold mb-2">Truques <span className="text-stone-400 font-normal">({selectedCantripsCount}/{cantripsKnown})</span></label>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                         {allCantrips.map(spell => {
                            const isSelected = chosenClassSpells.includes(spell.index);
                            const isLimitReached = !isSelected && selectedCantripsCount >= cantripsKnown;
                            return (
                                <SpellCard
                                    key={spell.index}
                                    spell={spell}
                                    isSelectable={true}
                                    isSelected={isSelected}
                                    isDisabled={isLimitReached}
                                    onToggleSelect={() => handleClassSpellChange(spell.index)}
                                />
                            )
                         })}
                     </div>
                </div>
            )}

             {spellsKnown > 0 && (
                 <div>
                    <label className="block text-stone-300 font-semibold mb-2">Magias de Nível 1 <span className="text-stone-400 font-normal">({selectedSpellsCount}/{spellsKnown})</span></label>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {allLevel1Spells.map(spell => {
                            const isSelected = chosenClassSpells.includes(spell.index);
                            const isLimitReached = !isSelected && selectedSpellsCount >= spellsKnown;
                            return (
                                <SpellCard
                                    key={spell.index}
                                    spell={spell}
                                    isSelectable={true}
                                    isSelected={isSelected}
                                    isDisabled={isLimitReached}
                                    onToggleSelect={() => handleClassSpellChange(spell.index)}
                                />
                            )
                        })}
                     </div>
                </div>
            )}
        </div>
    );
};

export default ClassSpellChoices;
