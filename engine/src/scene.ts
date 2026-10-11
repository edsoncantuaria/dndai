// Cena compacta para o Mestre: TOON por padrão, delta depois do primeiro turno fechado.
import { all, type DB, getMeta, metaNum, one, setMeta } from "./db.ts"
import { pendingRequests } from "./mechanics.ts"
import { encodeToon } from "./toon.ts"
import { clockParts, fmtClock, getCharacter, getPlace, now, pcId, type CharacterRow } from "./world.ts"

type Cell = string | number | boolean | null

function codeOf(db: DB, entity: string): string {
  return one<{ code: string }>(db, "SELECT code FROM codes WHERE entity = ?", entity)?.code ?? entity
}

/** Memórias que ainda valem a pena no contexto. Importância 3 fica; o resto envelhece. */
export function memoriesFor(db: DB, npc: string, detailed = false): { text: string; importance: number; at_min: number }[] {
  const rows = all<{ text: string; importance: number; at_min: number }>(
    db,
    "SELECT text, importance, at_min FROM memories WHERE npc_id = ? ORDER BY importance DESC, id DESC",
    npc,
  )
  const minutes = now(db)
  const kept = rows.filter((m) => {
    if (detailed || m.importance >= 3) return true
    const age = minutes - m.at_min
    if (m.importance === 2) return age <= 3 * 1440
    return age <= 1440
  })
  return kept.slice(0, detailed ? 50 : 4)
}

function signature(db: DB): string {
  const pid = pcId(db)
  const pc = pid ? getCharacter(db, pid) : null
  const npcs = all<{ id: string; hp: number; status: string; place_id: string | null; attitude: number }>(
    db,
    "SELECT id, hp, status, place_id, attitude FROM characters WHERE kind = 'npc' ORDER BY id",
  )
  const facts = all<{ id: number }>(db, "SELECT id FROM facts ORDER BY id")
  const hooks = all<{ id: number; status: string }>(db, "SELECT id, status FROM hooks ORDER BY id")
  const pend = pendingRequests(db).map((r) => r.id)
  return JSON.stringify({
    place: pc?.place_id ?? null,
    pc: pc ? [pc.hp, pc.max_hp, pc.cp, pc.status, pc.place_id] : null,
    npcs,
    facts: facts.map((f) => f.id),
    hooks,
    pend,
    now: now(db),
  })
}

export function sceneDoc(db: DB, slug: string): Record<string, unknown> {
  const turn = metaNum(db, "turn")
  const open = getMeta(db, "turn_open") === "1"
  const doc: Record<string, unknown> = {
    campanha: slug,
    nome: getMeta(db, "name"),
    turno: turn,
    aberto: open,
    quando: fmtClock(now(db)),
  }
  const pid = pcId(db)
  if (!pid) {
    doc.aviso = "Sem PC. Crie com pc create."
    return doc
  }
  const pc = getCharacter(db, pid)
  const place = pc.place_id ? getPlace(db, pc.place_id) : null
  const here = place
    ? all<CharacterRow>(db, "SELECT * FROM characters WHERE kind = 'npc' AND place_id = ? ORDER BY companion DESC, name", place.id)
    : []
  const presentes = here.map((n) => {
    const c = getCharacter(db, n.id)
    const row: Record<string, Cell> = {
      id: codeOf(db, n.id),
      nome: c.name,
      atitude: c.attitude,
      pv: `${c.hp}/${c.max_hp}`,
      status: c.status,
    }
    if (c.persona.secret) row.segredo = c.persona.secret
    const mem = memoriesFor(db, n.id)[0]
    if (mem) row.lembra = mem.text
    return row
  })
  const pendencias = pendingRequests(db).map((r) => `Rolagem #${r.id} aguardando o jogador na mesa: ${r.label}`)
  const hooks = all<{ id: number; kind: string; text: string }>(db, "SELECT id, kind, text FROM hooks WHERE status = 'aberto' ORDER BY id DESC LIMIT 8")
  const sceneIds = [pc.id, pc.place_id, ...here.map((n) => n.id)].filter(Boolean) as string[]
  const facts = all<{ id: number; text: string; truth: string; source: string; secret: number }>(
    db,
    `SELECT id, text, truth, source, secret FROM facts WHERE ${sceneIds.length ? `about_id IN (${sceneIds.map(() => "?").join(",")}) OR ` : ""}about_id IS NULL OR text LIKE 'FORA DE CENA:%' ORDER BY id DESC LIMIT 8`,
    ...sceneIds,
  )
  const indice = [
    { id: codeOf(db, pc.id), nome: pc.name, tipo: "pc" },
    ...(place ? [{ id: codeOf(db, place.id), nome: place.name, tipo: "local" }] : []),
    ...here.map((n) => ({ id: codeOf(db, n.id), nome: n.name, tipo: "npc" })),
  ]
  const corpo = {
    pc: {
      id: codeOf(db, pc.id),
      nome: pc.name,
      pv: `${pc.hp}/${pc.max_hp}`,
      ca: pc.ac,
      status: pc.status,
      local: place ? codeOf(db, place.id) : "",
    },
    local: place ? { id: codeOf(db, place.id), nome: place.name, tipo: place.kind, resumo: place.summary } : null,
    presentes,
    pendencias,
    ganchos: hooks.map((h) => ({ id: codeOf(db, `hook:${h.id}`), tipo: h.kind, texto: h.text })),
    fatos: facts.reverse().map((f) => ({
      id: codeOf(db, `fact:${f.id}`),
      texto: f.text,
      verdade: f.truth,
      fonte: f.source,
      secreto: f.secret === 1,
    })),
    indice,
  }
  const snapRaw = getMeta(db, "scene_snap")
  if (!snapRaw) return { ...doc, modo: "cena", ...corpo }
  const snap = JSON.parse(snapRaw) as { turn: number; sig: string }
  const sig = signature(db)
  if (snap.sig === sig) {
    return { ...doc, modo: "delta", desde: snap.turn, mudou: false, indice, pendencias }
  }
  return { ...doc, modo: "delta", desde: snap.turn, mudou: true, ...corpo, dia: clockParts(now(db)).day }
}

export function renderScene(db: DB, slug: string, opts: { json?: boolean } = {}): string {
  const doc = sceneDoc(db, slug)
  return opts.json ? JSON.stringify(doc) : encodeToon(doc)
}

/** Gravado no fim do turno, dentro da transação, para o próximo context sair em delta. */
export function captureSceneSnap(db: DB): void {
  setMeta(db, "scene_snap", JSON.stringify({ turn: metaNum(db, "turn"), sig: signature(db) }))
}
