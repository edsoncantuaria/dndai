// Acesso tipado às entidades do mundo + resolução de referências.
import { isSharedPrefix, reserveId } from "./atlas.ts"
import { all, type DB, metaNum, one } from "./db.ts"
import { type Ability, CLASSES, mod, norm, profBonus, spellSlots } from "./rules.ts"

export interface Attack {
  name: string
  bonus: number
  damage: string
  type: string
}

export interface Sheet {
  race: string
  class: string
  subclass: string
  background: string
  abilities: Record<Ability, number>
  skills: string[]
  expertise: string[]
  saves: Ability[]
  attacks: Attack[]
  slots: Record<string, { max: number; used: number }>
  spells: string[]
  features: string[]
  hitDice: { die: number; max: number; used: number }
  conditions: string[]
  death: { success: number; fail: number }
  speed: number
  profBonus?: number
  xpValue?: number
  portrait?: string
}

export interface Persona {
  traits?: string[]
  voice?: string
  wants?: string
  fears?: string
  secret?: string
  notes?: string
}

export interface ScheduleEntry {
  from: string
  to: string
  place: string
}

export interface CharacterRow {
  id: string
  kind: "pc" | "npc"
  name: string
  summary: string
  place_id: string | null
  status: string
  hp: number
  max_hp: number
  temp_hp: number
  ac: number
  level: number
  xp: number
  cp: number
  sheet: string
  persona: string
  attitude: number
  faction_id: string | null
  schedule: string
  companion: number
  created_turn: number
}

export interface Character extends Omit<CharacterRow, "sheet" | "persona" | "schedule"> {
  sheet: Sheet
  persona: Persona
  schedule: ScheduleEntry[]
}

export interface PlaceRow {
  id: string
  name: string
  kind: string
  parent_id: string | null
  summary: string
  details: string
  visited: number
}

export interface ItemRow {
  id: string
  owner_char: string | null
  owner_place: string | null
  name: string
  qty: number
  kind: string
  props: string
  equipped: number
  drawn: number
  notes: string
}

export function defaultSheet(partial: Partial<Sheet> = {}): Sheet {
  return {
    race: "", class: "", subclass: "", background: "",
    abilities: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
    skills: [], expertise: [], saves: [], attacks: [], slots: {}, spells: [], features: [],
    hitDice: { die: 8, max: 1, used: 0 }, conditions: [], death: { success: 0, fail: 0 }, speed: 9,
    ...partial,
  }
}

export function getCharacter(db: DB, id: string): Character {
  const row = one<CharacterRow>(db, "SELECT * FROM characters WHERE id = ?", id)
  if (!row) throw new Error(`Personagem ${id} não existe.`)
  return {
    ...row,
    sheet: defaultSheet(JSON.parse(row.sheet)),
    persona: JSON.parse(row.persona),
    schedule: JSON.parse(row.schedule),
  }
}

export function saveSheet(db: DB, id: string, sheet: Sheet): void {
  db.prepare("UPDATE characters SET sheet = ? WHERE id = ?").run(JSON.stringify(sheet), id)
}

export function getPlace(db: DB, id: string): PlaceRow {
  const row = one<PlaceRow>(db, "SELECT * FROM places WHERE id = ?", id)
  if (!row) throw new Error(`Local ${id} não existe.`)
  return row
}

export function pcId(db: DB): string | undefined {
  return one<{ id: string }>(db, "SELECT id FROM characters WHERE kind = 'pc' ORDER BY created_turn LIMIT 1")?.id
}

export function requirePc(db: DB): Character {
  const id = pcId(db)
  if (!id) throw new Error("A campanha ainda não tem personagem do jogador. Crie com: dnd pc create")
  return getCharacter(db, id)
}

// ---------- estatísticas derivadas ----------

export function charProf(c: Character): number {
  return c.sheet.profBonus ?? profBonus(c.level)
}

export function abilityMod(c: Character, a: Ability): number {
  return mod(c.sheet.abilities[a])
}

