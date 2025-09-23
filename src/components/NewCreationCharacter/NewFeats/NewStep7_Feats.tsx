// src/components/NewCreationCharacter/NewFeats/NewStep7_Feats.tsx
import React from 'react';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';
import { Icons } from '@/components/Icons';
import NewFeatCard from './NewFeatCard';

interface Props {
    hook: ReturnType<typeof useNewCharacterCreation>;
    prevStep: () => void;
    nextStep: () => void;
}

const NewStep7_Feats: React.FC<Props> = ({ hook, prevStep, nextStep }) => {
    const {
        feats,
        isFeatsLoading,
        racialFeats,
        chosenFeats,
        handleFeatChange,
        finalAttributes,
    } = hook;

    // Define que você pode escolher 1 talento geral (pode ser ajustado no futuro)
    const generalFeatSlots = 1;
    const chosenGeneralFeatsCount = chosenFeats.filter(featIndex => 
        !racialFeats.some(rf => rf.index === featIndex)
    ).length;

    const canProceed = chosenGeneralFeatsCount >= generalFeatSlots;

    if (isFeatsLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-stone-400">
                <Icons.Spinner className="h-12 w-12" />
                <p className="mt-4">Buscando tomos de talentos...</p>
            </div>
        );
    }
    
    // Se não houver talentos na API, permite pular a etapa.
    if(feats.length === 0) {
        return (
            <div className="space-y-8 animate-fadeIn">
                 <div className="text-center text-stone-400 italic p-8 bg-stone-900/50 rounded-lg">
                    <p>Nenhum talento encontrado para seleção no momento.</p>
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
        )
    }

    const availableGeneralFeats = feats.filter(feat => !racialFeats.some(rf => rf.index === feat.index));

    return (
        <div className="space-y-8 animate-fadeIn">
            <div>
                <h3 className="text-xl font-semibold text-stone-300 mb-2">Seleção de Talentos</h3>
                <p className="text-sm text-stone-400 mb-6">Sua raça pode conceder talentos. Além disso, você pode escolher <strong className="text-amber-300">{generalFeatSlots}</strong> talento(s) geral(ais) para customizar seu personagem.</p>
            </div>

            {racialFeats.length > 0 && (
                <div className="space-y-4">
                    <h4 className="font-semibold text-amber-300 border-b border-stone-700 pb-2">Talentos Raciais Concedidos</h4>
                    {racialFeats.map(feat => (
                        <NewFeatCard 
                            key={feat.index}
                            feat={feat}
                            isSelectable={false}
                            isSelected={true}
                            isGranted={true}
                            isDisabled={true}
                            onToggle={() => {}}
                        />
                    ))}
                </div>
            )}
            
            <div className="space-y-4">
                 <h4 className="font-semibold text-amber-300 border-b border-stone-700 pb-2">Talentos Gerais ({chosenGeneralFeatsCount}/{generalFeatSlots})</h4>
                {availableGeneralFeats.map(feat => {
                    const isSelected = chosenFeats.includes(feat.index);
                    const limitReached = !isSelected && chosenGeneralFeatsCount >= generalFeatSlots;
                    const hasPrereqs = feat.prerequisites.every(prereq => {
                        const attrKey = prereq.ability_score.index as keyof Attributes;
                        return finalAttributes[attrKey] >= prereq.minimum_score;
                    });
                    
                    const isDisabled = limitReached || !hasPrereqs;

                    return (
                        <NewFeatCard 
                            key={feat.index}
                            feat={feat}
                            isSelectable={true}
                            isSelected={isSelected}
                            isGranted={false}
                            isDisabled={isDisabled}
                            onToggle={() => handleFeatChange(feat.index)}
                        />
                    )
                })}
            </div>

            <div className="flex justify-between pt-8">
                <button type="button" onClick={prevStep} className="menu-button btn-import max-w-xs">
                    <Icons.Play className="h-6 w-6 mr-3 transform rotate-90 scale-y-150" />
                    Voltar
                </button>
                <button type="button" onClick={nextStep} disabled={!canProceed} className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed">
                    {canProceed ? 'Finalizar' : `Escolha ${generalFeatSlots - chosenGeneralFeatsCount} talento(s)`}
                    <Icons.Play className="h-6 w-6 ml-3 transform -rotate-90 scale-y-150" />
                </button>
            </div>
        </div>
    )
}

export default NewStep7_Feats;
