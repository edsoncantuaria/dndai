import { randomBytes } from "node:crypto"
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { attachAtlas, sync } from "./atlas.ts"
import { backfillCodes } from "./codes.ts"
import { type DB, getMeta, openDb, setMeta, tighten, transaction } from "./db.ts"

const KEEP_BACKUPS = 30
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,47}$/

export function campaignsHome(): string {
  const env = process.env.DNDAI_HOME
  if (env) return resolve(env)
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "campaigns")
}

export function campaignDir(slug: string): string {
  if (!SLUG_RE.test(slug)) throw new Error(`Slug de campanha inválido: "${slug}" (use minúsculas, números e hífen).`)
  return join(campaignsHome(), slug)
}

function dbPath(slug: string): string {
  return join(campaignDir(slug), "world.db")
}

export function campaignExists(slug: string): boolean {
  return existsSync(dbPath(slug))
}

export function listCampaigns(): { slug: string; name: string }[] {
  const home = campaignsHome()
  if (!existsSync(home)) return []
  return readdirSync(home, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(home, e.name, "world.db")))
    .map((e) => {
      const db = openDb(join(home, e.name, "world.db"))
      try {
        return { slug: e.name, name: getMeta(db, "name", e.name) }
      } finally {
        db.close()
      }
    })
}

const lockDepth = new Map<string, number>()

/**
 * Trava a campanha entre processos (BEGIN IMMEDIATE num lock.db).
 * No mesmo processo a trava é reentrante, para o undo não esperar a si mesmo.
 */
export function withCampaignLock<T>(slug: string, fn: () => T): T {
  const depth = lockDepth.get(slug) ?? 0
  if (depth > 0) {
    lockDepth.set(slug, depth + 1)
    try {
      return fn()
    } finally {
      lockDepth.set(slug, depth)
    }
  }
  const dir = campaignDir(slug)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, "lock.db")
  const lock = new DatabaseSync(path)
  lock.exec("PRAGMA busy_timeout = 15000;")
  tighten(path)
  lock.exec("BEGIN IMMEDIATE")
  lockDepth.set(slug, 1)
  try {
    return fn()
  } finally {
    lockDepth.set(slug, 0)
    try {
      lock.exec("ROLLBACK")
    } catch { /* já fechada */ }
    lock.close()
  }
}

export function createCampaign(slug: string, info: { name: string; premise: string; tone: string }): DB {
  if (campaignExists(slug)) throw new Error(`Campanha "${slug}" já existe.`)
  mkdirSync(join(campaignDir(slug), "backups"), { recursive: true })
  const secretFile = join(campaignDir(slug), "connector.secret")
  if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString("hex"), { mode: 0o600 })
  tighten(secretFile)
  const db = openDb(dbPath(slug))
  attachAtlas(db, campaignsHome())
  setMeta(db, "slug", slug)
  setMeta(db, "name", info.name)
  setMeta(db, "premise", info.premise)
  setMeta(db, "tone", info.tone)
  setMeta(db, "now", 8 * 60) // dia 1, 08:00
  setMeta(db, "turn", 0)
  setMeta(db, "turn_open", 0)
  setMeta(db, "version", 1)
  // Universo novo nasce com todo o mundo já criado pelas outras crônicas.
  transaction(db, () => sync(db))
  return db
}

export function openCampaign(slug: string): DB {
  if (!campaignExists(slug)) {
    const known = listCampaigns().map((c) => c.slug)
    throw new Error(`Campanha "${slug}" não existe. Existentes: ${known.join(", ") || "nenhuma"}. Crie com: dnd campaign new <slug> --name ...`)
  }
  const db = openDb(dbPath(slug))
  attachAtlas(db, campaignsHome())
  if (!getMeta(db, "slug")) setMeta(db, "slug", slug)
  backfillCodes(db)
  return db
}