export function skillBonus(c: Character, skill: string, ability: Ability): number {
  const prof = charProf(c)
  let bonus = abilityMod(c, ability)
  if (c.sheet.expertise.includes(skill)) bonus += prof * 2
  else if (c.sheet.skills.includes(skill)) bonus += prof
  return bonus
}

export function saveBonus(c: Character, a: Ability): number {
  return abilityMod(c, a) + (c.sheet.saves.includes(a) ? charProf(c) : 0)
}

export function spellInfo(c: Character): { ability: Ability; dc: number; attack: number } | undefined {
  const ability = CLASSES[c.sheet.class]?.spellAbility
  if (!ability) return undefined
  const m = abilityMod(c, ability) + charProf(c)
  return { ability, dc: 8 + m, attack: m }
}

export function maxSlotsFor(c: Character): Record<string, number> {
  return spellSlots(c.sheet.class, c.level)
}

// ---------- ids e referências ----------

export function slugify(name: string): string {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  return base.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-$/, "") || "x"
}

const PREFIX_TABLE: Record<string, string> = {
  pc: "characters", npc: "characters", place: "places", faction: "factions",
  item: "items", quest: "quests", clock: "clocks",
}

export function tableFor(id: string): string | undefined {
  return PREFIX_TABLE[id.split(":")[0]]
}

export function newId(db: DB, prefix: string, name: string): string {
  const table = PREFIX_TABLE[prefix]
  const base = `${prefix}:${slugify(name)}`
  // Locais, NPCs, facções e heróis são do multiverso: o id é reservado no atlas para nunca colidir.
  const shared = isSharedPrefix(prefix)
  let id = base
  for (let i = 2; one(db, `SELECT 1 FROM ${table} WHERE id = ?`, id) || (shared && !reserveId(db, id)); i++) id = `${base}-${i}`
  return id
}

export function exists(db: DB, id: string): boolean {
  const table = tableFor(id)
  return !!table && !!one(db, `SELECT 1 FROM ${table} WHERE id = ?`, id)
}

const NAME_TABLES: Record<string, { table: string; where?: string }> = {
  pc: { table: "characters", where: "kind = 'pc'" },
  npc: { table: "characters", where: "kind = 'npc'" },
  place: { table: "places" },
  faction: { table: "factions" },
  item: { table: "items" },
  quest: { table: "quests" },
  clock: { table: "clocks" },
}

/**
 * Resolve uma referência para um id existente. Aceita id ("npc:mara"), rótulo de lote ("$mara")
 * ou nome exato (sem acento/caixa). Ambiguidade ou ausência viram erro com sugestões.
 */
export function resolveRef(db: DB, ref: string, kinds: string[], labels?: Map<string, string>): string {
  const r = ref.trim()
  if (r.startsWith("$")) {
    const id = labels?.get(r.slice(1))
    if (!id) throw new Error(`Rótulo ${r} não foi definido antes neste lote (use "as": "${r.slice(1)}" na criação).`)
    return id
  }
  if (r === "pc" && kinds.includes("pc")) {
    const id = pcId(db)
    if (!id) throw new Error("Não há personagem do jogador.")
    return id
  }
  if (r.includes(":")) {
    const prefix = r.split(":")[0]
    if (!kinds.includes(prefix)) throw new Error(`"${r}" não é do tipo esperado (${kinds.join("/")}).`)
    if (exists(db, r)) return r
    throw new Error(`"${r}" não existe.${suggest(db, r.split(":")[1] ?? r, kinds)}`)
  }
  const wanted = norm(r)
  const matches: string[] = []
  for (const kind of kinds) {
    const spec = NAME_TABLES[kind]
    const rows = all<{ id: string; name: string }>(db, `SELECT id, ${spec.table === "quests" ? "title AS name" : "name"} FROM ${spec.table}${spec.where ? ` WHERE ${spec.where}` : ""}`)
    for (const row of rows) if (norm(row.name) === wanted) matches.push(row.id)
  }
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) throw new Error(`"${r}" é ambíguo: ${matches.join(", ")}. Use o id.`)
  throw new Error(`"${r}" não encontrado (${kinds.join("/")}).${suggest(db, r, kinds)}`)
}

