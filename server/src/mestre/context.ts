// Contexto do Mestre em TOON: cena inteira na primeira leitura, depois só o que mudou (delta).
// Memória longa: capítulos a cada 8 turnos fechados, resume por arcos, recall por busca de texto.
import { DatabaseSync } from "node:sqlite"
import type { Campaign } from "../core/campaign.ts"
import { all, getMeta, one, setMeta } from "../core/db.ts"
import { put } from "../core/ledger.ts"
import { combatState } from "../core/mechanics.ts"
import { pcRow, pcView } from "../core/pc.ts"
import { ABILITIES, mod, resourceList } from "../core/sheet.ts"
import { encodeToon } from "./toon.ts"

export const CHAPTER_TURNS = 8
export const ARC_CHAPTERS = 4

export function clock(min: number): string {
  const day = Math.floor(min / 1440) + 1, h = Math.floor((min % 1440) / 60), m = min % 60
  return `dia ${day} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}
const gp = (cp: number): string => `${(cp / 100).toFixed(cp % 100 ? 2 : 0)} PO`

export function pcCard(c: Campaign): Record<string, unknown> | null {
  if (!pcRow(c)) return null
  const v = pcView(c)
  const s = v.sheet, d = v.derived
  const xpNext = s.level < 20 ? [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000][s.level]! : null
  return {
    nome: v.row.name, id: "pc", classe: `${s.class}${s.subclass ? `/${s.subclass}` : ""} ${s.level}`, especie: `${s.species}${s.subspecies ? `/${s.subspecies}` : ""}`, antecedente: s.background,
    pv: `${v.row.hp}/${v.row.max_hp}${v.row.temp_hp ? `+${v.row.temp_hp}t` : ""}`, ca: d.ac, xp: `${v.row.xp}${xpNext ? `/${xpNext}` : ""}`, subida: xpNext !== null && v.row.xp >= xpNext ? "DISPONIVEL" : "",
    status: v.row.status, condicoes: s.conditions.join(","),
    atributos: ABILITIES.map((a) => `${a}${s.abilities[a]}(${mod(s.abilities[a]) >= 0 ? "+" : ""}${mod(s.abilities[a])})`).join(" "),
    pericias: s.skills.map((k) => `${k}${d.skills[k]! >= 0 ? "+" : ""}${d.skills[k]}`).join(" "),
    ataques: d.attacks.map((a) => `${a.item || "-"}:${a.name} ${a.bonus >= 0 ? "+" : ""}${a.bonus} ${a.damage} ${a.damageType}`).join("; "),
    magia: s.spell ? `CD${d.spellDc} atq+${d.spellAttack} truques:${s.spell.cantrips.join(",")} preparadas:${s.spell.prepared.join(",")} espacos:${Object.entries(s.slots).map(([l, x]) => `${l}º${x.max - x.used}/${x.max}`).join(" ")}` : "",
    recursos: resourceList(s).map((r) => `${r.key}:${r.max - (s.uses[r.key] ?? 0)}/${r.max}`).join(" "),
    estados: [s.notes.raging ? "FÚRIA" : "", s.notes.concentration ? `concentrando:${s.notes.concentration}` : ""].filter(Boolean).join(" "),
    dados_vida: `${s.hitDiceLeft}/${s.level}d${s.hitDie}`, dinheiro: gp(v.row.cp),
    itens: v.items.map((i) => `${i.id}:${i.qty > 1 ? `${i.qty}× ` : ""}${i.name}${i.equipped ? "*" : ""}`).join("; "),
    caracteristicas: s.features.join(","), talentos: s.feats.join(","),
  }
}

/** A cena do Mestre. Segredos vêm marcados com 🔒. */
export function scene(c: Campaign): Record<string, unknown> {
  const info = c.info()
  const out: Record<string, unknown> = { campanha: { nome: info.name, premissa: info.premise, tom: info.tone, turno: c.turn, quando: clock(c.time), edicao: "D&D 2024 (SRD)" } }
  const pc = pcRow(c)
  if (!pc) { out.aviso = "Sem personagem. Conduza a criação com o jogador (a mesa tem o criador)."; return out }
  out.pc = pcCard(c)
  const pl = pc.place_id ? one<{ id: string; name: string; kind: string; summary: string; details: string }>(c.db, "SELECT id, name, kind, summary, details FROM places WHERE id = ?", pc.place_id) : undefined
  if (pl) {
    out.local = { id: pl.id, nome: pl.name, tipo: pl.kind, resumo: pl.summary, detalhes: pl.details || undefined }
    out.saidas = all<{ id: string; name: string; minutes: number; visited: number }>(c.db, "SELECT p.id, p.name, l.minutes, p.visited FROM links l JOIN places p ON p.id = l.to_id WHERE l.from_id = ? ORDER BY l.minutes", pl.id).map((e) => ({ id: e.id, nome: e.name, min: e.minutes, novo: e.visited ? "" : "sim" }))
    const here = all<{ id: string; kind: string; name: string; summary: string; status: string; hp: number; max_hp: number; ac: number; attitude: number; persona: string; companion: number }>(c.db, "SELECT id, kind, name, summary, status, hp, max_hp, ac, attitude, persona, companion FROM characters WHERE place_id = ? AND kind <> 'pc' ORDER BY companion DESC, id", pl.id)
    out.presentes = here.map((n) => {
      const p = JSON.parse(n.persona) as { traits?: string[]; goal?: string; secret?: string; voice?: string; gender?: string }
      const mem = all<{ id: number; text: string; consolidated: number; importance: number }>(c.db, "SELECT id, text, consolidated, importance FROM memories WHERE npc_id = ? AND merged_into IS NULL ORDER BY consolidated DESC, importance DESC, id DESC LIMIT 5", n.id)
      return { id: n.id, nome: n.name, quem: n.summary, estado: n.status === "vivo" ? `PV ${n.hp}/${n.max_hp} CA ${n.ac}` : n.status, atitude: n.attitude, genero: p.gender, tracos: p.traits?.join(","), quer: p.goal, voz: p.voice, segredo: p.secret ? `🔒 ${p.secret}` : undefined, companheiro: n.companion ? "sim" : undefined, lembra: mem.map((m) => `#${m.id}${m.consolidated ? " RELAÇÃO" : ""} ${m.text}`).join(" | ") || "(nada sobre o PC)" }
    })
  } else out.aviso_local = "PC sem local."
  const cs = combatState(c)
  if (cs) out.combate = { rodada: cs.round, vez: cs.order[cs.turn]!.id, ordem: cs.order.map((o) => `${o.id}:${o.init}`).join(" ") }
  out.missoes = all<{ id: string; title: string; summary: string; objectives: string; secret: number }>(c.db, "SELECT id, title, summary, objectives, secret FROM quests WHERE status = 'ativa' ORDER BY updated_turn DESC").map((q) => ({ id: q.id, titulo: q.title, resumo: q.summary, objetivos: (JSON.parse(q.objectives) as string[]).join(" | "), oculta: q.secret ? "sim" : "" }))
  out.fios = all<{ id: number; kind: string; text: string; turn: number }>(c.db, "SELECT id, kind, text, turn FROM hooks WHERE status = 'aberto' ORDER BY id DESC LIMIT 12").map((h) => ({ id: `h${h.id}`, tipo: h.kind, texto: h.text, desde: `T${h.turn}` }))
  const hookTotal = one<{ n: number }>(c.db, "SELECT COUNT(*) n FROM hooks WHERE status = 'aberto'")!.n
  if (hookTotal > 12) out.fios_mais = `${hookTotal - 12} ganchos abertos mais antigos: use recall para achar e hook.update para encerrar`
  const factTotal = one<{ n: number }>(c.db, "SELECT COUNT(*) n FROM facts")!.n
  if (factTotal > 15) out.fatos_mais = `${factTotal - 15} fatos anteriores: use recall ou mostrar f<id>`
  out.fatos = all<{ id: number; text: string; secret: number }>(c.db, "SELECT id, text, secret FROM facts ORDER BY id DESC LIMIT 15").reverse().map((f) => ({ id: `f${f.id}`, texto: `${f.secret ? "🔒 " : ""}${f.text}` }))
  out.turnos = all<{ n: number; summary: string }>(c.db, "SELECT n, summary FROM turns WHERE ended = 1 ORDER BY n DESC LIMIT 5").reverse().map((t) => ({ t: t.n, resumo: t.summary }))
  const open = one<{ n: number; action: string }>(c.db, "SELECT n, action FROM turns WHERE ended = 0 ORDER BY n DESC LIMIT 1")
  if (open) out.turno_aberto = { n: open.n, acao_do_jogador: open.action }
  const away = all<{ id: string; name: string; status: string; place: string | null }>(c.db, "SELECT c.id, c.name, c.status, p.name AS place FROM characters c LEFT JOIN places p ON p.id = c.place_id WHERE c.kind = 'npc' AND (c.place_id IS NULL OR c.place_id <> ?) ORDER BY c.created_turn DESC LIMIT 25", pc.place_id ?? "")
  if (away.length) out.noutros_lugares = away.map((n) => `${n.id}:${n.name}${n.status !== "vivo" ? `(${n.status})` : ""}@${n.place ?? "?"}`).join("; ")
  return out
}