/** Resolve a campanha do comando. Nunca há campanha global: cada chat fixa a sua (isolamento entre sessões). */
export function resolveCampaign(flag: string | undefined): string {
  const slug = flag ?? process.env.DND_CAMPAIGN
  if (!slug) {
    const known = listCampaigns().map((c) => c.slug)
    throw new Error(
      `Nenhuma campanha selecionada. Use "export DND_CAMPAIGN=<slug>" neste shell ou -c <slug>. Existentes: ${known.join(", ") || "nenhuma"}.`
    )
  }
  return slug
}

function sqlPath(path: string): string {
  return path.replaceAll("'", "''")
}

function vacuumInto(db: DB, target: string): void {
  rmSync(target, { force: true })
  db.exec(`VACUUM INTO '${sqlPath(target)}'`)
  tighten(target)
}

/** Copia um sqlite fechado (ou ocioso) de forma consistente. */
function copyDbFile(src: string, dest: string): void {
  const db = new DatabaseSync(src, { readOnly: true })
  try {
    vacuumInto(db, dest)
  } finally {
    db.close()
  }
}

function archiveBackup(slug: string, src: string): void {
  const ext = process.env.DNDAI_BACKUP_DIR
  const destDir = ext ? join(resolve(ext), slug, "turns") : join(campaignDir(slug), "backups", "archive")
  mkdirSync(destDir, { recursive: true })
  const base = basename(src)
  const dest = existsSync(join(destDir, base)) ? join(destDir, `${Date.now()}-${base}`) : join(destDir, base)
  renameSync(src, dest)
  tighten(dest)
}

/** Snapshot consistente antes de abrir um turno (base do `dnd undo`). */
export function backupBeforeTurn(db: DB, slug: string, turn: number): void {
  const dir = join(campaignDir(slug), "backups")
  mkdirSync(dir, { recursive: true })
  const target = join(dir, `turn-${String(turn).padStart(5, "0")}.db`)
  vacuumInto(db, target)
  const files = readdirSync(dir).filter((f) => f.endsWith(".db")).sort()
  for (const old of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) archiveBackup(slug, join(dir, old))
}

/**
 * Cópia de sessão (world, chat, atlas) para DNDAI_BACKUP_DIR, fora do repo.
 * Sem a variável, não faz nada. Falha de disco não desfaz o turno.
 */
export function snapshotCampaign(slug: string, reason: string, world?: DB): void {
  const root = process.env.DNDAI_BACKUP_DIR
  if (!root) return
  const dest = join(resolve(root), slug, `${new Date().toISOString().replace(/[:.]/g, "-")}-${reason}`)
  mkdirSync(dest, { recursive: true })
  if (world) vacuumInto(world, join(dest, "world.db"))
  else copyDbFile(dbPath(slug), join(dest, "world.db"))
  const chat = join(campaignDir(slug), "chat.db")
  if (existsSync(chat)) copyDbFile(chat, join(dest, "chat.db"))
  const atlas = join(campaignsHome(), "atlas.db")
  if (existsSync(atlas)) copyDbFile(atlas, join(dest, "atlas.db"))
}

/** Restaura o estado anterior ao turno `turn`. O mundo precisa estar fechado; a trava da campanha segura os outros processos. */
export function restoreBeforeTurn(slug: string, turn: number): void {
  const source = join(campaignDir(slug), "backups", `turn-${String(turn).padStart(5, "0")}.db`)
  if (!existsSync(source)) throw new Error(`Não há backup anterior ao turno ${turn}.`)
  const tmp = `${dbPath(slug)}.restore`
  copyFileSync(source, tmp)
  tighten(tmp)
  renameSync(tmp, dbPath(slug)) // troca atômica: quem abrir depois vê o arquivo inteiro
  tighten(dbPath(slug))
  const undone = join(campaignDir(slug), "undone")
  mkdirSync(undone, { recursive: true })
  const base = basename(source)
  const dest = existsSync(join(undone, base)) ? join(undone, `${Date.now()}-${base}`) : join(undone, base)
  renameSync(source, dest)
  tighten(dest)
}
