// Consulta ao snapshot SRD 2014 (data/srd) para estatísticas de criaturas e magias.
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { type Ability, norm, parseAbility, parseSkill } from "./rules.ts"
import { type Attack, defaultSheet, type Sheet } from "./world.ts"

function srdDir(): string {
  return process.env.DNDAI_SRD_DIR
    ? resolve(process.env.DNDAI_SRD_DIR)
    : resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "srd", "2014", "normalized")
}

const DAMAGE_TYPES: Record<string, string> = {
  acid: "ácido", bludgeoning: "contundente", cold: "frio", fire: "fogo", force: "energia", lightning: "elétrico",
  necrotic: "necrótico", piercing: "perfurante", poison: "veneno", psychic: "psíquico", radiant: "radiante",
  slashing: "cortante", thunder: "trovão",
}

const cache = new Map<string, Record<string, unknown>[]>()

function load(resource: string): Record<string, unknown>[] {
  if (!cache.has(resource)) {
    const file = resolve(srdDir(), `${resource}.json`)
    if (!existsSync(file)) throw new Error(`SRD indisponível: ${file} não existe (defina DNDAI_SRD_DIR).`)
    cache.set(resource, JSON.parse(readFileSync(file, "utf8")))
  }
  return cache.get(resource)!
}

export function searchSrd(resource: "monsters" | "spells", query: string): Record<string, unknown>[] {
  const q = norm(query)
  const items = load(resource)
  const exact = items.filter((m) => norm(String(m.index)) === q || norm(String(m.name)) === q)
  if (exact.length) return exact
  return items.filter((m) => norm(String(m.name)).includes(q) || norm(String(m.index)).includes(q)).slice(0, 10)
}

export interface CreatureStats {
  ac: number
  hp: number
  sheet: Sheet
  srdName: string
}

interface SrdMonster {
  index: string
  name: string
  armor_class: { value: number }[]
  hit_points: number
  hit_dice: string
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  proficiencies: { value: number; proficiency: { index: string } }[]
  proficiency_bonus: number
  xp: number
  speed: { walk?: string }
  actions?: { name: string; attack_bonus?: number; damage?: { damage_dice?: string; damage_type?: { name: string } }[] }[]
}

export function creatureFromSrd(query: string): CreatureStats {
  const found = searchSrd("monsters", query) as unknown as SrdMonster[]
  if (found.length !== 1) {
    throw new Error(found.length ? `"${query}" é ambíguo no SRD: ${found.map((m) => m.index).join(", ")}.` : `Criatura "${query}" não encontrada no SRD.`)
  }
  const m = found[0]
  const skills: string[] = []
  const saves: Ability[] = []
  for (const p of m.proficiencies) {
    const idx = p.proficiency.index
    if (idx.startsWith("skill-")) {
      const s = parseSkill(idx.slice(6))
      if (s) skills.push(s)
    } else if (idx.startsWith("saving-throw-")) {
      const a = parseAbility(idx.slice(13))
      if (a) saves.push(a)
    }
  }
  const attacks: Attack[] = (m.actions ?? [])
    .filter((a) => a.attack_bonus !== undefined && a.damage?.[0]?.damage_dice)
    .map((a) => ({ name: a.name, bonus: a.attack_bonus!, damage: a.damage![0].damage_dice!.replace(/\s+/g, ""), type: translateDamage(a.damage![0].damage_type?.name ?? "") }))
  const die = Number(/d(\d+)/.exec(m.hit_dice)?.[1] ?? 8)
  const count = Number(/^(\d+)/.exec(m.hit_dice)?.[1] ?? 1)
  const speed = Math.round((Number.parseInt(m.speed.walk ?? "30", 10) || 30) * 0.3)
  return {
    ac: m.armor_class[0]?.value ?? 10,
    hp: m.hit_points,
    srdName: m.name,
    sheet: defaultSheet({
      abilities: { for: m.strength, des: m.dexterity, con: m.constitution, int: m.intelligence, sab: m.wisdom, car: m.charisma },
      skills, saves, attacks, profBonus: m.proficiency_bonus, xpValue: m.xp, speed,
      hitDice: { die, max: count, used: 0 },
    }),
  }
}

function translateDamage(name: string): string {
  return DAMAGE_TYPES[name.toLowerCase()] ?? name
}
