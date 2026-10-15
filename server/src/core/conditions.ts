// Efeitos das condições do SRD 2024 sobre testes de d20 (vantagem/desvantagem, falha automática,
// crítico em corpo a corpo, exaustão) e dos estados temporários do personagem (Fúria).
import type { Ability } from "./sheet.ts"

export type Mode = "normal" | "vantagem" | "desvantagem"

export interface CreatureState {
  conditions: string[]
  exhaustion: number
  /** Estados temporários (notes): raging etc. */
  raging?: boolean
}

export interface D20Mods {
  adv: string[]
  dis: string[]
  /** Penalidade fixa ao total (exaustão: −2 por nível). */
  penalty: number
  autoFail?: string
  /** Acerto em corpo a corpo é crítico (alvo paralisado/inconsciente/petrificado a 1,5 m). */
  critMelee?: string
}

const has = (s: CreatureState, c: string): boolean => s.conditions.includes(c)

/** Ataque de `a` contra `t`. `ranged` = ataque à distância. */
export function attackMods(a: CreatureState, t: CreatureState, ranged: boolean): D20Mods {
  const m: D20Mods = { adv: [], dis: [], penalty: 2 * a.exhaustion }
  for (const c of ["blinded", "frightened", "poisoned", "prone", "restrained"]) if (has(a, c)) m.dis.push(`atacante ${c}`)
  if (has(a, "invisible")) m.adv.push("atacante invisible")
  for (const c of ["blinded", "paralyzed", "petrified", "restrained", "stunned", "unconscious"]) if (has(t, c)) m.adv.push(`alvo ${c}`)
  if (has(t, "invisible")) m.dis.push("alvo invisible")
  if (has(t, "prone")) (ranged ? m.dis : m.adv).push(`alvo prone (${ranged ? "à distância" : "corpo a corpo"})`)
  if (!ranged) for (const c of ["paralyzed", "unconscious"]) if (has(t, c)) m.critMelee = `alvo ${c}`
  return m
}

export function checkMods(s: CreatureState, ability: Ability | undefined): D20Mods {
  const m: D20Mods = { adv: [], dis: [], penalty: 2 * s.exhaustion }
  for (const c of ["poisoned", "frightened"]) if (has(s, c)) m.dis.push(c)
  if (s.raging && ability === "str") m.adv.push("Fúria (Força)")
  return m
}

export function saveMods(s: CreatureState, ability: Ability): D20Mods {
  const m: D20Mods = { adv: [], dis: [], penalty: 2 * s.exhaustion }
  if (ability === "str" || ability === "dex") for (const c of ["paralyzed", "petrified", "stunned", "unconscious"]) if (has(s, c)) m.autoFail = c
  if (ability === "dex" && has(s, "restrained")) m.dis.push("restrained")
  if (s.raging && ability === "str") m.adv.push("Fúria (Força)")
  return m
}

/** Junta o modo pedido pelo Mestre com os efeitos calculados: vantagem e desvantagem se anulam. */
export function resolveMode(asked: Mode, m: D20Mods): { mode: Mode; why: string[] } {
  const adv = m.adv.length + Number(asked === "vantagem")
  const dis = m.dis.length + Number(asked === "desvantagem")
  const why = [...m.adv.map((x) => `vantagem: ${x}`), ...m.dis.map((x) => `desvantagem: ${x}`)]
  if (asked !== "normal") why.unshift(`${asked} pedida`)
  return { mode: adv > 0 && dis > 0 ? "normal" : adv > 0 ? "vantagem" : dis > 0 ? "desvantagem" : "normal", why }
}
