import type { GameStage } from '@/types/gameStage';

/** Trilha calma do hub (biblioteca medieval). */
export const HUB_AMBIENT_SOUND_ID = 'medieval_library';

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
