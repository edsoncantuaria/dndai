// Consulta ao srd.db (D&D 2024). Fonte única das regras: nada de tabela hardcoded no motor.
import { DatabaseSync } from "node:sqlite"
import { existsSync } from "node:fs"
import { COLLECTIONS, importSrd, SRD_DB } from "./import.ts"

export type Collection = typeof COLLECTIONS[number]
export type SrdRecord = Record<string, any> & { index: string; name: string; url: string }
export type Lang = "en" | "pt-BR"

export interface SearchHit { url: string; coll: string; name: string; snippet: string }

export class Srd {
  readonly db: DatabaseSync
  constructor(path = SRD_DB) {
    if (!existsSync(path)) importSrd(path)
    this.db = new DatabaseSync(path, { readOnly: true })
  }

  private parse(row: { json: string; pt: string | null } | undefined, lang: Lang): SrdRecord | undefined {
    if (!row) return undefined
    const rec = JSON.parse(row.json)
    return lang === "pt-BR" && row.pt ? { ...rec, ...JSON.parse(row.pt) } : rec
  }

  byUrl(url: string, lang: Lang = "pt-BR"): SrdRecord | undefined {
    return this.parse(this.db.prepare("SELECT json, pt FROM srd WHERE url = ?").get(url) as any, lang)
  }

  get(coll: Collection, index: string, lang: Lang = "pt-BR"): SrdRecord | undefined {
    return this.parse(this.db.prepare("SELECT json, pt FROM srd WHERE coll = ? AND idx = ?").get(coll, index) as any, lang)
  }

  require(coll: Collection, index: string, lang: Lang = "pt-BR"): SrdRecord {
    const r = this.get(coll, index, lang)
    if (!r) throw new Error(`SRD: ${coll}/${index} não existe`)
    return r
  }

  list(coll: Collection, lang: Lang = "pt-BR"): SrdRecord[] {
    return (this.db.prepare("SELECT json, pt FROM srd WHERE coll = ? ORDER BY idx").all(coll) as any[]).map((r) => this.parse(r, lang)!)
  }

  count(coll: Collection): number {
    return (this.db.prepare("SELECT COUNT(*) n FROM srd WHERE coll = ?").get(coll) as { n: number }).n
  }

  /** Busca textual (FTS5) em nome e descrição, em todas as coleções ou numa só. */
  search(query: string, coll?: Collection, limit = 10): SearchHit[] {
    const q = query.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean).map((t) => `"${t}"*`).join(" ")
    if (!q) return []
    const sql = `SELECT url, coll, name, snippet(fts, 1, '[', ']', '…', 12) AS snippet FROM fts WHERE fts MATCH ?${coll ? " AND coll = ?" : ""} ORDER BY bm25(fts, 10, 1) LIMIT ?`
    const args = coll ? [q, coll, limit] : [q, limit]
    return this.db.prepare(sql).all(...args) as unknown as SearchHit[]
  }

  /** Registros que este registro referencia / que referenciam este. */
  refsFrom(url: string): string[] {
    return (this.db.prepare("SELECT DISTINCT dst FROM refs WHERE src = ?").all(url) as { dst: string }[]).map((r) => r.dst)
  }
  refsTo(url: string): string[] {
    return (this.db.prepare("SELECT DISTINCT src FROM refs WHERE dst = ?").all(url) as { src: string }[]).map((r) => r.src)
  }

  close(): void { this.db.close() }
}

let shared: Srd | undefined
export function srd(): Srd { return (shared ??= new Srd()) }
