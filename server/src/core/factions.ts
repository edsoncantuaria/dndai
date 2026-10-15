// Facções e reinos: reputação do herói, filiação, traição e as consequências no mundo.
// Reinos são facções de tipo "reino"; casas, guildas e ordens podem ter um reino como pai.
// O Mestre pede mudanças por ops; limites e efeitos em cascata são do motor.
import type { Campaign } from "./campaign.ts"
import { all, getMeta, one } from "./db.ts"
import { meta, type Op, put } from "./ledger.ts"
import { RuleError, character, money } from "./mechanics.ts"
import { witnessMemory } from "./consequences.ts"
import { alloc, pcRow, pcView } from "./pc.ts"

const fail = (m: string): never => { throw new RuleError(m) }
const text = (s: string, what: string): string => (s.trim() ? s.trim() : fail(`${what} vazio`))

export const KINDS = ["reino", "casa", "ordem", "guilda", "culto", "igreja", "bando", "cla", "companhia", "outro"] as const
export type FactionKind = (typeof KINDS)[number]
export const DEFAULT_RANKS = ["Recruta", "Membro", "Veterano", "Oficial", "Líder"]
/** Mudança máxima de reputação por chamada e por turno (por facção). */
export const MAX_STEP = 25
export const MAX_PER_TURN = 40

export interface FactionRow { id: string; name: string; kind: string; summary: string; goal: string; secret: string; parent_id: string | null; power: number; known: number; join_rule: string; ranks: string }
export interface Standing { faction_id: string; value: number; status: "nenhum" | "aliado" | "membro" | "expulso" | "traidor"; rank: number; since_turn: number }

export function faction(c: Campaign, id: string): FactionRow {
  return one<FactionRow>(c.db, "SELECT * FROM factions WHERE id = ?", id) ?? fail(`facção "${id}" não existe (ids: g1, g2...; crie com create.faction)`)
}

export function standing(c: Campaign, id: string): Standing {
  return one<Standing>(c.db, "SELECT * FROM standing WHERE faction_id = ?", id) ?? { faction_id: id, value: 0, status: "nenhum", rank: 0, since_turn: 0 }
}

export function ranksOf(f: FactionRow): string[] { return JSON.parse(f.ranks) as string[] }

export interface NewFaction {
  name: string; kind: FactionKind; summary: string; goal?: string; secret?: string; parent?: string; power?: number; known?: boolean
  ranks?: string[]; join?: { min_standing?: number; quest?: string; level?: number }; ties?: { with: string; stance: number }[]
}

export function createFaction(c: Campaign, f: NewFaction): string {
  if (!KINDS.includes(f.kind)) fail(`tipo de facção inválido (${KINDS.join(", ")})`)
  if (f.parent) faction(c, f.parent)
  const power = f.power ?? 5
  if (!Number.isInteger(power) || power < 1 || power > 10) fail("poder deve ir de 1 a 10")
  return c.atomic("facao", () => {
    const ops: Op[] = []
    const id = alloc(c, "g", ops)
    ops.push(put("factions", {
      id, name: text(f.name, "nome"), kind: f.kind, summary: text(f.summary, "resumo"), goal: f.goal ?? "", secret: f.secret ?? "",
      parent_id: f.parent ?? null, power, known: Number(!!f.known), join_rule: { min_standing: 20, ...(f.join ?? {}) },
      ranks: f.ranks?.length ? f.ranks : DEFAULT_RANKS, created_turn: c.turn,
    }))
    c.commit("facao", ops)
    for (const t of f.ties ?? []) setTie(c, id, t.with, t.stance)
    return id
  })
}

export function setTie(c: Campaign, a: string, b: string, stance: number): void {
  faction(c, a); faction(c, b)
  if (a === b) fail("uma facção não tem laço consigo mesma")
  if (!Number.isInteger(stance) || stance < -100 || stance > 100) fail("laço entre -100 (guerra) e 100 (aliança)")
  const [x, y] = a < b ? [a, b] : [b, a]
  c.commit("laco", [put("faction_ties", { a: x, b: y, stance })])
}

export function ties(c: Campaign, id: string): { other: string; stance: number }[] {
  return all<{ a: string; b: string; stance: number }>(c.db, "SELECT a, b, stance FROM faction_ties WHERE a = ? OR b = ?", id, id).map((t) => ({ other: t.a === id ? t.b : t.a, stance: t.stance }))
}

export function reveal(c: Campaign, id: string): void { faction(c, id); c.commit("facao-conhecida", [put("factions", { id, known: 1 })]) }

