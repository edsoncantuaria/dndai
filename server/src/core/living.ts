// Mundo vivo: agendas (relógios), eventos, rotinas de NPCs e rumores. O tempo é do motor: quando o relógio
// do jogo anda, `tickWorld` move NPCs pela rotina, avança agendas e vence eventos, tudo no mesmo lote do tempo.
import type { Campaign } from "./campaign.ts"
import { all, one } from "./db.ts"
import { type Op, put } from "./ledger.ts"
import { auraOfCharacter } from "./auras.ts"
import { RuleError, character, combatState, save, setCondition } from "./mechanics.ts"
import { alloc, pcRow } from "./pc.ts"

const fail = (m: string): never => { throw new RuleError(m) }
const text = (s: string, what: string): string => (s.trim() ? s.trim() : fail(`${what} vazio`))

// ---------- agendas ----------

export interface NewClock { name: string; owner?: string; segments: number; every_min?: number; on_complete: string; secret?: boolean }

export function createClock(c: Campaign, k: NewClock): string {
  if (!Number.isInteger(k.segments) || k.segments < 2 || k.segments > 12) fail("agenda de 2 a 12 etapas")
  if (k.every_min !== undefined && (!Number.isInteger(k.every_min) || k.every_min < 10)) fail("every_min: no mínimo 10 minutos")
  const ops: Op[] = []
  const id = alloc(c, "k", ops)
  ops.push(put("clocks", { id, name: text(k.name, "nome"), owner_id: k.owner ?? null, segments: k.segments, filled: 0, every_min: k.every_min ?? null, last_tick_min: c.time, on_complete: text(k.on_complete, "consequência"), secret: Number(k.secret ?? true), status: "ativo", created_turn: c.turn }))
  c.commit("agenda", ops)
  return id
}

export function tickClock(c: Campaign, id: string, n = 1): string {
  const k = one<{ name: string; segments: number; filled: number; status: string; on_complete: string }>(c.db, "SELECT name, segments, filled, status, on_complete FROM clocks WHERE id = ?", id) ?? fail(`agenda "${id}" não existe`)
  if (k.status !== "ativo") fail(`${k.name} já ${k.status}`)
  if (!Number.isInteger(n) || n < -4 || n > 4 || n === 0) fail("n entre -4 e 4 (diferente de 0)")
  const filled = Math.max(0, Math.min(k.segments, k.filled + n))
  c.commit("agenda", [put("clocks", { id, filled, status: filled >= k.segments ? "disparado" : "ativo" })])
  return filled >= k.segments ? `${k.name} DISPAROU: ${k.on_complete}` : `${k.name}: ${filled}/${k.segments}`
}

export function resolveClock(c: Campaign, id: string, outcome: string): void {
  const k = one<{ status: string }>(c.db, "SELECT status FROM clocks WHERE id = ?", id) ?? fail(`agenda "${id}" não existe`)
  if (k.status === "resolvido") fail("agenda já resolvida")
  c.commit("agenda", [put("clocks", { id, status: "resolvido", outcome: text(outcome, "desfecho") })])
}

// ---------- eventos agendados ----------

export function createEvent(c: Campaign, e: { in_minutes: number; text: string; place?: string }): number {
  if (!Number.isInteger(e.in_minutes) || e.in_minutes < 1) fail("in_minutes inválido")
  if (e.place && !one(c.db, "SELECT 1 FROM places WHERE id = ?", e.place)) fail(`local "${e.place}" não existe`)
  c.commit("evento", [put("events", { at_min: c.time + e.in_minutes, text: text(e.text, "texto"), place_id: e.place ?? null, status: "pendente", created_turn: c.turn })])
  return one<{ id: number }>(c.db, "SELECT MAX(id) id FROM events")!.id
}

export function resolveEvent(c: Campaign, id: number, outcome: string): void {
  if (!one(c.db, "SELECT 1 FROM events WHERE id = ?", id)) fail(`evento #${id} não existe`)
  c.commit("evento", [put("events", { id, status: "resolvido", outcome: text(outcome, "desfecho") })])
}

// ---------- rotinas de NPCs ----------

export interface ScheduleEntry { from: string; to: string; place: string }
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const minutesOf = (s: string): number => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))

export function setSchedule(c: Campaign, npc: string, entries: ScheduleEntry[]): void {
  const row = character(c, npc)
  if (row.kind !== "npc") fail("só NPCs têm rotina")
  if (entries.length > 8) fail("no máximo 8 trechos de rotina")
  for (const e of entries) {
    if (!HHMM.test(e.from) || !HHMM.test(e.to)) fail(`horário inválido (use HH:MM): ${e.from}–${e.to}`)
    if (!one(c.db, "SELECT 1 FROM places WHERE id = ?", e.place)) fail(`local "${e.place}" não existe`)
  }
  c.commit("rotina", [put("characters", { id: npc, schedule: entries })])
}

/** Onde a rotina manda o NPC estar a esta hora (undefined = sem trecho ativo). */
export function scheduledPlace(entries: ScheduleEntry[], minute: number): string | undefined {
  const t = minute % 1440
  for (const e of entries) {
    const a = minutesOf(e.from), b = minutesOf(e.to)
    if (a <= b ? t >= a && t < b : t >= a || t < b) return e.place
  }
  return undefined
}

// ---------- rumores ----------

