// Resumo de capítulo: texto determinístico dos turnos, gravado como fato canônico.
import { all, type DB, getMeta, metaNum, one } from "./db.ts"
import { insertFact } from "./facts.ts"
import { fmtClock } from "./world.ts"

/** Capítulos por arco no resume: arcos fechados viram uma linha. */
export const ARC = 4

function summaryOf(db: DB, from: number, to: number): string {
  const turns = all<{ n: number; summary: string; started_min: number }>(
    db,
    "SELECT n, summary, started_min FROM turns WHERE ended = 1 AND n >= ? AND n <= ? ORDER BY n",
    from,
    to
  )
  if (!turns.length) throw new Error("Não há turnos encerrados nesse intervalo.")
  return turns.map((t) => `T${t.n}: ${t.summary}`).join(" ")
}

/** Linhas do lote que mudam a história (não memória, fato comum, dinheiro miúdo). */
const MARK = /^(\+ (local|NPC|facção|missão|agenda|gancho) |~ missão |~ gancho \S+: (resolvido|abandonado)|~ fato \S+ agora é conhecido|~ agenda .* resolvida|⚠ AGENDA DISPAROU|~ evento #\d+ resolvido)/

/**
 * Marcos do capítulo, tirados do log do motor (o que os apply gravaram de fato), com ids curtos.
 * Atitudes viram a variação líquida por NPC; mortes vêm do log de morte.
 */
export function changesOf(db: DB, from: number, to: number): string[] {
  const rows = all<{ kind: string; text: string }>(db, "SELECT kind, text FROM log WHERE turn >= ? AND turn <= ? AND kind IN ('lote','morte') ORDER BY id", from, to)
  const out: string[] = []
  const attitude = new Map<string, [number, number]>()
  for (const row of rows) {
    if (row.kind === "morte") {
      out.push(`✝ ${row.text}`)
      continue
    }
    for (const line of row.text.split(" | ")) {
      const att = /^~ atitude de (.+): (-?\d+) → (-?\d+)$/.exec(line)
      if (att) {
        const prev = attitude.get(att[1])
        attitude.set(att[1], [prev ? prev[0] : Number(att[2]), Number(att[3])])
      } else if (MARK.test(line)) {
        out.push(line.replace(/ \(fato secreto #\d+[^)]*\)/, "").replace(/ com \d+ ligação\(ões\)/, "").replace(/^(\+ agenda .*?\]).*/, "$1"))
      }
    }
  }
  for (const [name, [a, b]] of attitude) if (Math.abs(b - a) >= 10) out.push(`~ atitude de ${name}: ${a} → ${b}`)
  return out
}

function writeChapter(db: DB, from: number, to: number): string {
  const n = (one<{ n: number }>(db, "SELECT COALESCE(MAX(n), 0) AS n FROM chapters")?.n ?? 0) + 1
  const summary = summaryOf(db, from, to)
  const changes = changesOf(db, from, to)
  const text = `Capítulo ${n} (turnos ${from}–${to}): ${summary}`
  const factId = insertFact(db, { text, source: "motor", truth: "verdade" })
  db.prepare("INSERT INTO chapters(n, from_turn, to_turn, summary, fact_id, changes) VALUES(?,?,?,?,?,?)").run(n, from, to, summary, factId, changes.join("\n"))
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
  const c = one<{ from_turn: number; to_turn: number; summary: string; changes: string }>(db, "SELECT * FROM chapters WHERE n = ?", n)
  if (!c) throw new Error(`Capítulo ${n} não existe.`)
  const turns = all<{ n: number; action: string; summary: string }>(db, "SELECT n, action, summary FROM turns WHERE ended = 1 AND n >= ? AND n <= ? ORDER BY n", c.from_turn, c.to_turn)
  return [
    `Capítulo ${n} (T${c.from_turn}–T${c.to_turn}, ${chapterSpan(db, c.from_turn, c.to_turn)})`,
    ...(c.changes ? ["Mudanças:", ...c.changes.split("\n").map((l) => `  ${l}`)] : []),
    "Turnos:",
    ...turns.map((t) => `- T${t.n}: ${t.action} → ${t.summary}`),
  ].join("\n")
}

/** "Dia 2, 16:00 → Dia 3, 02:00" do capítulo, a partir dos turnos. */
export function chapterSpan(db: DB, from: number, to: number): string {
  const r = one<{ a: number | null; b: number | null }>(db, "SELECT MIN(started_min) AS a, MAX(started_min) AS b FROM turns WHERE n >= ? AND n <= ?", from, to)
  if (r?.a == null || r.b == null) return ""
  const strip = (m: number) => fmtClock(m).replace(/ \(.*\)$/, "")
  return `${strip(r.a)} → ${strip(r.b)}`
}