export function setControl(c: Campaign, place: string, factionId: string | null): void {
  if (!one(c.db, "SELECT 1 FROM places WHERE id = ?", place)) fail(`local "${place}" não existe`)
  if (factionId) faction(c, factionId)
  c.commit("controle", [put("places", { id: place, faction_id: factionId })])
}

/** Cadeia de autoridade de um local: facção que o controla e, subindo pelos pais, o reino. */
export function authorityOf(c: Campaign, place: string): { faction?: FactionRow; realm?: FactionRow } {
  let pid: string | null = place
  for (let i = 0; i < 6 && pid; i++) {
    const row: { faction_id: string | null; parent_id: string | null } | undefined = one(c.db, "SELECT faction_id, parent_id FROM places WHERE id = ?", pid)
    if (row?.faction_id) {
      const f = faction(c, row.faction_id)
      let r: FactionRow | undefined = f
      for (let j = 0; j < 6 && r && r.kind !== "reino"; j++) r = r.parent_id ? faction(c, r.parent_id) : undefined
      return { faction: f, realm: r?.kind === "reino" ? r : undefined }
    }
    pid = row?.parent_id ?? null
  }
  return {}
}

const clamp = (n: number, lo = -100, hi = 100): number => Math.max(lo, Math.min(hi, n))

function statusFor(cur: Standing, value: number): Standing["status"] {
  if (cur.status === "membro" && value <= -50) return "expulso"
  if (cur.status === "nenhum" && value >= 50) return "aliado"
  if (cur.status === "aliado" && value < 25) return "nenhum"
  return cur.status
}

function writeStanding(c: Campaign, id: string, value: number, patch: Partial<Standing> = {}): Op {
  const cur = standing(c, id)
  const v = clamp(value)
  return put("standing", { faction_id: id, value: v, status: patch.status ?? statusFor(cur, v), rank: patch.rank ?? cur.rank, since_turn: cur.since_turn || c.turn })
}

/** Reputação do herói com uma facção, com cascata: aliados dividem metade, rivais invertem metade, pai/filha 50%. */
export function adjustStanding(c: Campaign, id: string, delta: number, reason: string): string[] {
  const f = faction(c, id)
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > MAX_STEP) fail(`mudança de reputação entre -${MAX_STEP} e +${MAX_STEP} (diferente de 0)`)
  if (reason.trim().length < 8) fail("informe o motivo da reputação (mín. 8 letras)")
  const key = `st:${c.turn}:${id}`
  const used = Number(getMeta(c.db, key, "0")) + Math.abs(delta)
  if (used > MAX_PER_TURN) fail(`reputação com ${f.name} já mudou muito neste turno (limite ${MAX_PER_TURN}). A fama se constrói aos poucos.`)
  return c.atomic("reputacao", () => {
    const lines: string[] = []
    const ops: Op[] = [meta(key, used)]
    const cur = standing(c, id)
    ops.push(writeStanding(c, id, cur.value + delta))
    lines.push(`${f.name}: ${cur.value} → ${clamp(cur.value + delta)} (${reason.trim()})`)
    const spread = new Map<string, number>()
    for (const t of ties(c, id)) spread.set(t.other, (spread.get(t.other) ?? 0) + Math.round(delta * (t.stance / 100) * 0.5))
    if (f.parent_id) spread.set(f.parent_id, (spread.get(f.parent_id) ?? 0) + Math.round(delta * 0.5))
    for (const child of all<{ id: string }>(c.db, "SELECT id FROM factions WHERE parent_id = ?", id)) spread.set(child.id, (spread.get(child.id) ?? 0) + Math.round(delta * 0.5))
    for (const [other, d] of spread) {
      if (d === 0 || other === id) continue
      const o = standing(c, other)
      ops.push(writeStanding(c, other, o.value + d))
      lines.push(`  ↳ ${faction(c, other).name}: ${d > 0 ? "+" : ""}${d} (reflexo)`)
    }
    ops.push(put("facts", { about_id: id, text: `Reputação com ${f.name} ${delta > 0 ? "subiu" : "caiu"} (${delta > 0 ? "+" : ""}${delta}): ${reason.trim()}`, secret: 0, turn: c.turn, at_min: c.time }))
    c.commit("reputacao", ops)
    // Expulsão automática: quem é membro e cai a -50 perde a filiação.
    if (cur.status === "membro" && standing(c, id).status === "expulso") lines.push(`${f.name} expulsa você das suas fileiras.`)
    return lines
  })
}

