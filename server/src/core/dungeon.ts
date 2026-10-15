// Gerador de masmorras: grafo de salas com portas, segredos, armadilhas, enigmas, encontros e tesouro por nível.
// Determinístico pela semente. Tudo entra no mundo como lugares (salas) + características (features) ocultas.
import type { Campaign } from "./campaign.ts"
import { all, one } from "./db.ts"
import type { Rng } from "./dice.ts"
import { buildEncounter, type Difficulty, THEME_TYPES } from "./encounters.ts"
import { THEMES, THEME_IDS, type Theme } from "./dungeon-themes.ts"
import { type Op, put } from "./ledger.ts"
import { RuleError } from "./mechanics.ts"
import { alloc, pcRow } from "./pc.ts"
import { chance, newSeed, pick, seeded, shuffle } from "./rng.ts"
import { GOLD_PER_TURN_GP, minRarity } from "./scope.ts"

const fail = (m: string): never => { throw new RuleError(m) }

export type Role = "entrada" | "combate" | "armadilha" | "perigo" | "enigma" | "cofre" | "chefe" | "santuario" | "vazia"
export const band = (level: number): 0 | 1 | 2 | 3 => (level <= 4 ? 0 : level <= 10 ? 1 : level <= 16 ? 2 : 3)

const SAVE_DC: [number, number][] = [[10, 11], [12, 15], [16, 20], [21, 23]]
const SETBACK = ["1d10", "2d10", "4d10", "10d10"], DANGEROUS = ["2d10", "4d10", "10d10", "18d10"], DEADLY = ["4d10", "10d10", "18d10", "24d10"]
const LOCK_DC = [12, 15, 18, 22], SECRET_DC = [12, 14, 16, 18]
const RARITY_LEVEL: Record<string, number> = { common: 1, uncommon: 3, rare: 5, "very rare": 11, legendary: 17 }

export interface RoomPlan { id: string; name: string; role: Role; depth: number }
export interface DungeonPlan { id: string; name: string; theme: string; level: number; seed: number; rooms: RoomPlan[]; edges: { a: string; b: string; secret: boolean }[]; boss: string; entrance: string }

export interface DungeonOpts { entranceMinutes?: number; name?: string; theme?: string; level?: number; rooms?: number; from: string; difficulty?: Difficulty; seed?: number; party?: number; danger?: number }

function dc(rng: Rng, level: number, severity: "leve" | "perigosa" | "mortal"): { save: number; dmg: string } {
  const b = band(level)
  const [lo, hi] = SAVE_DC[b]!
  const dmg = severity === "leve" ? SETBACK[b]! : severity === "perigosa" ? DANGEROUS[b]! : DEADLY[b]!
  return { save: lo + rng(hi - lo + 1) - 1, dmg }
}

const ordinal = ["", " II", " III", " IV", " V", " VI"]

function nameRoom(rng: Rng, th: Theme, role: Role, used: Map<string, number>): string {
  const key = role === "armadilha" || role === "perigo" ? "corredor" : role === "combate" ? (chance(rng, 50) ? "salao" : "camara") : role === "enigma" ? "salao" : role === "vazia" ? "camara" : role
  const base = pick(rng, th.rooms[key as keyof Theme["rooms"]] ?? th.rooms.camara)
  const n = used.get(base) ?? 0
  used.set(base, n + 1)
  return `${base}${ordinal[n] ?? ` ${n + 1}`}`
}

/** Tesouro apropriado ao nível: ouro dentro do teto por turno, equipamento do SRD e, às vezes, um item mágico elegível. */
function lootFor(c: Campaign, rng: Rng, level: number, weight: number, magicPct: number, taken: Set<string>): { gp: number; items: { srd: string; qty: number }[]; magic?: string } {
  const b = band(level)
  const cap = GOLD_PER_TURN_GP[b]
  const base = [40, 300, 2000, 12000][b]!
  const gp = Math.max(1, Math.min(Math.floor(cap * 0.9), Math.round(base * weight * (0.6 + rng(8) / 10))))
  const items: { srd: string; qty: number }[] = []
  if (chance(rng, 60)) items.push({ srd: "potion-of-healing", qty: 1 + rng(2) - 1 + b })
  const gear = c.srd.list("equipment", "en").filter((e) => e.cost && (e.damage || e.armor_class || e.equipment_categories?.some((x: any) => x.index === "adventuring-gear")) && ({ gp: 1, sp: 0.1, cp: 0.01, ep: 0.5, pp: 10 }[e.cost.unit as string] ?? 1) * e.cost.quantity <= [60, 400, 2500, 20000][b]!)
  for (let i = 0; i < 1 + (weight >= 1 ? 1 : 0); i++) { const e = pick(rng, gear); if (!items.some((x) => x.srd === e.index)) items.push({ srd: e.index, qty: 1 }) }
  let magic: string | undefined
  if (chance(rng, magicPct)) {
    const pool = c.srd.list("magic-items", "en").filter((m) => {
      const r = minRarity(String(m.rarity?.name ?? ""))
      return r !== "artifact" && (RARITY_LEVEL[r] ?? 99) <= level && !taken.has(m.index) && !one(c.db, "SELECT 1 FROM items WHERE srd = ?", m.index) && !/Vorpal|Sphere of Annihilation/.test(m.name)
    })
    if (pool.length) { magic = pick(rng, pool).index; taken.add(magic) }
  }
  return { gp, items, magic }
}

