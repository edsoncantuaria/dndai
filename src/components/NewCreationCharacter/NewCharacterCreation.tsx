// src/components/NewCreationCharacter/NewCharacterCreation.tsx
// Este é o componente orquestrador do novo "Wizard" de criação de personagem.
// Ele gerencia o estado da etapa atual e passa os dados e funções necessárias para cada etapa.
// A lógica principal (o "cérebro") é consumida diretamente do hook `useCharacterCreation`.

'use client';
import React, { useState } from 'react';
import { useCharacterCreation } from '@/hooks/useCharacterCreation';
import { ApiListItem } from '@/types';
import NewStep1_RaceClass from './NewStep1_RaceClass';
import NewStepper from './NewStepper';
import NewStep2_Attributes from './NewStep2_Attributes';


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
    const hook = useCharacterCreation();
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 7; // Definindo o número total de etapas

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
    
    // Simplesmente para evitar passar a prop `hook` para todos os componentes
    const commonProps = {
        ...hook,
        nextStep,
        prevStep,
    };

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return <NewStep1_RaceClass {...commonProps} races={races} classes={classes} />;
            case 2:
                return <NewStep2_Attributes {...commonProps} />;
            // Outros steps virão aqui no futuro
            // case 3:
            //     return <NewStep3_Background {...commonProps} />;
            default:
                return <div>Etapa {currentStep} em construção.</div>;
        }
    };

    return (
        <div className="bg-stone-800/50 p-4 sm:p-6 rounded-lg border border-stone-700 w-full max-w-4xl mx-auto flex flex-col animate-fadeIn">
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
