import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { attachAtlas, sync } from "./atlas.ts"
import { type DB, getMeta, openDb, setMeta, transaction } from "./db.ts"

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

export function createCampaign(slug: string, info: { name: string; premise: string; tone: string }): DB {
  if (campaignExists(slug)) throw new Error(`Campanha "${slug}" já existe.`)
  mkdirSync(join(campaignDir(slug), "backups"), { recursive: true })
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

/** Snapshot consistente antes de abrir um turno (base do `dnd undo`). */
export function backupBeforeTurn(db: DB, slug: string, turn: number): void {
  const dir = join(campaignDir(slug), "backups")
  mkdirSync(dir, { recursive: true })
  const target = join(dir, `turn-${String(turn).padStart(5, "0")}.db`)
  rmSync(target, { force: true })
  db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`)
  const files = readdirSync(dir).filter((f) => f.endsWith(".db")).sort()
  for (const old of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) rmSync(join(dir, old))
}

/** Restaura o estado anterior ao turno `turn` (o banco precisa estar fechado). */
export function restoreBeforeTurn(slug: string, turn: number): void {
  const source = join(campaignDir(slug), "backups", `turn-${String(turn).padStart(5, "0")}.db`)
  if (!existsSync(source)) throw new Error(`Não há backup anterior ao turno ${turn}.`)
  const tmp = `${dbPath(slug)}.restore`
  copyFileSync(source, tmp)
  renameSync(tmp, dbPath(slug)) // troca atômica: leitores nunca veem arquivo pela metade
  rmSync(source)
}
