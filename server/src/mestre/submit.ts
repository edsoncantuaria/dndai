// Um beat = uma chamada do Mestre. Ops validadas e executadas em lote atômico (tudo ou nada);
// a narração só entra se passar na guarda e fecha o turno. Rolagens são do motor e voltam no resultado.
import { z } from "zod"
import type { Campaign } from "../core/campaign.ts"
import { all, one } from "../core/db.ts"
import { roll } from "../core/dice.ts"
import { meta, put } from "../core/ledger.ts"
import * as fx from "../core/features.ts"
import * as mx from "../core/mechanics.ts"
import * as sc from "../core/scope.ts"
import { cast } from "../core/spells.ts"
import * as w from "../core/world.ts"
import { ABILITIES } from "../core/sheet.ts"
import { closeChapters } from "./context.ts"
import { assertNarration, expandRefs } from "./narration.ts"

const label = z.string().regex(/^[a-z][a-z0-9_]{0,20}$/)
const ref = z.string().min(1).max(40)
const txt = z.string().trim().min(1).max(600)
const mode = z.enum(["normal", "vantagem", "desvantagem"]).default("normal")
const ability = z.enum(ABILITIES)
const persona = z.object({ traits: z.array(txt).max(6).optional(), goal: txt.optional(), secret: txt.optional(), voice: txt.optional(), gender: z.enum(["m", "f"]).optional() }).strict()

