// src/components/NewCreationCharacter/NewStep7_Finalize.tsx
import React from 'react';
import { Icons } from '../Icons';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';

interface Props {
    name: ReturnType<typeof useNewCharacterCreation>['name'];
    setName: ReturnType<typeof useNewCharacterCreation>['setName'];
    isComplete: ReturnType<typeof useNewCharacterCreation>['isComplete'];
    prevStep: () => void;
    handleFinalize: () => void;
}

const NewStep7_Finalize: React.FC<Props> = ({
    name,
    setName,
    isComplete,
    prevStep,
    handleFinalize,
}) => {
    return (
        <div className="space-y-8 animate-fadeIn flex flex-col items-center text-center">
            <div>
                <h3 className="text-xl font-semibold text-stone-300 mb-2">O Toque Final</h3>
                <p className="text-sm text-stone-400 mb-6">Seu herói está quase pronto. Dê a ele um nome digno de lendas.</p>
            </div>
            
            <div className="w-full max-w-md">
                <label htmlFor="character-name" className="sr-only">Nome do Personagem</label>
                <input
                    type="text"
                    id="character-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Digite o nome do seu personagem"
                    className="w-full bg-stone-900/70 border-2 border-stone-600 rounded-lg p-4 text-stone-100 text-2xl text-center font-bold font-garamond focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                />
            </div>

            <div className="flex justify-center gap-4 pt-8 w-full">
                <button
                    type="button"
                    onClick={prevStep}
                    className="menu-button btn-import max-w-xs"
                >
                    <Icons.Play className="h-6 w-6 mr-3 transform rotate-90 scale-y-150" />
                    Voltar
                </button>
                <button
                    type="button"
                    onClick={handleFinalize}
                    disabled={!isComplete}
                    className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isComplete ? 'Iniciar Aventura' : 'Preencha os campos'}
                    <Icons.Play className="h-6 w-6 ml-3 transform -rotate-90 scale-y-150" />
                </button>
            </div>
        </div>
    );
};

export default NewStep7_Finalize;
