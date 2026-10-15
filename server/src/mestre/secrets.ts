// Segredos do conector: cada campanha tem o seu (campaigns/<slug>/connector.secret) e só enxerga a si mesma.
// O segredo legado (campaigns/conector-secret) enxerga as campanhas listadas em campaigns/conector-scope.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { campaignsHome } from "../store.ts"

export const secretHash = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 12)

export function secretsEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b)
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb)
}

function readSecret(path: string): string | undefined {
  return existsSync(path) ? readFileSync(path, "utf8").trim() || undefined : undefined
}

/** Cria (se faltar) e devolve o segredo do conector de uma campanha. */
export function campaignSecret(slug: string): string {
  const path = join(campaignsHome(), slug, "connector.secret")
  const found = readSecret(path)
  if (found) return found
  mkdirSync(join(campaignsHome(), slug), { recursive: true })
  const secret = randomBytes(24).toString("hex")
  writeFileSync(path, `${secret}\n`, { mode: 0o600 })
  chmodSync(path, 0o600)
  return secret
}

export function allSecrets(): { secret: string; slug?: string }[] {
  const home = campaignsHome()
  const out: { secret: string; slug?: string }[] = []
  const legacy = readSecret(join(home, "conector-secret"))
  if (legacy) out.push({ secret: legacy })
  if (existsSync(home)) {
    for (const e of readdirSync(home, { withFileTypes: true })) {
      const s = e.isDirectory() ? readSecret(join(home, e.name, "connector.secret")) : undefined
      if (s) out.push({ secret: s, slug: e.name })
    }
  }
  return out
}

/** Campanhas que um segredo enxerga. Segredo de campanha: só ela. Legado: conector-scope (vazio = nenhuma). */
export function scopeOf(match: { slug?: string }): string[] {
  if (match.slug) return [match.slug]
  const file = readSecret(join(campaignsHome(), "conector-scope"))
  return file ? file.split("\n").map((s) => s.trim()).filter(Boolean) : []
}

/** Campanha nova entra no escopo do segredo legado (uma URL só no ChatGPT enxerga todas as campanhas listadas). */
export function addSlugToScope(slug: string): void {
  const home = campaignsHome()
  if (!existsSync(join(home, "conector-secret"))) return
  const path = join(home, "conector-scope")
  const current = readSecret(path)?.split("\n").map((x) => x.trim()).filter(Boolean) ?? []
  if (current.includes(slug)) return
  writeFileSync(path, `${[...current, slug].join("\n")}\n`, { mode: 0o600 })
  chmodSync(path, 0o600)
}

export function assertInScope(slugs: string[], asked: string | undefined): string {
  if (!asked) {
    if (slugs.length === 1) return slugs[0]!
    throw new Error("Informe campanha.")
  }
  if (!slugs.includes(asked)) throw new Error("Campanha fora do escopo deste conector.")
  return asked
}

export function auditCall(secret: string, what: string, ok: boolean, detail = ""): void {
  try {
    const home = campaignsHome()
    mkdirSync(home, { recursive: true })
    const path = join(home, "connector-audit.log")
    appendFileSync(path, `${new Date().toISOString()} ${secretHash(secret)} ${what} ${ok ? "ok" : "erro"} ${detail.split("\n").map((l) => l.trim()).filter(Boolean).join(" | ").slice(0, 300)}\n`, { mode: 0o600 })
    chmodSync(path, 0o600)
  } catch { /* auditoria não derruba a jogada */ }
}
