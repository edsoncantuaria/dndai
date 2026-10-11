// Lote atômico de operações sobre o mundo. É a ÚNICA forma do Mestre mudar o estado narrativo:
// tudo valida antes, tudo ou nada é gravado, e o resultado diz exatamente o que mudou.
import { z } from "zod"
import { all, type DB, index, log, metaNum, one } from "./db.ts"
import { gainXp, heal, applyDamage, useSlot } from "./mechanics.ts"
import { CLASSES, parseCondition } from "./rules.ts"
import { advanceTime, move } from "./simulation.ts"
import { creatureFromSrd } from "./srd.ts"
import {
  type Character, type ItemRow, defaultSheet, fmtMoney, getCharacter, getPlace, newId, now, parseDuration, parseHHMM, parseMoney,
  type Persona, resolveRef, saveSheet, type ScheduleEntry,
} from "./world.ts"

const text = z.string().trim().min(1)
const ref = z.string().trim().min(1)
const label = z.string().regex(/^[a-z0-9_-]+$/i, "rótulo: letras, números, _ ou -").optional()
const duration = z.union([z.number().int().positive(), z.string()])

const persona = z
  .object({
    traits: z.array(z.string()).optional(),
    voice: z.string().optional(),
    wants: z.string().optional(),
    fears: z.string().optional(),
    secret: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict()

const schedule = z.array(z.object({ from: z.string(), to: z.string(), place: ref }).strict())

const attack = z.object({ name: text, bonus: z.number().int(), damage: text, type: z.string().default("") }).strict()

const abilities = z
  .object({ for: z.number().int(), des: z.number().int(), con: z.number().int(), int: z.number().int(), sab: z.number().int(), car: z.number().int() })
  .strict()

const linkSpec = z.object({ to: ref, minutes: duration, via: z.string().default(""), oneway: z.boolean().default(false) }).strict()

export const OpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create.place"), as: label, name: text, kind: text, summary: text, details: z.string().default(""),
    parent: ref.optional(), links: z.array(linkSpec).default([]),
  }).strict(),
  z.object({
    op: z.literal("create.npc"), as: label, name: text, summary: text, place: ref.optional(), persona: persona.default({}),
    attitude: z.number().int().min(-100).max(100).default(0), faction: ref.optional(), srd: z.string().optional(),
    stats: z.object({ ac: z.number().int().optional(), hp: z.number().int().positive().optional(), level: z.number().int().min(1).max(20).optional(), abilities: abilities.optional(), attacks: z.array(attack).optional(), skills: z.array(z.string()).optional() }).strict().optional(),
    schedule: schedule.default([]), companion: z.boolean().default(false),
  }).strict(),
  z.object({ op: z.literal("create.faction"), as: label, name: text, summary: text, goal: z.string().default(""), attitude: z.number().int().min(-100).max(100).default(0) }).strict(),
  z.object({
    op: z.literal("create.item"), as: label, owner: ref, name: text, qty: z.number().int().positive().default(1), kind: z.string().default("equipamento"),
    props: z.record(z.unknown()).default({}), notes: z.string().default(""), equipped: z.boolean().default(false),
  }).strict(),
  z.object({ op: z.literal("create.quest"), as: label, title: text, summary: text, giver: ref.optional(), objectives: z.array(text).default([]), secret: z.boolean().default(false) }).strict(),
  z.object({
    op: z.literal("create.clock"), as: label, name: text, owner: ref.optional(), segments: z.number().int().min(2).max(12),
    every: duration.optional(), on_complete: text, secret: z.boolean().default(true),
  }).strict(),
  z.object({ op: z.literal("create.event"), in: duration, text, place: ref.optional() }).strict(),
  z.object({ op: z.literal("link"), from: ref, to: ref, minutes: duration, via: z.string().default(""), oneway: z.boolean().default(false) }).strict(),
  z.object({ op: z.literal("move"), who: ref, to: ref }).strict(),
  z.object({
    op: z.literal("update"), id: ref,
    name: text.optional(), summary: text.optional(), details: z.string().optional(), kind: text.optional(), goal: z.string().optional(),
    status: z.enum(["vivo", "inconsciente", "morto", "desaparecido"]).optional(), ac: z.number().int().optional(),
    max_hp: z.number().int().positive().optional(), persona: persona.optional(), schedule: schedule.optional(),
    companion: z.boolean().optional(), faction: ref.nullable().optional(), notes: z.string().optional(),
    props: z.record(z.unknown()).optional(), features_add: z.array(text).optional(), spells_add: z.array(text).optional(),
    spells_remove: z.array(text).optional(), portrait: z.string().optional(), parent: ref.nullable().optional(),
  }).strict(),
  z.object({ op: z.literal("hp"), who: ref, damage: z.number().int().positive().optional(), heal: z.number().int().positive().optional(), temp: z.number().int().min(0).optional() }).strict(),
  z.object({ op: z.literal("condition"), who: ref, add: z.array(text).default([]), remove: z.array(text).default([]) }).strict(),
  z.object({ op: z.literal("money"), who: ref, amount: z.union([z.number().int(), z.string()]), reason: z.string().default("") }).strict(),
  z.object({ op: z.literal("item.give"), item: ref, to: ref, qty: z.number().int().positive().optional() }).strict(),
  z.object({ op: z.literal("item.qty"), item: ref, delta: z.number().int() }).strict(),
  z.object({ op: z.literal("item.equip"), item: ref, equipped: z.boolean() }).strict(),
  z.object({ op: z.literal("attitude"), npc: ref, delta: z.number().int().min(-100).max(100), reason: text }).strict(),
  z.object({ op: z.literal("memory"), npcs: z.array(ref).min(1), text, importance: z.number().int().min(1).max(3).default(1) }).strict(),
  z.object({ op: z.literal("fact"), text, about: ref.optional(), secret: z.boolean().default(false), lore: z.boolean().default(false) }).strict(),
  z.object({ op: z.literal("reveal"), fact: z.number().int().positive() }).strict(),
  z.object({
    op: z.literal("quest.update"), quest: ref, status: z.enum(["ativa", "concluida", "falhou", "abandonada"]).optional(),
    complete: z.array(z.number().int().min(0)).default([]), add: z.array(text).default([]), summary: text.optional(), reveal: z.boolean().optional(),
  }).strict(),
  z.object({ op: z.literal("clock.tick"), clock: ref, n: z.number().int().min(-12).max(12).default(1) }).strict(),
  z.object({ op: z.literal("clock.resolve"), clock: ref, outcome: text }).strict(),
  z.object({ op: z.literal("event.resolve"), event: z.number().int().positive(), outcome: text }).strict(),
  z.object({ op: z.literal("xp"), who: ref, amount: z.number().int().positive() }).strict(),
  z.object({ op: z.literal("slot.use"), who: ref, level: z.number().int().min(1).max(9) }).strict(),
  z.object({ op: z.literal("time"), advance: duration }).strict(),
])