export function generateDungeon(c: Campaign, o: DungeonOpts): DungeonPlan {
  const theme = o.theme ?? pick(seeded(newSeed()), THEME_IDS)
  const th = THEMES[theme] ?? fail(`tema desconhecido "${theme}" (${THEME_IDS.join(", ")})`)
  const level = o.level ?? (pcRow(c) ? Number(JSON.parse(pcRow(c)!.sheet).level ?? 1) : 1)
  if (!Number.isInteger(level) || level < 1 || level > 20) fail("nível de 1 a 20")
  const nRooms = o.rooms ?? 8
  if (!Number.isInteger(nRooms) || nRooms < 4 || nRooms > 20) fail("a masmorra tem de 4 a 20 salas")
  if (!one(c.db, "SELECT 1 FROM places WHERE id = ?", o.from)) fail(`local "${o.from}" não existe`)
  const seed = o.seed ?? newSeed()
  const rng = seeded(seed)
  const party = o.party ?? 1 + (one<{ n: number }>(c.db, "SELECT COUNT(*) n FROM characters WHERE companion = 1 AND status = 'vivo'")?.n ?? 0)

  // 1) Grafo: árvore com ramos + atalhos secretos.
  const adj: number[][] = Array.from({ length: nRooms }, () => [])
  const depth = new Array<number>(nRooms).fill(0)
  for (let i = 1; i < nRooms; i++) {
    const cand = Array.from({ length: i }, (_, k) => k).filter((k) => adj[k]!.length < 3)
    // Favorece o último nó (cria profundidade) sem virar corredor único.
    const parent = chance(rng, 55) ? i - 1 : pick(rng, cand)
    const p = adj[parent]!.length < 3 ? parent : pick(rng, cand)
    adj[i]!.push(p); adj[p]!.push(i); depth[i] = depth[p]! + 1
  }
  const leaves = Array.from({ length: nRooms }, (_, i) => i).filter((i) => i > 0 && adj[i]!.length === 1).sort((a, b) => depth[b]! - depth[a]!)
  const boss = leaves[0] ?? nRooms - 1
  const vault = leaves.find((x) => x !== boss) ?? (boss === nRooms - 1 ? nRooms - 2 : nRooms - 1)
  const secretEdges: [number, number][] = []
  if (nRooms >= 8) for (let t = 0; t < 12 && secretEdges.length < (nRooms >= 12 ? 2 : 1); t++) {
    const a = 1 + rng(nRooms - 1) - 1, b = 1 + rng(nRooms - 1) - 1
    if (a !== b && a !== boss && b !== boss && !adj[a]!.includes(b) && Math.abs(depth[a]! - depth[b]!) >= 2) { secretEdges.push([a, b]) }
  }

  // 2) Papéis.
  const role: Role[] = new Array<Role>(nRooms).fill("combate")
  role[0] = "entrada"; role[boss] = "chefe"; role[vault] = "cofre"
  const rest = shuffle(rng, Array.from({ length: nRooms }, (_, i) => i).filter((i) => i !== 0 && i !== boss && i !== vault))
  const wants: Role[] = ["armadilha", "enigma", "santuario", "perigo", "vazia", "armadilha"]
  rest.forEach((r, k) => { role[r] = k < wants.length && nRooms >= 6 + k ? wants[k]! : "combate" })
  if (nRooms >= 5 && !role.includes("combate")) role[rest[0] ?? 1] = "combate"

  // 3) Ids, nomes, lugares.
  const ops: Op[] = []
  const dId = alloc(c, "d", ops)
  const used = new Map<string, number>()
  const ids = Array.from({ length: nRooms }, () => alloc(c, "l", ops))
  const names = ids.map((_, i) => nameRoom(rng, th, role[i]!, used))
  const dungeonName = o.name ?? `${pick(rng, th.places)} ${pick(rng, th.epithets)}`
  const rooms: RoomPlan[] = ids.map((id, i) => ({ id, name: names[i]!, role: role[i]!, depth: depth[i]! }))
  const danger = o.danger ?? 2

  for (let i = 0; i < nRooms; i++) {
    const sense = pick(rng, th.senses)
    ops.push(put("places", {
      id: ids[i], name: names[i], kind: role[i] === "entrada" ? "entrada de masmorra" : "sala de masmorra", parent_id: null, summary: `${names[i]} — ${dungeonName}.`,
      details: `${names[i]}: ${sense}.`, visited: 0, created_turn: c.turn, aura: th.aura ?? null, dungeon_id: dId, danger,
    }))
  }
  const em = o.entranceMinutes ?? 10
  ops.push(put("links", { from_id: o.from, to_id: ids[0], minutes: em, via: "entrada" }), put("links", { from_id: ids[0], to_id: o.from, minutes: em, via: "saída" }))
  const edges: DungeonPlan["edges"] = []
  const link = (a: number, b: number, minutes: number) => { ops.push(put("links", { from_id: ids[a], to_id: ids[b], minutes, via: "" }), put("links", { from_id: ids[b], to_id: ids[a], minutes, via: "" })); edges.push({ a: ids[a]!, b: ids[b]!, secret: false }) }
  const tree: [number, number][] = []
  for (let i = 1; i < nRooms; i++) tree.push([adj[i]!.find((x) => x < i) ?? 0, i])
  for (const [a, b] of tree) link(a, b, 1 + rng(3) - 1)
  for (const [a, b] of secretEdges) edges.push({ a: ids[a]!, b: ids[b]!, secret: true }) // o elo só existe depois de achado

  // 4) Características.
  const feature = (placeIdx: number | string, kind: string, name: string, data: unknown, state: "oculto" | "visivel", dcFind = 0) =>
    ops.push(put("features", { place_id: typeof placeIdx === "number" ? ids[placeIdx] : placeIdx, kind, name, data, state, dc_find: dcFind, created_turn: c.turn }))
  const taken = new Set<string>()
  const types = THEME_TYPES[theme] ?? []
  const b = band(level)

  // Portas: algumas trancadas; a do chefe sempre, com a chave escondida em outra sala.
  const keyName = pick(rng, th.keys)
  const keyRoom = pick(rng, Array.from({ length: nRooms }, (_, i) => i).filter((i) => i !== boss && i !== vault && i !== 0))
  const doorKey = `${keyName} de ${dungeonName}`
  for (const [a, bb] of tree) {
    const toBoss = bb === boss || a === boss
    const toVault = bb === vault || a === vault
    if (toBoss) feature(bb, "porta", `Portão do ${th.bosses.length ? "covil" : "fim"}`, { a: ids[a], b: ids[bb], locked: LOCK_DC[b]! + rng(4) - 1, key: doorKey, open: false, desc: "uma porta reforçada, claramente importante" }, "visivel")
    else if (toVault && chance(rng, 70)) feature(bb, "porta", "Porta do cofre", { a: ids[a], b: ids[bb], locked: LOCK_DC[b]! + rng(4) - 1, open: false, desc: "uma porta trancada com fechadura elaborada" }, "visivel")
    else if (chance(rng, 22)) feature(bb, "porta", "Porta emperrada", { a: ids[a], b: ids[bb], locked: Math.max(8, LOCK_DC[b]! - 3), open: false, desc: "uma porta de madeira inchada" }, "visivel")
  }
  for (const [a, bb] of secretEdges) feature(bb, "porta", "Passagem secreta", { a: ids[a], b: ids[bb], locked: 0, secret: SECRET_DC[b]! + rng(4) - 1, open: false, desc: "uma passagem escondida por trás da pedra" }, "oculto", SECRET_DC[b]! + rng(4) - 1)

  for (let i = 0; i < nRooms; i++) {
    const r = role[i]!
    if (r === "combate" || r === "chefe") {
      const diff: Difficulty = r === "chefe" ? "alta" : depth[i]! <= 1 ? "baixa" : chance(rng, 35) ? "alta" : "moderada"
      const enc = buildEncounter(c.srd, rng, { level, party, difficulty: diff, types, maxCreatures: r === "chefe" ? 6 : 5 })
      const stance = r === "chefe" ? "alerta" : chance(rng, 35) ? "dormindo" : "alerta"
      feature(i, "monstros", r === "chefe" ? `Chefe: ${pick(rng, th.bosses)}` : `Encontro (${diff})`, { group: enc.group, total_xp: enc.total, budget: enc.budget, difficulty: diff, stance, spawned: false, ids: [], boss: r === "chefe" }, "oculto", 0)
      if (r === "combate" && chance(rng, 25)) { const l = lootFor(c, rng, level, 0.25, 0, taken); feature(i, "tesouro", pick(rng, ["Baú pequeno", "Bolsa esquecida", "Cadáver com pertences"]), { ...l, container: "baú" }, "oculto", 10 + b * 2 + rng(4) - 1) }
    } else if (r === "armadilha") {
      const t = pick(rng, th.traps)
      const sev = chance(rng, 60) ? "leve" : chance(rng, 85) ? "perigosa" : "mortal"
      const { save, dmg } = dc(rng, level, sev)
      const detect = 10 + b * 2 + rng(5) - 1, disarm = 10 + b * 2 + rng(5) - 1
      feature(i, "armadilha", t.name, { trigger: t.trigger, note: t.note, severity: sev, save: { ability: t.ability, dc: save }, damage: dmg, dtype: t.dtype, disarm_dc: disarm }, "oculto", detect)
    } else if (r === "perigo") {
      const h = pick(rng, th.hazards)
      const { save, dmg } = dc(rng, level, "leve")
      feature(i, "perigo", h.name, { note: h.note, save: { ability: h.ability, dc: save }, damage: dmg, dtype: h.dtype }, "visivel")
    } else if (r === "enigma") {
      const p = pick(rng, th.puzzles)
      const target = ids[1] !== undefined ? ids[Math.min(nRooms - 1, i + 1)] : ids[i]
      feature(i, "enigma", p.title, { prompt: p.prompt, hint: p.hint, check: { skill: p.skill, dc: 12 + b * 2 + rng(3) - 1 }, alt: p.alt ? { skill: p.alt, dc: 14 + b * 2 + rng(3) - 1 } : undefined, reward: "tesouro", target }, "visivel")
      const l = lootFor(c, rng, level, 0.5, 15, taken)
      feature(i, "tesouro", "Recompensa do enigma", { ...l, container: "nicho selado", sealed_by: "enigma" }, "oculto", 0)
    } else if (r === "santuario") {
      feature(i, "altar", pick(rng, ["Altar esquecido", "Fonte serena", "Estátua votiva"]), { boon: "descanso", note: "um lugar de calma: um descanso curto aqui não é interrompido" }, "visivel")
    } else if (r === "cofre") {
      const l = lootFor(c, rng, level, 1, 50, taken)
      feature(i, "tesouro", "Tesouro principal", { ...l, container: pick(rng, ["arca reforçada", "sarcófago de ouro", "cofre de pedra"]) }, "visivel")
      if (chance(rng, 60)) {
        const t = pick(rng, th.traps); const { save, dmg } = dc(rng, level, "perigosa")
        feature(i, "armadilha", `Proteção do cofre: ${t.name}`, { trigger: "abrir", note: t.note, severity: "perigosa", save: { ability: t.ability, dc: save }, damage: dmg, dtype: t.dtype, disarm_dc: 12 + b * 2 + rng(4) - 1 }, "oculto", 12 + b * 2 + rng(4) - 1)
      }
    }
    if (r === "chefe") { const l = lootFor(c, rng, level, 1.5, 80, taken); feature(i, "tesouro", "Butim do chefe", { ...l, container: "pilha de despojos", guarded: true }, "oculto", 0) }
    if (i === keyRoom) feature(i, "tesouro", doorKey, { gp: 0, items: [], key: doorKey, opens_boss: true, container: "escondido numa dobra" }, "oculto", 12 + b * 2 + rng(4) - 1)
  }

  ops.push(put("dungeons", { id: dId, name: dungeonName, theme, level, entrance: ids[0], boss_room: ids[boss], summary: `${th.label}: ${nRooms} salas, ND-alvo ${level}`, layout: { seed, rooms, edges }, status: "inexplorada", created_turn: c.turn }))
  c.commit("masmorra", ops)
  return { id: dId, name: dungeonName, theme, level, seed, rooms, edges, boss: ids[boss]!, entrance: ids[0]! }
}

export interface Feature { id: number; place_id: string; kind: string; name: string; data: any; state: string; dc_find: number }
export function featuresAt(c: Campaign, place: string): Feature[] {
  return all<Feature & { data: string }>(c.db, "SELECT * FROM features WHERE place_id = ? ORDER BY id", place).map((f) => ({ ...f, data: JSON.parse(f.data as unknown as string) }))
}
export function feature(c: Campaign, id: number): Feature {
  const f = one<Feature & { data: string }>(c.db, "SELECT * FROM features WHERE id = ?", id)
  if (!f) fail(`característica #${id} não existe`)
  return { ...f!, data: JSON.parse(f!.data as unknown as string) }
}
export function dungeonOf(c: Campaign, place: string): { id: string; name: string; theme: string; level: number; status: string; entrance: string; boss_room: string | null } | undefined {
  const p = one<{ dungeon_id: string | null }>(c.db, "SELECT dungeon_id FROM places WHERE id = ?", place)
  return p?.dungeon_id ? one(c.db, "SELECT id, name, theme, level, status, entrance, boss_room FROM dungeons WHERE id = ?", p.dungeon_id) : undefined
}

export const THEME_IDS_TUPLE = THEME_IDS as [string, ...string[]]
export { THEME_IDS }