/** Primeira leitura (ou `full`) = cena inteira; depois só as seções que mudaram. */
export function context(c: Campaign, o: { full?: boolean } = {}): string {
  const now = scene(c)
  const last = getMeta(c.db, "ctx:last")
  setMeta(c.db, "ctx:last", JSON.stringify(now))
  if (o.full || !last) return encodeToon(now)
  const prev = JSON.parse(last) as Record<string, unknown>
  const changed: Record<string, unknown> = {}, same: string[] = []
  for (const k of Object.keys(now)) {
    if (JSON.stringify(now[k]) === JSON.stringify(prev[k])) same.push(k)
    else changed[k] = now[k]
  }
  for (const k of Object.keys(prev)) if (!(k in now)) changed[k] = null
  return encodeToon({ delta: true, ...changed, inalterado: same.join(",") })
}

// ---------- capítulos ----------

function turnChanges(c: Campaign, from: number, to: number): string {
  const rows = all<{ op: string }>(c.db, "SELECT op FROM ledger WHERE turn BETWEEN ? AND ?", from, to).map((r) => JSON.parse(r.op) as { op: string; table?: string; row?: Record<string, unknown> })
  const names = (t: string, key: string) => rows.filter((r) => r.op === "put" && r.table === t && r.row && key in r.row && !("hp" in r.row && t === "characters" && !("name" in r.row))).map((r) => String(r.row![key]))
  const parts = [
    ["locais", names("places", "name")], ["npcs", names("characters", "name").filter((n) => n)], ["missões", names("quests", "title")],
    ["ganchos", names("hooks", "text").map((t) => t.slice(0, 40))],
  ].filter(([, l]) => (l as string[]).length).map(([k, l]) => `${k}: ${[...new Set(l as string[])].join(", ")}`)
  const dead = all<{ name: string }>(c.db, "SELECT name FROM characters WHERE status = 'morto'").map((d) => d.name)
  if (dead.length) parts.push(`mortos até aqui: ${dead.join(", ")}`)
  return parts.join(" · ")
}