export type Op = z.infer<typeof OpSchema>

export function parseOps(input: unknown): Op[] {
  const list = Array.isArray(input) ? input : (input as { ops?: unknown })?.ops ?? [input]
  if (!Array.isArray(list) || !list.length) throw new Error("Lote vazio. Envie um array JSON de operações.")
  return list.map((raw, i) => {
    const r = OpSchema.safeParse(raw)
    if (r.success) return r.data
    const issues = r.error.issues.map((x) => `${x.path.join(".") || "(raiz)"}: ${x.message}`).join("; ")
    const name = (raw as { op?: string })?.op
    throw new Error(`Operação ${i + 1}${name ? ` (${name})` : ""} inválida: ${issues}`)
  })
}

interface Tx {
  db: DB
  labels: Map<string, string>
  turn: number
}

const CHAR = ["pc", "npc"]

function r(tx: Tx, value: string, kinds: string[]): string {
  return resolveRef(tx.db, value, kinds, tx.labels)
}

function remember(tx: Tx, as: string | undefined, id: string): void {
  if (!as) return
  if (tx.labels.has(as)) throw new Error(`Rótulo "${as}" repetido no lote.`)
  tx.labels.set(as, id)
}

function addMemory(tx: Tx, npc: string, textValue: string, importance: number): void {
  const c = getCharacter(tx.db, npc)
  if (c.kind !== "npc") throw new Error(`${c.name} não é NPC (memórias são de NPCs).`)
  const res = tx.db.prepare("INSERT INTO memories(npc_id, text, importance, turn, at_min) VALUES(?,?,?,?,?)").run(npc, textValue, importance, tx.turn, now(tx.db))
  index(tx.db, `mem:${res.lastInsertRowid}`, "memória", `${c.name}: ${textValue}`)
}

