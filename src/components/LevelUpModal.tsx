// components/LevelUpModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import type { LevelUpSelections, Attributes, ApiSpell } from '../types';
import * as DndApiService from '../services/dndApiService';
import { translateAttribute } from '@/utils/translator';
import NewSpellCard from '../components/Spells/NewSpellCard';
import { rollDice } from '../utils/dice';
import { fetchDetailsInChunks } from '../utils/apiUtils';
import { Loader2, Sparkles } from 'lucide-react';
import { isUiV2Enabled } from '@/lib/uiV2';
import { DndButton, DndCard } from '@/components/primitives';
import { DndGameModalShell } from '@/features/gameplay/modals/DndGameModalShell';
import { cn } from '@/lib/utils';

const LevelUpModal: React.FC = () => {
    const isV2 = isUiV2Enabled();
    const { levelUpState, applyLevelUp, isLoading, character } = useGameStateContext();
    const [selections, setSelections] = useState<LevelUpSelections>({});
    const [asiPoints, setAsiPoints] = useState(levelUpState?.choices?.asi?.count || 0);
    const [tempAttributes, setTempAttributes] = useState<Partial<Attributes>>({});
    const [spellOptions, setSpellOptions] = useState<ApiSpell[]>([]);
    const [isSpellsLoading, setIsSpellsLoading] = useState(false);
    const [spellsLoadingProgress, setSpellsLoadingProgress] = useState<string | null>(null);
    const [hpChoice, setHpChoice] = useState<'average' | 'roll' | null>(null);
    const [hpRollResult, setHpRollResult] = useState<number | null>(null);
    const [featureSelections, setFeatureSelections] = useState<Record<string, string[]>>({});
    const [subclassSelection, setSubclassSelection] = useState<string>('');

    useEffect(() => {
        const fetchSpellDetails = async () => {
            if (levelUpState?.choices?.spellChoiceOptions) {
                setIsSpellsLoading(true);
                const spellList = levelUpState.choices.spellChoiceOptions;
                const results = await fetchDetailsInChunks(
                    spellList,
                    DndApiService.getSpellDetails,
                    (loaded, total) => {
                        setSpellsLoadingProgress(`Carregando magias ${loaded} de ${total}...`);
                    }
                );
                setSpellOptions(results);
                setIsSpellsLoading(false);
                setSpellsLoadingProgress(null);
            }
        };
        fetchSpellDetails();
    }, [levelUpState?.choices?.spellChoiceOptions]);
    
    if (!levelUpState?.isPending || !character) return null;
    
    const { newLevel, choices } = levelUpState;
    
    const isReadyToConfirm = useMemo(() => {
        const asiMet = (choices?.asi?.count || 0) === 0 || asiPoints === 0;
        const spellsMet = (choices?.spellsToChoose || 0) === 0 || (selections.spells?.length || 0) === choices.spellsToChoose;
        const featuresMet = (choices?.featureChoices || []).every(
            choice => (featureSelections[choice.id]?.length || 0) === choice.choose
        );
        const subclassMet = !choices.subclassChoice || !!subclassSelection;
        const hpMet = hpChoice !== null;
        return asiMet && spellsMet && hpMet && featuresMet && subclassMet && !isLoading;
    }, [choices, asiPoints, selections.spells, hpChoice, featureSelections, subclassSelection, isLoading]);

    const handleAttributeIncrease = (attr: keyof Attributes) => {
        if (asiPoints <= 0) return;
        setTempAttributes(prev => {
            const currentIncrease = prev[attr] || 0;
            if (currentIncrease >= 2) return prev; 
            
            const newAttrs = { ...prev, [attr]: currentIncrease + 1 };
            setAsiPoints(p => p - 1);
            return newAttrs;
        });
    };
    
    const handleSpellSelection = (spellIndex: string) => {
        setSelections(prev => {
            const currentSpells = prev.spells || [];
            if (currentSpells.includes(spellIndex)) {
                return { ...prev, spells: currentSpells.filter(s => s !== spellIndex) };
            }
            if (currentSpells.length < (choices?.spellsToChoose || 0)) {
                return { ...prev, spells: [...currentSpells, spellIndex] };
            }
            return prev;
        });
    };

    const handleFeatureSelection = (choiceId: string, selectionIndex: string, choose: number) => {
        setFeatureSelections(prev => {
            const newSelections = { ...prev };
            const currentSelections = prev[choiceId] || [];

            if (currentSelections.includes(selectionIndex)) {
                newSelections[choiceId] = currentSelections.filter(s => s !== selectionIndex);
            } else {
                if (choose === 1) {
                    newSelections[choiceId] = [selectionIndex];
                } else if (currentSelections.length < choose) {
                    newSelections[choiceId] = [...currentSelections, selectionIndex];
                }
            }
            return newSelections;
        });
    };
    
    const handleHpChoice = (choice: 'average' | 'roll') => {
        if (hpChoice) return;
        setHpChoice(choice);
        if (choice === 'average') {
            const avg = Math.floor(character.hitDie / 2) + 1;
            setHpRollResult(avg);
        } else {
            const { total: diceResult } = rollDice(`1d${character.hitDie}`);
            setHpRollResult(diceResult);
        }
    }

    const handleSubmit = () => {
        if (!isReadyToConfirm) return;
        
        const hpIncrease = (hpRollResult || 0) + character.modifiers.constitution;

        const finalFeatureSelections = Object.entries(featureSelections).map(([id, selections]) => ({
            id,
            selections,
        }));

        const finalSelections: LevelUpSelections = {
            ...selections,
            attributes: tempAttributes,
            featureChoices: finalFeatureSelections,
            subclass: subclassSelection || undefined,
            hpIncrease,
        };
        applyLevelUp(finalSelections);
    };

    const sectionTitle = (text: string) => (
        <h4 className={cn('mb-2 font-semibold', isV2 ? 'font-ui text-sm uppercase tracking-wider text-dnd-gold' : 'text-stone-300')}>
            {text}
        </h4>
    );

    const renderHpChoice = () => {
        const modifier = character.modifiers.constitution;
        const average = Math.floor(character.hitDie / 2) + 1;

        const inner = (
            <>
                {sectionTitle('Aumento de pontos de vida')}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {isV2 ? (
                        <>
                            <DndButton type="button" variant="goldOutline" className="flex-1" disabled={!!hpChoice} onClick={() => handleHpChoice('average')}>
                                Média ({average} + {modifier})
                            </DndButton>
                            <DndButton type="button" variant="ember" className="flex-1" disabled={!!hpChoice} onClick={() => handleHpChoice('roll')}>
                                Rolar 1d{character.hitDie} + {modifier}
                            </DndButton>
                        </>
                    ) : (
                        <>
                            <button type="button" onClick={() => handleHpChoice('average')} disabled={!!hpChoice} className="flex-1 rounded-md bg-stone-700 px-4 py-2 font-semibold text-stone-200 disabled:opacity-50">
                                Pegar a Média ({average} + {modifier} Mod)
                            </button>
                            <button type="button" onClick={() => handleHpChoice('roll')} disabled={!!hpChoice} className="flex-1 rounded-md bg-amber-700 px-4 py-2 font-semibold text-stone-100 disabled:opacity-50">
                                Rolar 1d{character.hitDie} + {modifier} Mod
                            </button>
                        </>
                    )}
                </div>
                {hpChoice && hpRollResult !== null && (
                    <p className={cn('mt-3 text-center font-semibold', isV2 ? 'font-ui text-dnd-gold' : 'text-amber-300')}>
                        {hpChoice === 'roll' ? `Você rolou ${hpRollResult}!` : 'Você pegou a média.'} +{modifier} Const. Total: +{hpRollResult + modifier} PV.
                    </p>
                )}
            </>
        );

        return isV2 ? <DndCard padding="md" hover={false} className="border-dnd-gold/12">{inner}</DndCard> : <div>{inner}</div>;
    }

    const renderAsiChoices = () => {
        if (!choices?.asi) return null;
        return (
            <div>
                <h4 className="font-semibold text-stone-300 mb-2">Aumento no Valor de Atributo ({asiPoints} pontos restantes)</h4>
                <p className="text-sm text-stone-400 mb-3">Aumente um atributo em +2 ou dois atributos em +1.</p>
                <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(character.attributes) as Array<keyof Attributes>).map(attr => (
                        <div key={attr} className="bg-stone-800 p-2 rounded-md text-center">
                            <label className="text-xs font-bold text-stone-400">{translateAttribute(attr).substring(0, 3).toUpperCase()}</label>
                            <div className="font-bold text-lg text-stone-200">
                                {character.attributes[attr]}
                                {tempAttributes[attr] ? <span className="text-green-400"> +{tempAttributes[attr]}</span> : ''}
                            </div>
                            <button 
                                onClick={() => handleAttributeIncrease(attr)} 
                                disabled={asiPoints === 0 || (tempAttributes[attr] || 0) >= 2 || (character.attributes[attr] + (tempAttributes[attr] || 0) >= 20)}
                                className="text-xs bg-stone-600 hover:bg-stone-500 rounded px-2 py-1 mt-1 disabled:opacity-50"
                            >
                                +1
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };
    
    const renderSpellChoices = () => {
        if (!choices?.spellsToChoose) return null;
        if (isSpellsLoading || spellsLoadingProgress) {
            return (
                <div className="flex items-center justify-center p-4 text-stone-400">
                    <Loader2 className="animate-spin" />
                    <span className="ml-2">{spellsLoadingProgress || 'Consultando grimório...'}</span>
                </div>
            );
        }
        if (spellOptions.length === 0) return null;

        const selectedCount = selections.spells?.length || 0;
        return (
            <div>
                 <h4 className="font-semibold text-stone-300 mb-2">Aprender Novas Magias ({selectedCount}/{choices.spellsToChoose})</h4>
                 <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {spellOptions.map((spell) => {
                        const isSelected = selections.spells?.includes(spell.index);
                        const isDisabled = !isSelected && selectedCount >= (choices.spellsToChoose || 0);
                        return (
                            <NewSpellCard
                                key={spell.index}
                                spell={spell}
                                isSelectable={true}
                                isSelected={isSelected || false}
                                isDisabled={isDisabled}
                                onToggleSelect={() => handleSpellSelection(spell.index)}
                            />
                        )
                    })}
                 </div>
            </div>
        )
    };

    const renderFeatureChoices = (choice: typeof choices.featureChoices[0]) => {
        const selectedCount = featureSelections[choice.id]?.length || 0;
        return (
            <div key={choice.id}>
                <h4 className="font-semibold text-stone-300 mb-2">{choice.desc} ({selectedCount}/{choice.choose})</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {choice.options.map(option => {
                        const isSelected = featureSelections[choice.id]?.includes(option.index);
                        const isDisabled = !isSelected && selectedCount >= choice.choose;
                        const inputType = choice.choose === 1 ? 'radio' : 'checkbox';

                        return (
                            <div key={option.index} className={`bg-stone-800 p-3 rounded-md border transition-all duration-300 ${isSelected ? 'border-amber-600' : 'border-stone-700'} ${isDisabled ? 'opacity-60' : ''}`}>
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type={inputType}
                                        name={choice.id}
                                        checked={isSelected}
                                        disabled={isDisabled}
                                        onChange={() => handleFeatureSelection(choice.id, option.index, choice.choose)}
                                        className="form-checkbox h-5 w-5 text-amber-500 bg-stone-800 border-stone-600 focus:ring-amber-500 rounded mt-1"
                                    />
                                    <div>
                                        <h5 className="font-semibold text-stone-200">{option.name}</h5>
                                        <p className="text-sm text-stone-400">{option.desc}</p>
                                    </div>
                                </label>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderSubclassChoice = () => {
        if (!choices.subclassChoice) return null;
        const choice = choices.subclassChoice;
        return (
            <div key={choice.id}>
                 <h4 className="font-semibold text-stone-300 mb-2">{choice.desc}</h4>
                 <div className="space-y-2">
                    {choice.options.map(option => (
                        <div key={option.index} className={`bg-stone-800 p-3 rounded-md border transition-all duration-300 ${subclassSelection === option.index ? 'border-amber-600' : 'border-stone-700'}`}>
                             <label className="flex items-start gap-3 cursor-pointer">
                                 <input
                                    type="radio"
                                    name="subclass-choice"
                                    checked={subclassSelection === option.index}
                                    onChange={() => setSubclassSelection(option.index)}
                                    className="form-radio h-5 w-5 text-amber-500 bg-stone-800 border-stone-600 focus:ring-amber-500 rounded-full mt-1"
                                />
                                 <div>
                                    <h5 className="font-semibold text-stone-200">{option.name}</h5>
                                     {/* Description can be added if available */}
                                </div>
                            </label>
                        </div>
                    ))}
                </div>
            </div>
        )
    };

    const mainContent = (
        <div className={cn('space-y-6', isV2 ? 'p-4 md:p-5' : 'p-4')}>
            {renderHpChoice()}
            {renderSubclassChoice()}
            {renderAsiChoices()}
            {choices.featureChoices?.map(renderFeatureChoices)}
            {renderSpellChoices()}
        </div>
    );

    const confirmFooter = isV2 ? (
        <DndButton variant="ember" size="lg" className="w-full" disabled={!isReadyToConfirm} loading={isLoading} onClick={handleSubmit}>
            {isLoading ? null : (
              <>
                <Sparkles className="h-4 w-4" />
                Confirmar nível {newLevel}
              </>
            )}
        </DndButton>
    ) : (
        <button
            type="button"
            onClick={handleSubmit}
            disabled={!isReadyToConfirm}
            className="w-full rounded-md bg-amber-600 py-3 text-lg font-bold text-stone-900 disabled:opacity-50"
        >
            {isLoading ? <Loader2 className="mx-auto animate-spin" /> : `Confirmar Nível ${newLevel}`}
        </button>
    );

    if (isV2) {
        return (
            <DndGameModalShell
                maxWidth="max-w-2xl"
                eyebrow="Progressão"
                title={`Nível ${newLevel}`}
                subtitle={`Parabéns, ${character.name}! Faça suas escolhas.`}
                footer={confirmFooter}
                closeOnBackdrop={false}
            >
                {mainContent}
            </DndGameModalShell>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-amber-500 bg-stone-900 shadow-2xl">
                <header className="border-b border-stone-700 p-4">
                    <h2 className="font-garamond text-2xl font-bold text-amber-300">Subiu de nível!</h2>
                    <p className="text-stone-400">
                        Parabéns, {character.name}! Você alcançou o nível {newLevel}. Faça suas escolhas.
                    </p>
                </header>
                <main className="overflow-y-auto">{mainContent}</main>
                <footer className="mt-auto border-t border-stone-700 p-4">{confirmFooter}</footer>
            </div>
        </div>
    );
};

export default LevelUpModal;
