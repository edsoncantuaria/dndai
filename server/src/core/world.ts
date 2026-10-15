// Mundo vivo: lugares, ligações, NPCs, fatos, memórias, missões, ganchos e tempo. Só IDs de entidades
// existentes entram em referências; nome novo nasce apenas nos create*.
import type { Campaign } from "./campaign.ts"
import { all, one } from "./db.ts"
import { meta, type Op, put } from "./ledger.ts"
import { RuleError, character } from "./mechanics.ts"
import { witnessMemory } from "./consequences.ts"
import { alloc } from "./pc.ts"

const fail = (m: string): never => { throw new RuleError(m) }
const text = (s: string, what: string): string => (s.trim() ? s.trim() : fail(`${what} vazio`))

function place(c: Campaign, id: string) {
  return one<{ id: string; name: string }>(c.db, "SELECT id, name FROM places WHERE id = ?", id) ?? fail(`local "${id}" não existe`)
}

export function createPlace(c: Campaign, p: { name: string; kind: string; summary: string; parent?: string; links?: { to: string; minutes: number; via?: string }[] }): string {
  const ops: Op[] = []
  if (p.parent) place(c, p.parent)
  // O mundo cresce sempre conectado: todo lugar novo liga a pelo menos um lugar existente.
  if (!p.links?.length) fail("todo lugar novo precisa de ao menos uma ligação (links: [{to, minutes}]) para o mundo não ficar solto")
  const id = alloc(c, "l", ops)
  ops.push(put("places", { id, name: text(p.name, "nome"), kind: text(p.kind, "tipo"), parent_id: p.parent ?? null, summary: text(p.summary, "resumo"), created_turn: c.turn }))
  for (const l of p.links ?? []) { place(c, l.to); ops.push(...linkOps(id, l.to, l.minutes, l.via)) }
  c.commit("local", ops)
  return id
}

const linkOps = (a: string, b: string, minutes: number, via = ""): Op[] => {
  if (!Number.isInteger(minutes) || minutes < 0) fail("minutos inválidos")
  return [put("links", { from_id: a, to_id: b, minutes, via }), put("links", { from_id: b, to_id: a, minutes, via })]
}

export function link(c: Campaign, a: string, b: string, minutes: number, via = ""): void {
  place(c, a); place(c, b)
  c.commit("ligacao", linkOps(a, b, minutes, via))
}

/** Menor caminho em minutos (Dijkstra simples). */
export function route(c: Campaign, from: string, to: string): { minutes: number; path: string[] } | undefined {
  const edges = all<{ from_id: string; to_id: string; minutes: number }>(c.db, "SELECT from_id, to_id, minutes FROM links")
  const dist = new Map([[from, 0]]); const prev = new Map<string, string>(); const todo = new Set([from])
  while (todo.size) {
    const cur = [...todo].reduce((a, b) => (dist.get(a)! <= dist.get(b)! ? a : b))
    todo.delete(cur)
    if (cur === to) break
    for (const e of edges.filter((x) => x.from_id === cur)) {
      const d = dist.get(cur)! + e.minutes
      if (d < (dist.get(e.to_id) ?? Infinity)) { dist.set(e.to_id, d); prev.set(e.to_id, cur); todo.add(e.to_id) }
    }
  }
  if (!dist.has(to)) return undefined
  const path = [to]
  while (path[0] !== from) path.unshift(prev.get(path[0]!)!)
  return { minutes: dist.get(to)!, path }
}

/** Move um personagem (e quem o acompanha) pelo caminho mais curto, somando o tempo da viagem. */
export function move(c: Campaign, who: string, to: string): { minutes: number; path: string[] } {
  const row = character(c, who)
  place(c, to)
  if (!row.place_id) fail(`${row.name} não está em nenhum local`)
  const r = route(c, row.place_id!, to) ?? fail(`não há caminho de ${row.place_id} até ${to}`)
  const ops: Op[] = [put("characters", { id: who, place_id: to }), put("places", { id: to, visited: 1 })]
  if (row.kind === "pc") {
    for (const f of all<{ id: string }>(c.db, "SELECT id FROM characters WHERE companion = 1 AND status = 'vivo'")) ops.push(put("characters", { id: f.id, place_id: to }))
    ops.push(meta("time", c.time + r.minutes))
  }
  c.commit("mover", ops)
  return r
}

export function advanceTime(c: Campaign, minutes: number): number {
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 24 * 60) fail("tempo deve ficar entre 1 minuto e 24 h")
  c.commit("tempo", [meta("time", c.time + minutes)])
  return c.time
}

export interface Persona { traits?: string[]; goal?: string; secret?: string; voice?: string; gender?: "m" | "f" }