function indexEntity(db: DB, id: string, name: string, ...parts: string[]): void {
  index(db, id, "entidade", [name, ...parts].filter(Boolean).join(" — "))
}

function validateSchedule(tx: Tx, entries: ScheduleEntry[]): ScheduleEntry[] {
  return entries.map((e) => {
    parseHHMM(e.from)
    parseHHMM(e.to)
    return { ...e, place: r(tx, e.place, ["place"]) }
  })
}

function applyOne(tx: Tx, op: Op): string {
  const db = tx.db
  switch (op.op) {
    case "create.place": {
      const parent = op.parent ? r(tx, op.parent, ["place"]) : null
      const id = newId(db, "place", op.name)
      db.prepare("INSERT INTO places(id, name, kind, parent_id, summary, details, created_turn) VALUES(?,?,?,?,?,?,?)").run(id, op.name, op.kind, parent, op.summary, op.details, tx.turn)
      remember(tx, op.as, id)
      for (const l of op.links) addLink(tx, id, r(tx, l.to, ["place"]), parseDuration(l.minutes), l.via, l.oneway)
      indexEntity(db, id, op.name, op.kind, op.summary, op.details)
      return `+ local ${op.name} [${id}]${op.links.length ? ` com ${op.links.length} ligação(ões)` : ""}`
    }
    case "create.npc": {
      const place = op.place ? r(tx, op.place, ["place"]) : null
      const faction = op.faction ? r(tx, op.faction, ["faction"]) : null
      let sheet = defaultSheet()
      let ac = 10
      let hp = 4
      let level = op.stats?.level ?? 1
      let srdNote = ""
      if (op.srd) {
        const c = creatureFromSrd(op.srd)
        sheet = c.sheet
        ac = c.ac
        hp = c.hp
        srdNote = ` (estatísticas SRD: ${c.srdName}, CA ${ac}, ${hp} PV)`
      }
      if (op.stats) {
        if (op.stats.abilities) sheet.abilities = op.stats.abilities
        if (op.stats.attacks) sheet.attacks = op.stats.attacks
        if (op.stats.skills) sheet.skills = op.stats.skills
        ac = op.stats.ac ?? ac
        hp = op.stats.hp ?? hp
        level = op.stats.level ?? level
      }
      const id = newId(db, "npc", op.name)
      const sched = validateSchedule(tx, op.schedule)
      db.prepare(
        `INSERT INTO characters(id, kind, name, summary, place_id, hp, max_hp, ac, level, sheet, persona, attitude, faction_id, schedule, companion, created_turn)
         VALUES(?, 'npc', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, op.name, op.summary, place, hp, hp, ac, level, JSON.stringify(sheet), JSON.stringify(op.persona), op.attitude, faction, JSON.stringify(sched), op.companion ? 1 : 0, tx.turn)
      remember(tx, op.as, id)
      indexEntity(db, id, op.name, op.summary, op.persona.traits?.join(", ") ?? "", op.persona.wants ?? "")
      return `+ NPC ${op.name} [${id}]${place ? ` em ${getPlace(db, place).name}` : ""}${srdNote}`
    }
    case "create.faction": {
      const id = newId(db, "faction", op.name)
      db.prepare("INSERT INTO factions(id, name, summary, goal, attitude, created_turn) VALUES(?,?,?,?,?,?)").run(id, op.name, op.summary, op.goal, op.attitude, tx.turn)
      remember(tx, op.as, id)
      indexEntity(db, id, op.name, op.summary, op.goal)
      return `+ facção ${op.name} [${id}]`
    }
    case "create.item": {
      const owner = r(tx, op.owner, ["pc", "npc", "place"])
      const id = newId(db, "item", op.name)
      const isPlace = owner.startsWith("place:")
      db.prepare("INSERT INTO items(id, owner_char, owner_place, name, qty, kind, props, equipped, notes) VALUES(?,?,?,?,?,?,?,?,?)").run(
        id, isPlace ? null : owner, isPlace ? owner : null, op.name, op.qty, op.kind, JSON.stringify(op.props), op.equipped ? 1 : 0, op.notes
      )
      remember(tx, op.as, id)
      return `+ item ${op.qty}× ${op.name} [${id}] → ${owner}`
    }
    case "create.quest": {
      const giver = op.giver ? r(tx, op.giver, CHAR) : null
      const id = newId(db, "quest", op.title)
      const objectives = op.objectives.map((t) => ({ text: t, done: false }))
      db.prepare("INSERT INTO quests(id, title, summary, giver_id, objectives, secret, created_turn, updated_turn) VALUES(?,?,?,?,?,?,?,?)").run(
        id, op.title, op.summary, giver, JSON.stringify(objectives), op.secret ? 1 : 0, tx.turn, tx.turn
      )
      remember(tx, op.as, id)
      indexEntity(db, id, op.title, op.summary)
      return `+ missão ${op.title} [${id}]`
    }
    case "create.clock": {
      const owner = op.owner ? r(tx, op.owner, ["npc", "faction", "place", "pc"]) : null
      const id = newId(db, "clock", op.name)
      const every = op.every !== undefined ? parseDuration(op.every) : null
      db.prepare("INSERT INTO clocks(id, name, owner_id, segments, every_min, last_tick_min, on_complete, secret, created_turn) VALUES(?,?,?,?,?,?,?,?,?)").run(
        id, op.name, owner, op.segments, every, now(db), op.on_complete, op.secret ? 1 : 0, tx.turn
      )
      remember(tx, op.as, id)
      return `+ agenda ${op.name} [${id}] 0/${op.segments}${every ? `, avança a cada ${every} min` : ", avança manualmente"}`
    }
    case "create.event": {
      const place = op.place ? r(tx, op.place, ["place"]) : null
      const at = now(db) + parseDuration(op.in)
      const res = db.prepare("INSERT INTO events(at_min, text, place_id, created_turn) VALUES(?,?,?,?)").run(at, op.text, place, tx.turn)
      return `+ evento #${res.lastInsertRowid} agendado: ${op.text}`
    }
    case "link": {
      const from = r(tx, op.from, ["place"])
      const to = r(tx, op.to, ["place"])
      addLink(tx, from, to, parseDuration(op.minutes), op.via, op.oneway)
      return `~ ligação ${from} ↔ ${to} (${parseDuration(op.minutes)} min)`
    }
    case "move":
      return move(db, r(tx, op.who, CHAR), r(tx, op.to, ["place"])).join(" ")
    case "update":
      return applyUpdate(tx, op)
    case "hp": {
      const who = r(tx, op.who, CHAR)
      const out: string[] = []
      if (op.damage) out.push(applyDamage(db, who, op.damage, false))
      if (op.heal) out.push(heal(db, who, op.heal))
      if (op.temp !== undefined) {
        db.prepare("UPDATE characters SET temp_hp = MAX(temp_hp, ?) WHERE id = ?").run(op.temp, who)
        out.push(`PV temporários de ${getCharacter(db, who).name}: ${getCharacter(db, who).temp_hp}`)
      }
      if (!out.length) throw new Error("hp exige damage, heal ou temp.")
      return out.join(" ")
    }
    case "condition": {
      const who = r(tx, op.who, CHAR)
      const c = getCharacter(db, who)
      const set = new Set(c.sheet.conditions)
      for (const raw of op.add) set.add(conditionOrThrow(raw))
      for (const raw of op.remove) set.delete(conditionOrThrow(raw))
      c.sheet.conditions = [...set]
      saveSheet(db, who, c.sheet)
      return `~ condições de ${c.name}: ${c.sheet.conditions.join(", ") || "nenhuma"}`
    }
    case "money": {
      const who = r(tx, op.who, CHAR)
      const c = getCharacter(db, who)
      const delta = parseMoney(op.amount)
      if (c.cp + delta < 0) throw new Error(`${c.name} tem ${fmtMoney(c.cp)}; não pode gastar ${fmtMoney(-delta)}.`)
      db.prepare("UPDATE characters SET cp = cp + ? WHERE id = ?").run(delta, who)
      return `~ ${c.name} ${delta >= 0 ? "recebe" : "gasta"} ${fmtMoney(Math.abs(delta))} → ${fmtMoney(c.cp + delta)}${op.reason ? ` (${op.reason})` : ""}`
    }
    case "item.give": {
      const id = r(tx, op.item, ["item"])
      const to = r(tx, op.to, ["pc", "npc", "place"])
      const item = one<{ name: string; qty: number; kind: string; props: string; notes: string }>(db, "SELECT * FROM items WHERE id = ?", id)!
      const qty = op.qty ?? item.qty
      if (qty > item.qty) throw new Error(`${item.name}: só há ${item.qty}.`)
      const isPlace = to.startsWith("place:")
      if (qty === item.qty) {
        db.prepare("UPDATE items SET owner_char = ?, owner_place = ?, equipped = 0 WHERE id = ?").run(isPlace ? null : to, isPlace ? to : null, id)
        return `~ ${qty}× ${item.name} → ${to}`
      }
      db.prepare("UPDATE items SET qty = qty - ? WHERE id = ?").run(qty, id)
      const nid = newId(db, "item", item.name)
      db.prepare("INSERT INTO items(id, owner_char, owner_place, name, qty, kind, props, notes) VALUES(?,?,?,?,?,?,?,?)").run(
        nid, isPlace ? null : to, isPlace ? to : null, item.name, qty, item.kind, item.props, item.notes
      )
      return `~ ${qty}× ${item.name} → ${to} [${nid}]`
    }
    case "item.qty": {
      const id = r(tx, op.item, ["item"])
      const item = one<{ name: string; qty: number }>(db, "SELECT name, qty FROM items WHERE id = ?", id)!
      const qty = item.qty + op.delta
      if (qty < 0) throw new Error(`${item.name}: só há ${item.qty}.`)
      if (qty === 0) db.prepare("DELETE FROM items WHERE id = ?").run(id)
      else db.prepare("UPDATE items SET qty = ? WHERE id = ?").run(qty, id)
      return `~ ${item.name}: ${item.qty} → ${qty}${qty === 0 ? " (removido)" : ""}`
    }
    case "item.equip": {
      const id = r(tx, op.item, ["item"])
      const item = one<{ name: string; owner_char: string | null }>(db, "SELECT name, owner_char FROM items WHERE id = ?", id)!
      if (!item.owner_char) throw new Error(`${item.name} não está com um personagem.`)
      db.prepare("UPDATE items SET equipped = ? WHERE id = ?").run(op.equipped ? 1 : 0, id)
      return `~ ${item.name} ${op.equipped ? "equipado" : "guardado"}`
    }
    case "attitude": {
      const npc = r(tx, op.npc, ["npc"])
      const c = getCharacter(db, npc)
      const value = Math.max(-100, Math.min(100, c.attitude + op.delta))
      db.prepare("UPDATE characters SET attitude = ? WHERE id = ?").run(value, npc)
      addMemory(tx, npc, `${op.reason} (atitude ${op.delta >= 0 ? "+" : ""}${op.delta})`, Math.abs(op.delta) >= 20 ? 3 : 2)
      return `~ atitude de ${c.name}: ${c.attitude} → ${value}`
    }
    case "memory": {
      const ids = op.npcs.map((n) => r(tx, n, ["npc"]))
      for (const id of ids) addMemory(tx, id, op.text, op.importance)
      return `+ memória para ${ids.map((id) => getCharacter(db, id).name).join(", ")}`
    }
    case "fact": {
      const about = op.about ? resolveRef(db, op.about, ["pc", "npc", "place", "faction", "item", "quest"], tx.labels) : null
      const res = db.prepare("INSERT INTO facts(about_id, text, secret, turn, at_min, lore) VALUES(?,?,?,?,?,?)").run(about, op.text, op.secret ? 1 : 0, tx.turn, now(db), op.lore ? 1 : 0)
      index(db, `fact:${res.lastInsertRowid}`, op.secret ? "segredo" : "fato", op.text)
      return `+ fato #${res.lastInsertRowid}${op.secret ? " (segredo)" : ""}${op.lore ? " (lore do multiverso)" : ""}: ${op.text}`
    }
    case "reveal": {
      const f = one<{ text: string; secret: number }>(db, "SELECT text, secret FROM facts WHERE id = ?", op.fact)
      if (!f) throw new Error(`Fato #${op.fact} não existe.`)
      db.prepare("UPDATE facts SET secret = 0 WHERE id = ?").run(op.fact)
      index(db, `fact:${op.fact}`, "fato", f.text)
      return `~ fato #${op.fact} agora é conhecido pelo jogador`
    }
    case "quest.update": {
      const id = r(tx, op.quest, ["quest"])
      const q = one<{ title: string; objectives: string; status: string; summary: string; secret: number }>(db, "SELECT * FROM quests WHERE id = ?", id)!
      const objectives = JSON.parse(q.objectives) as { text: string; done: boolean }[]
      for (const i of op.complete) {
        if (!objectives[i]) throw new Error(`Missão ${id} não tem objetivo ${i} (0..${objectives.length - 1}).`)
        objectives[i].done = true
      }
      for (const t of op.add) objectives.push({ text: t, done: false })
      db.prepare("UPDATE quests SET objectives = ?, status = ?, summary = ?, secret = ?, updated_turn = ? WHERE id = ?").run(
        JSON.stringify(objectives), op.status ?? q.status, op.summary ?? q.summary, op.reveal ? 0 : q.secret, tx.turn, id
      )
      indexEntity(db, id, q.title, op.summary ?? q.summary)
      return `~ missão ${q.title}: ${op.status ?? q.status}, ${objectives.filter((o) => o.done).length}/${objectives.length} objetivos`
    }
    case "clock.tick": {
      const id = r(tx, op.clock, ["clock"])
      const c = one<{ name: string; filled: number; segments: number; status: string; on_complete: string }>(db, "SELECT * FROM clocks WHERE id = ?", id)!
      if (c.status !== "ativo") throw new Error(`Agenda ${id} está ${c.status}.`)
      const filled = Math.max(0, Math.min(c.segments, c.filled + op.n))
      const triggered = filled >= c.segments
      db.prepare("UPDATE clocks SET filled = ?, status = ? WHERE id = ?").run(filled, triggered ? "disparado" : "ativo", id)
      return triggered ? `⚠ AGENDA DISPAROU: ${c.name} → ${c.on_complete}. Resolva com clock.resolve.` : `~ agenda ${c.name}: ${filled}/${c.segments}`
    }
    case "clock.resolve": {
      const id = r(tx, op.clock, ["clock"])
      const c = one<{ name: string; status: string }>(db, "SELECT name, status FROM clocks WHERE id = ?", id)!
      if (c.status === "resolvido") throw new Error(`Agenda ${id} já resolvida.`)
      db.prepare("UPDATE clocks SET status = 'resolvido', outcome = ? WHERE id = ?").run(op.outcome, id)
      const res = db.prepare("INSERT INTO facts(about_id, text, secret, turn, at_min) VALUES(?,?,1,?,?)").run(id, `${c.name}: ${op.outcome}`, tx.turn, now(db))
      index(db, `fact:${res.lastInsertRowid}`, "segredo", `${c.name}: ${op.outcome}`)
      return `~ agenda ${c.name} resolvida (fato secreto #${res.lastInsertRowid}; use reveal quando o jogador souber)`
    }
    case "event.resolve": {
      const e = one<{ text: string; status: string }>(db, "SELECT text, status FROM events WHERE id = ?", op.event)
      if (!e) throw new Error(`Evento #${op.event} não existe.`)
      if (e.status === "resolvido") throw new Error(`Evento #${op.event} já resolvido.`)
      db.prepare("UPDATE events SET status = 'resolvido', outcome = ? WHERE id = ?").run(op.outcome, op.event)
      const res = db.prepare("INSERT INTO facts(about_id, text, secret, turn, at_min) VALUES(NULL,?,1,?,?)").run(`${e.text} → ${op.outcome}`, tx.turn, now(db))
      index(db, `fact:${res.lastInsertRowid}`, "segredo", `${e.text} → ${op.outcome}`)
      return `~ evento #${op.event} resolvido (fato secreto #${res.lastInsertRowid})`
    }
    case "xp":
      return gainXp(db, r(tx, op.who, CHAR), op.amount)
    case "slot.use":
      return useSlot(db, r(tx, op.who, CHAR), op.level)
    case "time":
      return advanceTime(db, parseDuration(op.advance)).join(" ")
  }
}

function conditionOrThrow(raw: string): string {
  const c = parseCondition(raw)
  if (!c) throw new Error(`Condição desconhecida "${raw}". Válidas: agarrado, amedrontado, atordoado, caido, cego, contido, enfeiticado, envenenado, exausto, impedido, incapacitado, inconsciente, invisivel, paralisado, petrificado, surdo.`)
  return c
}

function addLink(tx: Tx, from: string, to: string, minutes: number, via: string, oneway: boolean): void {
  const stmt = tx.db.prepare("INSERT INTO links(from_id, to_id, minutes, via) VALUES(?,?,?,?) ON CONFLICT(from_id, to_id) DO UPDATE SET minutes = excluded.minutes, via = excluded.via")
  stmt.run(from, to, minutes, via)
  if (!oneway) stmt.run(to, from, minutes, via)
}

function applyUpdate(tx: Tx, op: Extract<Op, { op: "update" }>): string {
  const db = tx.db
  const id = resolveRef(db, op.id, ["pc", "npc", "place", "faction", "item", "quest"], tx.labels)
  const changed: string[] = []
  const set = (table: string, col: string, value: string | number | null) => {
    db.prepare(`UPDATE ${table} SET ${col} = ? WHERE id = ?`).run(value, id)
    changed.push(col)
  }
  const reject = (field: string) => {
    throw new Error(`Campo "${field}" não se aplica a ${id}.`)
  }
  const prefix = id.split(":")[0]
  if (prefix === "pc" || prefix === "npc") {
    const c: Character = getCharacter(db, id)
    if (op.name) set("characters", "name", op.name)
    if (op.summary) set("characters", "summary", op.summary)
    if (op.status) {
      if (op.status === "vivo" && c.hp === 0) throw new Error(`${c.name} tem 0 PV; use hp.heal para trazê-lo de volta.`)
      set("characters", "status", op.status)
    }
    if (op.ac !== undefined) set("characters", "ac", op.ac)
    if (op.max_hp !== undefined) {
      set("characters", "max_hp", op.max_hp)
      db.prepare("UPDATE characters SET hp = MIN(hp, ?) WHERE id = ?").run(op.max_hp, id)
    }
    if (op.persona) set("characters", "persona", JSON.stringify({ ...c.persona, ...op.persona } satisfies Persona))
    if (op.schedule) set("characters", "schedule", JSON.stringify(validateSchedule(tx, op.schedule)))
    if (op.companion !== undefined) set("characters", "companion", op.companion ? 1 : 0)
    if (op.faction !== undefined) set("characters", "faction_id", op.faction === null ? null : r(tx, op.faction, ["faction"]))
    if (op.features_add || op.spells_add || op.spells_remove || op.portrait !== undefined) {
      const sheet = getCharacter(db, id).sheet
      if (op.features_add) sheet.features.push(...op.features_add)
      if (op.spells_add) sheet.spells = [...new Set([...sheet.spells, ...op.spells_add])]
      if (op.spells_remove) sheet.spells = sheet.spells.filter((s) => !op.spells_remove!.includes(s))
      if (op.portrait !== undefined) sheet.portrait = op.portrait
      saveSheet(db, id, sheet)
      changed.push("ficha")
    }
    for (const f of ["details", "kind", "goal", "notes", "props", "parent"] as const) if (op[f] !== undefined) reject(f)
    const fresh = getCharacter(db, id)
    indexEntity(db, id, fresh.name, fresh.summary, fresh.persona.traits?.join(", ") ?? "", fresh.persona.wants ?? "")
  } else if (prefix === "place") {
    const p = getPlace(db, id)
    if (op.name) set("places", "name", op.name)
    if (op.summary) set("places", "summary", op.summary)
    if (op.details !== undefined) set("places", "details", op.details)
    if (op.kind) set("places", "kind", op.kind)
    if (op.parent !== undefined) set("places", "parent_id", op.parent === null ? null : r(tx, op.parent, ["place"]))
    for (const f of ["status", "ac", "max_hp", "persona", "schedule", "companion", "faction", "goal", "notes", "props", "features_add", "spells_add", "spells_remove", "portrait"] as const) if (op[f] !== undefined) reject(f)
    const fresh = getPlace(db, id)
    indexEntity(db, id, fresh.name, fresh.kind, fresh.summary, fresh.details || p.details)
  } else if (prefix === "faction") {
    if (op.name) set("factions", "name", op.name)
    if (op.summary) set("factions", "summary", op.summary)
    if (op.goal !== undefined) set("factions", "goal", op.goal)
    const f = one<{ name: string; summary: string; goal: string }>(db, "SELECT * FROM factions WHERE id = ?", id)!
    indexEntity(db, id, f.name, f.summary, f.goal)
  } else if (prefix === "item") {
    if (op.name) set("items", "name", op.name)
    if (op.kind) set("items", "kind", op.kind)
    if (op.notes !== undefined) set("items", "notes", op.notes)
    if (op.props) set("items", "props", JSON.stringify(op.props))
  } else if (prefix === "quest") {
    if (op.name) set("quests", "title", op.name)
    if (op.summary) set("quests", "summary", op.summary)
  }
  if (!changed.length) throw new Error(`update de ${id} não alterou nada (campos aceitos dependem do tipo).`)
  return `~ ${id}: ${changed.join(", ")}`
}

/** Aplica o lote numa transação. Qualquer erro desfaz tudo e informa a operação culpada. */
export function applyOps(db: DB, ops: Op[]): string[] {
  const tx: Tx = { db, labels: new Map(), turn: metaNum(db, "turn") }
  const out: string[] = []
  ops.forEach((op, i) => {
    try {
      out.push(applyOne(tx, op))
    } catch (error) {
      throw new Error(`Operação ${i + 1} (${op.op}) falhou — NADA foi gravado: ${(error as Error).message}`)
    }
  })
  log(db, "lote", out.join(" | "))
  return out
}

/** Classes conhecidas (para mensagens de ajuda). */
export function classList(): string {
  return Object.keys(CLASSES).join(", ")
}

/** Itens no chão / com um dono, para exibição. */
export function itemsOf(db: DB, ownerId: string): ItemRow[] {
  const col = ownerId.startsWith("place:") ? "owner_place" : "owner_char"
  return all<ItemRow>(db, `SELECT * FROM items WHERE ${col} = ? ORDER BY equipped DESC, name`, ownerId)
}
