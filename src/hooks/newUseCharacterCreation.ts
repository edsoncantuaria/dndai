// hooks/newUseCharacterCreation.ts
// This file is now a wrapper for the new modular hook structure.
// This keeps imports in other files consistent while the refactoring is settled.
import { useCharacterCreator } from './useCharacterCreator';
import type { ApiListItem } from '@/types';

// REVALIDATE START: Re-exporting the new hook under the old name for compatibility
export const useNewCharacterCreation = ({ allLanguages }: { allLanguages: ApiListItem[] }) => {
    // The new hook `useCharacterCreator` contains all the refactored logic.
    // We simply call it here and return its result.
    return useCharacterCreator({ allLanguages });
};
// REVALIDATE END

export type { ProficiencyChoiceWithSource, EquipmentChoiceGroup } from './useCharacterCreator';
