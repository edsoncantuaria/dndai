// Criação de personagem 2024: Classe + Antecedente (ASI e talento de origem) + Espécie, tudo do SRD.
import { z } from "zod"
import { cryptoRng, roll, type Rng } from "./dice.ts"
import { ABILITIES, type Ability, mod, type PcSheet, PcSheetSchema } from "./sheet.ts"
import type { Collection, Srd, SrdRecord } from "../srd/index.ts"

export class CreationError extends Error {}
const fail = (m: string): never => { throw new CreationError(m) }

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]
export const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }

const ab = z.enum(ABILITIES)
const id = z.string().min(1).max(60)
/** Forma das escolhas na fronteira (API/Mestre). As regras do SRD são conferidas em createPc. */
export const CreationChoicesSchema = z.object({
  name: z.string().trim().min(1).max(60), class: id, species: id, subspecies: id.optional(), background: id,
  method: z.enum(["standard", "pointbuy", "roll"]),
  scores: z.object({ str: z.number().int(), dex: z.number().int(), con: z.number().int(), int: z.number().int(), wis: z.number().int(), cha: z.number().int() }).strict(),
  bonus: z.union([z.object({ plus2: ab, plus1: ab }).strict(), z.object({ plus1x3: z.literal(true) }).strict()]),
  classSkills: z.array(id).max(8), classTools: z.array(id).max(4).optional(), mastery: z.array(id).max(6).optional(),
  classEquipment: z.number().int().min(0).max(10), backgroundEquipment: z.number().int().min(0).max(10),
  equipmentPicks: z.array(id).max(8).optional(), languages: z.array(id).max(4),
  speciesChoices: z.object({ size: z.string().optional(), skill: id.optional(), feat: id.optional() }).strict().optional(),
  spells: z.object({ cantrips: z.array(id).max(12), prepared: z.array(id).max(30), spellbook: z.array(id).max(30).optional() }).strict().optional(),
  rollToken: z.string().optional(), alignment: z.string().max(40).optional(),
}).strict()

export interface Choice { choose: number; from: string[]; desc: string }
export interface CreationChoices {
  name: string
  class: string
  species: string
  subspecies?: string
  background: string
  method: "standard" | "pointbuy" | "roll"
  /** Valores base atribuídos a cada atributo (antes do bônus do antecedente). */
  scores: Record<Ability, number>
  /** Bônus do antecedente: +2/+1 ou +1/+1/+1, só entre os 3 atributos dele. */
  bonus: { plus2?: Ability; plus1?: Ability } | { plus1x3: true }
  classSkills: string[]
  /** Escolhas de ferramentas/instrumentos da classe (índices de proficiencies). */
  classTools?: string[]
  /** Opção escolhida em cada equipment_options da classe e do antecedente (índice 0-based). */
  /** Armas para Maestria (Bárbaro, Guerreiro, Paladino, Patrulheiro, Ladino). */
  mastery?: string[]
  classEquipment: number
  backgroundEquipment: number
  /** Itens escolhidos quando uma opção pede uma categoria (ex.: símbolo sagrado). Em ordem de aparição. */
  equipmentPicks?: string[]
  /** Idiomas além do Comum (2). */
  languages: string[]
  speciesChoices?: { size?: string; skill?: string; feat?: string }
  spells?: { cantrips: string[]; prepared: string[]; spellbook?: string[] }
  rollToken?: string
  alignment?: string
}

/** Bloco de opções (choose N de uma lista) do SRD → lista simples de índices. */
function parseChoice(c: any, allSkills: string[]): Choice {
  const opts: string[] = []
  for (const o of c.from?.options ?? []) {
    const idx = o.item?.index as string | undefined
    if (idx) opts.push(idx)
  }
  const skillish = opts.length && opts.every((i) => i.startsWith("skill-"))
  return { choose: c.choose, desc: c.desc, from: skillish ? opts.map((i) => i.slice(6)) : opts.length ? opts : /skill/i.test(c.desc) ? allSkills : [] }
}

