// src/components/NewCreationCharacter/NewStep6_Spells.tsx
import React from 'react';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';
import { getCantripsKnown, getSpellsKnown } from '@/utils/characterUtils';
import { Icons } from '../Icons';
import SpellCard from '../SpellCard';

interface Props {
    hook: ReturnType<typeof useNewCharacterCreation>;
    prevStep: () => void;
    nextStep: () => void;
}

const NewStep6_Spells: React.FC<Props> = ({
    hook,
    prevStep,
    nextStep
}) => {
    const {
        classDetails,
        classLevels,
        finalAttributes,
        isSpellsLoading,
        spellsLoadingProgress,
        classSpellOptions,
        chosenClassSpells,
        handleClassSpellChange,
        racialSpellTraits,
        racialSpellOptions,
        chosenRacialSpells,
        handleRacialSpellChange,
        handleRandomizeSpells,
    } = hook;
    
    const cantripsKnown = classDetails && classLevels ? getCantripsKnown(classLevels, 1) : 0;
    const spellsKnown = classDetails && classLevels ? getSpellsKnown(1, classLevels, classDetails, finalAttributes) : 0;
    const hasClassSpells = cantripsKnown > 0 || spellsKnown > 0;
    const hasRacialSpells = racialSpellTraits.length > 0;

    const allCantrips = classSpellOptions.filter(s => s.level === 0);
    const allLevel1Spells = classSpellOptions.filter(s => s.level === 1);

    const selectedCantripsCount = chosenClassSpells.filter(sIndex => allCantrips.some(c => c.index === sIndex)).length;
    const selectedSpellsCount = chosenClassSpells.filter(sIndex => allLevel1Spells.some(c => c.index === sIndex)).length;
    
    const areRacialSpellsSelected = racialSpellTraits.every(trait =>
        (chosenRacialSpells[trait.traitName]?.length || 0) === trait.choose
    );
    const areClassSpellsSelected = selectedCantripsCount === cantripsKnown && selectedSpellsCount === spellsKnown;

    const canProceed = areRacialSpellsSelected && areClassSpellsSelected;

    if (isSpellsLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-stone-400">
                <Icons.Spinner className="h-12 w-12" />
                <p className="mt-4">{spellsLoadingProgress || 'Consultando tomos arcanos...'}</p>
            </div>
        );
    }

    if (!hasClassSpells && !hasRacialSpells) {
         return (
            <div className="space-y-8 animate-fadeIn">
                <div className="text-center text-stone-400 italic p-8 bg-stone-900/50 rounded-lg">
                    <p>Sua classe e raça não concedem magias no nível 1.</p>
                </div>
                 <div className="flex justify-between pt-8">
                    <button type="button" onClick={prevStep} className="menu-button btn-import max-w-xs">
                        <Icons.Play className="h-6 w-6 mr-3 transform rotate-90 scale-y-150" />
                        Voltar
                    </button>
                    <button type="button" onClick={nextStep} className="menu-button btn-new max-w-xs">
                        Avançar
                        <Icons.Play className="h-6 w-6 ml-3 transform -rotate-90 scale-y-150" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-stone-300">Seleção de Magias</h3>
                <button
                    type="button"
                    onClick={handleRandomizeSpells}
                    className="flex items-center gap-1.5 text-xs bg-amber-600/20 hover:bg-amber-600/40 text-amber-200 font-semibold py-1 px-2 rounded-md transition-colors"
                >
                    <Icons.Dice className="h-4 w-4" />
                    Aleatório
                </button>
            </div>
             <p className="text-sm text-stone-400 -mt-6">Escolha os truques e magias que seu personagem conhece no início de sua jornada.</p>


            {hasRacialSpells && (
                <div className="space-y-4 bg-stone-900/50 p-4 rounded-lg border border-stone-700">
                    <h4 className="font-semibold text-amber-300 mb-2">Magias Raciais</h4>
                    {racialSpellTraits.map((trait) => {
                        const selectedCount = chosenRacialSpells[trait.traitName]?.length || 0;
                        return (
                             <div key={trait.traitName}>
                                <h5 className="text-stone-300 font-semibold mb-2">
                                    {trait.traitName} <span className="text-stone-400 font-normal">({selectedCount}/{trait.choose})</span>
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {trait.options.map(spellOption => {
                                        const spellDetails = racialSpellOptions.find(s => s.index === spellOption.index);
                                        if (!spellDetails) return null;

                                        const isSelected = !!chosenRacialSpells[trait.traitName]?.includes(spellOption.index);
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
                        )
                    })}
                </div>
            )}
            
            {hasClassSpells && (
                 <div className="space-y-4 bg-stone-900/50 p-4 rounded-lg border border-stone-700">
                     <h4 className="font-semibold text-amber-300 mb-2">Magias de Classe</h4>
                    {cantripsKnown > 0 && (
                        <div>
                            <h5 className="text-stone-300 font-semibold mb-2">Truques <span className="text-stone-400 font-normal">({selectedCantripsCount}/{cantripsKnown})</span></h5>
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
                            <h5 className="text-stone-300 font-semibold mb-2 mt-4">Magias de Nível 1 <span className="text-stone-400 font-normal">({selectedSpellsCount}/{spellsKnown})</span></h5>
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
            )}

             <div className="flex justify-between pt-8">
                <button type="button" onClick={prevStep} className="menu-button btn-import max-w-xs">
                    <Icons.Play className="h-6 w-6 mr-3 transform rotate-90 scale-y-150" />
                    Voltar
                </button>
                <button type="button" onClick={nextStep} disabled={!canProceed} className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed">
                    {canProceed ? 'Avançar' : 'Selecione suas magias'}
                    <Icons.Play className="h-6 w-6 ml-3 transform -rotate-90 scale-y-150" />
                </button>
            </div>
        </div>
    );
};

export default NewStep6_Spells;

    