export function createNpc(c: Campaign, n: { name: string; summary: string; place: string; persona?: Persona; attitude?: number; srd?: string; companion?: boolean }): string {
  place(c, n.place)
  const ops: Op[] = []
  const id = alloc(c, "n", ops)
  // Todo NPC tem bloco de estatísticas do SRD (padrão: plebeu); a persona é por cima.
  const m = c.srd.get("monsters", n.srd ?? "commoner", "en") ?? fail(`bloco de estatísticas "${n.srd}" não existe`)
  const sheet = { type: "monster", srd: m.index, cr: m.challenge_rating, prof: m.proficiency_bonus, speed: Object.values(m.speed).join(", "), abilities: { str: m.strength, dex: m.dexterity, con: m.constitution, int: m.intelligence, wis: m.wisdom, cha: m.charisma }, conditions: [], uses: {}, deathSaves: { ok: 0, fail: 0 } }
  const hp = m.hit_points, ac = m.armor_class[0].value, xp = m.xp
  ops.push(put("characters", { id, kind: "npc", name: text(n.name, "nome"), summary: text(n.summary, "resumo"), place_id: n.place, status: "vivo", hp, max_hp: hp, temp_hp: 0, ac, level: 0, xp, cp: 0, sheet, persona: n.persona ?? {}, attitude: n.attitude ?? 0, schedule: [], companion: Number(!!n.companion), created_turn: c.turn }))
  c.commit("npc", ops)
  return id
}

export function setAttitude(c: Campaign, npc: string, delta: number, reason: string): number {
  const row = character(c, npc)
  if (row.kind === "pc") fail("atitude é de NPC")
  text(reason, "motivo")
  const attitude = Math.max(-100, Math.min(100, row.attitude + delta))
  c.commit("atitude", [put("characters", { id: npc, attitude }), ...memoryOps(c, [npc], `Atitude ${delta >= 0 ? "+" : ""}${delta}: ${reason}`, 2)])
  return attitude
}

const memoryOps = (c: Campaign, npcs: string[], t: string, importance: number): Op[] =>
  npcs.map((n) => put("memories", { npc_id: character(c, n).id, text: text(t, "memória"), importance, turn: c.turn, at_min: c.time }))

export function remember(c: Campaign, npcs: string[], t: string, importance = 1): void {
  if (!npcs.length) fail("informe ao menos um NPC")
  c.commit("memoria", memoryOps(c, npcs, t, importance))
}

export function addFact(c: Campaign, f: { text: string; about?: string; secret?: boolean; witnessed?: boolean }): void {
  c.commit("fato", [put("facts", { about_id: f.about ?? null, text: text(f.text, "fato"), secret: Number(!!f.secret), turn: c.turn, at_min: c.time })])
  // Fato testemunhado: quem está no lugar passa a lembrar dele.
  if (f.witnessed && !f.secret) witnessMemory(c, one<{ place_id: string | null }>(c.db, "SELECT place_id FROM characters WHERE kind = 'pc'")?.place_id ?? null, f.text, 2)
}

export function addQuest(c: Campaign, q: { title: string; summary: string; giver?: string; objectives?: string[]; secret?: boolean }): string {
  const ops: Op[] = []
  const id = alloc(c, "q", ops)
  if (q.giver) character(c, q.giver)
  ops.push(put("quests", { id, title: text(q.title, "título"), summary: text(q.summary, "resumo"), giver_id: q.giver ?? null, objectives: q.objectives ?? [], secret: Number(!!q.secret), created_turn: c.turn, updated_turn: c.turn }))
  c.commit("missao", ops)
  return id
}

export function updateQuest(c: Campaign, id: string, status: "ativa" | "concluida" | "falhou" | "abandonada"): void {
  if (!one(c.db, "SELECT 1 FROM quests WHERE id = ?", id)) fail(`missão "${id}" não existe`)
  c.commit("missao", [put("quests", { id, status, updated_turn: c.turn })])
}

export function addHook(c: Campaign, kind: "promessa" | "ameaca" | "misterio" | "gancho", t: string, about?: string): void {
  c.commit("gancho", [put("hooks", { kind, text: text(t, "gancho"), about_id: about ?? null, turn: c.turn, at_min: c.time })])
}

/** Resume várias memórias de um NPC numa só (relação). As originais ficam, apontando para o resumo. */
export function consolidateMemories(c: Campaign, npc: string, ids: number[], summary: string): void {
  character(c, npc)
  const rows = c.db.prepare(`SELECT id FROM memories WHERE npc_id = ? AND merged_into IS NULL AND consolidated = 0 AND id IN (${ids.map(() => "?").join(",")})`).all(npc, ...ids) as { id: number }[]
  if (rows.length !== ids.length || ids.length < 2) fail("informe 2+ ids de memórias deste NPC ainda não resumidas")
  const next = (one<{ m: number | null }>(c.db, "SELECT MAX(id) m FROM memories")?.m ?? 0) + 1
  c.commit("memoria-resumo", [put("memories", { id: next, npc_id: npc, text: text(summary, "resumo"), importance: 3, turn: c.turn, at_min: c.time, consolidated: 1 }), ...ids.map((id) => put("memories", { id, merged_into: next }))])
}
