// Campanha: um world.db por slug. Toda mudança entra por commit() (atômico, validado, registrado no ledger).
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { all, type DB, getMeta, one, openDb, setMeta } from "./db.ts"
import { append, type Op, OpSchema, put, reduce, replay, meta } from "./ledger.ts"
import { type Srd, srd as sharedSrd } from "../srd/index.ts"

export const HOME = process.env.DNDAI_HOME ? resolve(process.env.DNDAI_HOME) : resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "campaigns")

export class CampaignError extends Error {}

export interface CampaignInit { name: string; premise?: string; tone?: string }

export class Campaign {
  readonly db: DB
  readonly srd: Srd
  readonly slug: string

  private constructor(db: DB, slug: string, srd: Srd) { this.db = db; this.slug = slug; this.srd = srd }

  static slugOk(slug: string): void {
    if (!/^[a-z0-9][a-z0-9-]{0,48}$/.test(slug)) throw new CampaignError(`slug inválido: "${slug}" (use a-z, 0-9 e hífen)`)
  }

  static create(slug: string, init: CampaignInit, opts: { home?: string; srd?: Srd } = {}): Campaign {
    Campaign.slugOk(slug)
    const dir = join(opts.home ?? HOME, slug)
    if (existsSync(join(dir, "world.db"))) throw new CampaignError(`campanha "${slug}" já existe`)
    mkdirSync(dir, { recursive: true })
    const c = new Campaign(openDb(join(dir, "world.db")), slug, opts.srd ?? sharedSrd())
    setMeta(c.db, "name", init.name)
    setMeta(c.db, "premise", init.premise ?? "")
    setMeta(c.db, "tone", init.tone ?? "")
    setMeta(c.db, "edition", "2024")
    setMeta(c.db, "created", new Date().toISOString())
    c.commit("campanha", [meta("turn", 0), meta("time", 8 * 60), put("places", { id: "l0", name: "Ponto de partida", kind: "local", summary: "Onde a história começa.", visited: 1 })])
    return c
  }

  static open(slug: string, opts: { home?: string; srd?: Srd } = {}): Campaign {
    Campaign.slugOk(slug)
    const path = join(opts.home ?? HOME, slug, "world.db")
    if (!existsSync(path)) throw new CampaignError(`campanha "${slug}" não existe`)
    return new Campaign(openDb(path), slug, opts.srd ?? sharedSrd())
  }

  close(): void { this.db.close() }

  get turn(): number { return Number(getMeta(this.db, "turn", "0")) }
  get time(): number { return Number(getMeta(this.db, "time", "0")) }
  get version(): number { return Number(getMeta(this.db, "version", "0")) }
  info(): { name: string; premise: string; tone: string; edition: string } {
    return { name: getMeta(this.db, "name"), premise: getMeta(this.db, "premise"), tone: getMeta(this.db, "tone"), edition: getMeta(this.db, "edition", "2024") }
  }

  private depth = 0
  private batch = 0

  /** Agrupa vários commits num só: tudo ou nada, um único passo de undo, invariantes conferidas no fim. */
  atomic<T>(label: string, fn: () => T): T {
    if (this.depth > 0) return fn()
    this.batch = (one<{ b: number | null }>(this.db, "SELECT MAX(batch) b FROM ledger")?.b ?? 0) + 1
    this.depth = 1
    this.db.exec("BEGIN IMMEDIATE")
    try {
      this.label = label
      const r = fn()
      const bad = this.invariants()
      if (bad.length) throw new CampaignError(`invariante violada: ${bad.join("; ")}`)
      setMeta(this.db, "version", this.version + 1)
      this.db.exec("COMMIT")
      this.backup()
      return r
    } catch (e) {
      this.db.exec("ROLLBACK")
      throw e
    } finally {
      this.depth = 0
    }
  }
  private label = ""
  private lastBackup = 0

  /** Cópia consistente do mundo em DNDAI_BACKUP_DIR (no máx. a cada 5 min, guarda as 30 mais recentes). */
  private backup(): void {
    const dir = process.env.DNDAI_BACKUP_DIR
    if (!dir || Date.now() - this.lastBackup < 5 * 60_000) return
    this.lastBackup = Date.now()
    try {
      const target = join(dir, this.slug)
      mkdirSync(target, { recursive: true })
      this.db.exec(`VACUUM INTO '${join(target, `world-${new Date().toISOString().replace(/[:.]/g, "-")}.db`).replace(/'/g, "''")}'`)
      for (const old of readdirSync(target).filter((f) => f.startsWith("world-")).sort().slice(0, -30)) rmSync(join(target, old))
    } catch (e) {
      console.error(`[backup] ${this.slug}: ${(e as Error).message}`)
    }
  }

  /** Aplica ops de forma atômica. Invariante quebrada = nada é gravado. */
  commit(label: string, ops: Op[]): void {
    const parsed = ops.map((o) => OpSchema.parse(o))
    this.atomic(label, () => {
      for (const o of parsed) reduce(this.db, o)
      append(this.db, this.batch, this.turn, this.depth > 0 && this.label ? this.label : label, parsed)
    })
  }

  /** Desfaz o último commit (reaplicando o ledger sem ele). */
  undo(): string | undefined {
    const last = one<{ b: number | null; label: string }>(this.db, "SELECT batch b, label FROM ledger ORDER BY seq DESC LIMIT 1")
    if (!last?.b || last.label === "campanha") return undefined
    const version = this.version
    this.db.prepare("DELETE FROM ledger WHERE batch = ?").run(last.b)
    replay(this.db)
    setMeta(this.db, "version", version + 1)
    return last.label
  }

  invariants(): string[] {
    const out: string[] = []
    for (const r of all<{ id: string; hp: number; max_hp: number; status: string; kind: string }>(this.db, "SELECT id, hp, max_hp, status, kind FROM characters")) {
      if (r.hp > r.max_hp) out.push(`${r.id}: PV ${r.hp} acima do máximo ${r.max_hp}`)
      if (r.status === "vivo" && r.hp === 0) out.push(`${r.id}: vivo com 0 PV`)
      if (r.status === "morto" && r.hp > 0) out.push(`${r.id}: morto com PV`)
    }
    for (const r of all<{ id: string }>(this.db, "SELECT id FROM characters WHERE place_id IS NOT NULL AND place_id NOT IN (SELECT id FROM places)")) out.push(`${r.id}: local inexistente`)
    for (const r of all<{ n: number }>(this.db, "SELECT COUNT(*) n FROM characters WHERE kind='pc'")) if (r.n > 1) out.push("mais de um PC")
    return out
  }
}
