// Semeia um cenário pronto numa campanha nova: lugares, facções, NPCs, masmorras, ganchos, agendas e o livro do mundo.
import type { Campaign } from "../core/campaign.ts"
import { createFaction, addMember, setControl, setTie } from "../core/factions.ts"
import { generateDungeon } from "../core/dungeon.ts"
import { createClock, setSchedule } from "../core/living.ts"
import { type Op, meta, put } from "../core/ledger.ts"
import { alloc } from "../core/pc.ts"
import { createNpc } from "../core/world.ts"
import { setMeta } from "../core/db.ts"
import * as A from "./auralis.ts"

export interface WorldInfo { id: string; name: string; summary: string }
export const WORLDS: WorldInfo[] = [{ id: "auralis", name: A.NAME, summary: "Alta fantasia mística: três luas, Veios de Aurora, oito reinos, o Astrolábio quebrado e um mal sem nome. Pronto para jogar." }]

export function seedWorld(c: Campaign, id: string): void {
  if (id !== "auralis") throw new Error(`mundo "${id}" não existe (${WORLDS.map((w) => w.id).join(", ")})`)
  if (c.db.prepare("SELECT COUNT(*) n FROM places").get()!.n as number > 1) throw new Error("só se semeia um mundo em campanha vazia")
  c.atomic("mundo", () => {
    setMeta(c.db, "premise", A.PREMISE)
    setMeta(c.db, "tone", A.TONE)
    const ids = new Map<string, string>()
    const ops: Op[] = []
    ids.set(A.START_PLACE, "l0")
    for (const p of A.PLACES) if (!ids.has(p.key)) ids.set(p.key, alloc(c, "l", ops))
    const at = (k: string): string => ids.get(k) ?? (() => { throw new Error(`lugar "${k}" não definido no cenário`) })()
    for (const p of A.PLACES) ops.push(put("places", { id: at(p.key), name: p.name, kind: p.kind, parent_id: p.parent ? at(p.parent) : null, summary: p.summary, details: p.details, visited: p.key === A.START_PLACE ? 1 : 0, created_turn: 0, aura: p.aura ?? null, danger: p.danger ?? 1 }))
    const seen = new Set<string>()
    for (const p of A.PLACES) for (const [to, minutes, via] of p.links) {
      const k = [at(p.key), at(to)].sort().join("|")
      if (seen.has(k)) continue
      seen.add(k)
      ops.push(put("links", { from_id: at(p.key), to_id: at(to), minutes, via: via ?? "" }), put("links", { from_id: at(to), to_id: at(p.key), minutes, via: via ?? "" }))
    }
    c.commit("lugares", ops)

    const fid = new Map<string, string>()
    for (const f of A.FACTIONS) fid.set(f.key, createFaction(c, { name: f.name, kind: f.kind, summary: f.summary, goal: f.goal, secret: f.secret, parent: f.parent ? fid.get(f.parent) : undefined, power: f.power, known: f.known, ranks: f.ranks, join: f.join }))
    const pairs = new Map<string, [string, string, number]>()
    for (const f of A.FACTIONS) for (const [other, stance] of f.ties ?? []) pairs.set([f.key, other].sort().join("|"), [f.key, other, stance])
    for (const [a, b, stance] of pairs.values()) setTie(c, fid.get(a)!, fid.get(b)!, stance)
    for (const p of A.PLACES) if (p.control) setControl(c, at(p.key), fid.get(p.control)!)

    const nid = new Map<string, string>()
    for (const n of A.NPCS) {
      const id = createNpc(c, { name: n.name, summary: n.summary, place: at(n.place), persona: n.persona, attitude: n.attitude, srd: n.srd })
      nid.set(n.key, id)
      if (n.faction) addMember(c, id, fid.get(n.faction[0])!, n.faction[1])
      if (n.schedule) setSchedule(c, id, n.schedule.map((s) => ({ ...s, place: at(s.place) })))
    }

    for (const d of A.DUNGEONS) generateDungeon(c, { name: d.name, theme: d.theme, level: d.level, rooms: d.rooms, from: at(d.from), seed: d.seed, entranceMinutes: d.minutes, party: 1, danger: 2 })

    const hookOps: Op[] = A.HOOKS.map((h) => put("hooks", { kind: h.kind, text: h.text, about_id: null, turn: 0, at_min: c.time }))
    for (const f of A.SECRET_FACTS) hookOps.push(put("facts", { about_id: null, text: f, secret: 1, turn: 0, at_min: c.time }))
    A.BIBLE.forEach((b, i) => hookOps.push(meta(`${b.secret ? "bible-secret" : "bible"}:${String(i).padStart(2, "0")}:${b.key}`, `${b.title}\n${b.text}`)))
    c.commit("lore", hookOps)
    for (const k of A.CLOCKS) createClock(c, { name: k.name, owner: k.owner ? fid.get(k.owner) : undefined, segments: k.segments, every_min: k.every_hours ? k.every_hours * 60 : undefined, on_complete: k.on_complete, secret: true })
  })
}

/** Livro do mundo: seções públicas (e as secretas, se `secret`). */
export function bible(c: Campaign, opts: { secret?: boolean } = {}): { key: string; title: string; text: string; secret: boolean }[] {
  const rows = c.db.prepare("SELECT key, value FROM meta WHERE key LIKE 'bible:%' OR key LIKE 'bible-secret:%' ORDER BY substr(key, instr(key, ':') + 1)").all() as { key: string; value: string }[]
  return rows.filter((r) => opts.secret || r.key.startsWith("bible:")).map((r) => { const [title, ...rest] = r.value.split("\n"); return { key: r.key.replace(/^bible(-secret)?:\d+:/, ""), title: title!, text: rest.join("\n"), secret: r.key.startsWith("bible-secret:") } })
}