/** Fecha capítulos devidos (a cada CHAPTER_TURNS turnos fechados). Devolve quantos criou. */
export function closeChapters(c: Campaign): number {
  let made = 0
  for (;;) {
    const last = one<{ to_turn: number }>(c.db, "SELECT to_turn FROM chapters ORDER BY n DESC LIMIT 1")?.to_turn ?? 0
    const turns = all<{ n: number; summary: string }>(c.db, "SELECT n, summary FROM turns WHERE ended = 1 AND n > ? ORDER BY n LIMIT ?", last, CHAPTER_TURNS)
    if (turns.length < CHAPTER_TURNS) return made
    const n = (one<{ n: number | null }>(c.db, "SELECT MAX(n) n FROM chapters")?.n ?? 0) + 1
    const from = turns[0]!.n, to = turns.at(-1)!.n
    c.commit("capitulo", [put("chapters", { n, from_turn: from, to_turn: to, summary: turns.map((t) => `T${t.n}: ${t.summary}`).join(" "), changes: turnChanges(c, from, to) })])
    made++
  }
}

export function resume(c: Campaign, o: { chapter?: number } = {}): string {
  if (o.chapter) {
    const ch = one<{ n: number; from_turn: number; to_turn: number; summary: string; changes: string }>(c.db, "SELECT * FROM chapters WHERE n = ?", o.chapter)
    if (!ch) throw new Error(`capítulo ${o.chapter} não existe`)
    return encodeToon({ capitulo: ch.n, turnos: `${ch.from_turn}-${ch.to_turn}`, resumo: ch.summary, mudancas: ch.changes })
  }
  const chapters = all<{ n: number; from_turn: number; to_turn: number; summary: string; changes: string }>(c.db, "SELECT * FROM chapters ORDER BY n")
  const arcs: string[] = []
  const current = chapters.length - (chapters.length % ARC_CHAPTERS || ARC_CHAPTERS)
  for (let i = 0; i < current; i += ARC_CHAPTERS) {
    const g = chapters.slice(i, i + ARC_CHAPTERS)
    arcs.push(`arco ${i / ARC_CHAPTERS + 1} (T${g[0]!.from_turn}-${g.at(-1)!.to_turn}): ${g.map((x) => x.changes || x.summary.slice(0, 80)).join(" | ")}`)
  }
  const open = chapters.slice(current)
  const lastNarr = one<{ turn: number; text: string }>(c.db, "SELECT turn, text FROM narrations ORDER BY id DESC LIMIT 1")
  return encodeToon({ premissa: c.info().premise, arcos_anteriores: arcs, arco_atual: open.map((x) => ({ cap: x.n, turnos: `${x.from_turn}-${x.to_turn}`, resumo: x.summary, mudancas: x.changes })), ultima_narracao: lastNarr ? `T${lastNarr.turn}: ${lastNarr.text}` : "", cena: scene(c) })
}

