// Regras de progressão derivadas do snapshot SRD. Não escreve no banco.
import { ABILITIES, type Ability, mod, norm, parseAbility, parseSkill } from "./rules.ts"
import { getClassLevel, getFeaturesForLevel, searchSrd, subclassesForClass, type SrdSubclass } from "./srd.ts"
import type { FeatureDetail, Sheet, TrackedResource } from "./world.ts"

const SUBCLASS_ALIASES: Record<string, string> = {
  campeao: "champion", evocador: "evocation", evocacao: "evocation", vida: "life", dominiodavida: "life",
  terra: "land", circulodaterra: "land", furioso: "berserker", caminhodofurioso: "berserker",
  conhecimento: "lore", colegiodoconhecimento: "lore", palmaaberta: "open-hand", caminhodapalmaaberta: "open-hand",
  devocao: "devotion", juramentodedevocao: "devotion", cacador: "hunter", ladrao: "thief",
  linhagemdraconica: "draconic", draconica: "draconic", corruptor: "fiend", ocorruptor: "fiend", escoladeevocacao: "evocation",
}

export function resolveSubclass(cls: string, query: string): SrdSubclass {
  const key = norm(SUBCLASS_ALIASES[norm(query)] ?? query)
  const sub = subclassesForClass(cls).find((s) => norm(s.index) === key || norm(s.name) === key)
  if (!sub) throw new Error(`Subclasse "${query}" inválida para ${cls}. Opções: ${subclassesForClass(cls).map((s) => s.index).join(", ")}.`)
  return sub
}

export function subclassRequiredLevel(cls: string): number {
  return Math.min(...subclassesForClass(cls).flatMap((s) => s.levels.map((l) => l.level)))
}

const RACE_ALIASES: Record<string, string> = {
  humano: "human", humana: "human", elfo: "elf", elfa: "elf", anao: "dwarf", ana: "dwarf", halfling: "halfling", gnomo: "gnome", gnoma: "gnome", draconato: "dragonborn",
  meioelfo: "half-elf", meioorc: "half-orc", tiefling: "tiefling", altoelfo: "high-elf", elfodaaltaestirpe: "high-elf",
  anaodacolina: "hill-dwarf", halflingpesleves: "lightfoot-halfling", gnomodarocha: "rock-gnome",
}

interface RaceRecord {
  index: string; name: string; speed?: number; race?: { index: string }
  traits?: { index: string }[]; racial_traits?: { index: string }[]
  ability_bonuses: { ability_score: { index: string }; bonus: number }[]
}

export function racialInfo(query: string) {
  const key = RACE_ALIASES[norm(query)] ?? query
  const exact = (resource: "races" | "subraces", value: string) => searchSrd(resource, value).find((r) => norm(String(r.index)) === norm(value) || norm(String(r.name)) === norm(value)) as unknown as RaceRecord | undefined
  const sub = exact("subraces", key)
  const race = exact("races", sub?.race?.index ?? key)
  if (!race) return null // Raças próprias e fichas antigas continuam válidas.
  const bonuses: Partial<Record<Ability, number>> = {}
  for (const b of [...race.ability_bonuses, ...(sub?.ability_bonuses ?? [])]) {
    const a = parseAbility(b.ability_score.index)!
    bonuses[a] = (bonuses[a] ?? 0) + b.bonus
  }
  const traits = [...(race.traits ?? []), ...(sub?.racial_traits ?? [])].map((ref) => {
    const trait = searchSrd("traits", ref.index).find((t) => t.index === ref.index)
    if (!trait) throw new Error(`Traço racial SRD ausente: ${ref.index}.`)
    return { id: ref.index, name: String(trait.name), description: (trait.desc as string[]).join("\n\n"), source: "race" as const }
  })
  return { bonuses, traits, speed: Math.round((race.speed ?? 30) * 0.3) }
}

function attach(sheet: Sheet, detail: FeatureDetail) {
  if (!sheet.featureDetails.some((f) => f.id === detail.id && f.source === detail.source)) sheet.featureDetails.push(detail)
  if (!sheet.features.includes(detail.name)) sheet.features.push(detail.name)
}