export function createRumor(c: Campaign, r: { text: string; truth?: "verdade" | "falso" | "exagero"; spread_hours?: number; about?: string; place?: string }): number {
  const origin = r.place ?? pcRow(c)?.place_id ?? fail("sem local de origem para o rumor")
  if (!one(c.db, "SELECT 1 FROM places WHERE id = ?", origin)) fail(`local "${origin}" não existe`)
  const hours = r.spread_hours ?? 8
  if (!Number.isInteger(hours) || hours < 1 || hours > 72) fail("spread_hours de 1 a 72")
  c.commit("rumor", [put("rumors", { text: text(r.text, "rumor"), truth: r.truth ?? "verdade", origin_place: origin, born_min: c.time, spread_min: hours * 60, about_id: r.about ?? null })])
  return one<{ id: number }>(c.db, "SELECT MAX(id) id FROM rumors")!.id
}

/** Distância em saltos pelas ligações (BFS). */
export function hops(c: Campaign, from: string, to: string): number | undefined {
  if (from === to) return 0
  const edges = all<{ from_id: string; to_id: string }>(c.db, "SELECT from_id, to_id FROM links")
  const seen = new Set([from])
  let frontier = [from]
  for (let d = 1; frontier.length && d <= 12; d++) {
    const next: string[] = []
    for (const f of frontier) for (const e of edges) if (e.from_id === f && !seen.has(e.to_id)) { if (e.to_id === to) return d; seen.add(e.to_id); next.push(e.to_id) }
    frontier = next
  }
  return undefined
}

/** Rumores que já chegaram a um lugar (um salto por `spread_min` minutos desde que nasceram). */
export function rumorsAt(c: Campaign, place: string): { id: number; text: string; truth: string; age_h: number }[] {
  const out: { id: number; text: string; truth: string; age_h: number }[] = []
  for (const r of all<{ id: number; text: string; truth: string; origin_place: string; born_min: number; spread_min: number }>(c.db, "SELECT * FROM rumors ORDER BY id DESC LIMIT 40")) {
    const d = hops(c, r.origin_place, place)
    if (d !== undefined && c.time - r.born_min >= d * r.spread_min) out.push({ id: r.id, text: r.text, truth: r.truth, age_h: Math.floor((c.time - r.born_min) / 60) })
  }
  return out
}

// ---------- o tempo passa ----------

/** Chamado pelo Campaign quando o relógio avança: rotinas, agendas, eventos. Tudo dentro do mesmo lote. */
export function tickWorld(c: Campaign, from: number, to: number): void {
  if (to <= from) return
  const ops: Op[] = []
  // Rotinas: cada NPC vivo vai para onde a rotina manda neste horário (companheiros e quem está em combate ficam).
  const inCombat = new Set(combatState(c)?.order.map((o) => o.id) ?? [])
  for (const n of all<{ id: string; place_id: string | null; schedule: string }>(c.db, "SELECT id, place_id, schedule FROM characters WHERE kind = 'npc' AND status = 'vivo' AND companion = 0")) {
    const entries = JSON.parse(n.schedule) as ScheduleEntry[]
    if (!entries.length || inCombat.has(n.id)) continue
    const where = scheduledPlace(entries, to)
    if (where && where !== n.place_id) ops.push(put("characters", { id: n.id, place_id: where }))
  }
  // Agendas com ritmo próprio.
  for (const k of all<{ id: string; segments: number; filled: number; every_min: number; last_tick_min: number }>(c.db, "SELECT id, segments, filled, every_min, last_tick_min FROM clocks WHERE status = 'ativo' AND every_min IS NOT NULL")) {
    const steps = Math.floor((to - k.last_tick_min) / k.every_min)
    if (steps < 1) continue
    const filled = Math.min(k.segments, k.filled + steps)
    ops.push(put("clocks", { id: k.id, filled, last_tick_min: k.last_tick_min + steps * k.every_min, status: filled >= k.segments ? "disparado" : "ativo" }))
  }
  // Eventos que venceram.
  for (const e of all<{ id: number }>(c.db, "SELECT id FROM events WHERE status = 'pendente' AND at_min <= ?", to)) ops.push(put("events", { id: e.id, status: "vencido" }))
  if (ops.length) c.commit("mundo-segue", ops)
  // Clareira Feérica: a cada hora lá dentro, salvaguarda de SAB (CD 12) ou o encanto do lugar prende a mente.
  const hours = Math.floor(to / 60) - Math.floor(from / 60)
  if (hours > 0 && pcRow(c) && auraOfCharacter(c, "pc") === "feybleed") {
    const sheet = JSON.parse(pcRow(c)!.sheet) as { conditions?: string[] }
    if (!(sheet.conditions ?? []).includes("charmed")) {
      const r = save(c, "pc", "wis", 12)
      if (!r.success) setCondition(c, "pc", ["charmed"])
    }
  }
}

/** O que o Mestre precisa resolver agora por causa do tempo. */
export function pendencias(c: Campaign): string[] {
  const out: string[] = []
  for (const k of all<{ id: string; name: string; on_complete: string }>(c.db, "SELECT id, name, on_complete FROM clocks WHERE status = 'disparado'")) out.push(`agenda ${k.id} DISPAROU (${k.name}): ${k.on_complete} → narre as consequências e feche com clock.resolve`)
  for (const e of all<{ id: number; text: string }>(c.db, "SELECT id, text FROM events WHERE status = 'vencido'")) out.push(`evento #${e.id} venceu: ${e.text} → narre e feche com event.resolve`)
  return out
}

