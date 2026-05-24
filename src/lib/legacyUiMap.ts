/**
 * Referência estática legado → v2 (ferramentas, docs, busca no repo).
 * @see docs/legacy-ui.md
 */
export const LEGACY_UI_REPLACEMENTS = {
  GameMenuContentLegacy: 'features/hub/HubShell',
  GameScreenLegacy: 'features/gameplay/GameplayScreen',
  NewCharacterCreation: 'features/character-create/CharacterCreationWizard',
  HomebrewStoreFullscreen: 'features/homebrew/HomebrewStorePage',
  TranslationStudioLegacy: 'features/homebrew/TranslationStudioPage',
  LegacyCombatTracker: 'features/gameplay/combat/GameplayCombatTracker',
} as const;
