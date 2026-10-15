// Importa 100% do 5e-database (D&D 2024) para um SQLite consultável.
// Fonte: data/5e-database/src/2024/{en,pt-BR}. Nada é ignorado em silêncio:
// coleção desconhecida ou ausente, url duplicada e referência órfã são erros.
import { DatabaseSync } from "node:sqlite"
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
export const SRD_SOURCE = resolve(here, "..", "..", "..", "data", "5e-database", "src", "2024")
export const SRD_DB = process.env.DNDAI_SRD_DB ?? resolve(here, "..", "..", "data", "srd.db")

export const COLLECTIONS = [
  "ability-scores", "alignments", "backgrounds", "classes", "conditions", "damage-types",
  "equipment", "equipment-categories", "feats", "features", "languages", "levels", "magic-items",
  "magic-schools", "monsters", "poisons", "proficiencies", "skills", "species", "spells",
  "subclasses", "subspecies", "traits", "weapon-mastery-properties", "weapon-properties",
] as const

type Json = null | boolean | number | string | Json[] | { [k: string]: Json }
type Rec = { [k: string]: Json }

const API_PREFIX = "/api/2024/"

function collOfFile(file: string): string {
  return file.replace(/^5e-SRD-/, "").replace(/\.json$/, "").toLowerCase()
}

function readCollections(lang: string): Map<string, Rec[]> {
  const dir = join(SRD_SOURCE, lang)
  const out = new Map<string, Rec[]>()
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    out.set(collOfFile(f), JSON.parse(readFileSync(join(dir, f), "utf8")) as Rec[])
  }
  return out
}

// Todo objeto com index/name/url apontando para /api/2024/... é uma referência.
function collectRefs(node: Json, out: string[]): void {
  if (Array.isArray(node)) { for (const x of node) collectRefs(x, out); return }
  if (node && typeof node === "object") {
    const u = node.url
    if (typeof u === "string" && u.startsWith(API_PREFIX) && "index" in node && "name" in node) out.push(u)
    for (const v of Object.values(node)) collectRefs(v, out)
  }
}

function collectText(node: Json, out: string[]): void {
  if (typeof node === "string") out.push(node)
  else if (Array.isArray(node)) for (const x of node) collectText(x, out)
  else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) if (k !== "url" && k !== "image") collectText(v, out)
}

export interface ImportReport { records: number; refs: number; perCollection: Record<string, number>; ptBR: number }

export function importSrd(dbPath = SRD_DB): ImportReport {
  const en = readCollections("en")
  const found = [...en.keys()].sort()
  const expected = [...COLLECTIONS].sort()
  if (JSON.stringify(found) !== JSON.stringify(expected)) {
    throw new Error(`Coleções do 5e-database mudaram.\n  esperado: ${expected.join(",")}\n  achado:   ${found.join(",")}`)
  }

  mkdirSync(dirname(dbPath), { recursive: true })
  if (existsSync(dbPath)) rmSync(dbPath)
  const db = new DatabaseSync(dbPath)
  db.exec(`
    PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;
    CREATE TABLE srd (url TEXT PRIMARY KEY, coll TEXT NOT NULL, idx TEXT NOT NULL, name TEXT NOT NULL, json TEXT NOT NULL, pt TEXT, UNIQUE (coll, idx));
    CREATE TABLE refs (src TEXT NOT NULL, dst TEXT NOT NULL);
    CREATE INDEX refs_src ON refs (src); CREATE INDEX refs_dst ON refs (dst);
    CREATE VIRTUAL TABLE fts USING fts5 (name, text, url UNINDEXED, coll UNINDEXED, tokenize = 'unicode61 remove_diacritics 2');
  `)
  const ins = db.prepare("INSERT INTO srd (url, coll, idx, name, json) VALUES (?,?,?,?,?)")
  const insRef = db.prepare("INSERT INTO refs (src, dst) VALUES (?,?)")
  const insFts = db.prepare("INSERT INTO fts (name, text, url, coll) VALUES (?,?,?,?)")
  const perCollection: Record<string, number> = {}
  let records = 0, refCount = 0
  db.exec("BEGIN")
  for (const [coll, list] of en) {
    perCollection[coll] = list.length
    for (const r of list) {
      const url = r.url, idx = r.index, name = r.name
      if (typeof url !== "string" || typeof idx !== "string" || typeof name !== "string") throw new Error(`${coll}: registro sem index/name/url: ${JSON.stringify(r).slice(0, 120)}`)
      ins.run(url, coll, idx, name, JSON.stringify(r))
      const refs: string[] = []
      collectRefs(r, refs)
      for (const d of refs) { insRef.run(url, d); refCount++ }
      const text: string[] = []
      collectText(r, text)
      insFts.run(name, text.join("\n"), url, coll)
      records++
    }
  }
  // Tradução oficial (pt-BR): só guarda; a leitura mescla sobre o inglês.
  let ptBR = 0
  const upPt = db.prepare("UPDATE srd SET pt = ? WHERE url = ?")
  for (const [, list] of readCollections("pt-BR")) {
    for (const r of list) {
      if (typeof r.url !== "string") continue
      const res = upPt.run(JSON.stringify(r), r.url)
      if (Number(res.changes) !== 1) throw new Error(`pt-BR sem correspondente em en: ${r.url}`)
      ptBR++
    }
  }
  db.exec("COMMIT")

  const orphans = db.prepare("SELECT DISTINCT dst FROM refs WHERE dst NOT IN (SELECT url FROM srd)").all() as { dst: string }[]
  db.close()
  if (orphans.length) throw new Error(`${orphans.length} referências órfãs: ${orphans.slice(0, 10).map((o) => o.dst).join(", ")}`)
  return { records, refs: refCount, perCollection, ptBR }
}
