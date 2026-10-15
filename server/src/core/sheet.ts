// Ficha 2024 e valores derivados. Tudo que depende de regra lê o SRD (srd.db); aqui só ficam
// as fórmulas do jogo (modificador, CA, ataque, CD), que o SRD descreve em texto, não em dados.
import { z } from "zod"
import type { Srd } from "../srd/index.ts"

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const
export type Ability = (typeof ABILITIES)[number]
export const ABILITY_PT: Record<Ability, string> = { str: "Força", dex: "Destreza", con: "Constituição", int: "Inteligência", wis: "Sabedoria", cha: "Carisma" }

export const XP_TABLE = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000]

const abilityScores = z.object({ str: z.number().int().min(1).max(30), dex: z.number().int().min(1).max(30), con: z.number().int().min(1).max(30), int: z.number().int().min(1).max(30), wis: z.number().int().min(1).max(30), cha: z.number().int().min(1).max(30) }).strict()
const slots = z.record(z.string().regex(/^[1-9]$/), z.object({ max: z.number().int().min(0), used: z.number().int().min(0) }).strict())

export const PcSheetSchema = z.object({
  type: z.literal("pc"),
  species: z.string(), subspecies: z.string().optional(), size: z.string(), speed: z.number().int(),
  background: z.string(), class: z.string(), subclass: z.string().optional(), level: z.number().int().min(1).max(20),
  abilities: abilityScores,
  skills: z.array(z.string()), expertise: z.array(z.string()).default([]), saves: z.array(z.enum(ABILITIES)),
  tools: z.array(z.string()).default([]), languages: z.array(z.string()),
  armorProf: z.array(z.string()), weaponProf: z.array(z.string()),
  feats: z.array(z.string()), features: z.array(z.string()), traits: z.array(z.string()),
  hitDie: z.number().int(), hitDiceLeft: z.number().int().min(0),
  spell: z.object({ ability: z.enum(ABILITIES), cantrips: z.array(z.string()), prepared: z.array(z.string()), spellbook: z.array(z.string()).optional() }).nullable(),
  slots, mastery: z.array(z.string()).default([]),
  classSpecific: z.record(z.string(), z.unknown()).default({}),
  uses: z.record(z.string(), z.number().int().min(0)).default({}),
  inspiration: z.boolean().default(false), exhaustion: z.number().int().min(0).max(6).default(0),
  conditions: z.array(z.string()).default([]),
  deathSaves: z.object({ ok: z.number().int().min(0).max(3), fail: z.number().int().min(0).max(3) }).default({ ok: 0, fail: 0 }),
  alignment: z.string().optional(), notes: z.record(z.string(), z.unknown()).default({}),
}).strict()
export type PcSheet = z.infer<typeof PcSheetSchema>

/** Ficha de criatura do SRD (monstros e NPCs de bloco de estatísticas). */
export const MonsterSheetSchema = z.object({
  type: z.literal("monster"), srd: z.string(), abilities: abilityScores,
  cr: z.number(), prof: z.number().int(), speed: z.string(),
  conditions: z.array(z.string()).default([]),
  uses: z.record(z.string(), z.number().int().min(0)).default({}),
  deathSaves: z.object({ ok: z.number().int().min(0).max(3), fail: z.number().int().min(0).max(3) }).default({ ok: 0, fail: 0 }),
  notes: z.record(z.string(), z.unknown()).default({}),
}).strict()
export type MonsterSheet = z.infer<typeof MonsterSheetSchema>

export const SheetSchema = z.discriminatedUnion("type", [PcSheetSchema, MonsterSheetSchema])
export type Sheet = z.infer<typeof SheetSchema>

export const mod = (score: number): number => Math.floor((score - 10) / 2)
export const fmt = (n: number): string => (n >= 0 ? `+${n}` : `${n}`)
export const profBonus = (level: number): number => 2 + Math.floor((Math.max(1, level) - 1) / 4)

export interface ItemRow { id: string; name: string; srd: string | null; qty: number; equipped: number; props: Record<string, unknown> | string }

/** Valores calculados de um PC com seus itens. */
export interface Derived {
  prof: number
  ac: number
  initiative: number
  passivePerception: number
  saves: Record<Ability, number>
  skills: Record<string, number>
  spellDc?: number
  spellAttack?: number
  attacks: AttackOption[]
}
export interface AttackOption { item: string; name: string; bonus: number; damage: string; damageType: string; ranged: boolean; mastery?: string; mastered: boolean; properties: string[]; abilityMod: number; usesStr: boolean }

const has = (list: string[], ...keys: string[]) => keys.some((k) => list.includes(k))

