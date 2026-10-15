// Regras determinísticas do núcleo D&D 5e (SRD). Chaves internas em PT-BR sem acento.

export const ABILITIES = ["for", "des", "con", "int", "sab", "car"] as const
export type Ability = (typeof ABILITIES)[number]

export const ABILITY_NAMES: Record<Ability, string> = {
  for: "Força", des: "Destreza", con: "Constituição", int: "Inteligência", sab: "Sabedoria", car: "Carisma",
}

export function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[\s_-]+/g, "")
}

const ABILITY_ALIASES: Record<string, Ability> = {
  for: "for", forca: "for", str: "for", strength: "for",
  des: "des", destreza: "des", dex: "des", dexterity: "des",
  con: "con", constituicao: "con", constitution: "con",
  int: "int", inteligencia: "int", intelligence: "int",
  sab: "sab", sabedoria: "sab", wis: "sab", wisdom: "sab",
  car: "car", carisma: "car", cha: "car", charisma: "car",
}

export function parseAbility(s: string): Ability | undefined {
  return ABILITY_ALIASES[norm(s)]
}

export const SKILLS: Record<string, { ability: Ability; label: string }> = {
  atletismo: { ability: "for", label: "Atletismo" },
  acrobacia: { ability: "des", label: "Acrobacia" },
  furtividade: { ability: "des", label: "Furtividade" },
  prestidigitacao: { ability: "des", label: "Prestidigitação" },
  arcanismo: { ability: "int", label: "Arcanismo" },
  historia: { ability: "int", label: "História" },
  investigacao: { ability: "int", label: "Investigação" },
  natureza: { ability: "int", label: "Natureza" },
  religiao: { ability: "int", label: "Religião" },
  adestrar: { ability: "sab", label: "Adestrar Animais" },
  intuicao: { ability: "sab", label: "Intuição" },
  medicina: { ability: "sab", label: "Medicina" },
  percepcao: { ability: "sab", label: "Percepção" },
  sobrevivencia: { ability: "sab", label: "Sobrevivência" },
  atuacao: { ability: "car", label: "Atuação" },
  enganacao: { ability: "car", label: "Enganação" },
  intimidacao: { ability: "car", label: "Intimidação" },
  persuasao: { ability: "car", label: "Persuasão" },
}

const SKILL_ALIASES: Record<string, string> = {
  athletics: "atletismo", acrobatics: "acrobacia", stealth: "furtividade", sleightofhand: "prestidigitacao",
  arcana: "arcanismo", history: "historia", investigation: "investigacao", nature: "natureza", religion: "religiao",
  animalhandling: "adestrar", adestraranimais: "adestrar", lidarcomanimais: "adestrar", insight: "intuicao",
  medicine: "medicina", perception: "percepcao", survival: "sobrevivencia", performance: "atuacao",
  deception: "enganacao", intimidation: "intimidacao", persuasion: "persuasao",
}

export function parseSkill(s: string): string | undefined {
  const k = norm(s)
  if (SKILLS[k]) return k
  return SKILL_ALIASES[k]
}

export const CONDITIONS = [
  "agarrado", "amedrontado", "atordoado", "caido", "cego", "contido", "enfeiticado", "envenenado",
  "exausto", "impedido", "incapacitado", "inconsciente", "invisivel", "paralisado", "petrificado", "surdo",
] as const

export function parseCondition(s: string): string | undefined {
  const k = norm(s)
  return (CONDITIONS as readonly string[]).find((c) => c === k || k.startsWith(c.slice(0, 5)))
}

export function mod(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

export function profBonus(level: number): number {
  return 2 + Math.floor((Math.max(1, level) - 1) / 4)
}

export const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
]

export function levelForXp(xp: number): number {
  let lvl = 1
  for (let i = 0; i < XP_THRESHOLDS.length; i++) if (xp >= XP_THRESHOLDS[i]) lvl = i + 1
  return lvl
}

export type CasterKind = "full" | "half" | "pact"