// ---------- recall ----------

/** Busca de texto na memória da campanha (fatos, memórias de NPC, turnos, narrações, capítulos). */
export function recall(c: Campaign, query: string, limit = 8): { kind: string; ref: string; text: string }[] {
  const mem = new DatabaseSync(":memory:")
  mem.exec("CREATE VIRTUAL TABLE s USING fts5(kind UNINDEXED, ref UNINDEXED, text, tokenize='unicode61 remove_diacritics 2')")
  const ins = mem.prepare("INSERT INTO s(kind, ref, text) VALUES (?,?,?)")
  for (const f of all<{ id: number; text: string }>(c.db, "SELECT id, text FROM facts WHERE secret = 0")) ins.run("fato", `f${f.id}`, f.text)
  for (const m of all<{ id: number; npc_id: string; text: string }>(c.db, "SELECT id, npc_id, text FROM memories")) ins.run("memoria", `${m.npc_id}#${m.id}`, m.text)
  for (const t of all<{ n: number; summary: string; action: string }>(c.db, "SELECT n, summary, action FROM turns WHERE ended = 1")) ins.run("turno", `T${t.n}`, `${t.action} ${t.summary}`)
  for (const n of all<{ turn: number; text: string }>(c.db, "SELECT turn, text FROM narrations")) ins.run("narracao", `T${n.turn}`, n.text)
  for (const ch of all<{ n: number; summary: string; changes: string }>(c.db, "SELECT n, summary, changes FROM chapters")) ins.run("capitulo", `cap${ch.n}`, `${ch.summary} ${ch.changes}`)
  const q = query.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean).map((t) => `"${t}"*`).join(" OR ")
  if (!q) return []
  const rows = mem.prepare("SELECT kind, ref, snippet(s, 2, '[', ']', '…', 24) AS text FROM s WHERE s MATCH ? ORDER BY rank LIMIT ?").all(q, limit) as { kind: string; ref: string; text: string }[]
  mem.close()
  return rows
}

// ---------- consulta sob demanda ----------