export const BeatOp = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create.place"), as: label.optional(), name: txt, kind: txt, summary: txt, parent: ref.optional(), links: z.array(z.object({ to: ref, minutes: z.number().int().min(0), via: z.string().optional() }).strict()).max(8).optional() }).strict(),
  z.object({ op: z.literal("create.npc"), as: label.optional(), name: txt, summary: txt, place: ref, persona: persona.optional(), attitude: z.number().int().min(-100).max(100).optional(), srd: z.string().optional(), companion: z.boolean().optional() }).strict(),
  z.object({ op: z.literal("create.quest"), as: label.optional(), title: txt, summary: txt, giver: ref.optional(), objectives: z.array(txt).max(8).optional(), secret: z.boolean().optional() }).strict(),
  z.object({ op: z.literal("link"), a: ref, b: ref, minutes: z.number().int().min(0), via: z.string().optional() }).strict(),
  z.object({ op: z.literal("spawn"), as: label.optional(), srd: z.string(), place: ref, name: txt.optional(), confirm: z.boolean().optional() }).strict(),
  z.object({ op: z.literal("move"), who: ref, to: ref }).strict(),
  z.object({ op: z.literal("time"), minutes: z.number().int().positive().max(1440) }).strict(),
  z.object({ op: z.literal("attitude"), npc: ref, delta: z.number().int().min(-100).max(100), reason: txt }).strict(),
  z.object({ op: z.literal("memory"), npcs: z.array(ref).min(1), text: txt, importance: z.number().int().min(1).max(3).optional() }).strict(),
  z.object({ op: z.literal("memory.consolidate"), npc: ref, ids: z.array(z.number().int().positive()).min(2), text: z.string().trim().min(10).max(400) }).strict(),
  z.object({ op: z.literal("fact"), text: txt, about: ref.optional(), secret: z.boolean().optional() }).strict(),
  z.object({ op: z.literal("reveal"), fact: z.number().int().positive() }).strict(),
  z.object({ op: z.literal("hook"), kind: z.enum(["promessa", "ameaca", "misterio", "gancho"]), text: txt, about: ref.optional() }).strict(),
  z.object({ op: z.literal("hook.update"), hook: z.number().int().positive(), status: z.enum(["aberto", "resolvido", "abandonado"]) }).strict(),
  z.object({ op: z.literal("quest.update"), quest: ref, status: z.enum(["ativa", "concluida", "falhou", "abandonada"]) }).strict(),
  z.object({ op: z.literal("item.give"), to: ref, srd: z.string(), qty: z.number().int().positive().max(100).optional() }).strict(),
  z.object({ op: z.literal("item.magic"), to: ref, srd: z.string() }).strict(),
  z.object({ op: z.literal("item.equip"), item: ref, on: z.boolean() }).strict(),
  z.object({ op: z.literal("item.drop"), item: ref, qty: z.number().int().positive().optional() }).strict(),
  z.object({ op: z.literal("buy"), who: ref, srd: z.string(), qty: z.number().int().positive().max(100).optional() }).strict(),
  z.object({ op: z.literal("sell"), item: ref, qty: z.number().int().positive().optional() }).strict(),
  z.object({ op: z.literal("treasure"), to: ref, gp: z.number().positive(), source: txt }).strict(),
  z.object({ op: z.literal("xp.kills") }).strict(),
  z.object({ op: z.literal("xp.milestone"), reason: txt }).strict(),
  z.object({ op: z.literal("check"), who: ref, what: z.string(), dc: z.number().int().min(1).max(30), mode }).strict(),
  z.object({ op: z.literal("save"), who: ref, ability, dc: z.number().int().min(1).max(30), mode }).strict(),
  z.object({ op: z.literal("attack"), attacker: ref, target: ref, using: z.string(), mode, sneak: z.boolean().optional(), ally_near: z.boolean().optional() }).strict(),
  z.object({ op: z.literal("second-wind") }).strict(),
  z.object({ op: z.literal("action-surge") }).strict(),
  z.object({ op: z.literal("rage.start") }).strict(),
  z.object({ op: z.literal("rage.end") }).strict(),
  z.object({ op: z.literal("lay-on-hands"), target: ref, amount: z.number().int().positive() }).strict(),
  z.object({ op: z.literal("resource.use"), key: z.string(), n: z.number().int().positive().max(20).optional() }).strict(),
  z.object({ op: z.literal("item.use"), item: ref, target: ref.optional() }).strict(),
  z.object({ op: z.literal("concentration.end"), who: ref.optional() }).strict(),
  z.object({ op: z.literal("cast"), who: ref, spell: z.string(), slot: z.number().int().min(1).max(9).optional(), targets: z.array(ref).max(8).optional(), mode }).strict(),
  z.object({ op: z.literal("hazard"), who: ref, dice: z.string().regex(/^\d{1,2}d\d{1,3}([+-]\d+)?$/), type: z.string(), reason: txt }).strict(),
  z.object({ op: z.literal("condition"), who: ref, add: z.array(z.string()).default([]), remove: z.array(z.string()).default([]) }).strict(),
  z.object({ op: z.literal("combat.start"), ids: z.array(ref).min(2).max(12) }).strict(),
  z.object({ op: z.literal("combat.next") }).strict(),
  z.object({ op: z.literal("combat.end") }).strict(),
  z.object({ op: z.literal("rest"), kind: z.enum(["short", "long"]), dice: z.number().int().min(0).max(20).optional() }).strict(),
  z.object({ op: z.literal("death.save") }).strict(),
])
export type BeatOpT = z.infer<typeof BeatOp>

export const Beat = z.object({
  ops: z.array(BeatOp).max(40).default([]),
  /** Presente = fecha o turno. Ausente = só mecânica (para ler as rolagens antes de narrar). */
  narration: z.string().trim().min(2).max(6000).optional(),
  summary: z.string().trim().min(8).max(400).optional(),
  /** Sugestões curtas de ação para o jogador (a mesa mostra como botões). */
  options: z.array(z.string().trim().min(2).max(80)).max(5).optional(),
}).strict()
export type BeatT = z.infer<typeof Beat>

export interface BeatResult { lines: string[]; labels: Record<string, string>; closed: boolean; turn: number; narration?: string }

const ENTITY: Record<string, string> = { p: "characters", n: "characters", m: "characters", l: "places", i: "items", q: "quests" }

export function openTurn(c: Campaign, action: string): number {
  const open = one<{ n: number }>(c.db, "SELECT n FROM turns WHERE ended = 0 ORDER BY n DESC LIMIT 1")
  if (open) c.commit("turno", [put("turns", { n: open.n, ended: 1, summary: "(sem narração)" })])
  const n = c.turn + 1
  c.commit("turno", [meta("turn", n), meta("options", "[]"), put("turns", { n, started_min: c.time, action: action.trim(), ended: 0 })])
  return n
}

