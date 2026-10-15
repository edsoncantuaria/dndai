// Fios da campanha (missões, ganchos, agendas, eventos) e vizinhança do local, para a cena do Mestre.
// Regra de compactação: o que não cabe inteiro aparece pelo id. Nada some da vista sem ponteiro.
import { all, type DB, metaNum, one } from "./db.ts"
import { now } from "./world.ts"

/** Fios mostrados por inteiro; os outros vão só pelo id em `dormentes`. */
const FULL = 6
/** Turnos sem tocar o fio (nem a quem ele se liga) até ele ser marcado como esfriando. */
const STALE = 10

export interface Thread {
  id: string
  tipo: string
  texto: string
  estado: string
  liga: string
  idade: number
  alerta: string
}

function codeOf(db: DB, entity: string): string {
  return one<{ code: string }>(db, "SELECT code FROM codes WHERE entity = ?", entity)?.code ?? entity
}

/** Guarda quem esteve em cena no fim do turno (PC, local e presentes). */
export function markSeen(db: DB): void {
  const turn = metaNum(db, "turn")
  const pc = one<{ id: string; place_id: string | null }>(db, "SELECT id, place_id FROM characters WHERE kind = 'pc' LIMIT 1")
  if (!pc?.place_id) return
  const here = all<{ id: string; faction_id: string | null }>(db, "SELECT id, faction_id FROM characters WHERE kind = 'npc' AND place_id = ? AND status <> 'morto'", pc.place_id)
  const ids = new Set([pc.id, pc.place_id, ...here.map((n) => n.id), ...here.flatMap((n) => (n.faction_id ? [n.faction_id] : []))])
  const up = db.prepare("INSERT INTO seen(entity, turn) VALUES(?, ?) ON CONFLICT(entity) DO UPDATE SET turn = excluded.turn")
  for (const id of ids) up.run(id, turn)
}

interface Raw {
  entity: string
  code: string
  tipo: string
  texto: string
  estado: string
  links: (string | null)[]
  touched: number
  urgent: string
}

function rawThreads(db: DB): Raw[] {
  const out: Raw[] = []
  for (const q of all<{ id: string; title: string; objectives: string; giver_id: string | null; secret: number; updated_turn: number }>(
    db, "SELECT id, title, objectives, giver_id, secret, updated_turn FROM quests WHERE status = 'ativa'",
  )) {
    const obj = JSON.parse(q.objectives) as { text: string; done: boolean }[]
    const next = obj.find((o) => !o.done)
    const clues = all<{ id: number }>(db, "SELECT id FROM facts WHERE about_id = ? ORDER BY id DESC LIMIT 3", q.id).map((f) => codeOf(db, `fact:${f.id}`))
    out.push({
      entity: q.id,
      code: codeOf(db, q.id),
      tipo: q.secret ? "missão secreta" : "missão",
      texto: q.title,
      estado: [obj.length ? `${obj.filter((o) => o.done).length}/${obj.length}` : "", next ? `próximo: ${next.text}` : "", clues.length ? `pistas ${clues.join(" ")}` : ""].filter(Boolean).join(" · "),
      links: [q.giver_id],
      touched: q.updated_turn,
      urgent: "",
    })
  }
  for (const h of all<{ id: number; kind: string; text: string; about_id: string | null; turn: number }>(
    db, "SELECT id, kind, text, about_id, turn FROM hooks WHERE status = 'aberto'",
  )) {
    out.push({ entity: `hook:${h.id}`, code: codeOf(db, `hook:${h.id}`), tipo: h.kind, texto: h.text, estado: "", links: [h.about_id], touched: h.turn, urgent: "" })
  }
  for (const c of all<{ id: string; name: string; owner_id: string | null; segments: number; filled: number; status: string; on_complete: string; secret: number; created_turn: number }>(
    db, "SELECT * FROM clocks WHERE status IN ('ativo','disparado')",
  )) {
    const fired = c.status === "disparado"
    out.push({
      entity: c.id,
      code: codeOf(db, c.id),
      tipo: c.secret ? "agenda secreta" : "agenda",
      texto: c.name,
      estado: fired ? `DISPAROU → ${c.on_complete}` : `${c.filled}/${c.segments}`,
      links: [c.owner_id],
      touched: c.created_turn,
      urgent: fired ? "resolva com clock.resolve" : "",
    })
  }
  const minutes = now(db)
  for (const e of all<{ id: number; text: string; at_min: number; place_id: string | null; status: string; created_turn: number }>(
    db, "SELECT * FROM events WHERE status IN ('pendente','vencido')",
  )) {
    const due = e.status === "vencido"
    const wait = Math.max(0, e.at_min - minutes)
    out.push({
      entity: `event:${e.id}`,
      code: `#${e.id}`,
      tipo: "evento",
      texto: e.text,
      estado: due ? "VENCIDO" : `em ${wait >= 60 ? `${Math.round(wait / 60)}h` : `${wait}min`}`,
      links: [e.place_id],
      touched: e.created_turn,
      urgent: due ? `resolva com event.resolve ${e.id}` : "",
    })
  }
  return out
}

