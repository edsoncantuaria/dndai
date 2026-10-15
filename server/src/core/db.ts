// Esquema da campanha (v2). O estado é uma projeção do `ledger`: apagar o banco e reaplicar o ledger
// reconstrói tudo (é assim que o undo funciona). Colunas JSON são objetos nas ops e texto no SQLite.
import { chmodSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"

export type DB = DatabaseSync
export const SCHEMA_VERSION = 1

/** Tabelas escritíveis pelo ledger e suas colunas JSON. */
export const TABLES = {
  places: { key: "id", json: [] },
  links: { key: "from_id,to_id", json: [] },
  characters: { key: "id", json: ["sheet", "persona", "schedule"] },
  items: { key: "id", json: ["props"] },
  quests: { key: "id", json: ["objectives"] },
  facts: { key: "id", json: [] },
  memories: { key: "id", json: [] },
  chapters: { key: "n", json: [] },
  hooks: { key: "id", json: [] },
  turns: { key: "n", json: [] },
  narrations: { key: "id", json: [] },
  rolls: { key: "id", json: ["result"] },
} as const satisfies Record<string, { key: string; json: readonly string[] }>
export type Table = keyof typeof TABLES

const STATE_SCHEMA = `
CREATE TABLE places (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, parent_id TEXT REFERENCES places(id),
  summary TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', visited INTEGER NOT NULL DEFAULT 0, created_turn INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE links (
  from_id TEXT NOT NULL REFERENCES places(id), to_id TEXT NOT NULL REFERENCES places(id),
  minutes INTEGER NOT NULL CHECK (minutes >= 0), via TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (from_id, to_id), CHECK (from_id <> to_id)
);
CREATE TABLE characters (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('pc','npc','monster')), name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '', place_id TEXT REFERENCES places(id),
  status TEXT NOT NULL DEFAULT 'vivo' CHECK (status IN ('vivo','inconsciente','estavel','morto','desaparecido')),
  hp INTEGER NOT NULL CHECK (hp >= 0), max_hp INTEGER NOT NULL CHECK (max_hp >= 1), temp_hp INTEGER NOT NULL DEFAULT 0 CHECK (temp_hp >= 0),
  ac INTEGER NOT NULL, level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 0 AND 20), xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  cp INTEGER NOT NULL DEFAULT 0 CHECK (cp >= 0), sheet TEXT NOT NULL, persona TEXT NOT NULL DEFAULT '{}',
  attitude INTEGER NOT NULL DEFAULT 0 CHECK (attitude BETWEEN -100 AND 100), faction_id TEXT,
  schedule TEXT NOT NULL DEFAULT '[]', companion INTEGER NOT NULL DEFAULT 0, created_turn INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE items (
  id TEXT PRIMARY KEY, owner_char TEXT REFERENCES characters(id), owner_place TEXT REFERENCES places(id),
  name TEXT NOT NULL, srd TEXT, qty INTEGER NOT NULL DEFAULT 1 CHECK (qty >= 0), kind TEXT NOT NULL DEFAULT 'equipamento',
  props TEXT NOT NULL DEFAULT '{}', equipped INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '',
  CHECK ((owner_char IS NULL) <> (owner_place IS NULL))
);
CREATE TABLE quests (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','concluida','falhou','abandonada')),
  giver_id TEXT, objectives TEXT NOT NULL DEFAULT '[]', secret INTEGER NOT NULL DEFAULT 0,
  created_turn INTEGER NOT NULL DEFAULT 0, updated_turn INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, about_id TEXT, text TEXT NOT NULL, secret INTEGER NOT NULL DEFAULT 0,
  turn INTEGER NOT NULL, at_min INTEGER NOT NULL
);
CREATE TABLE memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT, npc_id TEXT NOT NULL REFERENCES characters(id), text TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 1 CHECK (importance BETWEEN 1 AND 3), turn INTEGER NOT NULL, at_min INTEGER NOT NULL,
  consolidated INTEGER NOT NULL DEFAULT 0, merged_into INTEGER
);
CREATE TABLE chapters (n INTEGER PRIMARY KEY, from_turn INTEGER NOT NULL, to_turn INTEGER NOT NULL, summary TEXT NOT NULL, changes TEXT NOT NULL DEFAULT '');
CREATE TABLE hooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL CHECK (kind IN ('promessa','ameaca','misterio','gancho')),
  text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','resolvido','abandonado')),
  about_id TEXT, turn INTEGER NOT NULL, at_min INTEGER NOT NULL
);
CREATE TABLE turns (
  n INTEGER PRIMARY KEY, started_min INTEGER NOT NULL, action TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '', ended INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE narrations (id INTEGER PRIMARY KEY AUTOINCREMENT, turn INTEGER NOT NULL, text TEXT NOT NULL, at TEXT NOT NULL DEFAULT '');
CREATE TABLE rolls (
  id INTEGER PRIMARY KEY AUTOINCREMENT, turn INTEGER NOT NULL, who TEXT NOT NULL, kind TEXT NOT NULL, label TEXT NOT NULL,
  expr TEXT NOT NULL, total INTEGER NOT NULL, natural INTEGER, dc INTEGER, success INTEGER, result TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_chars_place ON characters(place_id);
CREATE INDEX idx_items_owner ON items(owner_char);
CREATE INDEX idx_mem_npc ON memories(npc_id);
`

const FIXED_SCHEMA = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE ledger (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, batch INTEGER NOT NULL, turn INTEGER NOT NULL, label TEXT NOT NULL DEFAULT '',
  op TEXT NOT NULL, at TEXT NOT NULL
);
CREATE INDEX idx_ledger_batch ON ledger(batch);
`

export function resetState(db: DB): void {
  const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('meta','ledger','sqlite_sequence')").all() as { name: string }[]).map((r) => r.name)
  for (const n of names) db.exec(`DROP TABLE IF EXISTS "${n}"`)
  db.exec("DELETE FROM sqlite_sequence")
  db.exec(STATE_SCHEMA)
}

export function openDb(path: string): DB {
  const db = new DatabaseSync(path)
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = DELETE;")
  const { user_version } = db.prepare("PRAGMA user_version").get() as { user_version: number }
  if (user_version === 0) {
    db.exec("BEGIN")
    db.exec(FIXED_SCHEMA)
    db.exec(STATE_SCHEMA)
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
    db.exec("COMMIT")
  } else if (user_version !== SCHEMA_VERSION) {
    throw new Error(`Campanha com schema ${user_version}; esperado ${SCHEMA_VERSION}.`)
  }
  try { chmodSync(path, 0o600) } catch { /* :memory: */ }
  return db
}

export function getMeta(db: DB, key: string, fallback = ""): string {
  return (db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? fallback
}
export function setMeta(db: DB, key: string, value: string | number): void {
  db.prepare("INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(value))
}
export function all<T>(db: DB, sql: string, ...p: (string | number | null)[]): T[] { return db.prepare(sql).all(...p) as T[] }
export function one<T>(db: DB, sql: string, ...p: (string | number | null)[]): T | undefined { return db.prepare(sql).get(...p) as T | undefined }