export interface ClassDef {
  label: string
  hitDie: number
  saves: Ability[]
  caster?: CasterKind
  spellAbility?: Ability
}

export const CLASSES: Record<string, ClassDef> = {
  barbaro: { label: "Bárbaro", hitDie: 12, saves: ["for", "con"] },
  bardo: { label: "Bardo", hitDie: 8, saves: ["des", "car"], caster: "full", spellAbility: "car" },
  bruxo: { label: "Bruxo", hitDie: 8, saves: ["sab", "car"], caster: "pact", spellAbility: "car" },
  clerigo: { label: "Clérigo", hitDie: 8, saves: ["sab", "car"], caster: "full", spellAbility: "sab" },
  druida: { label: "Druida", hitDie: 8, saves: ["int", "sab"], caster: "full", spellAbility: "sab" },
  feiticeiro: { label: "Feiticeiro", hitDie: 6, saves: ["con", "car"], caster: "full", spellAbility: "car" },
  guerreiro: { label: "Guerreiro", hitDie: 10, saves: ["for", "con"] },
  ladino: { label: "Ladino", hitDie: 8, saves: ["des", "int"] },
  mago: { label: "Mago", hitDie: 6, saves: ["int", "sab"], caster: "full", spellAbility: "int" },
  monge: { label: "Monge", hitDie: 8, saves: ["for", "des"] },
  paladino: { label: "Paladino", hitDie: 10, saves: ["sab", "car"], caster: "half", spellAbility: "car" },
  patrulheiro: { label: "Patrulheiro", hitDie: 10, saves: ["for", "des"], caster: "half", spellAbility: "sab" },
}

/** Ouro inicial do PHB: média e máximo da rolagem da classe (po). 0 no `pc create` vira a média. */
export const STARTING_GP: Record<string, { avg: number; max: number }> = {
  barbaro: { avg: 50, max: 80 },
  bardo: { avg: 125, max: 200 },
  bruxo: { avg: 100, max: 160 },
  clerigo: { avg: 125, max: 200 },
  druida: { avg: 50, max: 80 },
  feiticeiro: { avg: 75, max: 120 },
  guerreiro: { avg: 125, max: 200 },
  ladino: { avg: 100, max: 160 },
  mago: { avg: 100, max: 160 },
  monge: { avg: 12, max: 20 },
  paladino: { avg: 125, max: 200 },
  patrulheiro: { avg: 125, max: 200 },
}

const CLASS_ALIASES: Record<string, string> = {
  barbarian: "barbaro", bard: "bardo", warlock: "bruxo", cleric: "clerigo", druid: "druida", sorcerer: "feiticeiro",
  fighter: "guerreiro", rogue: "ladino", wizard: "mago", monk: "monge", paladin: "paladino", ranger: "patrulheiro",
}

export function parseClass(s: string): string | undefined {
  const k = norm(s)
  if (CLASSES[k]) return k
  return CLASS_ALIASES[k]
}

const FULL_SLOTS: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
]

/** Espaços de magia máximos por nível de magia ("1".."9"). */
export function spellSlots(cls: string | undefined, level: number): Record<string, number> {
  const def = cls ? CLASSES[cls] : undefined
  const out: Record<string, number> = {}
  if (!def?.caster) return out
  if (def.caster === "pact") {
    const count = level >= 17 ? 4 : level >= 11 ? 3 : level >= 2 ? 2 : 1
    out[String(Math.min(5, Math.ceil(level / 2)))] = count
    return out
  }
  const effective = def.caster === "full" ? level : level < 2 ? 0 : Math.ceil(level / 2)
  if (effective < 1) return out
  FULL_SLOTS[effective - 1].forEach((n, i) => (out[String(i + 1)] = n))
  return out
}

export function attitudeLabel(a: number): string {
  if (a <= -60) return "hostil"
  if (a <= -20) return "desconfiado"
  if (a < 20) return "neutro"
  if (a < 60) return "amigável"
  return "leal"
}
