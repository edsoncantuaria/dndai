import type { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';

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
      return (
        hook.attributeMethod !== null &&
        (!hook.isVariantHuman || hook.variantHumanBonusSelections.length === 2)
      );
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
  return getStepCompleteness(step, hook);
}
