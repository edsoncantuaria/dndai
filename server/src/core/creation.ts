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
function parseChoice(c: any, allSkills: string[], tools: { index: string; type: string }[] = []): Choice {
  const opts: string[] = []
  for (const o of c.from?.options ?? []) {
    const idx = o.item?.index as string | undefined
    if (idx) opts.push(idx)
  }
  const skillish = opts.length && opts.every((i) => i.startsWith("skill-"))
  const byType = (t: string) => tools.filter((x) => x.type === t).map((x) => x.index)
  const anyTool = !opts.length && /artisan|instrument/i.test(c.desc) ? [...(/artisan/i.test(c.desc) ? byType("Artisan's Tools") : []), ...(/instrument/i.test(c.desc) ? byType("Musical Instruments") : [])] : []
  return { choose: c.choose, desc: c.desc, from: skillish ? opts.map((i) => i.slice(6)) : opts.length ? opts : anyTool.length ? anyTool : /skill/i.test(c.desc) ? allSkills : [] }
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
      equipment: c.starting_equipment_options[0].from.options.map((o: any) => describeOption(srd, o)),
      spellcasting: c.spellcasting ? { ability: c.spellcasting.spellcasting_ability.index } : null,
      subclasses: (c.subclasses ?? []).map(nm),
    })),
    species: srd.list("species").map((s) => ({
      ...nm(s), size: s.size ?? null, sizeOptions: s.size_options?.desc ?? null, speed: s.speed,
      traits: (s.traits ?? []).map(nm),
      subspecies: srd.list("subspecies").filter((x) => x.species?.index === s.index).map(nm),
    })),
    backgrounds: srd.list("backgrounds").map((b) => ({
      ...nm(b), abilities: b.ability_scores.map((a: any) => a.index), feat: b.feat.index, featName: srd.get("feats", b.feat.index)?.name,
      skills: b.proficiencies.filter((p: any) => p.index.startsWith("skill-")).map((p: any) => p.index.slice(6)),
      equipment: b.equipment_options[0].from.options.map((o: any) => describeOption(srd, o)),
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
  const profList = srd.list("proficiencies", "en").map((p) => ({ index: p.index, type: p.type as string }))
  const [skillChoice, toolChoice] = cls.proficiency_choices.map((p: any) => parseChoice(p, srd.list("skills", "en").map((s) => s.index), profList))
  const classSkills = pick(c.classSkills, skillChoice!.choose, "perícias da classe")
  for (const s of classSkills) {
    if (!skillChoice!.from.includes(s)) fail(`perícia "${s}" não está na lista da classe`)
    if (skills.has(s)) fail(`perícia "${s}" já vem do antecedente: escolha outra`)
    skills.add(s)
  }
  if (toolChoice) for (const t of pick(c.classTools, toolChoice.choose, "ferramentas/instrumentos da classe")) { get("proficiencies", t, "proficiência"); if (!toolChoice.from.includes(t)) fail(`"${t}" não está nas opções da classe`); tools.push(t) }

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

/** Texto legível de uma opção de equipamento do SRD ("2× Adaga, Túnica, 5 PO"). */
export function describeOption(srd: Srd, opt: any): string {
  if (opt.option_type === "money") return `${opt.count} ${({ gp: "PO", sp: "PP", cp: "PC", ep: "PE", pp: "PL" } as Record<string, string>)[opt.unit] ?? opt.unit}`
  if (opt.option_type === "counted_reference") return `${opt.count > 1 ? `${opt.count}× ` : ""}${srd.byUrl(opt.of.url)?.name ?? opt.of.name}${opt.of.note ? ` (${opt.of.note})` : ""}`
  if (opt.option_type === "multiple") return opt.items.map((i: any) => describeOption(srd, i)).join(", ")
  if (opt.option_type === "reference") return srd.byUrl(opt.item.url)?.name ?? opt.item.name
  if (opt.option_type === "choice") return `um item à escolha (${opt.choice.desc ?? "categoria"})`
  return "?"
}

function pickSlots(opt: any, out: { label: string; from: string[] }[], srd: Srd): void {
  if (opt.option_type === "multiple") for (const i of opt.items) pickSlots(i, out, srd)
  else if (opt.option_type === "counted_reference" && opt.of.url.includes("/equipment-categories/")) {
    out.push({ label: opt.of.name, from: srd.byUrl(opt.of.url, "en")!.equipment.map((e: any) => e.index as string) })
  } else if (opt.option_type === "choice") {
    const cats: string[] = []
    const collect = (ch: any) => { const f = ch.from; if (f.option_set_type === "equipment_category") cats.push(f.equipment_category.url); else for (const o of f.options) collect(o.choice) }
    collect(opt.choice)
    out.push({ label: opt.choice.desc ?? "Escolha um item", from: cats.flatMap((u) => srd.byUrl(u, "en")!.equipment.map((e: any) => e.index as string)) })
  }
}

/** Tudo que falta escolher para uma combinação classe/antecedente/espécie (o cliente monta o formulário a partir disto). */
export function creationNeeds(srd: Srd, q: { class: string; background: string; species: string; subspecies?: string; classEquipment?: number; backgroundEquipment?: number }) {
  const cls = srd.get("classes", q.class, "en") ?? fail("classe inexistente")
  const bg = srd.get("backgrounds", q.background, "en") ?? fail("antecedente inexistente")
  const species = srd.get("species", q.species, "en") ?? fail("espécie inexistente")
  const allSkills = srd.list("skills", "en").map((s) => s.index)
  const profList = srd.list("proficiencies", "en").map((p) => ({ index: p.index, type: p.type as string }))
  const [skillChoice, toolChoice] = cls.proficiency_choices.map((p: any) => parseChoice(p, allSkills, profList))
  const bgSkills: string[] = bg.proficiencies.filter((p: any) => p.index.startsWith("skill-")).map((p: any) => p.index.slice(6))
  const lvl1 = srd.get("levels", `${cls.index}-1`, "en")!
  const eqSet = (list: any[], i: number | undefined) => list[0].from.options[i ?? 0]
  const picks: { label: string; from: string[] }[] = []
  pickSlots(eqSet(cls.starting_equipment_options, q.classEquipment), picks, srd)
  pickSlots(eqSet(bg.equipment_options, q.backgroundEquipment), picks, srd)
  const traits = (species.traits ?? []).map((t: any) => t.index as string)
  const subs = srd.list("subspecies", "en").filter((s) => s.species?.index === species.index)
  const sp = lvl1.spellcasting
  const classSpells = (level: number) => srd.list("spells").filter((s) => s.level === level && s.classes.some((c: any) => c.index === cls.index)).map((s) => ({ index: s.index, name: s.name, school: s.school?.name }))
  const hasMastery = (lvl1.features ?? []).some((f: any) => f.index === `${cls.index}-weapon-mastery`)
  const wp = cls.proficiencies.map((p: any) => p.index as string)
  return {
    skills: { choose: skillChoice!.choose, from: skillChoice!.from.filter((s: string) => !bgSkills.includes(s)) },
    tools: toolChoice ? { choose: toolChoice.choose, from: toolChoice.from.map((i: string) => ({ index: i, name: srd.get("proficiencies", i)?.name ?? i })) } : null,
    mastery: hasMastery ? { count: Number((lvl1.class_specific as any)?.weapon_mastery ?? 2), from: srd.list("equipment", "en").filter((e) => e.mastery && wp.some((p: string) => e.equipment_categories.some((c: any) => c.index === p))).map((e) => ({ index: e.index, name: srd.get("equipment", e.index)?.name })) } : null,
    equipmentPicks: picks,
    speciesChoices: {
      subspecies: subs.map((s) => ({ index: s.index, name: s.name })),
      size: species.size ? null : ["Small", "Medium"],
      skill: traits.includes("skillful") ? allSkills : traits.includes("keen-senses") ? ["insight", "perception", "survival"] : null,
      feat: traits.includes("versatile") ? srd.list("feats", "en").filter((f) => f.type === "origin" && f.index !== bg.feat.index).map((f) => ({ index: f.index, name: srd.get("feats", f.index)?.name })) : null,
    },
    languages: { choose: 2, from: srd.list("languages").filter((l) => !l.is_rare && l.index !== "common").map((l) => ({ index: l.index, name: l.name })) },
    spells: sp ? { cantrips: sp.cantrips_known ?? 0, prepared: sp.prepared_spells ?? 0, spellbook: cls.index === "wizard" ? 6 : 0, ability: cls.spellcasting.spellcasting_ability.index, cantripList: classSpells(0), levelOneList: classSpells(1) } : null,
    bonusAbilities: bg.ability_scores.map((a: any) => a.index),
  }
}
