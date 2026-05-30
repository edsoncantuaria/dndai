import type { GameStage } from '@/types/gameStage';

/** Trilha calma do hub — alvorecer fantástico (par com menu music). */
export const HUB_AMBIENT_SOUND_ID = 'middle_earth_dawn';

const HUB_STAGES: GameStage[] = [
  'loading',
  'main_menu',
  'session_list',
  'character_vault',
  'creating_character',
  'homebrew_store',
  'translation_studio',
];

export function isHubGameStage(stage: GameStage): boolean {
  return HUB_STAGES.includes(stage);
}

export function isGameplayStage(stage: GameStage): boolean {
  return stage === 'playing';
}
