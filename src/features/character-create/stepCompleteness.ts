import type { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import type { Attributes } from '@/types';

type AttributesCompletionInput = {
  attributeMethod: 'point-buy' | 'roll' | null;
  rollSessionId: string | null;
  points: number;
  baseAttributes: Attributes;
  isVariantHuman: boolean;
  variantHumanBonusSelections: (keyof Attributes)[];
};

export function areAttributesCompleteFromState(input: AttributesCompletionInput): boolean {
  if (!input.attributeMethod) return false;
  if (input.isVariantHuman && input.variantHumanBonusSelections.length !== 2) return false;
  if (input.attributeMethod === 'point-buy') return input.points === 0;
  if (input.attributeMethod === 'roll') {
    return Object.values(input.baseAttributes).some((value) => value !== 8);
  }
  return false;
}

export function areAttributesComplete(hook: ReturnType<typeof useCharacterCreator>): boolean {
  return areAttributesCompleteFromState({
    attributeMethod: hook.attributeMethod,
    rollSessionId: hook.rollSessionId,
    points: hook.points,
    baseAttributes: hook.baseAttributes,
    isVariantHuman: hook.isVariantHuman,
    variantHumanBonusSelections: hook.variantHumanBonusSelections,
  });
}

export function getStepCompleteness(
  step: number,
  hook: ReturnType<typeof useCharacterCreator>
): boolean {
  switch (step) {
    case 1: {
      const needsSubrace = (hook.details?.raceDetails?.subraces?.length ?? 0) > 0;
      return !!hook.race && !!hook.characterClass && (!needsSubrace || !!hook.subrace);
    }
    case 2:
      return areAttributesComplete(hook);
    case 3:
      return (
        !!hook.background &&
        !!hook.alignment &&
        !!hook.ideal &&
        !!hook.bond &&
        !!hook.flaw &&
        hook.personalityTraits.length > 0
      );
    case 4:
      return hook.canProceedFromProficiencies;
    case 5:
      return hook.areAllEquipmentChoicesMade;
    case 6:
      return hook.areClassSpellsSelected && hook.areRacialSpellsSelected;
    case 7:
      return !hook.isVariantHuman || !!hook.selectedFeat;
    case 8:
      return hook.isComplete;
    default:
      return false;
  }
}

export function canProceedFromStep(
  step: number,
  hook: ReturnType<typeof useCharacterCreator>
): boolean {
  if (step === 6) {
    const hasClassSpells = hook.cantripsKnown > 0 || hook.spellsKnown > 0;
    const hasRacial = (hook.racialSpellTraits || []).length > 0;
    if (!hasClassSpells && !hasRacial) return true;
  }
  if (step === 7 && !hook.isVariantHuman) return true;
  if (step === 2) return areAttributesComplete(hook);
  return getStepCompleteness(step, hook);
}
