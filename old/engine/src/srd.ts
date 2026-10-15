// Consulta ao snapshot SRD 2014 (data/srd), incluindo as tabelas oficiais de progressão.
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { type Ability, norm, parseAbility, parseClass, parseSkill } from "./rules.ts"
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

export function loadSrd(resource: string): Record<string, unknown>[] {
  const file = resolve(srdDir(), `${resource}.json`)
  if (!cache.has(file)) {
    if (!existsSync(file)) throw new Error(`SRD indisponível: ${file} não existe (defina DNDAI_SRD_DIR).`)
    cache.set(file, JSON.parse(readFileSync(file, "utf8")))
  }
  return cache.get(file)!
}

function load(resource: string): Record<string, unknown>[] {
  return loadSrd(resource)
}

export const SRD_RESOURCES = {
  monster: "monsters", spell: "spells", feature: "features", subclass: "subclasses",
  race: "races", subrace: "subraces", feat: "feats", trait: "traits",
} as const

export type SrdResource = typeof SRD_RESOURCES[keyof typeof SRD_RESOURCES]

interface SrdRef { index: string; name: string }
export interface SrdLevel { level: number; features: SrdRef[]; class_specific?: Record<string, unknown> }
interface SrdClass extends SrdRef { levels: SrdLevel[] }
export interface SrdSubclass extends SrdClass { class: SrdRef }
export interface SrdFeature extends SrdRef {
  class: SrdRef
  subclass?: SrdRef
  level: number
  desc: string[]
  prerequisites: Record<string, unknown>[]
}

function classFromSrd(query: string): SrdClass | undefined {
  const key = parseClass(query)
  if (!key) return undefined
  return (load("classes") as unknown as SrdClass[]).find((c) => parseClass(c.index) === key)
}

export function getClassLevel(cls: string, level: number): SrdLevel {
  const row = classFromSrd(cls)?.levels.find((l) => l.level === level)
  if (!row) throw new Error(`Progressão SRD indisponível: ${cls} nível ${level}.`)
  return row
}

export function subclassesForClass(cls: string): SrdSubclass[] {
  const base = classFromSrd(cls)
  if (!base) throw new Error(`Classe "${cls}" não encontrada no SRD.`)
  return (load("subclasses") as unknown as SrdSubclass[]).filter((s) => s.class.index === base.index)
}

export function searchSrd(resource: SrdResource, query: string): Record<string, unknown>[] {
  const q = norm(query)
  const items = load(resource)
  const exact = items.filter((m) => norm(String(m.index)) === q || norm(String(m.name)) === q)
  if (exact.length) return exact
  if (resource === "subclasses") {
    const cls = classFromSrd(query)
    if (cls) return items.filter((s) => (s.class as SrdRef).index === cls.index)
  }
  return items.filter((m) => norm(String(m.name)).includes(q) || norm(String(m.index)).includes(q)).slice(0, 10)
}

/** Só habilidades concedidas neste nível; escolhas opcionais não são concedidas automaticamente. */
export function getFeaturesForLevel(cls: string, subclass: string | null, level: number): SrdFeature[] {
  if (!Number.isInteger(level) || level < 1 || level > 20) throw new Error("Nível SRD deve ser inteiro de 1 a 20.")
  const base = classFromSrd(cls)
  if (!base) throw new Error(`Classe "${cls}" não encontrada no SRD.`)
  const refs = [...(base.levels.find((l) => l.level === level)?.features ?? [])]
  if (subclass) {
    const found = searchSrd("subclasses", subclass) as unknown as SrdSubclass[]
    if (found.length !== 1) throw new Error(`Subclasse "${subclass}" não encontrada ou ambígua no SRD.`)
    const sub = found[0]
    if (sub.class.index !== base.index) throw new Error(`Subclasse "${sub.name}" não pertence a ${base.name}.`)
    refs.push(...(sub.levels.find((l) => l.level === level)?.features ?? []))
  }
  const features = load("features") as unknown as SrdFeature[]
  return [...new Set(refs.map((ref) => ref.index))].map((index) => {
    const feature = features.find((f) => f.index === index)
    if (!feature) throw new Error(`Habilidade "${index}" ausente no snapshot SRD.`)
    return feature
  })
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
