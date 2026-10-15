// Catálogo SRD e geração de opções válidas para criação de personagem (5e SRD 2014).
import { type Ability, norm, parseAbility, parseClass, parseSkill, CLASSES } from "./rules.ts"
import { loadSrd, searchSrd } from "./srd.ts"

export interface ChoiceOption {
  id: string
  name: string
}

export interface ChoiceGroup {
  id: string
  label: string
  choose: number
  options: ChoiceOption[]
  kind: "skill" | "language" | "tool" | "equipment" | "ability"
}

export interface CharacterCreationOptions {
  catalog?: {
    races: ChoiceOption[]
    classes: ChoiceOption[]
    backgrounds: ChoiceOption[]
  }
  race: {
    id: string
    name: string
    fixedBonuses: Partial<Record<Ability, number>>
    choices: ChoiceGroup[]
  }
  class: {
    id: string
    name: string
    savingThrows: Ability[]
    proficiencies: ChoiceOption[]
    choices: ChoiceGroup[]
  }
  background: {
    id: string
    name: string
    proficiencies: ChoiceOption[]
    choices: ChoiceGroup[]
  }
  equipment: ChoiceGroup[]
}

const RACE_ALIASES: Record<string, string> = {
  humano: "human", humana: "human", human: "human",
  elfo: "high-elf", elfa: "high-elf", elf: "high-elf", altoelfo: "high-elf", "high-elf": "high-elf",
  anao: "hill-dwarf", ana: "hill-dwarf", dwarf: "hill-dwarf", anaodacolina: "hill-dwarf", "hill-dwarf": "hill-dwarf",
  halfling: "lightfoot-halfling", halflingpesleves: "lightfoot-halfling", "lightfoot-halfling": "lightfoot-halfling",
  gnomo: "rock-gnome", gnoma: "rock-gnome", gnome: "rock-gnome", gnomodarocha: "rock-gnome", "rock-gnome": "rock-gnome",
  draconato: "dragonborn", dragonborn: "dragonborn",
  meioelfo: "half-elf", "half-elf": "half-elf", halfelf: "half-elf",
  meioorc: "half-orc", "half-orc": "half-orc", halforc: "half-orc",
  tiefling: "tiefling",
}

const BACKGROUND_ALIASES: Record<string, string> = {
  acolito: "acolyte", acolyto: "acolyte", acolyte: "acolyte",
  heroidopovo: "folk-hero", "heroi-do-povo": "folk-hero", folkhero: "folk-hero", "folk-hero": "folk-hero",
  criminoso: "criminal", criminal: "criminal",
  soldado: "soldier", soldier: "soldier",
  sabio: "sage", sage: "sage",
  nobre: "noble", noble: "noble",
  forasteiro: "outlander", outlander: "outlander",
  charlatao: "charlatan", charlatan: "charlatan",
  artista: "entertainer", entertainer: "entertainer",
  marinheiro: "sailor", sailor: "sailor",
  eremita: "hermit", hermit: "hermit",
}

const LANGUAGE_LABELS: Record<string, string> = {
  common: "Comum",
  dwarvish: "Anão",
  elvish: "Élfico",
  giant: "Gigante",
  gnomish: "Gnômico",
  goblin: "Goblin",
  halfling: "Halfling",
  orc: "Orc",
  abyssal: "Abissal",
  celestial: "Celestial",
  draconic: "Dracônico",
  "deep-speech": "Dialeto Subterrâneo",
  infernal: "Infernal",
  primordial: "Primordial",
  sylvan: "Silvestre",
  undercommon: "Subcomum",
}

