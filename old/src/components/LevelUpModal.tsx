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
import { DndButton, DndCard } from '@/components/primitives';
import { DndGameModalShell } from '@/features/gameplay/modals/DndGameModalShell';
import { cn } from '@/lib/utils';

const LevelUpModal: React.FC = () => {
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
        <h4 className="mb-2 font-ui text-sm font-semibold uppercase tracking-wider text-dnd-gold">{text}</h4>
    );

    const renderHpChoice = () => {
        const modifier = character.modifiers.constitution;
        const average = Math.floor(character.hitDie / 2) + 1;

        const inner = (
            <>
                {sectionTitle('Aumento de pontos de vida')}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <DndButton type="button" variant="goldOutline" className="flex-1" disabled={!!hpChoice} onClick={() => handleHpChoice('average')}>
                        Média ({average} + {modifier})
                    </DndButton>
                    <DndButton type="button" variant="ember" className="flex-1" disabled={!!hpChoice} onClick={() => handleHpChoice('roll')}>
                        Rolar 1d{character.hitDie} + {modifier}
                    </DndButton>
                </div>
                {hpChoice && hpRollResult !== null && (
                    <p className="mt-3 text-center font-ui font-semibold text-dnd-gold">
                        {hpChoice === 'roll' ? `Você rolou ${hpRollResult}!` : 'Você pegou a média.'} +{modifier} Const. Total: +{hpRollResult + modifier} PV.
                    </p>
                )}
            </>
        );

        return (
            <DndCard padding="md" hover={false} className="border-dnd-gold/12">
                {inner}
            </DndCard>
        );
    }

    const renderAsiChoices = () => {
        if (!choices?.asi) return null;
        return (
            <div>
                <h4 className="mb-2 font-ui text-sm font-semibold uppercase tracking-wider text-dnd-gold">
                    Aumento no Valor de Atributo ({asiPoints} pontos restantes)
                </h4>
                <p className="mb-3 font-ui text-sm text-dnd-parchment-muted">
                    Aumente um atributo em +2 ou dois atributos em +1.
                </p>
                <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(character.attributes) as Array<keyof Attributes>).map(attr => (
                        <div key={attr} className="rounded-md border border-dnd-gold/12 bg-dnd-obsidian-raised p-2 text-center">
                            <label className="text-xs font-bold text-dnd-parchment-muted">
                                {translateAttribute(attr).substring(0, 3).toUpperCase()}
                            </label>
                            <div className="font-ui text-lg font-bold text-dnd-parchment">
                                {character.attributes[attr]}
                                {tempAttributes[attr] ? <span className="text-dnd-gold"> +{tempAttributes[attr]}</span> : ''}
                            </div>
                            <button 
                                onClick={() => handleAttributeIncrease(attr)} 
                                disabled={asiPoints === 0 || (tempAttributes[attr] || 0) >= 2 || (character.attributes[attr] + (tempAttributes[attr] || 0) >= 20)}
                                className="mt-1 rounded border border-dnd-gold/20 bg-dnd-obsidian px-2 py-1 text-xs text-dnd-parchment hover:border-dnd-gold/40 disabled:opacity-50"
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
                <div className="flex items-center justify-center p-4 font-ui text-dnd-parchment-muted">
                    <Loader2 className="animate-spin" />
                    <span className="ml-2">{spellsLoadingProgress || 'Consultando grimório...'}</span>
                </div>
            );
        }
        if (spellOptions.length === 0) return null;

        const selectedCount = selections.spells?.length || 0;
        return (
            <div>
                 <h4 className="mb-2 font-ui text-sm font-semibold uppercase tracking-wider text-dnd-gold">
                    Aprender Novas Magias ({selectedCount}/{choices.spellsToChoose})
                 </h4>
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
                <h4 className="mb-2 font-ui text-sm font-semibold uppercase tracking-wider text-dnd-gold">
                    {choice.desc} ({selectedCount}/{choice.choose})
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {choice.options.map(option => {
                        const isSelected = featureSelections[choice.id]?.includes(option.index);
                        const isDisabled = !isSelected && selectedCount >= choice.choose;
                        const inputType = choice.choose === 1 ? 'radio' : 'checkbox';

                        return (
                            <div
                                key={option.index}
                                className={`rounded-md border bg-dnd-obsidian-raised p-3 transition-all duration-300 ${isSelected ? 'border-dnd-gold' : 'border-dnd-gold/15'} ${isDisabled ? 'opacity-60' : ''}`}
                            >
                                <label className="flex cursor-pointer items-start gap-3">
                                    <input
                                        type={inputType}
                                        name={choice.id}
                                        checked={isSelected}
                                        disabled={isDisabled}
                                        onChange={() => handleFeatureSelection(choice.id, option.index, choice.choose)}
                                        className="form-checkbox mt-1 h-5 w-5 rounded border-dnd-gold/30 bg-dnd-obsidian text-dnd-gold focus:ring-dnd-gold"
                                    />
                                    <div>
                                        <h5 className="font-ui font-semibold text-dnd-parchment">{option.name}</h5>
                                        <p className="font-ui text-sm text-dnd-parchment-muted">{option.desc}</p>
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
                 <h4 className="mb-2 font-ui text-sm font-semibold uppercase tracking-wider text-dnd-gold">{choice.desc}</h4>
                 <div className="space-y-2">
                    {choice.options.map(option => (
                        <div
                            key={option.index}
                            className={`rounded-md border bg-dnd-obsidian-raised p-3 transition-all duration-300 ${subclassSelection === option.index ? 'border-dnd-gold' : 'border-dnd-gold/15'}`}
                        >
                             <label className="flex cursor-pointer items-start gap-3">
                                 <input
                                    type="radio"
                                    name="subclass-choice"
                                    checked={subclassSelection === option.index}
                                    onChange={() => setSubclassSelection(option.index)}
                                    className="form-radio mt-1 h-5 w-5 rounded-full border-dnd-gold/30 bg-dnd-obsidian text-dnd-gold focus:ring-dnd-gold"
                                />
                                 <div>
                                    <h5 className="font-ui font-semibold text-dnd-parchment">{option.name}</h5>
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
        <div className="space-y-6 p-4 md:p-5">
            {renderHpChoice()}
            {renderSubclassChoice()}
            {renderAsiChoices()}
            {choices.featureChoices?.map(renderFeatureChoices)}
            {renderSpellChoices()}
        </div>
    );

    const confirmFooter = (
        <DndButton
            variant="ember"
            size="lg"
            className="w-full"
            disabled={!isReadyToConfirm}
            loading={isLoading}
            onClick={handleSubmit}
        >
            {isLoading ? null : (
                <>
                    <Sparkles className="h-4 w-4" />
                    Confirmar nível {newLevel}
                </>
            )}
        </DndButton>
    );

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
};

export default LevelUpModal;
