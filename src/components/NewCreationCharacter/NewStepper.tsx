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
        <div className="flex items-center justify-center w-full mb-8 overflow-x-auto pb-2">
            <div className="flex items-center">
                {Array.from({ length: totalSteps }).map((_, index) => {
                    const step = index + 1;
                    const isCompleted = step < highestStep;
                    const isActive = step === currentStep;
                    const isReachable = step <= highestStep;

                    return (
                        <React.Fragment key={step}>
                            <div className="flex flex-col items-center flex-shrink-0">
                                <button
                                    onClick={() => isReachable && !isActive && goToStep(step)}
                                    disabled={!isReachable || isActive}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                                        isActive
                                            ? 'bg-amber-500 text-stone-900 scale-110 shadow-lg shadow-amber-500/30'
                                            : isReachable
                                            ? 'bg-stone-600 text-stone-200 cursor-pointer hover:bg-amber-700'
                                            : 'bg-stone-800 text-stone-500'
                                    } ${!isReachable || isActive ? 'cursor-default' : ''}`}
                                >
                                    {isCompleted ? '✔' : step}
                                </button>
                            </div>
                            {step < totalSteps && (
                                <div
                                    className={`flex-auto border-t-2 transition-all duration-300 mx-1 w-4 sm:w-8 md:w-12 ${
                                        step < currentStep ? 'border-amber-500' : 'border-stone-700'
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