export function creationOptions(srd: Srd) {
  const skills = srd.list("skills", "en").map((s) => s.index)
  const nm = (r: SrdRecord) => ({ index: r.index, name: r.name })
  return {
    abilities: srd.list("ability-scores").map((a) => ({ index: a.index, name: a.full_name ?? a.name, description: a.description })),
    skills: srd.list("skills").map((s) => ({ index: s.index, name: s.name, ability: s.ability_score.index, description: s.description })),
    standardArray: STANDARD_ARRAY,
    pointBuy: { budget: 27, min: 8, max: 15, cost: POINT_COST },
    languages: srd.list("languages").filter((l) => !l.is_rare).map(nm),
    classes: srd.list("classes").map((c) => ({
      ...nm(c), hitDie: c.hit_die, primary: c.primary_ability?.desc,
      saves: c.saving_throws.map((s: any) => s.index),
      skillChoices: c.proficiency_choices.map((p: any) => parseChoice(p, skills)),
      equipment: c.starting_equipment_options.map((e: any) => ({ desc: e.desc, options: e.from.options.length })),
      spellcasting: c.spellcasting ? { ability: c.spellcasting.spellcasting_ability.index } : null,
      subclasses: (c.subclasses ?? []).map(nm),
    })),
    species: srd.list("species").map((s) => ({
      ...nm(s), size: s.size ?? null, sizeOptions: s.size_options?.desc ?? null, speed: s.speed,
      traits: (s.traits ?? []).map(nm),
      subspecies: srd.list("subspecies").filter((x) => x.species?.index === s.index).map(nm),
    })),
    backgrounds: srd.list("backgrounds").map((b) => ({
      ...nm(b), abilities: b.ability_scores.map((a: any) => a.index), feat: b.feat.index,
      skills: b.proficiencies.filter((p: any) => p.index.startsWith("skill-")).map((p: any) => p.index.slice(6)),
      equipment: b.equipment_options.map((e: any) => ({ desc: e.desc, options: e.from.options.length })),
    })),
  }
}

/** Atributos sorteados pelo motor (o cliente só pode usar um conjunto que o motor rolou). */
export function rollAbilitySet(rng: Rng = cryptoRng): number[] {
  return Array.from({ length: 6 }, () => roll("4d6kh3", rng).total).sort((a, b) => b - a)
}

function validateScores(c: CreationChoices, rolled: number[] | undefined): void {
  const vals = ABILITIES.map((a) => c.scores[a])
  if (vals.some((v) => !Number.isInteger(v))) fail("atributos incompletos")
  if (c.method === "standard") {
    if ([...vals].sort((a, b) => b - a).join() !== STANDARD_ARRAY.join()) fail(`array padrão exige ${STANDARD_ARRAY.join(", ")}`)
  } else if (c.method === "pointbuy") {
    let cost = 0
    for (const v of vals) { if (!(v in POINT_COST)) fail(`point buy: ${v} fora de 8–15`); cost += POINT_COST[v]! }
    if (cost > 27) fail(`point buy: ${cost} pontos > 27`)
  } else {
    if (!rolled) fail("conjunto rolado não encontrado (peça ao motor para rolar)")
    if ([...vals].sort((a, b) => b - a).join() !== rolled!.join()) fail(`valores diferentes dos rolados (${rolled!.join(", ")})`)
  }
}

function pick<T>(list: T[] | undefined, n: number, label: string): T[] {
  if ((list ?? []).length !== n) fail(`${label}: escolha exatamente ${n}`)
  return list!
}

export interface CreatedPc {
  sheet: PcSheet
  hp: number
  cp: number
  items: { srd: string | null; name: string; qty: number; equip: boolean; kind: string }[]
}