export function syncProgression(sheet: Sheet, level: number): void {
  const racial = racialInfo(sheet.race)
  for (const t of racial?.traits ?? []) attach(sheet, t)
  let subclass: string | null = null
  if (sheet.subclass) {
    // Subclasses próprias em fichas antigas não são reinterpretadas como uma opção SRD.
    try { subclass = resolveSubclass(sheet.class, sheet.subclass).index } catch { /* mantém a ficha */ }
  }
  for (let n = 1; n <= level; n++) {
    for (const f of getFeaturesForLevel(sheet.class, subclass, n)) {
      attach(sheet, { id: f.index, name: f.name, description: f.desc.join("\n\n"), source: f.subclass ? "subclass" : "class" })
    }
  }
  const specific = getClassLevel(sheet.class, level).class_specific ?? {}
  const resources: TrackedResource[] = []
  const add = (id: string, name: string, max: number, resets_on: "short" | "long", effect: string, unlimited = false) => {
    if (max > 0) resources.push({ id, name, max, used: 0, resets_on, effect, ...(unlimited ? { unlimited: true } : {}) })
  }
  switch (sheet.class) {
    case "guerreiro":
      add("segundo-folego", "Segundo Fôlego", 1, "short", `Cura 1d10 + ${level} PV em si mesmo (ação bônus).`)
      add("surto-de-acao", "Surto de Ação", Number(specific.action_surges), "short", "Uma ação adicional; no máximo uma vez no mesmo turno.")
      add("indomavel", "Indomável", Number(specific.indomitable_uses), "long", "Repete uma salvaguarda que falhou; use o novo resultado.")
      break
    case "barbaro": add("furia", "Fúria", Number(specific.rage_count), "long", "Ativa Fúria; duração e efeitos conduzidos pelo Mestre.", level === 20); break
    case "paladino":
      add("cura-pelas-maos", "Cura pelas Mãos", level * 5, "long", "Gasta pontos para curar PV (ação); indique quantidade e alvo.")
      add("sentido-divino", "Sentido Divino", Math.max(1, 1 + mod(sheet.abilities.car)), "long", "Detecta celestiais, corruptores e mortos-vivos nas condições da habilidade.")
      if (level >= 3) add("canalizar-divindade", "Canalizar Divindade", 1, "short", "Escolha um efeito do juramento com o Mestre.")
      break
    case "clerigo": add("canalizar-divindade", "Canalizar Divindade", Number(specific.channel_divinity_charges), "short", "Escolha um efeito do domínio com o Mestre."); break
    case "bardo": add("inspiracao-bardica", "Inspiração Bárdica", Math.max(1, mod(sheet.abilities.car)), level >= 5 ? "short" : "long", `Concede 1d${specific.bardic_inspiration_die} de inspiração a outra criatura.`); break
    case "monge":
      add("ki", "Ki", Number(specific.ki_points), "short", "Gasta pontos para técnicas de Ki; descanso exige 30 minutos de meditação.")
      if (subclass === "open-hand" && level >= 6) add("integridade-corporal", "Integridade Corporal", 1, "long", `Cura ${level * 3} PV em si mesmo (ação).`)
      break
    case "druida": if (level >= 2) add("forma-selvagem", "Forma Selvagem", 2, "short", "Transformação conduzida pelo Mestre.", level === 20); break
    case "feiticeiro": add("pontos-de-feiticaria", "Pontos de Feitiçaria", Number(specific.sorcery_points), "long", "Gasta pontos em Metamagia ou conversão de espaços com o Mestre."); break
  }
  for (const r of resources) {
    const previous = sheet.resources[r.id]
    sheet.resources[r.id] = { ...r, used: r.unlimited ? 0 : Math.min(previous?.used ?? 0, r.max) }
  }
}

export interface LevelChoices { subclass?: string; asi?: string; feat?: string; choices?: Record<string, string[]> }

