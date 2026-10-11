import { chmodSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"

export type DB = DatabaseSync

const SCHEMA_VERSION = 5

/** Arquivo de campanha legível só pelo usuário do servidor (o túnel público não deve herdar 644). */
export function tighten(path: string): void {
  try {
    chmodSync(path, 0o600)
  } catch { /* :memory: ou filesystem sem chmod */ }
}

const SCHEMA = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  parent_id TEXT REFERENCES places(id),
  summary TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  visited INTEGER NOT NULL DEFAULT 0,
  created_turn INTEGER NOT NULL
);

CREATE TABLE links (
  from_id TEXT NOT NULL REFERENCES places(id),
  to_id TEXT NOT NULL REFERENCES places(id),
  minutes INTEGER NOT NULL CHECK (minutes >= 0),
  via TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (from_id, to_id),
  CHECK (from_id <> to_id)
);

CREATE TABLE factions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  goal TEXT NOT NULL DEFAULT '',
  attitude INTEGER NOT NULL DEFAULT 0,
  created_turn INTEGER NOT NULL
);

CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('pc','npc')),
  name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  place_id TEXT REFERENCES places(id),
  status TEXT NOT NULL DEFAULT 'vivo' CHECK (status IN ('vivo','inconsciente','morto','desaparecido')),
  hp INTEGER NOT NULL CHECK (hp >= 0),
  max_hp INTEGER NOT NULL CHECK (max_hp >= 1),
  temp_hp INTEGER NOT NULL DEFAULT 0 CHECK (temp_hp >= 0),
  ac INTEGER NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 20),
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  cp INTEGER NOT NULL DEFAULT 0 CHECK (cp >= 0),
  sheet TEXT NOT NULL,
  persona TEXT NOT NULL DEFAULT '{}',
  attitude INTEGER NOT NULL DEFAULT 0 CHECK (attitude BETWEEN -100 AND 100),
  faction_id TEXT REFERENCES factions(id),
  schedule TEXT NOT NULL DEFAULT '[]',
  companion INTEGER NOT NULL DEFAULT 0,
  created_turn INTEGER NOT NULL
);

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  owner_char TEXT REFERENCES characters(id),
  owner_place TEXT REFERENCES places(id),
  name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty >= 0),
  kind TEXT NOT NULL DEFAULT 'equipamento',
  props TEXT NOT NULL DEFAULT '{}',
  equipped INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  CHECK ((owner_char IS NULL) <> (owner_place IS NULL))
);

CREATE TABLE quests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','concluida','falhou','abandonada')),
  giver_id TEXT REFERENCES characters(id),
  objectives TEXT NOT NULL DEFAULT '[]',
  secret INTEGER NOT NULL DEFAULT 0,
  created_turn INTEGER NOT NULL,
  updated_turn INTEGER NOT NULL
);

CREATE TABLE facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  about_id TEXT,
  text TEXT NOT NULL,
  secret INTEGER NOT NULL DEFAULT 0,
  turn INTEGER NOT NULL,
  at_min INTEGER NOT NULL
);

CREATE TABLE memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  npc_id TEXT NOT NULL REFERENCES characters(id),
  text TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 1 CHECK (importance BETWEEN 1 AND 3),
  turn INTEGER NOT NULL,
  at_min INTEGER NOT NULL
);

CREATE TABLE clocks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT,
  segments INTEGER NOT NULL CHECK (segments BETWEEN 2 AND 12),
  filled INTEGER NOT NULL DEFAULT 0 CHECK (filled >= 0),
  every_min INTEGER CHECK (every_min IS NULL OR every_min > 0),
  last_tick_min INTEGER NOT NULL,
  on_complete TEXT NOT NULL,
  secret INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','disparado','resolvido')),
  outcome TEXT NOT NULL DEFAULT '',
  created_turn INTEGER NOT NULL
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at_min INTEGER NOT NULL,
  text TEXT NOT NULL,
  place_id TEXT REFERENCES places(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','vencido','resolvido')),
  outcome TEXT NOT NULL DEFAULT '',
  created_turn INTEGER NOT NULL
);

CREATE TABLE turns (
  n INTEGER PRIMARY KEY,
  started_min INTEGER NOT NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  narration TEXT NOT NULL DEFAULT '',
  ended INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE roll_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  who TEXT NOT NULL REFERENCES characters(id),
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  dice TEXT NOT NULL,
  mode TEXT NOT NULL,
  modifier INTEGER NOT NULL,
  dc INTEGER,
  reason TEXT NOT NULL DEFAULT '',
  created_turn INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','resolvida','cancelada')),
  result TEXT
);

CREATE TABLE intents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','lida')),
  created_at TEXT NOT NULL
);

