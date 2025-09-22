import React from 'react';
import { useCharacterCreation } from '../../hooks/useCharacterCreation';
import SpellCard from '../SpellCard';

interface RacialSpellChoicesProps {
    hook: ReturnType<typeof useCharacterCreation>;
}

const RacialSpellChoices: React.FC<RacialSpellChoicesProps> = ({ hook }) => {
    const {
        racialSpellTraits,
        chosenRacialSpells,
        racialSpellOptions,
        handleRacialSpellChange
    } = hook;

    if (racialSpellTraits.length === 0 || racialSpellOptions.length === 0) {
        return null;
    }

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold font-garamond text-amber-300 border-b border-stone-700 pb-2 text-shadow-amber">Magias Raciais</h3>
            
            {racialSpellTraits.map((trait) => {
                const selectedCount = chosenRacialSpells[trait.traitName]?.length || 0;
                
                return (
                    <div key={trait.traitName}>
                        <label className="block text-stone-300 font-semibold mb-2">
                            {trait.traitName} <span className="text-stone-400 font-normal">(Escolha {trait.choose})</span>
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {trait.options.map(spellOption => {
                                const spellDetails = racialSpellOptions.find(s => s.index === spellOption.index);
                                if (!spellDetails) return null;

                                const isSelected = chosenRacialSpells[trait.traitName]?.includes(spellOption.index);
                                const isLimitReached = !isSelected && selectedCount >= trait.choose;

                                return (
                                    <SpellCard
                                        key={spellOption.index}
                                        spell={spellDetails}
                                        isSelectable={true}
                                        isSelected={isSelected}
                                        isDisabled={isLimitReached}
                                        onToggleSelect={() => handleRacialSpellChange(trait.traitName, spellOption.index, trait.choose)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default RacialSpellChoices;