export function applyLevelChoices(sheet: Sheet, level: number, options: LevelChoices): void {
  syncProgression(sheet, level - 1)
  const previousFeatures = new Set(sheet.featureDetails.map((f) => f.id))
  if (options.subclass) {
    const sub = resolveSubclass(sheet.class, options.subclass)
    if (level < subclassRequiredLevel(sheet.class)) throw new Error("A escolha de subclasse ainda não está disponível.")
    if (sheet.subclass && resolveSubclass(sheet.class, sheet.subclass).index !== sub.index) throw new Error("Não é permitido trocar a subclasse ao subir de nível.")
    sheet.subclass = sub.index
  }
  if (!sheet.subclass && level >= subclassRequiredLevel(sheet.class)) throw new Error(`Escolha uma subclasse com --subclass: ${subclassesForClass(sheet.class).map((s) => s.index).join(", ")}.`)
  const asi = getClassLevel(sheet.class, level).features.some((f) => f.index.includes("ability-score-improvement"))
  if (options.asi && options.feat) throw new Error("Escolha apenas --asi ou --feat.")
  if (!asi && (options.asi || options.feat)) throw new Error(`Nível ${level} não concede aumento de atributo ou talento.`)
  if (asi && !options.asi && !options.feat) throw new Error(`Nível ${level}: escolha --asi for+2 (ou des+1,con+1) ou --feat grappler.`)
  if (options.asi) {
    const increases = new Map<Ability, number>()
    for (const part of options.asi.split(",")) {
      const match = /^\s*([\p{L}_-]+)\+([12])\s*$/u.exec(part)
      const ability = match && parseAbility(match[1])
      if (!match || !ability) throw new Error("ASI inválido: use for+2 ou des+1,con+1.")
      increases.set(ability, (increases.get(ability) ?? 0) + Number(match[2]))
    }
    if ([...increases.values()].reduce((a, b) => a + b, 0) !== 2) throw new Error("ASI deve distribuir exatamente 2 pontos.")
    for (const [a, n] of increases) if (sheet.abilities[a] + n > 20) throw new Error(`ASI não pode elevar ${a} acima de 20.`)
    for (const [a, n] of increases) sheet.abilities[a] += n
  }
  if (options.feat) {
    const found = searchSrd("feats", options.feat)
    if (found.length !== 1) throw new Error(`Talento "${options.feat}" não encontrado ou ambíguo. SRD: Grappler.`)
    const feat = found[0]
    if (sheet.feats.includes(String(feat.index)) || sheet.features.includes(String(feat.name))) throw new Error("Talento já adquirido.")
    for (const raw of feat.prerequisites as { ability_score?: { index: string }; minimum_score?: number }[]) {
      const a = raw.ability_score && parseAbility(raw.ability_score.index)
      if (!a || raw.minimum_score === undefined) throw new Error("Pré-requisito de talento não suportado pelo motor.")
      if (sheet.abilities[a] < raw.minimum_score) throw new Error(`Talento exige ${a} ${raw.minimum_score}.`)
    }
    sheet.feats.push(String(feat.index))
    attach(sheet, { id: String(feat.index), name: String(feat.name), description: (feat.desc as string[]).join("\n\n"), source: "feat" })
  }
  syncProgression(sheet, level)
  for (const [id, selected] of Object.entries(options.choices ?? {})) chooseFeature(sheet, level, id, selected)
  const pending = pendingFeatureChoices(sheet, level).filter((c) => c.level === level || !previousFeatures.has(c.id) || c.id === "eldritch-invocations")
  if (pending.length) throw new Error(`Escolhas obrigatórias: ${pending.map((c) => `${c.id} (${c.choose}): ${c.options.map((o) => o.id).join(", ")}`).join("; ")}. Informe --choices JSON {"habilidade":["opção"]}.`)
}

interface FeatureChoice { id: string; name: string; level: number; choose: number; kind: "feature" | "expertise"; options: { id: string; name: string }[] }

function meetsFeaturePrerequisites(sheet: Sheet, level: number, id: string): boolean {
  const feature = searchSrd("features", id).find((f) => f.index === id)
  if (!feature) return false
  return (feature.prerequisites as { type: string; level?: number; feature?: string; spell?: string }[]).every((p) => {
    if (p.type === "level") return level >= (p.level ?? Infinity)
    if (p.type === "feature") return sheet.featureDetails.some((f) => f.id === p.feature?.split("/").at(-1))
    if (p.type === "spell") {
      const spell = p.spell?.split("/").at(-1) ?? ""
      const record = searchSrd("spells", spell).find((s) => s.index === spell)
      return sheet.spells.some((s) => norm(s) === norm(spell) || norm(s) === norm(String(record?.name)) || (spell === "eldritch-blast" && norm(s) === "rajadamistica"))
    }
    return false // Não concede uma opção cujos requisitos o motor não sabe validar.
  })
}

export function pendingFeatureChoices(sheet: Sheet, level: number): FeatureChoice[] {
  return featureChoices(sheet, level).filter((c) => (sheet.featureChoices[c.id]?.length ?? 0) !== c.choose)
}

