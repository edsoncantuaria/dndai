// src/components/NewCreationCharacter/NewStepper.tsx
import React from 'react';

interface NewStepperProps {
    currentStep: number;
    totalSteps: number;
    highestStep: number;
    goToStep: (step: number) => void;
}

const NewStepper: React.FC<NewStepperProps> = ({ currentStep, totalSteps, highestStep, goToStep }) => {
    return (
        <div className="flex items-center justify-center w-full mb-8">
            <div className="flex items-center">
                {Array.from({ length: totalSteps }).map((_, index) => {
                    const step = index + 1;
                    const isCompleted = step < currentStep;
                    const isActive = step === currentStep;
                    const isReachable = step <= highestStep;

                    return (
                        <React.Fragment key={step}>
                            <div className="flex flex-col items-center">
                                <button
                                    onClick={() => isReachable && !isActive && goToStep(step)}
                                    disabled={!isReachable || isActive}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                                        isActive
                                            ? 'bg-amber-500 text-stone-900 scale-110'
                                            : isCompleted
                                            ? 'bg-green-700 text-white cursor-pointer hover:bg-green-600'
                                            : 'bg-stone-700 text-stone-400 opacity-50'
                                    } ${isReachable && !isActive ? 'cursor-pointer' : 'cursor-default'}`}
                                >
                                    {isCompleted ? '✔' : step}
                                </button>
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
