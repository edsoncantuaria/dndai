// src/components/NewCreationCharacter/NewStep5_Equipment.tsx
import React from 'react';
import { ApiClass, ApiBackground, InventoryItem } from '../../types';
import NewEquipment from './NewEquipment';

interface Props {
    classDetails: ApiClass | null;
    backgroundDetails: ApiBackground | null;
    prevStep: () => void;
    nextStep: () => void;
    setFinalizedEquipment: (inventory: InventoryItem[]) => void;
}

const NewStep5_Equipment: React.FC<Props> = ({ classDetails, backgroundDetails, prevStep, nextStep, setFinalizedEquipment }) => {
    return (
        <NewEquipment 
            classDetails={classDetails}
            backgroundDetails={backgroundDetails}
            prevStep={prevStep}
            nextStep={nextStep}
            onEquipmentFinalized={setFinalizedEquipment}
        />
    );
};

export default NewStep5_Equipment;
