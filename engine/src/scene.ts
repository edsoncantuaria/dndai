// Cena compacta para o Mestre: TOON por padrão, delta depois do primeiro turno fechado.
import { all, type DB, getMeta, metaNum, one, setMeta } from "./db.ts"
import { drawnWeapon, reactionOf } from "./items.ts"
import { pendingRequests } from "./mechanics.ts"
import { exitsOf, threadsFor } from "./threads.ts"
import { encodeToon } from "./toon.ts"
import { clockParts, fmtClock, getCharacter, getPlace, now, pcId, type CharacterRow } from "./world.ts"

type Cell = string | number | boolean | null

/** Fatos da cena mostrados por inteiro; o resto vira contagem com ponteiro. */
const FACTS = 8

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
  const quests = all<{ id: string; status: string; updated_turn: number }>(db, "SELECT id, status, updated_turn FROM quests ORDER BY id")
  const clocks = all<{ id: string; filled: number; status: string }>(db, "SELECT id, filled, status FROM clocks ORDER BY id")
  const events = all<{ id: number; status: string }>(db, "SELECT id, status FROM events ORDER BY id")
  const places = one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM places")?.n ?? 0
  return JSON.stringify({
    quests,
    clocks,
    events,
    places,
    place: pc?.place_id ?? null,
    pc: pc ? [pc.hp, pc.max_hp, pc.cp, pc.status, pc.place_id] : null,
    npcs,
    facts: facts.map((f) => f.id),
    hooks,
    pend,
    now: now(db),
  })
}

/** `cena: true` ignora o delta (conversa nova do Mestre não viu a cena anterior). */
export function sceneDoc(db: DB, slug: string, opts: { cena?: boolean } = {}): Record<string, unknown> {
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
    const reaction = reactionOf(db, n.id)
    if (reaction) row.reacao = `Reagindo agora: ${reaction}`
    const mems = memoriesFor(db, n.id)
    if (mems[0]) row.lembra = mems[0].text
    const total = one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM memories WHERE npc_id = ?", n.id)?.n ?? 0
    if (total > (mems[0] ? 1 : 0)) row.memorias = `+${total - (mems[0] ? 1 : 0)} → show ${codeOf(db, n.id)}`
    return row
  })
  const pendencias = pendingRequests(db).map((r) => `Rolagem #${r.id} aguardando o jogador na mesa: ${r.label}`)
  const sceneIds = [pc.id, pc.place_id, ...here.map((n) => n.id)].filter(Boolean) as string[]
  const { fios, dormentes, esfriando } = threadsFor(db, sceneIds)
  // Capítulos são fatos sem about_id, mas vivem no resume: não disputam espaço com os fatos da cena.
  const factWhere = `(${sceneIds.length ? `about_id IN (${sceneIds.map(() => "?").join(",")}) OR ` : ""}about_id IS NULL OR text LIKE 'FORA DE CENA:%') AND id NOT IN (SELECT fact_id FROM chapters WHERE fact_id IS NOT NULL)`
  const facts = all<{ id: number; text: string; truth: string; source: string; secret: number }>(
    db,
    `SELECT id, text, truth, source, secret FROM facts WHERE ${factWhere} ORDER BY id DESC LIMIT ${FACTS}`,
    ...sceneIds,
  )
  const factTotal = one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM facts WHERE ${factWhere}`, ...sceneIds)?.n ?? 0
  const map = place ? exitsOf(db, place.id) : null
  const indice = [
    { id: codeOf(db, pc.id), nome: pc.name, tipo: "pc" },
    ...(place ? [{ id: codeOf(db, place.id), nome: place.name, tipo: "local" }] : []),
    ...here.map((n) => ({ id: codeOf(db, n.id), nome: n.name, tipo: "npc" })),
  ]
  const weapon = drawnWeapon(db, pc.id)
  const corpo = {
    pc: {
      id: codeOf(db, pc.id),
      nome: pc.name,
      pv: `${pc.hp}/${pc.max_hp}`,
      ca: pc.ac,
      status: pc.status,
      local: place ? codeOf(db, place.id) : "",
      ...(weapon ? { punho: `EM PUNHO: ${weapon}` } : {}),
    },
    local: place ? { id: codeOf(db, place.id), nome: place.name, tipo: place.kind, resumo: place.summary } : null,
    ...(map ? { saidas: map.saidas, mapa: map.mapa } : {}),
    presentes,
    pendencias,
    fios,
    ...(dormentes ? { dormentes: `${dormentes} → show <id>` } : {}),
    ...(esfriando ? { esfriando } : {}),
    fatos: facts.reverse().map((f) => ({
      id: codeOf(db, `fact:${f.id}`),
      texto: f.text,
      verdade: f.truth,
      fonte: f.source,
      secreto: f.secret === 1,
    })),
    ...(factTotal > facts.length ? { fatos_mais: `+${factTotal - facts.length} mais antigos → recall <termos> ou fact <id>` } : {}),
    indice,
  }
  const snapRaw = getMeta(db, "scene_snap")
  if (!snapRaw || opts.cena) return { ...doc, modo: "cena", ...corpo }
  const snap = JSON.parse(snapRaw) as { turn: number; sig: string }
  const sig = signature(db)
  if (snap.sig === sig) {
    return { ...doc, modo: "delta", desde: snap.turn, mudou: false, indice, pendencias }
  }
  return { ...doc, modo: "delta", desde: snap.turn, mudou: true, ...corpo, dia: clockParts(now(db)).day }
}

export function renderScene(db: DB, slug: string, opts: { json?: boolean; cena?: boolean } = {}): string {
  const doc = sceneDoc(db, slug, opts)
  return opts.json ? JSON.stringify(doc) : encodeToon(doc)
}

/** Gravado no fim do turno, dentro da transação, para o próximo context sair em delta. */
export function captureSceneSnap(db: DB): void {
  setMeta(db, "scene_snap", JSON.stringify({ turn: metaNum(db, "turn"), sig: signature(db) }))
}
