// src/components/NewCreationCharacter/NewStepper.tsx
// Um componente de UI para exibir o progresso no "wizard" de criação.
// É puramente visual e não contém lógica de negócio.

import React from 'react';

interface NewStepperProps {
    currentStep: number;
    totalSteps: number;
}

const NewStepper: React.FC<NewStepperProps> = ({ currentStep, totalSteps }) => {
    return (
        <div className="flex items-center justify-center w-full mb-8">
            <div className="flex items-center">
                {Array.from({ length: totalSteps }).map((_, index) => {
                    const step = index + 1;
                    const isCompleted = step < currentStep;
                    const isActive = step === currentStep;

                    return (
                        <React.Fragment key={step}>
                            <div className="flex flex-col items-center">
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                                        isActive
                                            ? 'bg-amber-500 text-stone-900 scale-110'
                                            : isCompleted
                                            ? 'bg-green-700 text-white'
                                            : 'bg-stone-700 text-stone-400'
                                    }`}
                                >
                                    {isCompleted ? '✔' : step}
                                </div>
                            </div>
                            {step < totalSteps && (
                                <div
                                    className={`flex-auto border-t-2 transition-all duration-300 mx-2 w-8 sm:w-12 ${
                                        isCompleted || isActive ? 'border-amber-500' : 'border-stone-600'
                                    }`}
                                ></div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default NewStepper;