export function join(c: Campaign, id: string): string {
  const f = faction(c, id)
  const cur = standing(c, id)
  if (cur.status === "membro") fail(`você já é membro de ${f.name}`)
  if (cur.status === "traidor") fail(`${f.name} nunca aceitará um traidor de volta (só uma grande reviravolta na história muda isso: reputação precisa passar de 60 por outros meios)`)
  const rule = JSON.parse(f.join_rule) as { min_standing?: number; quest?: string; level?: number }
  const need = rule.min_standing ?? 20
  const need2 = cur.status === "expulso" ? Math.max(need, 40) : need
  if (cur.value < need2) fail(`${f.name} ainda não confia em você: reputação ${cur.value}, precisa de ${need2}`)
  if (rule.quest) {
    const q = one<{ status: string; title: string }>(c.db, "SELECT status, title FROM quests WHERE id = ?", rule.quest)
    if (q?.status !== "concluida") fail(`${f.name} exige antes cumprir a missão "${q?.title ?? rule.quest}"`)
  }
  if (rule.level && pcView(c).sheet.level < rule.level) fail(`${f.name} exige nível ${rule.level}`)
  for (const t of ties(c, id).filter((x) => x.stance <= -50)) {
    const other = standing(c, t.other)
    if (other.status === "membro") fail(`conflito de lealdade: você é membro de ${faction(c, t.other).name}, rival de ${f.name}. Saia ou traia antes.`)
  }
  c.commit("filiacao", [writeStanding(c, id, cur.value + 10, { status: "membro", rank: 0 })])
  return `Você ingressa em ${f.name} como ${ranksOf(f)[0] ?? "membro"}.`
}

export function leave(c: Campaign, id: string): string {
  const f = faction(c, id)
  const cur = standing(c, id)
  if (cur.status !== "membro") fail(`você não é membro de ${f.name}`)
  c.commit("saida", [writeStanding(c, id, cur.value - 15, { status: "nenhum", rank: 0 })])
  return `Você deixa ${f.name} (reputação ${cur.value - 15}).`
}

export function promote(c: Campaign, id: string, reason: string): string {
  const f = faction(c, id)
  const cur = standing(c, id)
  if (cur.status !== "membro") fail(`você não é membro de ${f.name}`)
  const ranks = ranksOf(f)
  if (cur.rank >= ranks.length - 1) fail(`${ranks[cur.rank]} já é o posto mais alto`)
  const need = 20 + 20 * cur.rank
  if (cur.value < need) fail(`reputação ${cur.value}: promoção a ${ranks[cur.rank + 1]} exige ${need}`)
  if (reason.trim().length < 8) fail("informe o motivo da promoção (mín. 8 letras)")
  c.commit("promocao", [writeStanding(c, id, cur.value, { rank: cur.rank + 1 }), put("facts", { about_id: id, text: `Promovido a ${ranks[cur.rank + 1]} em ${f.name}: ${reason.trim()}`, secret: 0, turn: c.turn, at_min: c.time })])
  return `Promovido a ${ranks[cur.rank + 1]} em ${f.name}.`
}

