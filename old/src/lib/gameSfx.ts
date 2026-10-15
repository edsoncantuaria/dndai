/** Efeitos sonoros de UI/eventos (Kenney Interface Sounds, CC0). */
export type GameSfxId =
  | 'xp'
  | 'loot'
  | 'relationshipUp'
  | 'relationshipDown'
  | 'shop'
  | 'hpLoss'
  | 'hpGain'
  | 'resourceUse'
  | 'diceRoll'
  | 'diceCritical'
  | 'diceFailure';

export const GAME_SFX_URLS: Record<GameSfxId, string> = {
  diceRoll: '/audios/sfx/dice-roll.ogg',
  diceCritical: '/audios/sfx/dice-critical.ogg',
  diceFailure: '/audios/sfx/dice-failure.ogg',
  xp: '/audios/sfx/xp.ogg',
  loot: '/audios/sfx/loot.ogg',
  relationshipUp: '/audios/sfx/relationship-up.ogg',
  relationshipDown: '/audios/sfx/relationship-down.ogg',
  shop: '/audios/sfx/shop.ogg',
  hpLoss: '/audios/sfx/hp-loss.ogg',
  hpGain: '/audios/sfx/hp-gain.ogg',
  resourceUse: '/audios/sfx/resource-use.ogg',
};

/** Volume relativo ao slider global (SFX não devem dominar a trilha). */
export const GAME_SFX_VOLUME_SCALE = 0.72;