export function derivePc(srd: Srd, sheet: PcSheet, items: ItemRow[]): Derived {
  const prof = profBonus(sheet.level)
  const m = (a: Ability) => mod(sheet.abilities[a])
  const saves = {} as Record<Ability, number>
  for (const a of ABILITIES) saves[a] = m(a) + (sheet.saves.includes(a) ? prof : 0)

  const skills: Record<string, number> = {}
  for (const sk of srd.list("skills", "en")) {
    const ab = sk.ability_score.index as Ability
    const lvl = sheet.expertise.includes(sk.index) ? 2 : sheet.skills.includes(sk.index) ? 1 : 0
    skills[sk.index] = m(ab) + prof * lvl
  }

  const worn = items.filter((i) => i.equipped && i.srd)
  const isCat = (e: any, c: string) => e?.equipment_categories?.some((x: any) => x.index === c)
  const wornSrd = worn.map((i) => srd.get("equipment", i.srd!, "en"))
  const armorItem = wornSrd.find((e) => e?.armor_class && isCat(e, "armor") && !isCat(e, "shields"))
  const shield = wornSrd.find((e) => isCat(e, "shields"))
  let ac: number
  if (armorItem) {
    const a = armorItem.armor_class
    ac = a.base + (a.dex_bonus ? Math.min(m("dex"), a.max_bonus ?? 99) : 0)
  } else if (sheet.class === "barbarian") ac = 10 + m("dex") + m("con")
  else if (sheet.class === "monk" && !shield) ac = 10 + m("dex") + m("wis")
  else ac = 10 + m("dex")
  if (shield) ac += shield.armor_class.base

  const attacks: AttackOption[] = []
  for (const it of items.filter((i) => i.srd && i.qty > 0)) {
    const e = srd.get("equipment", it.srd!, "en")
    if (!e?.damage) continue
    const props: string[] = (e.properties ?? []).map((p: any) => p.index)
    const cats: string[] = e.equipment_categories.map((c: any) => c.index)
    const ranged = cats.includes("ranged-weapons")
    const finesse = props.includes("finesse")
    const ab: Ability = ranged ? "dex" : finesse ? (m("dex") > m("str") ? "dex" : "str") : "str"
    const proficient = has(sheet.weaponProf, cats.includes("martial-weapons") ? "martial-weapons" : "simple-weapons", e.index)
    attacks.push({
      item: it.id, name: e.name, bonus: m(ab) + (proficient ? prof : 0),
      damage: m(ab) === 0 ? e.damage.damage_dice : `${e.damage.damage_dice}${fmt(m(ab))}`,
      damageType: e.damage.damage_type.index, ranged, mastery: e.mastery?.index,
      mastered: sheet.mastery.includes(e.index), properties: props, abilityMod: m(ab), usesStr: ab === "str",
    })
  }
  // Ataque desarmado: 1 + FOR; o Monge usa a Arte Marcial (dado de classe, melhor entre FOR e DES).
  const martial = sheet.class === "monk" ? Number((sheet.classSpecific as Record<string, unknown>).martial_arts_die ?? 0) : 0
  const uAb: Ability = martial && m("dex") > m("str") ? "dex" : "str"
  attacks.push({
    item: "", name: "Ataque desarmado", bonus: m(uAb) + prof,
    damage: martial ? (m(uAb) === 0 ? `1d${martial}` : `1d${martial}${fmt(m(uAb))}`) : `${Math.max(1, 1 + m("str"))}`,
    damageType: "bludgeoning", ranged: false, mastered: false, properties: [], abilityMod: m(uAb), usesStr: uAb === "str",
  })

  const d: Derived = {
    prof, ac, initiative: m("dex") + (sheet.feats.includes("alert") ? prof : 0),
    passivePerception: 10 + skills.perception!, saves, skills, attacks,
  }
  if (sheet.spell) {
    d.spellDc = 8 + prof + m(sheet.spell.ability)
    d.spellAttack = prof + m(sheet.spell.ability)
  }
  return d
}

export interface Resource { key: string; max: number; label: string; recharge: "short" | "long" | "short1" }

/** Recursos de classe: números do SRD (class_specific) + os que o SRD descreve só em texto. */
export function resourceList(sheet: PcSheet): Resource[] {
  const out: Resource[] = []
  const cs = sheet.classSpecific as Record<string, unknown>
  const num = (k: string) => (typeof cs[k] === "number" ? (cs[k] as number) : 0)
  const mapping: [string, string, Resource["recharge"]][] = [
    ["rage_count", "Fúrias", "short1"], ["second_wind_uses", "Retomar o Fôlego", "short1"], ["channel_divinity_charges", "Canalizar Divindade", "short1"],
    ["wild_shape_uses", "Forma Selvagem", "short1"], ["focus_points", "Pontos de Foco", "short"], ["sorcery_points", "Pontos de Feitiçaria", "long"],
  ]
  for (const [k, label, recharge] of mapping) if (num(k) > 0) out.push({ key: k, max: num(k), label, recharge })
  if (sheet.class === "fighter" && sheet.level >= 2) out.push({ key: "action_surge", max: sheet.level >= 17 ? 2 : 1, label: "Surto de Ação", recharge: "short" })
  if (sheet.class === "bard") out.push({ key: "bardic_inspiration", max: Math.max(1, mod(sheet.abilities.cha)), label: "Inspiração de Bardo", recharge: sheet.level >= 5 ? "short" : "long" })
  if (sheet.class === "paladin") out.push({ key: "lay_on_hands", max: 5 * sheet.level, label: "Mãos Consagradas (PV)", recharge: "long" })
  return out
}
