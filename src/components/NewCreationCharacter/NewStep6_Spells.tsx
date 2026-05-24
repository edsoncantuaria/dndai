// src/components/NewCreationCharacter/NewStep6_Spells.tsx
'use client';
import React from 'react';
import { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import NewSpellCard from '../Spells/NewSpellCard';
import { Dice5, ArrowLeft, ArrowRight } from 'lucide-react';
import PremiumLoader from '@/components/ui/PremiumLoader';

interface Props {
    hook: ReturnType<typeof useCharacterCreator>;
    prevStep: () => void;
    nextStep: () => void;
    hideNav?: boolean;
}

const NewStep6_Spells: React.FC<Props> = ({ hook, prevStep, nextStep, hideNav }) => {
    const {
        characterClass,
        loadingStates,
        details: { classDetails, classSpellOptions, subclassSpells },
        racialSpellTraits,
        handleClassSpellChange,
        handleRacialSpellChange,
        chosenClassSpells,
        chosenRacialSpells,
        racialSpellOptions,
        cantripsKnown,
        spellsKnown,
        handleRandomizeSpells,
    } = hook;
    
    const hasClassSpells = cantripsKnown > 0 || spellsKnown > 0;
    const hasRacialSpells = (racialSpellTraits || []).length > 0;

    const allCantrips = classSpellOptions.filter(s => s.level === 0);
    const allLevel1Spells = [...classSpellOptions.filter(s => s.level === 1), ...subclassSpells];

    const selectedCantripsCount = chosenClassSpells.filter(sIndex => allCantrips.some(c => c.index === sIndex)).length;
    const selectedSpellsCount = chosenClassSpells.filter(sIndex => allLevel1Spells.some(c => c.index === sIndex)).length;
    
    const areRacialSpellsSelected = (racialSpellTraits || []).every(trait =>
        (chosenRacialSpells[trait.traitName]?.length || 0) === trait.choose
    );
    const areClassSpellsSelected = selectedCantripsCount === cantripsKnown && selectedSpellsCount === spellsKnown;

    const canProceed = areRacialSpellsSelected && areClassSpellsSelected;

    const allChosenSpellIndices = new Set([...chosenClassSpells, ...Object.values(chosenRacialSpells).flat()]);

    if (characterClass && !classDetails && loadingStates.isFetching) {
        return (
            <PremiumLoader
                title="Carregando grimórios iniciais"
                subtitle="Buscando truques, magias de nível 1 e dons raciais disponíveis."
                description="Sincronizando grimórios da classe e da subclasse..."
                statusLabel={loadingStates.message || 'Mapeando magias'}
                progress={loadingStates.progress}
                showSkeletons={false}
            />
        );
    }

    if (!hasClassSpells && !hasRacialSpells) {
         return (
            <div className="space-y-10 animate-fadeIn">
                <div className="rounded-[32px] border border-white/5 bg-stone-950/70 p-8 text-center text-stone-400 shadow-2xl shadow-black/40">
                    <p className="text-sm">Sua classe e raça não concedem magias no nível 1.</p>
                </div>
                {!hideNav ? (
                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                        type="button"
                        onClick={prevStep}
                        className="flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-stone-100 transition hover:border-white/40 hover:bg-white/5"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Voltar para Equipamentos
                    </button>
                    <button
                        type="button"
                        onClick={nextStep}
                        className="flex items-center justify-center gap-3 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/80 to-rose-500/70 px-6 py-3 text-base font-semibold text-stone-950 shadow-lg shadow-amber-500/30 transition"
                    >
                        Prosseguir
                        <ArrowRight className="h-5 w-5" />
                    </button>
                </div>
                ) : null}
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-fadeIn">
            <section className="rounded-[32px] border border-white/5 bg-stone-950/70 p-6 shadow-2xl shadow-black/40">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.5em] text-amber-400/80">Grimório Inicial</p>
                        <h3 className="text-3xl font-semibold text-amber-50">Seleção de Magias</h3>
                        <p className="text-sm text-stone-400">Escolha os truques e magias que inaugurarão seu repertório arcano.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleRandomizeSpells()}
                        className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-amber-500/20"
                    >
                        <Dice5 className="h-4 w-4" />
                        Sortear magias
                    </button>
                </div>

                {hasRacialSpells && (
                    <div className="mt-6 space-y-5 rounded-3xl border border-white/5 bg-stone-950/60 p-5">
                        <h4 className="text-lg font-semibold text-amber-200">Magias Raciais</h4>
                        {(racialSpellTraits || []).map(trait => {
                        const selectedCount = chosenRacialSpells[trait.traitName]?.length || 0;
                        return (
                             <div key={trait.traitName}>
                                <h5 className="text-stone-300 font-semibold mb-2">{trait.traitName} <span className="text-stone-400 font-normal">({selectedCount}/{trait.choose})</span></h5>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {(trait.options || []).map(spellOption => {
                                        const spell = racialSpellOptions.find(s => s.index === spellOption.index);
                                        if (!spell) return null;
                                        const isSelected = !!chosenRacialSpells[trait.traitName]?.includes(spell.index);
                                        const isDisabled = !isSelected && (selectedCount >= trait.choose || allChosenSpellIndices.has(spell.index));
                                        return (
                                            <NewSpellCard
                                                key={spell.index} spell={spell} isSelectable={true}
                                                isSelected={isSelected} isDisabled={isDisabled}
                                                onToggleSelect={() => handleRacialSpellChange(trait.traitName, spell.index, trait.choose)}
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
                    <div className="mt-6 space-y-5 rounded-3xl border border-white/5 bg-stone-950/60 p-5">
                        <h4 className="text-lg font-semibold text-amber-200">Magias de Classe</h4>
                    {cantripsKnown > 0 && (
                        <div>
                            <h5 className="text-stone-300 font-semibold mb-2">Truques <span className="text-stone-400 font-normal">({selectedCantripsCount}/{cantripsKnown})</span></h5>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {allCantrips.map(spell => {
                                    const isSelected = chosenClassSpells.includes(spell.index);
                                    const isDisabled = !isSelected && (selectedCantripsCount >= cantripsKnown || allChosenSpellIndices.has(spell.index));
                                    return (
                                        <NewSpellCard
                                            key={spell.index} spell={spell} isSelectable={true}
                                            isSelected={isSelected} isDisabled={isDisabled}
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
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {allLevel1Spells.map(spell => {
                                    const isSelected = chosenClassSpells.includes(spell.index);
                                    const isDisabled = !isSelected && (selectedSpellsCount >= spellsKnown || allChosenSpellIndices.has(spell.index));
                                    return (
                                        <NewSpellCard
                                            key={spell.index} spell={spell} isSelectable={true}
                                            isSelected={isSelected} isDisabled={isDisabled}
                                            onToggleSelect={() => handleClassSpellChange(spell.index)}
                                        />
                                    )
                                })}
                            </div>
                        </div>
                    )}
                 </div>
            )}
            </section>

            {!hideNav ? (
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    onClick={prevStep}
                    className="flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-stone-100 transition hover:border-white/40 hover:bg-white/5"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para Equipamentos
                </button>
                <button
                    type="button"
                    onClick={nextStep}
                    disabled={!canProceed}
                    className="flex items-center justify-center gap-3 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/80 to-rose-500/70 px-6 py-3 text-base font-semibold text-stone-950 shadow-lg shadow-amber-500/30 transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {canProceed ? 'Prosseguir para Talentos' : 'Finalize a seleção de magias'}
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
            ) : null}
        </div>
    );
};

export default NewStep6_Spells;
