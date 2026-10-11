// Escopo do conector: um segredo enxerga só as campanhas que lhe pertencem.
import { createHash, timingSafeEqual } from "node:crypto"
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { campaignsHome, listCampaigns } from "./campaign.ts"

export interface SecretScope {
  kind: "campaign" | "legacy"
  /** Campanha dona do segredo, quando a URL é /mcp/<segredo-da-campanha>. */
  owner?: string
  slugs: string[]
  /** Pode criar campanha nova (só o segredo legado, nunca o de uma campanha). */
  canCreate: boolean
  /** Há várias campanhas e o operador ainda não gravou conector-scope. */
  ambiguous: boolean
}

export function secretHash(secret: string): string {
  return createHash("sha256").update(secret).digest("hex").slice(0, 12)
}

export function secretsEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb)
}

function scopePath(): string {
  return join(campaignsHome(), "conector-scope")
}

function readScopeFile(): string[] | null {
  const path = scopePath()
  if (!existsSync(path)) return null
  return readFileSync(path, "utf8").split("\n").map((s) => s.trim()).filter(Boolean)
}

export function writeScopeFile(slugs: string[]): void {
  const home = campaignsHome()
  mkdirSync(home, { recursive: true })
  const path = scopePath()
  const unique = [...new Set(slugs)]
  writeFileSync(path, unique.length ? `${unique.join("\n")}\n` : "", { mode: 0o600 })
  chmodSync(path, 0o600)
}

export function addSlugToScope(slug: string): void {
  const current = readScopeFile() ?? []
  if (!current.includes(slug)) writeScopeFile([...current, slug])
}

export function campaignOfSecret(secret: string): string | undefined {
  const home = campaignsHome()
  if (!existsSync(home)) return undefined
  for (const entry of readdirSync(home, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = join(home, entry.name, "connector.secret")
    if (!existsSync(file)) continue
    const got = readFileSync(file, "utf8").trim()
    if (secretsEqual(got, secret)) return entry.name
  }
  return undefined
}

export function resolveScope(secret: string, legacySecrets: string[]): SecretScope {
  const owner = campaignOfSecret(secret)
  if (owner) return { kind: "campaign", owner, slugs: [owner], canCreate: false, ambiguous: false }
  if (!legacySecrets.some((s) => secretsEqual(s, secret))) {
    return { kind: "legacy", slugs: [], canCreate: false, ambiguous: false }
  }
  const file = readScopeFile()
  const known = listCampaigns().map((c) => c.slug)
  if (file) return { kind: "legacy", slugs: file, canCreate: true, ambiguous: false }
  if (known.length === 1) {
    writeScopeFile(known)
    return { kind: "legacy", slugs: known, canCreate: true, ambiguous: false }
  }
  if (known.length === 0) return { kind: "legacy", slugs: [], canCreate: true, ambiguous: false }
  return { kind: "legacy", slugs: [], canCreate: true, ambiguous: true }
}

export function assertInScope(scope: SecretScope, slug: string | undefined, comando: string, sub?: string): string | undefined {
  const listing = comando === "campaign" && (sub === "list" || sub === "new")
  const free = comando === "help" || comando === "skill" || comando === "srd" || listing
  if (!slug) {
    if (free) return undefined
    if (scope.owner) return scope.owner
    if (scope.slugs.length === 1) return scope.slugs[0]
    throw new Error("Informe campanha. Este conector não assume uma campanha sozinho.")
  }
  if (scope.ambiguous && !listing) {
    throw new Error("Este conector legado não tem escopo (há várias campanhas). O operador grava campaigns/conector-scope ou usa a URL /mcp/<segredo-da-campanha>.")
  }
  if (!scope.slugs.includes(slug)) throw new Error("Campanha fora do escopo deste conector.")
  return slug
}

const auditPath = () => join(campaignsHome(), "connector-audit.log")

/** Uma linha por chamada. Em erro, o motivo (linhas unidas, 300 caracteres) para entender o que confundiu o Mestre. */
export function auditCall(secret: string, comando: string, ok: boolean, error = ""): void {
  try {
    const home = campaignsHome()
    mkdirSync(home, { recursive: true })
    const path = auditPath()
    const why = ok ? "" : ` ${error.split("\n").map((l) => l.trim()).filter(Boolean).join(" | ").slice(0, 300)}`
    appendFileSync(path, `${new Date().toISOString()} ${secretHash(secret)} ${comando} ${ok ? "ok" : "erro"}${why}\n`, { mode: 0o600 })
    chmodSync(path, 0o600)
  } catch {
    /* auditoria não pode derrubar a jogada */
  }
}
