// Rolagens e undos fora do world.db. O `dnd undo` restaura o mundo, mas este
// arquivo é append-only: o dado rolado continua visível e undos seguidos têm teto.
import { DatabaseSync } from "node:sqlite"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { campaignDir } from "./campaign.ts"
import { tighten } from "./db.ts"

const MAX_UNDO_STREAK = 2

interface JournalEvent {
  id: number
  kind: string
  turn: number
  at: string
  payload: string
}

function openJournal(slug: string): DatabaseSync {
  const dir = campaignDir(slug)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, "rolls.db")
  const db = new DatabaseSync(path)
  db.exec("PRAGMA busy_timeout = 5000;")
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      turn INTEGER NOT NULL,
      at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events BEGIN
      SELECT RAISE(ABORT, 'log append-only');
    END;
    CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events BEGIN
      SELECT RAISE(ABORT, 'log append-only');
    END;
  `)
  tighten(path)
  return db
}

function withJournal<T>(slug: string, fn: (db: DatabaseSync) => T): T {
  const db = openJournal(slug)
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

function append(slug: string, kind: string, turn: number, payload: unknown): void {
  withJournal(slug, (db) => {
    db.prepare("INSERT INTO events(kind, turn, at, payload) VALUES(?,?,?,?)").run(kind, turn, new Date().toISOString(), JSON.stringify(payload))
  })
}

export function recordRoll(slug: string, turn: number, payload: { worldId: number; label: string; text: string; values: number[]; source: string; reason: string }): void {
  if (!slug) return
  append(slug, "roll", turn, payload)
}

export function recordTurnClosed(slug: string, turn: number): void {
  if (!slug) return
  append(slug, "turn_closed", turn, { turn })
}

function events(slug: string): JournalEvent[] {
  return withJournal(slug, (db) => db.prepare("SELECT id, kind, turn, at, payload FROM events ORDER BY id").all() as unknown as JournalEvent[])
}

/** Undos desde o último turno fechado (o contador vive fora do world.db, senão o undo o apagaria). */
export function undoStreak(slug: string): number {
  const rows = events(slug)
  let n = 0
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].kind === "turn_closed") break
    if (rows[i].kind === "undo") n++
  }
  return n
}

export function assertCanUndo(slug: string): void {
  const n = undoStreak(slug)
  if (n >= MAX_UNDO_STREAK) {
    throw new Error(`Limite de ${MAX_UNDO_STREAK} undos seguidos. Feche um turno novo (turn end) antes de desfazer de novo. As rolagens desfeitas continuam em "dnd rolls".`)
  }
}

export function recordUndo(slug: string, turn: number): void {
  append(slug, "undo", turn, { turn })
}

export interface VisibleRoll {
  turn: number
  at: string
  label: string
  text: string
  values: number[]
  source: string
  undone: boolean
}

export function visibleRolls(slug: string): VisibleRoll[] {
  const rows = events(slug)
  const undoneTurns = new Set(rows.filter((r) => r.kind === "undo").map((r) => r.turn))
  const out: VisibleRoll[] = []
  for (const r of rows) {
    if (r.kind !== "roll") continue
    const p = JSON.parse(r.payload) as { label: string; text: string; values: number[]; source: string }
    out.push({ turn: r.turn, at: r.at, label: p.label, text: p.text, values: p.values, source: p.source, undone: undoneTurns.has(r.turn) })
  }
  return out
}

export function formatRollJournal(slug: string): string {
  const rows = visibleRolls(slug)
  if (!rows.length) return ""
  return rows
    .map((r) => `${r.undone ? "↩ desfeita (o dado continua valendo)" : "✔"} T${r.turn} [${r.source}] ${r.label}: ${r.text.replaceAll("\n", " · ")} dados [${r.values.join(",")}]`)
    .join("\n")
}
