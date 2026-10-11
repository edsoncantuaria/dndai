// Resumo de capítulo: texto determinístico dos turnos, gravado como fato canônico.
import { all, type DB, getMeta, metaNum, one } from "./db.ts"
import { insertFact } from "./facts.ts"
import { fmtClock } from "./world.ts"

function summaryOf(db: DB, from: number, to: number): string {
  const turns = all<{ n: number; summary: string; started_min: number }>(
    db,
    "SELECT n, summary, started_min FROM turns WHERE ended = 1 AND n >= ? AND n <= ? ORDER BY n",
    from,
    to
  )
  if (!turns.length) throw new Error("Não há turnos encerrados nesse intervalo.")
  const body = turns.map((t) => `T${t.n} (${fmtClock(t.started_min)}): ${t.summary}`).join(" ")
  return body.length > 700 ? `${body.slice(0, 697)}…` : body
}

function writeChapter(db: DB, from: number, to: number): string {
  const n = (one<{ n: number }>(db, "SELECT COALESCE(MAX(n), 0) AS n FROM chapters")?.n ?? 0) + 1
  const summary = summaryOf(db, from, to)
  const text = `Capítulo ${n} (turnos ${from}–${to}): ${summary}`
  const factId = insertFact(db, { text, source: "motor", truth: "verdade" })
  db.prepare("INSERT INTO chapters(n, from_turn, to_turn, summary, fact_id) VALUES(?,?,?,?,?)").run(n, from, to, summary, factId)
  return `Capítulo ${n} gravado como fato #${factId} (turnos ${from}–${to}).`
}

/** A cada 8 turnos fechados, gera o capítulo sozinho. */
export function closeIfNeeded(db: DB): string | null {
  const n = metaNum(db, "turn")
  if (n < 8 || n % 8 !== 0) return null
  if (one(db, "SELECT 1 FROM chapters WHERE to_turn = ?", n)) return null
  return writeChapter(db, n - 7, n)
}

export function closeChapterNow(db: DB): string {
  const last = one<{ to_turn: number }>(db, "SELECT to_turn FROM chapters ORDER BY n DESC LIMIT 1")?.to_turn ?? 0
  const to = getMeta(db, "turn_open") === "1" ? metaNum(db, "turn") - 1 : metaNum(db, "turn")
  const from = last + 1
  if (to < from) throw new Error("Não há turnos novos para fechar um capítulo.")
  return writeChapter(db, from, to)
}

export function listChapters(db: DB): string {
  const rows = all<{ n: number; from_turn: number; to_turn: number; summary: string }>(db, "SELECT n, from_turn, to_turn, summary FROM chapters ORDER BY n")
  if (!rows.length) return "Nenhum capítulo ainda. Feche com: dnd chapter close (ou aguarde 8 turnos)."
  return rows.map((c) => `#${c.n} T${c.from_turn}–T${c.to_turn}: ${c.summary}`).join("\n")
}

export function showChapter(db: DB, n: number): string {
  const c = one<{ from_turn: number; to_turn: number; summary: string }>(db, "SELECT * FROM chapters WHERE n = ?", n)
  if (!c) throw new Error(`Capítulo ${n} não existe.`)
  const turns = all<{ n: number; action: string; summary: string }>(db, "SELECT n, action, summary FROM turns WHERE ended = 1 AND n >= ? AND n <= ? ORDER BY n", c.from_turn, c.to_turn)
  return [`Capítulo ${n}: ${c.summary}`, ...turns.map((t) => `- T${t.n}: ${t.action} → ${t.summary}`)].join("\n")
}
