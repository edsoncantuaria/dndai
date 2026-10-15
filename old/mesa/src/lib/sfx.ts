import { asset } from "./asset"

// Efeitos sonoros curtos (Kenney, CC0) copiados de public/audios/sfx do projeto antigo.
export type Cue = "diceRoll" | "diceCritical" | "diceFailure" | "success" | "hpLoss" | "hpGain" | "loot" | "coins" | "use" | "tension"

const FILES: Record<Cue, string> = {
  diceRoll: "audios/sfx/dice-roll.ogg",
  diceCritical: "audios/sfx/dice-critical.ogg",
  diceFailure: "audios/sfx/dice-failure.ogg",
  success: "audios/sfx/xp.ogg",
  hpLoss: "audios/sfx/hp-loss.ogg",
  hpGain: "audios/sfx/hp-gain.ogg",
  loot: "audios/sfx/loot.ogg",
  coins: "audios/sfx/shop.ogg",
  use: "audios/sfx/resource-use.ogg",
  tension: "audios/sfx/relationship-down.ogg",
}

let enabled = true
export const setSfxEnabled = (on: boolean) => {
  enabled = on
}

export function playCue(cue: Cue) {
  if (!enabled) return
  const audio = new Audio(asset(FILES[cue]))
  audio.volume = 0.55
  audio.play().catch(() => {
    /* autoplay bloqueado até a primeira interação: ignorar */
  })
}