CREATE TABLE log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  turn INTEGER NOT NULL,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE VIRTUAL TABLE search USING fts5(ref UNINDEXED, kind UNINDEXED, text, tokenize = 'unicode61 remove_diacritics 2');

CREATE INDEX idx_chars_place ON characters(place_id);
CREATE INDEX idx_mem_npc ON memories(npc_id);
CREATE INDEX idx_facts_about ON facts(about_id);
`

// MIGRATIONS[i] leva o schema da versão i+1 para i+2 (campanhas existentes são atualizadas ao abrir).
const MIGRATIONS = [
  `CREATE TABLE narrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turn INTEGER NOT NULL,
    text TEXT NOT NULL,
    at TEXT NOT NULL
  );`,
  // v3: multiverso compartilhado (atlas). Liga cada entidade local à sua definição no atlas.
  `CREATE TABLE atlas_state (
    id TEXT PRIMARY KEY,
    canon_id TEXT NOT NULL,
    owned INTEGER NOT NULL,
    def TEXT NOT NULL DEFAULT '',
    diverged INTEGER NOT NULL DEFAULT 0
  );
  ALTER TABLE facts ADD COLUMN lore INTEGER NOT NULL DEFAULT 0;`,
  // v4: arma em punho e reação dos NPCs a ela (estado do universo).
  `ALTER TABLE items ADD COLUMN drawn INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE reactions (
    npc_id TEXT PRIMARY KEY REFERENCES characters(id),
    text TEXT NOT NULL,
    penalized_at INTEGER NOT NULL
  );`,
  // v5: proveniência dos fatos, ganchos e capítulos.
  `ALTER TABLE facts ADD COLUMN source TEXT NOT NULL DEFAULT 'mestre';
  ALTER TABLE facts ADD COLUMN truth TEXT NOT NULL DEFAULT 'verdade';
  ALTER TABLE facts ADD COLUMN source_ref TEXT NOT NULL DEFAULT '';
  CREATE TABLE hooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('promessa','ameaca','misterio','gancho')),
    text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','resolvido','abandonado')),
    about_id TEXT,
    turn INTEGER NOT NULL,
    at_min INTEGER NOT NULL
  );
  CREATE TABLE chapters (
    n INTEGER PRIMARY KEY,
    from_turn INTEGER NOT NULL,
    to_turn INTEGER NOT NULL,
    summary TEXT NOT NULL,
    fact_id INTEGER
  );
  CREATE TABLE codes (
    code TEXT PRIMARY KEY,
    entity TEXT NOT NULL UNIQUE
  );`,
]

export function openDb(path: string): DB {
  const db = new DatabaseSync(path)
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = DELETE;")
  const { user_version } = db.prepare("PRAGMA user_version").get() as { user_version: number }
  if (user_version === 0) {
    db.exec("BEGIN")
    db.exec(SCHEMA)
    for (const m of MIGRATIONS) db.exec(m)
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
    db.exec("COMMIT")
  } else if (user_version < SCHEMA_VERSION) {
    db.exec("BEGIN IMMEDIATE")
    for (let v = user_version; v < SCHEMA_VERSION; v++) db.exec(MIGRATIONS[v - 1])
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
    db.exec("COMMIT")
  } else if (user_version > SCHEMA_VERSION) {
    throw new Error(`Campanha criada por versão mais nova do motor (schema ${user_version}).`)
  }
  tighten(path)
  return db
}

export function getMeta(db: DB, key: string, fallback = ""): string {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined
  return row?.value ?? fallback
}

export function setMeta(db: DB, key: string, value: string | number): void {
  db.prepare("INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(value))
}

export function metaNum(db: DB, key: string): number {
  return Number(getMeta(db, key, "0"))
}

/** Executa `fn` atomicamente e incrementa a versão do mundo (usada pelo SSE da mesa). */
export function transaction<T>(db: DB, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE")
  try {
    const result = fn()
    setMeta(db, "version", metaNum(db, "version") + 1)
    db.exec("COMMIT")
    return result
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

export function all<T>(db: DB, sql: string, ...params: (string | number | null)[]): T[] {
  return db.prepare(sql).all(...params) as T[]
}

export function one<T>(db: DB, sql: string, ...params: (string | number | null)[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined
}

export function index(db: DB, ref: string, kind: string, text: string): void {
  db.prepare("DELETE FROM search WHERE ref = ? AND kind = ?").run(ref, kind)
  db.prepare("INSERT INTO search(ref, kind, text) VALUES(?, ?, ?)").run(ref, kind, text)
}

export function log(db: DB, kind: string, text: string): void {
  db.prepare("INSERT INTO log(turn, kind, text, at) VALUES(?, ?, ?, ?)").run(metaNum(db, "turn"), kind, text, new Date().toISOString())
}