export function createPc(srd: Srd, c: CreationChoices, rolled?: number[]): CreatedPc {
  const get = (coll: Collection, idx: string, what: string) => srd.get(coll, idx, "en") ?? fail(`${what} "${idx}" não existe no SRD`)
  const cls = get("classes", c.class, "classe")
  const species = get("species", c.species, "espécie")
  const bg = get("backgrounds", c.background, "antecedente")
  validateScores(c, rolled)

  // Atributos: base + bônus do antecedente (máx. 20)
  const bgAbs: Ability[] = bg.ability_scores.map((a: any) => a.index)
  const bonus: Partial<Record<Ability, number>> = {}
  if ("plus1x3" in c.bonus) for (const a of bgAbs) bonus[a] = 1
  else {
    const { plus2, plus1 } = c.bonus
    if (!plus2 || !plus1 || plus2 === plus1) fail("bônus do antecedente: informe plus2 e plus1 diferentes")
    for (const a of [plus2!, plus1!]) if (!bgAbs.includes(a)) fail(`${bg.name} não permite bônus em ${a} (${bgAbs.join(", ")})`)
    bonus[plus2!] = 2; bonus[plus1!] = 1
  }
  const abilities = {} as Record<Ability, number>
  for (const a of ABILITIES) abilities[a] = Math.min(20, c.scores[a] + (bonus[a] ?? 0))

  // Perícias: antecedente (fixas) + classe (escolha) + espécie
  const skills = new Set<string>(bg.proficiencies.filter((p: any) => p.index.startsWith("skill-")).map((p: any) => p.index.slice(6)))
  const tools: string[] = bg.proficiencies.filter((p: any) => p.index.startsWith("tool-")).map((p: any) => p.index)
  const [skillChoice, toolChoice] = cls.proficiency_choices.map((p: any) => parseChoice(p, srd.list("skills", "en").map((s) => s.index)))
  const classSkills = pick(c.classSkills, skillChoice!.choose, "perícias da classe")
  for (const s of classSkills) {
    if (!skillChoice!.from.includes(s)) fail(`perícia "${s}" não está na lista da classe`)
    if (skills.has(s)) fail(`perícia "${s}" já vem do antecedente: escolha outra`)
    skills.add(s)
  }
  if (toolChoice) for (const t of pick(c.classTools, toolChoice.choose, "ferramentas/instrumentos da classe")) { get("proficiencies", t, "proficiência"); tools.push(t) }

  // Espécie
  const traits = (species.traits ?? []).map((t: any) => t.index as string)
  let subspecies: string | undefined
  const subs = srd.list("subspecies", "en").filter((s) => s.species?.index === species.index)
  if (subs.length) {
    const s = subs.find((x) => x.index === c.subspecies) ?? fail(`${species.name} exige subespécie: ${subs.map((x) => x.index).join(", ")}`)
    subspecies = s.index
    for (const t of s.traits ?? []) traits.push(t.index)
  } else if (c.subspecies) fail(`${species.name} não tem subespécie`)
  const feats = [bg.feat.index as string]
  const sc = c.speciesChoices ?? {}
  let size = species.size as string | undefined
  if (!size) { size = sc.size; if (!size || !["Small", "Medium"].includes(size)) fail("espécie exige tamanho Small ou Medium (speciesChoices.size)") }
  if (traits.includes("skillful")) { if (!sc.skill) fail("Humano (Habilidoso): informe speciesChoices.skill"); get("skills", sc.skill!, "perícia"); if (skills.has(sc.skill!)) fail("perícia da espécie repetida"); skills.add(sc.skill!) }
  if (traits.includes("keen-senses")) {
    const k = sc.skill ?? ""
    if (!["insight", "perception", "survival"].includes(k)) fail("Sentidos Aguçados: insight, perception ou survival (speciesChoices.skill)")
    if (skills.has(k)) fail("perícia da espécie repetida")
    skills.add(k)
  }
  if (traits.includes("versatile")) {
    const f = get("feats", sc.feat ?? "", "talento (Versátil)")
    if (f.type !== "origin") fail("Versátil exige talento de origem")
    if (feats.includes(f.index)) fail("talento repetido")
    feats.push(f.index)
  }

  // Idiomas: Comum + 2
  const langs = srd.list("languages", "en").filter((l) => !l.is_rare).map((l) => l.index)
  const extra = pick(c.languages, 2, "idiomas")
  for (const l of extra) if (!langs.includes(l) || l === "common") fail(`idioma inválido: ${l}`)
  if (new Set(extra).size !== 2) fail("idiomas repetidos")

  // Nível 1
  const lvl1 = srd.get("levels", `${cls.index}-1`, "en") ?? fail("nível 1 ausente no SRD")
  const features = (lvl1.features ?? []).map((f: any) => f.index as string)
  const conMod = mod(abilities.con)
  const hp = cls.hit_die + conMod

  // Conjuração
  let spell: PcSheet["spell"] = null
  const slots: PcSheet["slots"] = {}
  const sp = lvl1.spellcasting
  if (cls.spellcasting && sp) {
    const ab = cls.spellcasting.spellcasting_ability.index as Ability
    const chosen = c.spells ?? fail("classe conjuradora: informe spells {cantrips, prepared}")
    spell = { ability: ab, cantrips: [], prepared: [] }
    const known = (idx: string, level: number, label: string) => {
      const s = get("spells", idx, "magia")
      if (!s.classes.some((x: any) => x.index === cls.index)) fail(`${s.name} não está na lista de ${cls.name}`)
      if (s.level !== level && !(level === 1 && s.level >= 1 && s.level <= maxSlotLevel(sp))) fail(`${s.name} é de nível ${s.level} (${label})`)
      return s.index as string
    }
    if (sp.cantrips_known) spell.cantrips = pick(chosen!.cantrips, sp.cantrips_known, "truques").map((x) => known(x, 0, "truque"))
    if (sp.prepared_spells) spell.prepared = pick(chosen!.prepared, sp.prepared_spells, "magias preparadas").map((x) => known(x, 1, "magia preparada"))
    if (cls.index === "wizard") {
      const book = chosen!.spellbook ?? spell.prepared
      if (book.length !== 6 || !spell.prepared.every((p) => book.includes(p))) fail("Mago: grimório com 6 magias de nível 1 incluindo as preparadas")
      spell.spellbook = book.map((x) => known(x, 1, "grimório"))
    }
    for (let i = 1; i <= 9; i++) { const n = sp[`spell_slots_level_${i}`] ?? 0; if (n) slots[String(i)] = { max: n, used: 0 } }
  } else if (c.spells && (c.spells.cantrips.length || c.spells.prepared.length)) fail(`${cls.name} não conjura no nível 1`)

  // Maestria com armas (Bárbaro, Guerreiro, Paladino, Patrulheiro, Ladino)
  const mastery: string[] = []
  if (features.includes(`${cls.index}-weapon-mastery`)) {
    const n = Number((lvl1.class_specific as any)?.weapon_mastery ?? 2)
    const wp = cls.proficiencies.map((p: any) => p.index as string)
    for (const w of pick(c.mastery, n, "maestria com armas")) {
      const e = get("equipment", w, "arma")
      const cats: string[] = e.equipment_categories.map((x: any) => x.index)
      if (!e.mastery) fail(`${e.name} não tem propriedade de maestria`)
      if (!wp.some((p: string) => cats.includes(p))) fail(`${cls.name} não tem proficiência em ${e.name}`)
      mastery.push(e.index)
    }
    if (new Set(mastery).size !== n) fail("maestrias repetidas")
  } else if (c.mastery?.length) fail(`${cls.name} não tem Maestria com Armas`)

  const sheet = PcSheetSchema.parse({
    type: "pc", species: species.index, subspecies, size, speed: species.speed, background: bg.index, class: cls.index,
    level: 1, abilities, skills: [...skills], expertise: [], saves: cls.saving_throws.map((s: any) => s.index),
    tools, languages: ["common", ...extra],
    armorProf: cls.proficiencies.map((p: any) => p.index).filter((i: string) => /armor|shields/.test(i)),
    weaponProf: cls.proficiencies.map((p: any) => p.index).filter((i: string) => /weapons/.test(i)),
    feats, features, traits, hitDie: cls.hit_die, hitDiceLeft: 1, spell, slots, mastery,
    classSpecific: lvl1.class_specific ?? {}, alignment: c.alignment,
  })

  const { items, cp } = startingKit(srd, cls, bg, c)
  return { sheet, hp, cp, items }
}

