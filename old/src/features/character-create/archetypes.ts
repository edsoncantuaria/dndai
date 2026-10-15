import type { LucideIcon } from 'lucide-react';
import { Shield, Sparkles, Swords, Wand2 } from 'lucide-react';
import type { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import * as DndApiService from '@/services/dndApiService';

export type ArchetypeDef = {
  id: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
  race: string;
  subrace?: string;
  class: string;
  background: string;
};

/** Presets curados — índices SRD em inglês (API padrão). */
export const CHARACTER_ARCHETYPES: ArchetypeDef[] = [
  {
    id: 'frontline-fighter',
    name: 'Guerreiro de linha de frente',
    tagline: 'Humano resistente, armadura pesada e espada longa.',
    icon: Shield,
    race: 'human',
    class: 'fighter',
    background: 'soldier',
  },
  {
    id: 'urban-rogue',
    name: 'Ladino das sombras',
    tagline: 'Halfling ágil, furtividade e ferramentas de ladrão.',
    icon: Swords,
    race: 'halfling',
    class: 'rogue',
    background: 'criminal',
  },
  {
    id: 'healer-cleric',
    name: 'Clérigo curador',
    tagline: 'Anão devoto, armadura e magias de suporte.',
    icon: Sparkles,
    race: 'dwarf',
    class: 'cleric',
    background: 'acolyte',
  },
  {
    id: 'scholar-wizard',
    name: 'Mago erudito',
    tagline: 'Alto elfo, grimório e conhecimento arcano.',
    icon: Wand2,
    race: 'elf',
    subrace: 'high-elf',
    class: 'wizard',
    background: 'sage',
  },
];

export async function applyArchetype(
  archetype: ArchetypeDef,
  hook: ReturnType<typeof useCharacterCreator>,
): Promise<void> {
  await hook.handleRaceChange(archetype.race);

  if (archetype.subrace) {
    await hook.handleSubraceChange(archetype.subrace);
  } else {
    try {
      const raceData = await DndApiService.getRaceDetails(archetype.race);
      if (raceData?.subraces?.length === 1) {
        await hook.handleSubraceChange(raceData.subraces[0].index);
      }
    } catch {
      /* sub-raça opcional */
    }
  }

  await hook.handleClassChange(archetype.class);
  await hook.handleBackgroundChange(archetype.background);
}
