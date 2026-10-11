// IDs curtos estáveis (n12, l3, i7, f20, q2, h5). Não se reutilizam.
import { type DB, metaNum, one, setMeta } from "./db.ts"

const PREFIX: Record<string, string> = {
  pc: "pc",
  npc: "n",
  place: "l",
  item: "i",
  fact: "f",
  quest: "q",
  hook: "h",
  clock: "k",
  faction: "g",
}

const CODE_RE = /^(pc|[nlifqhkfg]\d+)$/

export function ensureCode(db: DB, entity: string): string {
  const found = one<{ code: string }>(db, "SELECT code FROM codes WHERE entity = ?", entity)
  if (found) return found.code
  const kind = entity.split(":")[0]
  if (kind === "pc") {
    db.prepare("INSERT INTO codes(code, entity) VALUES('pc', ?)").run(entity)
    return "pc"
  }
  const prefix = PREFIX[kind]
  if (!prefix) return entity
  const key = `code_${prefix}`
  const n = metaNum(db, key) + 1
  setMeta(db, key, n)
  const code = `${prefix}${n}`
  db.prepare("INSERT INTO codes(code, entity) VALUES(?, ?)").run(code, entity)
  return code
}

export function entityOfCode(db: DB, code: string): string | undefined {
  if (!CODE_RE.test(code)) return undefined
  return one<{ entity: string }>(db, "SELECT entity FROM codes WHERE code = ?", code)?.entity
}

export function isShortCode(code: string): boolean {
  return CODE_RE.test(code)
}