export function featureChoices(sheet: Sheet, level: number): FeatureChoice[] {
  return sheet.featureDetails.filter((d) => d.source === "class" || d.source === "subclass").flatMap((d) => {
    const f = searchSrd("features", d.id).find((f) => f.index === d.id)
    const specific = f?.feature_specific as { invocations?: { index: string; name: string }[]; subfeature_options?: { choose: number; from: { options: { item: { index: string; name: string } }[] } }; expertise_options?: { choose: number; from: { options: { item: { index: string; name: string } }[] } } } | undefined
    if (d.id === "eldritch-invocations" && specific?.invocations) {
      return [{ id: d.id, name: d.name, level: 2, choose: Number(getClassLevel(sheet.class, level).class_specific?.invocations_known), kind: "feature" as const, options: specific.invocations.filter((i) => meetsFeaturePrerequisites(sheet, level, i.index)).map((i) => ({ id: i.index, name: i.name })) }]
    }
    const spec = specific?.subfeature_options ?? specific?.expertise_options
    if (!spec?.from?.options) return []
    const kind = specific?.subfeature_options ? "feature" as const : "expertise" as const
    const options = spec.from.options.filter((o) => o.item).map((o) => ({ id: o.item.index, name: o.item.name })).filter((o) => kind !== "expertise" || sheet.skills.includes(parseSkill(o.id.replace(/^skill-/, "")) ?? ""))
    return [{ id: d.id, name: d.name, level: Number(f!.level), choose: spec.choose, kind, options }]
  }).filter((c) => c.level <= level)
}

export function chooseFeature(sheet: Sheet, level: number, id: string, selected: string[]): void {
  const choice = featureChoices(sheet, level).find((c) => c.id === id)
  if (!choice) throw new Error(`Escolha "${id}" não está disponível para esta ficha.`)
  const previous = sheet.featureChoices[id] ?? []
  if (previous.length && (id !== "eldritch-invocations" || previous.length >= choice.choose)) throw new Error(`Escolha "${id}" já foi feita.`)
  if (previous.some((p) => !selected.includes(p))) throw new Error("Mantenha as escolhas anteriores ao adicionar novas opções.")
  if (new Set(selected).size !== selected.length || selected.length !== choice.choose) throw new Error(`Escolha ${choice.choose} opções diferentes para ${id}.`)
  for (const option of selected) {
    if (!choice.options.some((o) => o.id === option)) throw new Error(`Opção "${option}" inválida para ${id}.`)
    if (previous.includes(option)) continue
    if (choice.kind === "expertise") {
      const skill = parseSkill(option.replace(/^skill-/, ""))!
      if (sheet.expertise.includes(skill)) throw new Error(`Perícia ${skill} já tem especialização.`)
    } else {
      if (sheet.featureDetails.some((f) => f.id === option)) throw new Error(`Habilidade ${option} já adquirida.`)
      if (!meetsFeaturePrerequisites(sheet, level, option)) throw new Error(`Pré-requisitos não atendidos: ${option}.`)
    }
  }
  for (const option of selected) {
    if (previous.includes(option)) continue
    if (choice.kind === "expertise") sheet.expertise.push(parseSkill(option.replace(/^skill-/, ""))!)
    else {
      const f = searchSrd("features", option).find((f) => f.index === option)!
      const source = sheet.featureDetails.find((f) => f.id === id)?.source === "subclass" ? "subclass" : "class"
      attach(sheet, { id: option, name: String(f.name), description: (f.desc as string[]).join("\n\n"), source })
    }
  }
  sheet.featureChoices[id] = selected
}

export function validateRacialAbilities(race: string, final: Record<Ability, number>, base?: Record<Ability, number>): void {
  if (!base) return
  const info = racialInfo(race)
  if (!info) throw new Error("Valores-base exigem uma raça ou sub-raça do catálogo SRD.")
  // Meio-elfo tem dois +1 livres, além do +2 em Carisma.
  const free = norm(race) === "meioelfo" || norm(race) === "halfelf"
  const extra = ABILITIES.map((a) => final[a] - base[a] - (info.bonuses[a] ?? 0))
  if (free) {
    if (extra.filter((n) => n === 1).length !== 2 || extra.some((n) => n !== 0 && n !== 1) || extra[ABILITIES.indexOf("car")] !== 0) throw new Error("Meio-elfo exige +2 Carisma e +1 em dois outros atributos diferentes.")
  } else if (extra.some((n) => n !== 0)) throw new Error("Atributos finais não correspondem aos valores-base + bônus raciais SRD.")
}
