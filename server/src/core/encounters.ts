// Encontros por orçamento de XP (regra da casa inspirada no DMG 2024): o motor monta o grupo com monstros do SRD,
// sem passar do orçamento do nível. Temas ligam o tipo de lugar aos tipos de criatura.
import type { Srd } from "../srd/index.ts"
import type { Rng } from "./dice.ts"
import { pick } from "./rng.ts"

export const DIFFICULTIES = ["baixa", "moderada", "alta"] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

/** XP por personagem: [baixa, moderada, alta], por nível 1–20. */
export const XP_BUDGET: Record<number, [number, number, number]> = {
  1: [50, 75, 100], 2: [100, 150, 200], 3: [150, 225, 400], 4: [250, 375, 500], 5: [500, 750, 1100], 6: [600, 1000, 1400], 7: [750, 1300, 1700],
  8: [1000, 1700, 2100], 9: [1300, 2000, 2600], 10: [1600, 2300, 3100], 11: [1900, 2900, 4100], 12: [2200, 3700, 4700], 13: [2600, 4200, 5400],
  14: [2900, 4900, 6200], 15: [3300, 5400, 7800], 16: [3800, 6100, 9800], 17: [4500, 7200, 11700], 18: [5000, 8700, 14200], 19: [5500, 10700, 17200], 20: [6400, 13200, 22000],
}

export const THEME_TYPES: Record<string, string[]> = {
  cripta: ["undead"], caverna: ["beast", "monstrosity", "humanoid", "giant"], ruina: ["undead", "construct", "humanoid", "monstrosity"],
  "torre-arcana": ["construct", "aberration", "elemental"], esgoto: ["ooze", "beast", "humanoid", "monstrosity"], "ninho-de-dragao": ["dragon", "humanoid", "monstrosity"],
  "bosque-feerico": ["fey", "plant", "beast"], abismo: ["fiend", "undead"], "templo-esquecido": ["celestial", "monstrosity", "undead", "construct"],
  "mina-ana": ["humanoid", "construct", "elemental", "monstrosity", "giant"], estrada: ["beast", "humanoid", "monstrosity"], floresta: ["beast", "plant", "fey", "monstrosity"],
  montanha: ["beast", "giant", "monstrosity", "dragon"], pantano: ["beast", "ooze", "undead", "plant", "monstrosity"], deserto: ["beast", "monstrosity", "undead", "elemental"],
  mar: ["beast", "monstrosity", "elemental"],
}

export interface Member { srd: string; name: string; cr: number; xp: number; count: number }
export interface Encounter { level: number; party: number; difficulty: Difficulty; budget: number; total: number; group: Member[] }

export const partyBudget = (level: number, difficulty: Difficulty, party = 1): number => XP_BUDGET[Math.max(1, Math.min(20, level))]![DIFFICULTIES.indexOf(difficulty)]! * Math.max(1, party)

interface Cand { index: string; name: string; cr: number; xp: number; type: string }

const cache = new WeakMap<Srd, Cand[]>()

function candidates(srd: Srd, types: string[]): Cand[] {
  let base = cache.get(srd)
  if (!base) {
    base = srd.list("monsters", "en").filter((m) => Number(m.xp) > 0)
      .map((m) => ({ index: m.index, name: srd.get("monsters", m.index)?.name ?? m.name, cr: Number(m.challenge_rating), xp: Number(m.xp), type: String(m.type).toLowerCase() }))
    cache.set(srd, base)
  }
  return base.filter((m) => !types.length || types.some((t) => m.type.startsWith(t)))
}

/** Monta um grupo de monstros do SRD cujo XP somado cabe no orçamento (e usa a maior parte dele). */
export function buildEncounter(srd: Srd, rng: Rng, o: { level: number; party?: number; difficulty?: Difficulty; types?: string[]; maxCreatures?: number }): Encounter {
  const party = o.party ?? 1
  const difficulty = o.difficulty ?? "moderada"
  const budget = partyBudget(o.level, difficulty, party)
  const maxN = o.maxCreatures ?? 8
  const themed = candidates(srd, o.types ?? [])
  const all = candidates(srd, [])
  const fit = (pool: Cand[], min: number, max: number) => pool.filter((c) => c.xp >= min && c.xp <= max)
  // Âncora: o monstro principal, entre ~30% e 100% do orçamento; se o tema não tem, amplia para qualquer tipo.
  // Se o tema não tem criatura à altura do orçamento (ex.: fadas de ND 15), o líder vem de qualquer tipo.
  let pool = fit(themed, budget * 0.3, budget)
  if (!pool.length) pool = fit(all, budget * 0.3, budget)
  if (!pool.length) pool = all.filter((c) => c.xp <= budget).sort((a, b) => b.xp - a.xp).slice(0, 6)
  const anchor = pick(rng, pool)
  const group = new Map<string, Member>()
  const add = (c: Cand) => {
    const g = group.get(c.index)
    if (g) g.count++
    else group.set(c.index, { srd: c.index, name: c.name, cr: c.cr, xp: c.xp, count: 1 })
  }
  add(anchor)
  let total = anchor.xp
  let creatures = 1
  // Acompanhantes: do mesmo tema, mais fracos que a âncora, até esgotar o orçamento ou o limite de criaturas.
  for (let guard = 0; guard < 40 && creatures < maxN; guard++) {
    const left = budget - total
    let sub = fit(themed, left * 0.25, left).filter((c) => c.xp <= anchor.xp)
    if (!sub.length) sub = fit(themed, 1, left)
    if (!sub.length) break
    const c = pick(rng, sub)
    add(c); total += c.xp; creatures++
  }
  return { level: o.level, party, difficulty, budget, total, group: [...group.values()] }
}

export function describeEncounter(e: Encounter): string {
  return e.group.map((m) => `${m.count}× ${m.name} (ND ${m.cr})`).join(", ")
}
