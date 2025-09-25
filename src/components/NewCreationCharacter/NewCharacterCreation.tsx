'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';
import { useGameStateContext } from '@/contexts/GameStateContext';
import type { ApiListItem } from '@/types';
import NewStep1_RaceClass from './NewStep1_RaceClass';
import NewStepper from './NewStepper';
import NewStep2_Attributes from './NewStep2_Attributes';
import NewStep3_Background from './NewStep3_Background';
import NewStep4_ProficienciesAndLanguages from './NewStep4_ProficienciesAndLanguages';
import NewStep5_Equipment from './NewStep5_Equipment';
import NewStep6_Spells from '../Spells/NewStep6_Spells';
import NewStep8_Finalize from './NewStep8_Finalize';
import ConfirmationModal from '../ui/ConfirmationModal';

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
    const hook = useNewCharacterCreation({ allLanguages: allLanguages || [] });
    const [currentStep, setCurrentStep] = useState(1);
    const [highestStep, setHighestStep] = useState(1);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const totalSteps = 7; 
    const wizardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (wizardRef.current) {
            wizardRef.current.scrollTo(0, 0);
        }
    }, [currentStep]);

    const nextStep = () => {
        const next = Math.min(currentStep + 1, totalSteps);
        setCurrentStep(next);
        setHighestStep(Math.max(highestStep, next));
    }
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
    const goToStep = (step: number) => {
        if (step <= highestStep && step >= 1) {
            setCurrentStep(step);
        }
    };
    
    const handleFinalizeAndSubmit = async () => {
        const finalCharacterData = hook.buildCharacter();
        if (finalCharacterData) {
            setShowConfirmationModal(false);
            await createCharacter(finalCharacterData);
            // A transição para a tela do jogo será gerenciada pelo GameStateContext
        } else {
            console.error("Não foi possível finalizar a criação do personagem. Dados incompletos.");
            setShowConfirmationModal(false);
            // Idealmente, mostrar um erro para o usuário aqui.
        }
    };

    const promptFinalize = () => {
        if (hook.isComplete) {
            setShowConfirmationModal(true);
        }
    }

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return <NewStep1_RaceClass hook={hook} nextStep={nextStep} races={races} classes={classes} />;
            case 2:
                return <NewStep2_Attributes hook={hook} prevStep={prevStep} nextStep={nextStep} />;
            case 3:
                return <NewStep3_Background hook={hook} backgrounds={backgrounds} alignments={alignments} prevStep={prevStep} nextStep={nextStep} />;
            case 4:
                return <NewStep4_ProficienciesAndLanguages hook={hook} prevStep={prevStep} nextStep={nextStep} />;
            case 5:
                return <NewStep5_Equipment hook={hook} prevStep={prevStep} nextStep={nextStep} />;
            case 6:
                return <NewStep6_Spells hook={hook} prevStep={prevStep} nextStep={nextStep} />;
            case 7:
                return <NewStep8_Finalize hook={hook} prevStep={prevStep} handleFinalize={promptFinalize} />;
            default:
                return <div>Etapa Inválida.</div>;
        }
    };

    return (
        <div ref={wizardRef} className="bg-stone-800/50 p-4 sm:p-6 rounded-lg border border-stone-700 w-full max-w-4xl mx-auto flex flex-col animate-fadeIn max-h-[90vh] overflow-y-auto">
            <header className="flex justify-between items-center border-b border-stone-700 pb-4 mb-6">
                <h2 className="text-2xl font-bold font-garamond text-amber-300 text-shadow-amber">Criação de Personagem</h2>
                <button type="button" onClick={onBackToMenu} className="text-sm text-stone-400 hover:text-amber-400 transition-colors">
                    Voltar ao Menu
                </button>
            </header>

            <NewStepper currentStep={currentStep} totalSteps={totalSteps} highestStep={highestStep} goToStep={goToStep} />
            
            <main className="mt-6 flex-grow">
                {renderStep()}
            </main>

            <ConfirmationModal
                isOpen={showConfirmationModal}
                title="Iniciar Aventura?"
                message={`Você está prestes a começar sua jornada como ${hook.name || 'um herói sem nome'}. Uma vez iniciada, a história não poderá ser alterada. Deseja continuar?`}
                onConfirm={handleFinalizeAndSubmit}
                onCancel={() => setShowConfirmationModal(false)}
                confirmText="Sim, iniciar aventura!"
                cancelText="Não, voltar"
            />
        </div>
    );
};

export default NewCharacterCreation;