const TOOL_LABELS: Record<string, string> = {
  "thieves-tools": "Ferramentas de Ladrão",
  "herbalism-kit": "Kit de Herbalismo",
  "disguise-kit": "Kit de Disfarce",
  "forgery-kit": "Kit de Falsificação",
  "navigators-tools": "Ferramentas de Navegador",
  "poisoners-kit": "Kit de Envenenador",
  "smiths-tools": "Ferramentas de Ferreiro",
  "brewers-supplies": "Suprimentos de Cervejeiro",
  "masons-tools": "Ferramentas de Pedreiro",
  "alchemists-supplies": "Suprimentos de Alquimista",
  "calligraphers-supplies": "Suprimentos de Calígrafo",
  "carpenters-tools": "Ferramentas de Carpinteiro",
  "cartographers-tools": "Ferramentas de Cartógrafo",
  "cobblers-tools": "Ferramentas de Sapateiro",
  "cooks-utensils": "Utensílios de Cozinheiro",
  "glassblowers-tools": "Ferramentas de Soprador de Vidro",
  "jewelers-tools": "Ferramentas de Joalheiro",
  "leatherworkers-tools": "Ferramentas de Coureiro",
  "painters-supplies": "Suprimentos de Pintor",
  "potters-tools": "Ferramentas de Oleiro",
  "tinkers-tools": "Ferramentas de Funileiro",
  "weavers-tools": "Ferramentas de Tecelão",
  "woodcarvers-tools": "Ferramentas de Entalhador",
  "land-vehicles": "Veículos Terrestres",
  "water-vehicles": "Veículos Aquáticos",
  "dice-set": "Jogo de Dados",
  "playing-card-set": "Baralho de Cartas",
  bagpipes: "Gaita de Foles",
  drum: "Tambor",
  dulcimer: "Dulcimer",
  flute: "Flauta",
  lute: "Alaúde",
  lyre: "Lira",
  horn: "Trompa",
  "pan-flute": "Flauta de Pã",
  shawm: "Charamela",
  viol: "Viola",
}

const ITEM_LABELS: Record<string, string> = {
  dagger: "Adaga",
  shortsword: "Espada Curta",
  longsword: "Espada Longa",
  greatsword: "Espada Grande (Montante)",
  rapier: "Rapieira",
  scimitar: "Cimitarra",
  handaxe: "Machadinha",
  battleaxe: "Machado de Batalha",
  greataxe: "Machado Grande",
  mace: "Maça",
  warhammer: "Martelo de Guerra",
  maul: "Malho",
  halberd: "Alabarda",
  pike: "Pique",
  glaive: "Glaive",
  lance: "Lança de Montaria",
  javelin: "Dardo de Arremesso (Javelin)",
  spear: "Lança",
  quarterstaff: "Bordão",
  club: "Clava",
  greatclub: "Clava Grande",
  shortbow: "Arco Curto",
  longbow: "Arco Longo",
  arrow: "Flecha",
  "crossbow-light": "Besta Leve",
  "crossbow-heavy": "Besta Pesada",
  "crossbow-hand": "Besta de Mão",
  "crossbow-bolt": "Virote de Besta",
  shield: "Escudo",
  "leather-armor": "Armadura de Couro",
  "studded-leather-armor": "Couro Batido",
  "scale-mail": "Cota de Escamas",
  "chain-mail": "Cota de Malha",
  "chain-shirt": "Camisa de Malha",
  "ring-mail": "Cota de Anéis",
  "splint-armor": "Cota de Talas",
  "plate-armor": "Armadura de Placas",
  "explorers-pack": "Pacote de Explorador",
  "dungeoneers-pack": "Pacote de Masmorra (Aventureiro)",
  "priests-pack": "Pacote de Sacerdote",
  "burglars-pack": "Pacote de Ladrão",
  "scholars-pack": "Pacote de Estudioso",
  "diplomats-pack": "Pacote de Diplomata",
  "entertainers-pack": "Pacote de Artista",
  spellbook: "Grimório",
  "component-pouch": "Bolsa de Componentes",
  "clothes-common": "Roupas Comuns",
  pouch: "Algibeira",
  amulet: "Amuleto Sagrado",
  emblem: "Emblema Sagrado",
  reliquary: "Relicário Sagrado",
  crystal: "Cristal Arcano",
  orb: "Orbe Arcano",
  rod: "Cetro Arcano",
  staff: "Cajado Arcano",
  wand: "Varinha Arcana",
  "sprig-of-mistletoe": "Ramo de Visco",
  totem: "Totem Druídico",
  "wooden-staff": "Cajado de Madeira",
  "yew-wand": "Varinha de Teixo",
}