/** Fios ordenados: urgentes, ligados à cena, depois os tocados mais recentemente. */
export function threadsFor(db: DB, sceneIds: string[]): { fios: Thread[]; dormentes: string; esfriando: string } {
  const turn = metaNum(db, "turn")
  const scene = new Set(sceneIds)
  const factions = new Set(
    sceneIds.length
      ? all<{ faction_id: string }>(db, `SELECT faction_id FROM characters WHERE faction_id IS NOT NULL AND id IN (${sceneIds.map(() => "?").join(",")})`, ...sceneIds).map((r) => r.faction_id)
      : [],
  )
  const seen = new Map(all<{ entity: string; turn: number }>(db, "SELECT entity, turn FROM seen").map((r) => [r.entity, r.turn]))
  const ranked = rawThreads(db).map((t) => {
    const links = t.links.filter((l): l is string => !!l)
    const factTurn = one<{ t: number | null }>(db, "SELECT MAX(turn) AS t FROM facts WHERE about_id = ?", t.entity)?.t ?? 0
    const touched = Math.max(t.touched, factTurn, ...links.map((l) => seen.get(l) ?? 0))
    const here = links.some((l) => scene.has(l) || factions.has(l))
    const idade = Math.max(0, turn - touched)
    // Agenda e evento andam sozinhos com o tempo: não "esfriam" por falta de atenção do jogador.
    const moves = t.tipo.startsWith("agenda") || t.tipo === "evento"
    return { ...t, links, here, idade, stale: !moves && !here && !t.urgent && idade >= STALE }
  })
  ranked.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent) || Number(b.here) - Number(a.here) || a.idade - b.idade || a.code.localeCompare(b.code))
  const full = ranked.slice(0, FULL)
  const rest = ranked.slice(FULL)
  return {
    fios: full.map((t) => ({
      id: t.code,
      tipo: t.tipo,
      texto: t.texto,
      estado: t.estado,
      liga: t.links.map((l) => codeOf(db, l)).join(" "),
      idade: t.idade,
      alerta: t.urgent || (t.here ? "em cena" : t.stale ? "esfriando: traga de volta ou encerre" : ""),
    })),
    dormentes: rest.map((t) => (t.stale ? `${t.code}*` : t.code)).join(" "),
    esfriando: rest.some((t) => t.stale) ? `* = parado há ${STALE}+ turnos: traga de volta ou encerre` : "",
  }
}

/** Saídas do local (ligações e sublocais) e o tamanho do mapa conhecido. */
export function exitsOf(db: DB, placeId: string): { saidas: Record<string, string | number | boolean>[]; mapa: string } {
  const links = all<{ id: string; name: string; minutes: number; via: string; visited: number }>(
    db,
    "SELECT p.id, p.name, l.minutes, l.via, p.visited FROM links l JOIN places p ON p.id = l.to_id WHERE l.from_id = ? ORDER BY l.minutes",
    placeId,
  )
  const inside = all<{ id: string; name: string; visited: number }>(db, "SELECT id, name, visited FROM places WHERE parent_id = ? ORDER BY name", placeId)
  const parent = one<{ id: string; name: string; visited: number }>(db, "SELECT p.id, p.name, p.visited FROM places c JOIN places p ON p.id = c.parent_id WHERE c.id = ?", placeId)
  const saidas = [
    ...links.map((l) => ({ id: codeOf(db, l.id), nome: l.name, min: l.minutes, via: l.via, visitado: l.visited === 1 })),
    ...inside.filter((p) => !links.some((l) => l.id === p.id)).map((p) => ({ id: codeOf(db, p.id), nome: p.name, min: 0, via: "dentro", visitado: p.visited === 1 })),
    ...(parent && !links.some((l) => l.id === parent.id) ? [{ id: codeOf(db, parent.id), nome: parent.name, min: 0, via: "fora", visitado: parent.visited === 1 }] : []),
  ]
  const total = one<{ n: number; novos: number }>(db, "SELECT COUNT(*) AS n, SUM(visited = 0) AS novos FROM places")
  return { saidas, mapa: `${total?.n ?? 0} locais conhecidos, ${total?.novos ?? 0} inexplorados → show <id> ou resume` }
}
