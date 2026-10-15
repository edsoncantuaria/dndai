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

/**
 * Campanhas anteriores aos ids curtos: dá código a toda entidade que ainda não tem, na ordem de criação.
 * Sem isso a cena dessas campanhas sai com ids longos ("npc:encapuzado-de-luvas-escuras").
 */
export function backfillCodes(db: DB): void {
  const missing = db.prepare(`
    SELECT entity FROM (
      SELECT id AS entity, 0 AS g, created_turn AS t, rowid AS r FROM characters
      UNION ALL SELECT id, 1, created_turn, rowid FROM places
      UNION ALL SELECT id, 2, created_turn, rowid FROM factions
      UNION ALL SELECT id, 3, 0, rowid FROM items
      UNION ALL SELECT id, 4, created_turn, rowid FROM quests
      UNION ALL SELECT id, 5, created_turn, rowid FROM clocks
      UNION ALL SELECT 'fact:' || id, 6, turn, id FROM facts
      UNION ALL SELECT 'hook:' || id, 7, turn, id FROM hooks
    ) WHERE entity NOT IN (SELECT entity FROM codes) ORDER BY g, t, r`).all() as { entity: string }[]
  if (!missing.length) return
  db.exec("BEGIN IMMEDIATE")
  try {
    for (const { entity } of missing) ensureCode(db, entity)
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}