function suggest(db: DB, text: string, kinds: string[]): string {
  const words = norm(text).replace(/[^a-z0-9]/g, " ").split(/\s+/).filter((w) => w.length >= 3)
  if (!words.length) return ""
  const found = new Set<string>()
  for (const kind of kinds) {
    const spec = NAME_TABLES[kind]
    const col = spec.table === "quests" ? "title" : "name"
    for (const row of all<{ id: string; name: string }>(db, `SELECT id, ${col} AS name FROM ${spec.table}${spec.where ? ` WHERE ${spec.where}` : ""}`)) {
      const n = norm(row.name) + row.id
      if (words.some((w) => n.includes(w))) found.add(`${row.name} [${row.id}]`)
    }
  }
  return found.size ? ` Talvez: ${[...found].slice(0, 6).join("; ")}.` : ""
}

// ---------- tempo ----------

export function now(db: DB): number {
  return metaNum(db, "now")
}

export function clockParts(minutes: number): { day: number; time: string; period: "madrugada" | "manhã" | "tarde" | "noite" } {
  const day = Math.floor(minutes / 1440) + 1
  const m = minutes % 1440
  const h = Math.floor(m / 60)
  const time = `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
  const period = h < 6 ? "madrugada" : h < 12 ? "manhã" : h < 18 ? "tarde" : "noite"
  return { day, time, period }
}

export function fmtClock(minutes: number): string {
  const p = clockParts(minutes)
  return `Dia ${p.day}, ${p.time} (${p.period})`
}

/** "90", "90m", "2h", "1h30m", "3d" → minutos. */
export function parseDuration(s: string | number): number {
  if (typeof s === "number") return s
  const clean = s.replace(/\s+/g, "").toLowerCase()
  if (/^\d+$/.test(clean)) return Number(clean)
  const re = /(\d+)(d|h|min|m)/g
  let total = 0
  let consumed = ""
  for (const m of clean.matchAll(re)) {
    consumed += m[0]
    total += Number(m[1]) * (m[2] === "d" ? 1440 : m[2] === "h" ? 60 : 1)
  }
  if (consumed !== clean || total <= 0) throw new Error(`Duração inválida: "${s}" (ex.: 30m, 2h, 1h30m, 1d).`)
  return total
}

export function parseHHMM(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new Error(`Horário inválido: "${s}" (use HH:MM).`)
  return Number(m[1]) * 60 + Number(m[2])
}

export function scheduledPlace(schedule: ScheduleEntry[], minutes: number): string | undefined {
  const t = minutes % 1440
  for (const e of schedule) {
    const from = parseHHMM(e.from)
    const to = parseHHMM(e.to)
    const inside = from <= to ? t >= from && t < to : t >= from || t < to
    if (inside) return e.place
  }
  return undefined
}

// ---------- dinheiro ----------

export function fmtMoney(cp: number): string {
  const po = Math.floor(cp / 100)
  const pp = Math.floor((cp % 100) / 10)
  const pc = cp % 10
  return `${po} po, ${pp} pp, ${pc} pc`
}

/** "5po", "3pp", "12pc", "1po5pp", número = cobre. Aceita sinal. */
export function parseMoney(s: string | number): number {
  if (typeof s === "number") return s
  const clean = s.replace(/\s+/g, "").toLowerCase()
  const sign = clean.startsWith("-") ? -1 : 1
  const body = clean.replace(/^[+-]/, "")
  if (/^\d+$/.test(body)) return sign * Number(body)
  let total = 0
  let consumed = ""
  for (const m of body.matchAll(/(\d+)(po|gp|pp|sp|pc|cp)/g)) {
    consumed += m[0]
    total += Number(m[1]) * (m[2] === "po" || m[2] === "gp" ? 100 : m[2] === "pp" || m[2] === "sp" ? 10 : 1)
  }
  if (consumed !== body) throw new Error(`Valor monetário inválido: "${s}" (ex.: 5po, 3pp, 1po5pp).`)
  return sign * total
}
