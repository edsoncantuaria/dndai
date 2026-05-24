/**
 * Imagens locais em /public/assets/cinematic (Magnific/Freepik free — ver ATTRIBUTION.md).
 */

export const CINEMATIC_BASE = '/assets/cinematic';

export const cinematicImages = {
  finalBattle: `${CINEMATIC_BASE}/greet-final-battle.jpg`,
  spookyCastle: `${CINEMATIC_BASE}/spooky-castle.jpg`,
  rpgStillLife: `${CINEMATIC_BASE}/rpg-still-life.jpg`,
} as const;

export type CinematicImageKey = keyof typeof cinematicImages;

export type NarrativeBeatVisual = 'narration' | 'combat' | 'insight' | 'system' | 'action' | 'roll' | 'image';

const beatByType: Record<NarrativeBeatVisual, string> = {
  narration: cinematicImages.finalBattle,
  combat: cinematicImages.spookyCastle,
  insight: cinematicImages.rpgStillLife,
  system: cinematicImages.finalBattle,
  action: cinematicImages.rpgStillLife,
  roll: cinematicImages.rpgStillLife,
  image: cinematicImages.finalBattle,
};

export const introSlides = [
  {
    image: cinematicImages.finalBattle,
    imageAlt: 'Herói diante da fortaleza e dragões — batalha final',
  },
  {
    image: cinematicImages.spookyCastle,
    imageAlt: 'Guerreiro diante de um castelo sombrio',
  },
  {
    image: cinematicImages.rpgStillLife,
    imageAlt: 'Mesa de RPG — ficha, dados e pedras',
  },
] as const;

export function getBeatImage(type: NarrativeBeatVisual): string {
  return beatByType[type] ?? cinematicImages.finalBattle;
}

export const beatChapterLabel: Record<NarrativeBeatVisual, string> = {
  narration: 'Narração',
  combat: 'Combate',
  insight: 'Vislumbre',
  system: 'Mestre',
  action: 'Ação',
  roll: 'Rolagem',
  image: 'Cena',
};