export function submit(c: Campaign, raw: unknown): BeatResult {
  const beat = Beat.parse(raw)
  if (beat.narration && !beat.summary) throw new Error("summary é obrigatório com narration (quem, o quê, onde, resultado).")
  const labels: Record<string, string> = {}
  const lines: string[] = []
  const r = (v: string): string => {
    if (v.startsWith("$")) return labels[v.slice(1)] ?? (() => { throw new Error(`rótulo ${v} não foi definido antes neste lote`) })()
    const table = ENTITY[v[0]!]
    if (!table || !one(c.db, `SELECT 1 FROM ${table} WHERE id = ?`, v)) throw new Error(`"${v}" não existe. Ids: pc, n1 (NPC), m1 (monstro), l1 (local), i1 (item), q1 (missão). Crie com create.* antes de citar.`)
    return v
  }
  const bind = (as: string | undefined, id: string) => { if (as) labels[as] = id }
  let finalText: string | undefined

  c.atomic("beat", () => {
    if (!one(c.db, "SELECT 1 FROM turns WHERE ended = 0")) openTurn(c, "(cena aberta pelo Mestre)")
    const pcId = "pc"
    for (const op of beat.ops) {
      switch (op.op) {
        case "create.place": { const id = w.createPlace(c, { ...op, parent: op.parent ? r(op.parent) : undefined, links: op.links?.map((l) => ({ ...l, to: r(l.to) })) }); bind(op.as, id); lines.push(`local ${id} ${op.name}`); break }
        case "create.npc": { const id = w.createNpc(c, { ...op, place: r(op.place) }); bind(op.as, id); lines.push(`npc ${id} ${op.name}`); break }
        case "create.quest": { const id = w.addQuest(c, { ...op, giver: op.giver ? r(op.giver) : undefined }); bind(op.as, id); lines.push(`missão ${id} ${op.title}`); break }
        case "link": w.link(c, r(op.a), r(op.b), op.minutes, op.via); lines.push(`ligação ${op.a}↔${op.b} ${op.minutes}min`); break
        case "spawn": { const id = sc.spawnChecked(c, op.srd, r(op.place), op); bind(op.as, id); lines.push(`monstro ${id} ${mx.character(c, id).name} (PV ${mx.character(c, id).hp}, CA ${mx.character(c, id).ac})`); break }
        case "move": { const m = w.move(c, r(op.who), r(op.to)); lines.push(`${op.who} → ${op.to} (${m.minutes} min)`); break }
        case "time": w.advanceTime(c, op.minutes); lines.push(`+${op.minutes} min`); break
        case "attitude": lines.push(`${op.npc} atitude ${w.setAttitude(c, r(op.npc), op.delta, op.reason)}`); break
        case "memory": w.remember(c, op.npcs.map(r), op.text, op.importance); break
        case "memory.consolidate": w.consolidateMemories(c, r(op.npc), op.ids, op.text); break
        case "fact": w.addFact(c, { ...op, about: op.about ? r(op.about) : undefined }); break
        case "reveal": if (!one(c.db, "SELECT 1 FROM facts WHERE id = ?", op.fact)) throw new Error(`fato #${op.fact} não existe`); c.commit("revelar", [put("facts", { id: op.fact, secret: 0 })]); break
        case "hook": w.addHook(c, op.kind, op.text, op.about ? r(op.about) : undefined); break
        case "hook.update": if (!one(c.db, "SELECT 1 FROM hooks WHERE id = ?", op.hook)) throw new Error(`gancho #${op.hook} não existe`); c.commit("gancho", [put("hooks", { id: op.hook, status: op.status })]); break
        case "quest.update": w.updateQuest(c, r(op.quest), op.status); break
        case "item.give": { const id = mx.giveItem(c, r(op.to), op.srd, op.qty); lines.push(`item ${id} → ${op.to}`); break }
        case "item.magic": { const id = sc.grantMagicItem(c, r(op.to), op.srd); lines.push(`item mágico ${id} → ${op.to}`); break }
        case "item.equip": mx.equip(c, r(op.item), op.on); break
        case "item.drop": mx.itemQty(c, r(op.item), -(op.qty ?? one<{ qty: number }>(c.db, "SELECT qty FROM items WHERE id = ?", op.item)!.qty)); break
        case "buy": lines.push(mx.buy(c, r(op.who), op.srd, op.qty)); break
        case "sell": lines.push(mx.sell(c, r(op.item), op.qty)); break
        case "treasure": lines.push(`PC com ${sc.grantMoney(c, r(op.to), Math.round(op.gp * 100), op.source) / 100} PO`); break
        case "xp.kills": { const k = sc.claimKillXp(c); lines.push(k.xp ? `+${k.xp} XP (${k.from.join(", ")})` : "sem XP novo de combate"); break }
        case "xp.milestone": lines.push(`+${sc.grantMilestoneXp(c, op.reason)} XP (marco)`); break
        case "check": lines.push(mx.check(c, r(op.who), op.what, op.dc, op.mode).text); break
        case "save": lines.push(mx.save(c, r(op.who), op.ability, op.dc, op.mode).text); break
        case "attack": lines.push(mx.attack(c, r(op.attacker), r(op.target), op.using, op.mode, undefined, { sneak: op.sneak, allyNear: op.ally_near }).text); break
        case "second-wind": lines.push(fx.secondWind(c, pcId)); break
        case "action-surge": lines.push(fx.actionSurge(c, pcId)); break
        case "rage.start": lines.push(fx.rageStart(c, pcId)); break
        case "rage.end": lines.push(fx.rageEnd(c, pcId)); break
        case "lay-on-hands": lines.push(fx.layOnHands(c, pcId, r(op.target), op.amount)); break
        case "resource.use": lines.push(fx.spend(c, pcId, op.key, op.n)); break
        case "item.use": lines.push(fx.useItem(c, pcId, r(op.item), op.target ? r(op.target) : undefined)); break
        case "concentration.end": lines.push(mx.endConcentration(c, op.who ? r(op.who) : pcId)); break
        case "cast": lines.push(...cast(c, r(op.who), op.spell, { slot: op.slot, targets: op.targets?.map(r), mode: op.mode }).lines); break
        case "hazard": { const t = r(op.who); const d = roll(op.dice); lines.push(`${op.reason}: ${d.detail} → ${mx.damage(c, t, d.total, op.type)}`); c.commit("perigo", [put("rolls", { turn: c.turn, who: t, kind: "dano", label: `Perigo: ${op.reason}`, expr: op.dice, total: d.total, result: { faces: d.faces } })]); break }
        case "condition": mx.setCondition(c, r(op.who), op.add, op.remove); break
        case "combat.start": lines.push(`iniciativa: ${mx.startCombat(c, op.ids.map(r)).order.map((o) => `${o.id}(${o.init})`).join(" > ")}`); break
        case "combat.next": { const st = mx.nextTurn(c); lines.push(`rodada ${st.round}, vez de ${st.order[st.turn]!.id}`); break }
        case "combat.end": mx.endCombat(c); break
        case "rest": lines.push(op.kind === "short" ? mx.shortRest(c, pcId, op.dice ?? 0) : mx.longRest(c, pcId)); break
        case "death.save": lines.push(mx.deathSave(c, pcId)); break
      }
    }
    if (beat.narration) {
      const expanded = expandRefs(c, beat.narration)
      assertNarration(c, expanded)
      finalText = expanded
      const n = c.turn
      c.commit("narracao", [put("narrations", { turn: n, text: expanded, at: new Date().toISOString() }), put("turns", { n, summary: beat.summary, ended: 1 }), meta("options", JSON.stringify(beat.options ?? []))])
    }
  })

  if (beat.narration) {
    closeChapters(c)
    const st = all<{ name: string; hp: number; max_hp: number }>(c.db, "SELECT name, hp, max_hp FROM characters WHERE kind = 'pc'")[0]
    if (st) lines.push(`${st.name}: PV ${st.hp}/${st.max_hp}`)
  }
  return { lines, labels, closed: !!beat.narration, turn: c.turn, narration: finalText }
}

