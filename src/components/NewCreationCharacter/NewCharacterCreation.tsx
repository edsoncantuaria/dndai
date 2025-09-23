// src/components/NewCreationCharacter/NewCharacterCreation.tsx
// Este é o componente orquestrador do novo "Wizard" de criação de personagem.
// Ele gerencia o estado da etapa atual e passa os dados e funções necessárias para cada etapa.
// A lógica principal (o "cérebro") é consumida diretamente do hook `useNewCharacterCreation`.

'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { ApiListItem } from '@/types';
import NewStep1_RaceClass from './NewStep1_RaceClass';
import NewStepper from './NewStepper';
import NewStep2_Attributes from './NewStep2_Attributes';
import NewStep3_Background from './NewStep3_Background';
import NewStep4_Proficiencies from './NewStep4_Proficiencies';
import NewStep5_Equipment from './NewStep5_Equipment';
import NewStep6_Spells from './NewStep6_Spells';
import NewStep7_Feats from './NewFeats/NewStep7_Feats';
import NewStep8_Finalize from './NewStep8_Finalize';


interface NewCharacterCreationProps {
    races: ApiListItem[];
    classes: ApiListItem[];
    backgrounds: ApiListItem[];
    alignments: ApiListItem[];
    allLanguages: ApiListItem[];
    onBackToMenu: () => void;
}

const NewCharacterCreation: React.FC<NewCharacterCreationProps> = ({
    races,
    classes,
    backgrounds,
    alignments,
    allLanguages,
    onBackToMenu
}) => {
    const { createCharacter } = useGameStateContext();
    const hook = useNewCharacterCreation();
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 8;
    const wizardRef = useRef<HTMLDivElement>(null);

     useEffect(() => {
        if (wizardRef.current) {
            wizardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [currentStep]);

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
    
    const handleFinalizeAndSubmit = async () => {
        const finalCharacterData = hook.buildCharacter();
        if (finalCharacterData) {
            await createCharacter(finalCharacterData);
            // A transição para a tela do jogo será gerenciada pelo GameStateContext
        } else {
            console.error("Não foi possível finalizar a criação do personagem. Dados incompletos.");
            // O ideal seria mostrar um erro para o usuário aqui.
        }
    };

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return <NewStep1_RaceClass hook={hook} nextStep={nextStep} races={races} classes={classes} />;
            case 2:
                return <NewStep2_Attributes hook={hook} prevStep={prevStep} nextStep={nextStep} />;
            case 3:
                return <NewStep3_Background hook={hook} backgrounds={backgrounds} alignments={alignments} prevStep={prevStep} nextStep={nextStep} />;
            case 4:
                return <NewStep4_Proficiencies hook={hook} prevStep={prevStep} nextStep={nextStep} />;
            case 5:
                return <NewStep5_Equipment hook={hook} prevStep={prevStep} nextStep={nextStep} />;
            case 6:
                return <NewStep6_Spells hook={hook} prevStep={prevStep} nextStep={nextStep} />;
            case 7:
                return <NewStep7_Feats hook={hook} prevStep={prevStep} nextStep={nextStep} />;
            case 8:
                return <NewStep8_Finalize hook={hook} prevStep={prevStep} handleFinalize={handleFinalizeAndSubmit} />;
            default:
                return <div>Etapa Inválida.</div>;
        }
    };

    return (
        <div ref={wizardRef} className="bg-stone-800/50 p-4 sm:p-6 rounded-lg border border-stone-700 w-full max-w-4xl mx-auto flex flex-col animate-fadeIn">
            <header className="flex justify-between items-center border-b border-stone-700 pb-4 mb-6">
                <h2 className="text-2xl font-bold font-garamond text-amber-300 text-shadow-amber">Criação de Personagem</h2>
                <button type="button" onClick={onBackToMenu} className="text-sm text-stone-400 hover:text-amber-400 transition-colors">
                    Voltar ao Menu
                </button>
            </header>

            <NewStepper currentStep={currentStep} totalSteps={totalSteps} />
            
            <main className="mt-6 flex-grow">
                {renderStep()}
            </main>
        </div>
    );
};

export default NewCharacterCreation;