/** Detalhe de qualquer entidade por id (inclui segredos e todas as memórias). */
export function showEntity(c: Campaign, id: string): string {
  if (id === "pc") return encodeToon(pcCard(c) ?? { aviso: "sem personagem" })
  const ch = one<Record<string, unknown>>(c.db, "SELECT * FROM characters WHERE id = ?", id)
  if (ch) {
    const persona = JSON.parse(ch.persona as string)
    const mem = all<{ id: number; text: string; consolidated: number; merged_into: number | null; at_min: number }>(c.db, "SELECT id, text, consolidated, merged_into, at_min FROM memories WHERE npc_id = ? ORDER BY id", id)
    const sheet = JSON.parse(ch.sheet as string)
    return encodeToon({ id, tipo: ch.kind, nome: ch.name, quem: ch.summary, status: ch.status, pv: `${ch.hp}/${ch.max_hp}`, ca: ch.ac, atitude: ch.attitude, local: ch.place_id, bloco_srd: sheet.srd, persona, memorias: mem.map((m) => `#${m.id}${m.consolidated ? " RELAÇÃO" : ""}${m.merged_into ? ` (resumida em #${m.merged_into})` : ""} [${clock(m.at_min)}] ${m.text}`) })
  }
  const pl = one<Record<string, unknown>>(c.db, "SELECT * FROM places WHERE id = ?", id)
  if (pl) return encodeToon({ id, tipo: "local", nome: pl.name, kind: pl.kind, resumo: pl.summary, detalhes: pl.details, pai: pl.parent_id, saidas: all<{ to_id: string; minutes: number; via: string }>(c.db, "SELECT to_id, minutes, via FROM links WHERE from_id = ?", id).map((e) => `${e.to_id} ${e.minutes}min${e.via ? ` via ${e.via}` : ""}`), presentes: all<{ id: string; name: string }>(c.db, "SELECT id, name FROM characters WHERE place_id = ?", id).map((x) => `${x.id}:${x.name}`) })
  const it = one<Record<string, unknown>>(c.db, "SELECT * FROM items WHERE id = ?", id)
  if (it) return encodeToon({ id, tipo: "item", nome: it.name, qtd: it.qty, dono: it.owner_char ?? it.owner_place, srd: it.srd, equipado: it.equipped, props: JSON.parse(it.props as string), descricao: it.srd ? (c.srd.get("equipment", it.srd as string, "pt-BR")?.description ?? c.srd.get("magic-items", it.srd as string, "pt-BR")?.desc) : undefined })
  const q = one<Record<string, unknown>>(c.db, "SELECT * FROM quests WHERE id = ?", id)
  if (q) return encodeToon({ id, tipo: "missao", titulo: q.title, resumo: q.summary, status: q.status, giver: q.giver_id, objetivos: JSON.parse(q.objectives as string) })
  const f = /^f(\d+)$/.exec(id) ? one<Record<string, unknown>>(c.db, "SELECT * FROM facts WHERE id = ?", Number(id.slice(1))) : undefined
  if (f) return encodeToon({ id, tipo: "fato", texto: f.text, segredo: !!f.secret, sobre: f.about_id, turno: f.turn })
  throw new Error(`"${id}" não existe. Ids: pc, n1, m1, l1, i1, q1, f1.`)
}

const SRD_COLLS = ["monsters", "spells", "equipment", "magic-items", "classes", "species", "subspecies", "feats", "features", "traits", "conditions", "backgrounds", "subclasses", "skills", "weapon-properties", "weapon-mastery-properties", "poisons", "damage-types", "levels"] as const

/** Consulta ao SRD: com `id` devolve o registro (texto relevante); senão busca por texto. */
export function srdLookup(c: Campaign, coll: string, q: string): string {
  if (!(SRD_COLLS as readonly string[]).includes(coll)) throw new Error(`coleção inválida. Use: ${SRD_COLLS.join(", ")}`)
  const rec = c.srd.get(coll as never, q, "pt-BR")
  if (rec) {
    const { url: _u, image: _i, ...rest } = rec
    return encodeToon(rest)
  }
  const hits = c.srd.search(q, coll as never, 8)
  if (!hits.length) return `nada em ${coll} para "${q}"`
  return encodeToon({ resultados: hits.map((h) => ({ id: h.url.split("/").pop()!, nome: h.name, trecho: h.snippet })) })
}
