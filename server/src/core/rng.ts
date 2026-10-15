// Gerador pseudoaleatório com semente (masmorras e encontros reproduzíveis).
import { randomInt } from "node:crypto"
import type { Rng } from "./dice.ts"

export function seeded(seed: number): Rng {
  let a = seed >>> 0
  return (sides) => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return 1 + Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * sides)
  }
}

export const newSeed = (): number => randomInt(1, 2 ** 31)

export const pick = <T>(rng: Rng, list: readonly T[]): T => list[rng(list.length) - 1]!
export const chance = (rng: Rng, pct: number): boolean => rng(100) <= pct
export function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) { const j = rng(i + 1) - 1; [a[i], a[j]] = [a[j]!, a[i]!] }
  return a
}