const maxSlotLevel = (sp: Record<string, number>): number => { for (let i = 9; i >= 1; i--) if (sp[`spell_slots_level_${i}`]) return i; return 0 }

/** Equipamento inicial: uma opção da classe e uma do antecedente, com escolhas de categoria. */
function startingKit(srd: Srd, cls: SrdRecord, bg: SrdRecord, c: CreationChoices) {
  const items: CreatedPc["items"] = []
  let cp = 0
  const picks = [...(c.equipmentPicks ?? [])]
  const addRef = (ref: any, count: number) => {
    const url: string = ref.url
    if (url.includes("/equipment-categories/")) {
      const idx = picks.shift() ?? fail(`informe em equipmentPicks um item de "${ref.name}"`)
      const cat = srd.byUrl(url, "en")!
      if (!cat.equipment.some((e: any) => e.index === idx)) fail(`"${idx}" não pertence a ${ref.name}`)
      const e = srd.get("equipment", idx, "en")!
      items.push({ srd: e.index, name: e.name, qty: count, equip: false, kind: kindOf(e) })
    } else {
      const e = srd.byUrl(url, "en") ?? fail(`equipamento ausente: ${url}`)
      items.push({ srd: e.index, name: ref.note ? `${e.name} (${ref.note})` : e.name, qty: count, equip: false, kind: kindOf(e) })
    }
  }
  const apply = (opt: any) => {
    if (opt.option_type === "money") cp += moneyCp(opt.count, opt.unit)
    else if (opt.option_type === "counted_reference") addRef(opt.of, opt.count)
    else if (opt.option_type === "multiple") for (const it of opt.items) apply(it)
    else if (opt.option_type === "reference") addRef(opt.item, 1)
    else if (opt.option_type === "choice") {
      // Escolha dentro de uma ou mais categorias (ferramenta, instrumento, jogo): consome um item de equipmentPicks.
      const cats: string[] = []
      const collect = (ch: any) => {
        const f = ch.from
        if (f.option_set_type === "equipment_category") cats.push(f.equipment_category.url)
        else for (const o of f.options) collect(o.choice)
      }
      collect(opt.choice)
      const idx = picks.shift() ?? fail(`informe em equipmentPicks um item de: ${cats.map((u) => u.split("/").pop()).join(" ou ")}`)
      const e = srd.get("equipment", idx, "en") ?? fail(`equipamento "${idx}" não existe`)
      if (!cats.some((u) => srd.byUrl(u, "en")!.equipment.some((x: any) => x.index === idx))) fail(`"${idx}" não está em ${cats.map((u) => u.split("/").pop()).join(" ou ")}`)
      items.push({ srd: e.index, name: e.name, qty: opt.choice.choose ?? 1, equip: false, kind: kindOf(e) })
    }
    else fail(`opção de equipamento não suportada: ${opt.option_type}`)
  }
  const take = (sets: any[], pickIdx: number, who: string) => {
    const set = sets[0]
    const opt = set.from.options[pickIdx] ?? fail(`${who}: opção ${pickIdx} não existe (0–${set.from.options.length - 1})`)
    apply(opt)
  }
  take(cls.starting_equipment_options, c.classEquipment, "equipamento da classe")
  take(bg.equipment_options, c.backgroundEquipment, "equipamento do antecedente")
  if (picks.length) fail(`equipmentPicks sobrando: ${picks.join(", ")}`)
  // Veste armadura e escudo; empunha a primeira arma.
  let armor = false, shield = false, weapon = false
  for (const it of items) {
    const e = it.srd ? srd.get("equipment", it.srd, "en") : undefined
    if (!e) continue
    const cats: string[] = e.equipment_categories?.map((x: any) => x.index) ?? []
    if (e.armor_class && cats.includes("shields") && !shield) { it.equip = shield = true }
    else if (e.armor_class && cats.includes("armor") && !armor) { it.equip = armor = true }
    else if (e.damage && !weapon && !cats.includes("ammunition")) { it.equip = weapon = true }
  }
  return { items, cp }
}

function kindOf(e: SrdRecord): string {
  const cats: string[] = e.equipment_categories?.map((x: any) => x.index) ?? []
  if (e.damage) return "arma"
  if (cats.includes("shields")) return "escudo"
  if (e.armor_class) return "armadura"
  return "equipamento"
}

export function moneyCp(n: number, unit: string): number {
  const f: Record<string, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }
  return n * (f[unit] ?? fail(`moeda desconhecida: ${unit}`))
}
