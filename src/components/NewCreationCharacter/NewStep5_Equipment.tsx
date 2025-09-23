// src/components/NewCreationCharacter/NewStep5_Equipment.tsx
import React from 'react';
import { ApiClass, ApiBackground } from '../../types';
import { useNewEquipment } from '../../hooks/newUseEquipment';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';
import NewEquipment from './NewEquipment';
import { Icons } from '../Icons';

interface Props {
    classDetails: ApiClass | null;
    backgroundDetails: ApiBackground | null;
    prevStep: () => void;
    nextStep: () => void;
    setFinalizedEquipment: ReturnType<typeof useNewCharacterCreation>['setFinalizedEquipment'];
}

const NewStep5_Equipment: React.FC<Props> = ({ classDetails, backgroundDetails, prevStep, nextStep, setFinalizedEquipment }) => {
    const equipmentHook = useNewEquipment(classDetails, backgroundDetails);
    
    const handleNext = () => {
        setFinalizedEquipment(equipmentHook.finalInventory);
        nextStep();
    };

    return (
        <div className="space-y-8 animate-fadeIn">
             <NewEquipment 
                hook={equipmentHook}
            />

            <div className="flex justify-between pt-8">
                <button type="button" onClick={prevStep} className="menu-button btn-import max-w-xs">
                    <Icons.Play className="h-6 w-6 mr-3 transform rotate-90 scale-y-150" />
                    Voltar
                </button>
                <button type="button" onClick={handleNext} disabled={!equipmentHook.isEquipmentComplete} className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed">
                    {equipmentHook.isEquipmentComplete ? 'Avançar' : 'Faça suas escolhas'}
                    <Icons.Play className="h-6 w-6 ml-3 transform -rotate-90 scale-y-150" />
                </button>
            </div>
        </div>
    );
};

export default NewStep5_Equipment;