/** Traição: o mundo reage (vingança, recompensa, rumores, antigos companheiros). */
export function betray(c: Campaign, id: string, reason: string): string[] {
  const f = faction(c, id)
  const cur = standing(c, id)
  if (!["membro", "aliado"].includes(cur.status)) fail(`só trai quem recebeu confiança: você não é membro nem aliado de ${f.name}`)
  if (reason.trim().length < 12) fail("descreva a traição (mín. 12 letras)")
  return c.atomic("traicao", () => {
    const lines: string[] = [`Você trai ${f.name}: ${reason.trim()}`]
    const ops: Op[] = [writeStanding(c, id, -100, { status: "traidor", rank: 0 })]
    for (const t of ties(c, id)) {
      const o = standing(c, t.other)
      const d = t.stance > 0 ? -Math.round(40 * (t.stance / 100)) : Math.round(15 * (-t.stance / 100))
      if (d) { ops.push(writeStanding(c, t.other, o.value + d)); lines.push(`  ↳ ${faction(c, t.other).name}: ${d > 0 ? "+" : ""}${d}`) }
    }
    for (const m of all<{ npc_id: string }>(c.db, "SELECT npc_id FROM members WHERE faction_id = ?", id)) {
      const row = character(c, m.npc_id)
      ops.push(put("characters", { id: m.npc_id, attitude: Math.max(-100, Math.min(row.attitude, -60)) }))
      ops.push(put("memories", { npc_id: m.npc_id, text: `${pcRow(c)?.name ?? "O herói"} traiu ${f.name}: ${reason.trim()}`, importance: 3, turn: c.turn, at_min: c.time }))
    }
    const clockId = alloc(c, "k", ops)
    ops.push(put("clocks", { id: clockId, name: `Vingança de ${f.name}`, owner_id: id, segments: 6, filled: 0, every_min: 2880, last_tick_min: c.time, on_complete: `${f.name} envia assassinos ou caçadores de recompensa atrás do herói`, secret: 1, status: "ativo", created_turn: c.turn }))
    ops.push(put("hooks", { kind: "ameaca", text: `${f.name} jurou vingança contra o herói por trair a organização`, about_id: id, turn: c.turn, at_min: c.time }))
    const bounty = f.power >= 4 ? f.power * 10_000 : 0
    if (bounty) { ops.push(put("bounties", { faction_id: id, amount_cp: (one<{ amount_cp: number }>(c.db, "SELECT amount_cp FROM bounties WHERE faction_id = ?", id)?.amount_cp ?? 0) + bounty, reason: "traição" })); lines.push(`Recompensa por sua cabeça: ${bounty / 100} PO`) }
    const place = pcRow(c)?.place_id
    if (place) ops.push(put("rumors", { text: `${pcRow(c)?.name ?? "O herói"} traiu ${f.name}`, truth: "verdade", origin_place: place, born_min: c.time, spread_min: 480, about_id: id }))
    ops.push(put("facts", { about_id: id, text: `Traição a ${f.name}: ${reason.trim()}`, secret: 0, turn: c.turn, at_min: c.time }))
    c.commit("traicao", ops)
    lines.push(`Agenda criada: ${clockId} (Vingança de ${f.name}, 6 etapas, uma a cada 2 dias).`)
    return lines
  })
}

export function addMember(c: Campaign, npc: string, id: string, rank = ""): void {
  const f = faction(c, id)
  if (character(c, npc).kind === "pc") fail("o herói entra em facções por join, não por npc.member")
  c.commit("membro", [put("members", { npc_id: npc, faction_id: id, rank: rank || ranksOf(f)[1] || "" })])
}

export function membersOf(c: Campaign, npc: string): { faction: string; id: string; rank: string }[] {
  return all<{ faction_id: string; rank: string; name: string }>(c.db, "SELECT m.faction_id, m.rank, f.name FROM members m JOIN factions f ON f.id = m.faction_id WHERE m.npc_id = ?", npc).map((m) => ({ id: m.faction_id, faction: m.name, rank: m.rank }))
}

/** Crime contra uma autoridade (reino, ordem, guilda): reputação cai e, se houve testemunha, a recompensa sobe. */
export function crime(c: Campaign, id: string, severity: number, witnessed: boolean, reason: string): string[] {
  const f = faction(c, id)
  if (!Number.isInteger(severity) || severity < 1 || severity > 5) fail("gravidade de 1 (furto) a 5 (regicídio)")
  return c.atomic("crime", () => {
    const lines = adjustStanding(c, id, -Math.min(MAX_STEP, severity * 6), `crime: ${reason}`)
    if (witnessed) {
      const add = severity * severity * 2_500
      const cur = one<{ amount_cp: number }>(c.db, "SELECT amount_cp FROM bounties WHERE faction_id = ?", id)?.amount_cp ?? 0
      c.commit("recompensa", [put("bounties", { faction_id: id, amount_cp: cur + add, reason })])
      lines.push(`Testemunhado: recompensa de ${f.name} sobe para ${(cur + add) / 100} PO`)
      witnessMemory(c, pcRow(c)?.place_id ?? null, `${pcRow(c)?.name ?? "O herói"} cometeu um crime contra ${f.name}: ${reason}`, 3)
    } else lines.push("Sem testemunhas: nenhuma recompensa (por enquanto).")
    return lines
  })
}

export function payBounty(c: Campaign, id: string): string {
  const f = faction(c, id)
  const b = one<{ amount_cp: number }>(c.db, "SELECT amount_cp FROM bounties WHERE faction_id = ?", id)
  const owed = b?.amount_cp ?? 0
  if (!owed) fail(`não há recompensa de ${f.name} sobre você`)
  return c.atomic("pagar-recompensa", () => {
    money(c, "pc", -owed)
    c.commit("recompensa", [put("bounties", { faction_id: id, amount_cp: 0, reason: "" })])
    return `Você paga ${owed / 100} PO a ${f.name}: a recompensa é retirada. ${adjustStanding(c, id, 6, "pagou a multa ao tesouro").at(0)}`
  })
}