export function translateItem(id: string): string {
  return ITEM_LABELS[id] ?? id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function translateLanguage(id: string): string {
  return LANGUAGE_LABELS[id] ?? id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function translateTool(id: string): string {
  return TOOL_LABELS[id] ?? id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function resolveRaceKey(query: string): string | null {
  const k = norm(query)
  if (RACE_ALIASES[k]) return RACE_ALIASES[k]
  const allRaces = loadSrd("races") as { index: string; name: string }[]
  const allSub = loadSrd("subraces") as { index: string; name: string }[]
  const foundSub = allSub.find((s) => norm(s.index) === k || norm(s.name) === k)
  if (foundSub) return foundSub.index
  const foundRace = allRaces.find((r) => norm(r.index) === k || norm(r.name) === k)
  if (foundRace) return foundRace.index
  return null
}

export function resolveBackgroundKey(query: string): string | null {
  const k = norm(query)
  if (BACKGROUND_ALIASES[k]) return BACKGROUND_ALIASES[k]
  const allBg = loadSrd("backgrounds") as { index: string; name: string }[]
  const found = allBg.find((b) => norm(b.index) === k || norm(b.name) === k)
  if (found) return found.index
  return null
}

export function getCreationCatalog(): {
  races: ChoiceOption[]
  classes: ChoiceOption[]
  backgrounds: ChoiceOption[]
} {
  return {
    races: [
      { id: "human", name: "Humano" },
      { id: "high-elf", name: "Alto Elfo" },
      { id: "hill-dwarf", name: "Anão da Colina" },
      { id: "lightfoot-halfling", name: "Halfling Pés-Leves" },
      { id: "dragonborn", name: "Draconato" },
      { id: "rock-gnome", name: "Gnomo da Rocha" },
      { id: "half-elf", name: "Meio-Elfo" },
      { id: "half-orc", name: "Meio-Orc" },
      { id: "tiefling", name: "Tiefling" },
    ],
    classes: [
      { id: "barbarian", name: "Bárbaro" },
      { id: "bard", name: "Bardo" },
      { id: "cleric", name: "Clérigo" },
      { id: "druid", name: "Druida" },
      { id: "fighter", name: "Guerreiro" },
      { id: "monk", name: "Monge" },
      { id: "paladin", name: "Paladino" },
      { id: "ranger", name: "Patrulheiro" },
      { id: "rogue", name: "Ladino" },
      { id: "sorcerer", name: "Feiticeiro" },
      { id: "warlock", name: "Bruxo" },
      { id: "wizard", name: "Mago" },
    ],
    backgrounds: [
      { id: "acolyte", name: "Acólito" },
      { id: "folk-hero", name: "Herói do Povo" },
      { id: "criminal", name: "Criminoso" },
      { id: "soldier", name: "Soldado" },
      { id: "sage", name: "Sábio" },
      { id: "noble", name: "Nobre" },
      { id: "outlander", name: "Forasteiro" },
      { id: "charlatan", name: "Charlatão" },
      { id: "entertainer", name: "Artista" },
      { id: "sailor", name: "Marinheiro" },
      { id: "hermit", name: "Eremita" },
    ],
  }
}

const ALL_LANGUAGES: ChoiceOption[] = [
  { id: "common", name: "Comum" },
  { id: "dwarvish", name: "Anão" },
  { id: "elvish", name: "Élfico" },
  { id: "giant", name: "Gigante" },
  { id: "gnomish", name: "Gnômico" },
  { id: "goblin", name: "Goblin" },
  { id: "halfling", name: "Halfling" },
  { id: "orc", name: "Orc" },
  { id: "abyssal", name: "Abissal" },
  { id: "celestial", name: "Celestial" },
  { id: "draconic", name: "Dracônico" },
  { id: "deep-speech", name: "Dialeto Subterrâneo" },
  { id: "infernal", name: "Infernal" },
  { id: "primordial", name: "Primordial" },
  { id: "sylvan", name: "Silvestre" },
  { id: "undercommon", name: "Subcomum" },
]

const ALL_SKILLS: ChoiceOption[] = [
  { id: "atletismo", name: "Atletismo" },
  { id: "acrobacia", name: "Acrobacia" },
  { id: "furtividade", name: "Furtividade" },
  { id: "prestidigitacao", name: "Prestidigitação" },
  { id: "arcanismo", name: "Arcanismo" },
  { id: "historia", name: "História" },
  { id: "investigacao", name: "Investigação" },
  { id: "natureza", name: "Natureza" },
  { id: "religiao", name: "Religião" },
  { id: "adestrar", name: "Adestrar Animais" },
  { id: "intuicao", name: "Intuição" },
  { id: "medicina", name: "Medicina" },
  { id: "percepcao", name: "Percepção" },
  { id: "sobrevivencia", name: "Sobrevivência" },
  { id: "atuacao", name: "Atuação" },
  { id: "enganacao", name: "Enganação" },
  { id: "intimidacao", name: "Intimidação" },
  { id: "persuasao", name: "Persuasão" },
]

export function getCharacterCreationOptions(
  raceQuery: string,
  classQuery: string,
  backgroundQuery: string,
): CharacterCreationOptions {
  const raceKey = resolveRaceKey(raceQuery)
  if (!raceKey) throw new Error(`Raça inválida: "${raceQuery}". Opções: Humano, Elfo, Anão, Halfling, Draconato, Gnomo, Meio-Elfo, Meio-Orc, Tiefling.`)

  const clsKey = parseClass(classQuery)
  if (!clsKey || !CLASSES[clsKey]) throw new Error(`Classe inválida: "${classQuery}". Opções: ${Object.keys(CLASSES).join(", ")}.`)

  const bgKey = resolveBackgroundKey(backgroundQuery)
  if (!bgKey) throw new Error(`Antecedente inválido: "${backgroundQuery}". Opções: Acólito, Herói do Povo, Soldado, Criminoso, Sábio, Nobre, etc.`)

  // --- 1. RAÇA ---
  const allSub = loadSrd("subraces") as { index: string; name: string; race?: { index: string }; ability_bonuses?: { ability_score: { index: string }; bonus: number }[] }[]
  const allRaces = loadSrd("races") as { index: string; name: string; ability_bonuses: { ability_score: { index: string }; bonus: number }[] }[]

  const sub = allSub.find((s) => s.index === raceKey)
  const raceRecord = allRaces.find((r) => r.index === (sub?.race?.index ?? raceKey))
  if (!raceRecord) throw new Error(`Raça SRD não encontrada para "${raceKey}".`)

  const fixedBonuses: Partial<Record<Ability, number>> = {}
  const rawBonuses = [...raceRecord.ability_bonuses, ...(sub?.ability_bonuses ?? [])]
  for (const b of rawBonuses) {
    const a = parseAbility(b.ability_score.index)
    if (a) fixedBonuses[a] = (fixedBonuses[a] ?? 0) + b.bonus
  }

  const raceChoices: ChoiceGroup[] = []
  const raceName = sub?.name ?? raceRecord.name

  if (raceKey === "half-elf") {
    // Meio-elfo: +2 CAR (já em fixedBonuses) e escolha de 2 +1 em outros atributos
    raceChoices.push({
      id: "racial-ability-bonus",
      label: "Bônus de Atributos do Meio-Elfo (+1 em dois atributos distintos)",
      choose: 2,
      kind: "ability",
      options: [
        { id: "for", name: "Força (+1)" },
        { id: "des", name: "Destreza (+1)" },
        { id: "con", name: "Constituição (+1)" },
        { id: "int", name: "Inteligência (+1)" },
        { id: "sab", name: "Sabedoria (+1)" },
      ],
    })
    raceChoices.push({
      id: "racial-language",
      label: "Idioma Adicional do Meio-Elfo",
      choose: 1,
      kind: "language",
      options: ALL_LANGUAGES.filter((l) => l.id !== "common" && l.id !== "elvish"),
    })
    raceChoices.push({
      id: "racial-skill",
      label: "Versatilidade em Perícias (Meio-Elfo)",
      choose: 2,
      kind: "skill",
      options: ALL_SKILLS,
    })
  } else if (raceKey === "human") {
    raceChoices.push({
      id: "racial-language",
      label: "Idioma Adicional do Humano",
      choose: 1,
      kind: "language",
      options: ALL_LANGUAGES.filter((l) => l.id !== "common"),
    })
  } else if (raceKey === "high-elf") {
    raceChoices.push({
      id: "racial-language",
      label: "Idioma Adicional do Alto Elfo",
      choose: 1,
      kind: "language",
      options: ALL_LANGUAGES.filter((l) => l.id !== "common" && l.id !== "elvish"),
    })
  } else if (raceKey === "hill-dwarf" || raceKey === "dwarf") {
    raceChoices.push({
      id: "racial-tool",
      label: "Proficiência com Ferramentas de Artesão (Anão)",
      choose: 1,
      kind: "tool",
      options: [
        { id: "smiths-tools", name: "Ferramentas de Ferreiro" },
        { id: "brewers-supplies", name: "Suprimentos de Cervejeiro" },
        { id: "masons-tools", name: "Ferramentas de Pedreiro" },
      ],
    })
  }

  // --- 2. CLASSE ---
  const allClasses = loadSrd("classes") as {
    index: string
    name: string
    saving_throws: { index: string; name: string }[]
    proficiencies: { index: string; name: string }[]
    proficiency_choices: {
      choose: number
      type: string
      from: {
        option_set_type: string
        options: { option_type: string; item?: { index: string; name: string } }[]
      }
    }[]
    starting_equipment: { starting_equipment: { quantity: number; equipment: { index: string; name: string } }[] }
    starting_equipment_options: any[]
  }[]

  const classDef = CLASSES[clsKey]
  const srdClass = allClasses.find((c) => parseClass(c.index) === clsKey)
  if (!srdClass) throw new Error(`Classe SRD "${clsKey}" não encontrada.`)

  const classProficiencies: ChoiceOption[] = (srdClass.proficiencies ?? [])
    .filter((p) => !p.index.startsWith("saving-throw-"))
    .map((p) => ({
      id: p.index,
      name: TOOL_LABELS[p.index] ?? ITEM_LABELS[p.index] ?? p.name,
    }))

  const classChoices: ChoiceGroup[] = []
  for (const [idx, choice] of (srdClass.proficiency_choices ?? []).entries()) {
    if (choice.from?.option_set_type === "options_array") {
      const opts = choice.from.options
      const isSkillGroup = opts.some((o) => o.item?.index.startsWith("skill-"))
      if (isSkillGroup) {
        classChoices.push({
          id: `class-skills`,
          label: `Perícias de ${classDef.label}`,
          choose: choice.choose,
          kind: "skill",
          options: opts.map((o) => {
            const rawId = o.item?.index.replace(/^skill-/, "") ?? ""
            const skillKey = parseSkill(rawId) ?? rawId
            const label = ALL_SKILLS.find((s) => s.id === skillKey)?.name ?? o.item?.name ?? skillKey
            return { id: skillKey, name: label }
          }),
        })
      } else {
        // Ferramentas ou instrumentos musicais (como Bardo ou Monge)
        classChoices.push({
          id: `class-tools-${idx}`,
          label: `Ferramentas de ${classDef.label}`,
          choose: choice.choose,
          kind: "tool",
          options: opts.map((o) => ({
            id: o.item?.index ?? "",
            name: TOOL_LABELS[o.item?.index ?? ""] ?? o.item?.name ?? o.item?.index ?? "",
          })),
        })
      }
    }
  }

  // --- 3. ANTECEDENTE ---
  const allBackgrounds = loadSrd("backgrounds") as {
    index: string
    name: string
    starting_proficiencies?: { index: string; name: string }[]
    language_options?: { choose: number }
  }[]
  const srdBg = allBackgrounds.find((b) => b.index === bgKey)

  const bgProficiencies: ChoiceOption[] = []
  const bgChoices: ChoiceGroup[] = []
  let bgName = "Antecedente"

  if (srdBg) {
    bgName = srdBg.name
    for (const p of srdBg.starting_proficiencies ?? []) {
      const s = parseSkill(p.index.replace(/^skill-/, ""))
      if (s) {
        bgProficiencies.push({ id: s, name: ALL_SKILLS.find((k) => k.id === s)?.name ?? s })
      } else {
        bgProficiencies.push({ id: p.index, name: TOOL_LABELS[p.index] ?? p.name })
      }
    }
    if (srdBg.language_options) {
      bgChoices.push({
        id: "background-languages",
        label: `Idiomas de ${bgName}`,
        choose: srdBg.language_options.choose,
        kind: "language",
        options: ALL_LANGUAGES,
      })
    }
  } else {
    // Perfis dos antecedentes clássicos 5e para compatibilidade integral
    switch (bgKey) {
      case "folk-hero":
        bgName = "Herói do Povo"
        bgProficiencies.push({ id: "adestrar", name: "Adestrar Animais" }, { id: "sobrevivencia", name: "Sobrevivência" })
        bgChoices.push({
          id: "background-tools",
          label: "Ferramenta de Artesão (Herói do Povo)",
          choose: 1,
          kind: "tool",
          options: [
            { id: "smiths-tools", name: "Ferramentas de Ferreiro" },
            { id: "brewers-supplies", name: "Suprimentos de Cervejeiro" },
            { id: "masons-tools", name: "Ferramentas de Pedreiro" },
            { id: "carpenters-tools", name: "Ferramentas de Carpinteiro" },
            { id: "leatherworkers-tools", name: "Ferramentas de Coureiro" },
            { id: "weavers-tools", name: "Ferramentas de Tecelão" },
          ],
        })
        break
      case "criminal":
        bgName = "Criminoso"
        bgProficiencies.push({ id: "enganacao", name: "Enganação" }, { id: "furtividade", name: "Furtividade" }, { id: "thieves-tools", name: "Ferramentas de Ladrão" })
        bgChoices.push({
          id: "background-tools",
          label: "Jogo de Azar (Criminoso)",
          choose: 1,
          kind: "tool",
          options: [{ id: "dice-set", name: "Jogo de Dados" }, { id: "playing-card-set", name: "Baralho de Cartas" }],
        })
        break
      case "soldier":
        bgName = "Soldado"
        bgProficiencies.push({ id: "atletismo", name: "Atletismo" }, { id: "intimidacao", name: "Intimidação" }, { id: "land-vehicles", name: "Veículos Terrestres" })
        bgChoices.push({
          id: "background-tools",
          label: "Jogo de Azar (Soldado)",
          choose: 1,
          kind: "tool",
          options: [{ id: "dice-set", name: "Jogo de Dados" }, { id: "playing-card-set", name: "Baralho de Cartas" }],
        })
        break
      case "sage":
        bgName = "Sábio"
        bgProficiencies.push({ id: "arcanismo", name: "Arcanismo" }, { id: "historia", name: "História" })
        bgChoices.push({
          id: "background-languages",
          label: "Idiomas do Sábio",
          choose: 2,
          kind: "language",
          options: ALL_LANGUAGES,
        })
        break
      case "noble":
        bgName = "Nobre"
        bgProficiencies.push({ id: "historia", name: "História" }, { id: "persuasao", name: "Persuasão" })
        bgChoices.push({
          id: "background-languages",
          label: "Idioma do Nobre",
          choose: 1,
          kind: "language",
          options: ALL_LANGUAGES,
        })
        break
      case "outlander":
        bgName = "Forasteiro"
        bgProficiencies.push({ id: "atletismo", name: "Atletismo" }, { id: "sobrevivencia", name: "Sobrevivência" })
        bgChoices.push({
          id: "background-languages",
          label: "Idioma do Forasteiro",
          choose: 1,
          kind: "language",
          options: ALL_LANGUAGES,
        })
        break
      case "charlatan":
        bgName = "Charlatão"
        bgProficiencies.push({ id: "enganacao", name: "Enganação" }, { id: "prestidigitacao", name: "Prestidigitação" }, { id: "disguise-kit", name: "Kit de Disfarce" }, { id: "forgery-kit", name: "Kit de Falsificação" })
        break
      case "entertainer":
        bgName = "Artista"
        bgProficiencies.push({ id: "acrobacia", name: "Acrobacia" }, { id: "atuacao", name: "Atuação" }, { id: "disguise-kit", name: "Kit de Disfarce" })
        bgChoices.push({
          id: "background-tools",
          label: "Instrumento Musical (Artista)",
          choose: 1,
          kind: "tool",
          options: [
            { id: "lute", name: "Alaúde" },
            { id: "flute", name: "Flauta" },
            { id: "drum", name: "Tambor" },
            { id: "horn", name: "Trompa" },
          ],
        })
        break
      case "sailor":
        bgName = "Marinheiro"
        bgProficiencies.push({ id: "atletismo", name: "Atletismo" }, { id: "percepcao", name: "Percepção" }, { id: "navigators-tools", name: "Ferramentas de Navegador" }, { id: "water-vehicles", name: "Veículos Aquáticos" })
        break
      case "hermit":
        bgName = "Eremita"
        bgProficiencies.push({ id: "medicina", name: "Medicina" }, { id: "religiao", name: "Religião" }, { id: "herbalism-kit", name: "Kit de Herbalismo" })
        bgChoices.push({
          id: "background-languages",
          label: "Idioma do Eremita",
          choose: 1,
          kind: "language",
          options: ALL_LANGUAGES,
        })
        break
    }
  }

  // --- 4. EQUIPAMENTO INICIAL ---
  const cats = Object.fromEntries(
    (loadSrd("equipment-categories") as { index: string; name: string; equipment?: { index: string; name: string }[] }[]).map((c) => [c.index, c]),
  )

  function expandEquipmentOption(opt: any): ChoiceOption[] {
    if (opt.option_type === "counted_reference") {
      const idx = opt.of.index
      const count = opt.count ?? 1
      const label = translateItem(idx) + (count > 1 ? ` (${count})` : "")
      const id = idx + (count > 1 ? `:${count}` : "")
      return [{ id, name: label }]
    }
    if (opt.option_type === "reference") {
      const idx = opt.item.index
      return [{ id: idx, name: translateItem(idx) }]
    }
    if (opt.option_type === "multiple") {
      const subs = (opt.items as any[]).flatMap(expandEquipmentOption)
      const id = subs.map((s) => s.id).join("+")
      const name = subs.map((s) => s.name).join(" e ")
      return [{ id, name }]
    }
    if (opt.option_type === "choice") {
      const c = opt.choice
      if (c.from?.option_set_type === "equipment_category") {
        const cat = cats[c.from.equipment_category.index]
        const count = c.choose ?? 1
        return (cat?.equipment ?? []).map((e) => {
          const label = translateItem(e.index) + (count > 1 ? ` (${count})` : "")
          const id = e.index + (count > 1 ? `:${count}` : "")
          return { id, name: label }
        })
      }
    }
    return []
  }

  const equipmentChoices: ChoiceGroup[] = []
  const rawEquipOpts =
    srdClass.starting_equipment_options ??
    (srdClass.starting_equipment as any)?.starting_equipment_options ??
    []

  for (const [idx, opt] of rawEquipOpts.entries()) {
    let options: ChoiceOption[] = []
    if (opt.from?.option_set_type === "equipment_category") {
      const cat = cats[opt.from.equipment_category.index]
      options = (cat?.equipment ?? []).map((e) => ({
        id: e.index,
        name: translateItem(e.index),
      }))
    } else if (opt.from?.option_set_type === "options_array") {
      for (const itemOpt of opt.from.options) {
        if (itemOpt.option_type === "multiple" && itemOpt.items?.some((it: any) => it.option_type === "choice")) {
          // Ex.: (a) a martial weapon and a shield
          const choiceItem = itemOpt.items.find((it: any) => it.option_type === "choice")
          const otherItems = itemOpt.items.filter((it: any) => it.option_type !== "choice")
          if (choiceItem.choice?.from?.option_set_type === "equipment_category") {
            const cat = cats[choiceItem.choice.from.equipment_category.index]
            const suffixSubs = otherItems.flatMap(expandEquipmentOption)
            const suffixId = suffixSubs.map((s: ChoiceOption) => s.id).join("+")
            const suffixName = suffixSubs.map((s: ChoiceOption) => s.name).join(" e ")
            for (const wep of cat?.equipment ?? []) {
              options.push({
                id: `${wep.index}+${suffixId}`,
                name: `${translateItem(wep.index)} e ${suffixName}`,
              })
            }
          }
        } else {
          options.push(...expandEquipmentOption(itemOpt))
        }
      }
    }

    if (options.length > 0) {
      equipmentChoices.push({
        id: `equipment-class-${idx}`,
        label: opt.desc ? `Opção ${idx + 1}: ${opt.desc}` : `Equipamento de ${classDef.label} (${idx + 1})`,
        choose: opt.choose ?? 1,
        kind: "equipment",
        options,
      })
    }
  }

  // Equipamento de antecedente (ex.: Acólito escolhe símbolo sagrado)
  if (bgKey === "acolyte") {
    equipmentChoices.push({
      id: "equipment-bg-holy-symbol",
      label: "Símbolo Sagrado (Acólito)",
      choose: 1,
      kind: "equipment",
      options: [
        { id: "amulet", name: "Amuleto Sagrado" },
        { id: "emblem", name: "Emblema Sagrado" },
        { id: "reliquary", name: "Relicário Sagrado" },
      ],
    })
  }

  return {
    catalog: getCreationCatalog(),
    race: {
      id: raceKey,
      name: raceName,
      fixedBonuses,
      choices: raceChoices,
    },
    class: {
      id: clsKey,
      name: classDef.label,
      savingThrows: classDef.saves,
      proficiencies: classProficiencies,
      choices: classChoices,
    },
    background: {
      id: bgKey,
      name: bgName,
      proficiencies: bgProficiencies,
      choices: bgChoices,
    },
    equipment: equipmentChoices,
  }
}
