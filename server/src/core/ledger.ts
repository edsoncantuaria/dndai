// Ledger: único caminho de escrita do mundo. Cada op já carrega valores resolvidos (dados rolados,
// ids alocados), então reaplicar o ledger em ordem reconstrói exatamente o mesmo estado.
import { z } from "zod"
import { type DB, resetState, setMeta, TABLES, type Table } from "./db.ts"

const row = z.record(z.string(), z.unknown())

export const OpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("meta"), key: z.string(), value: z.union([z.string(), z.number()]) }).strict(),
  z.object({ op: z.literal("put"), table: z.enum(Object.keys(TABLES) as [Table, ...Table[]]), row }).strict(),
  z.object({ op: z.literal("del"), table: z.enum(Object.keys(TABLES) as [Table, ...Table[]]), where: row }).strict(),
])
export type Op = z.infer<typeof OpSchema>

export const put = (table: Table, r: Record<string, unknown>): Op => ({ op: "put", table, row: r })
export const del = (table: Table, where: Record<string, unknown>): Op => ({ op: "del", table, where })
export const meta = (key: string, value: string | number): Op => ({ op: "meta", key, value })

type Sql = string | number | null

function encode(table: Table, r: Record<string, unknown>): Record<string, Sql> {
  const json = TABLES[table].json as readonly string[]
  const out: Record<string, Sql> = {}
  for (const [k, v] of Object.entries(r)) {
    if (!/^[a-z_]+$/.test(k)) throw new Error(`coluna inválida: ${k}`)
    out[k] = v === undefined || v === null ? null : json.includes(k) ? JSON.stringify(v) : typeof v === "boolean" ? Number(v) : (v as Sql)
  }
  return out
}

/** Aplica uma op ao estado (sem registrar). */
export function reduce(db: DB, op: Op): void {
  if (op.op === "meta") return setMeta(db, op.key, op.value)
  const cols = encode(op.table, op.op === "put" ? op.row : op.where)
  const names = Object.keys(cols)
  if (op.op === "del") {
    db.prepare(`DELETE FROM ${op.table} WHERE ${names.map((n) => `${n} = ?`).join(" AND ")}`).run(...Object.values(cols))
    return
  }
  // put = upsert com merge: linha existente recebe só as colunas informadas.
  const keys = TABLES[op.table].key.split(",")
  if (keys.every((k) => k in cols)) {
    const where = keys.map((k) => `${k} = ?`).join(" AND ")
    const exists = db.prepare(`SELECT 1 FROM ${op.table} WHERE ${where}`).get(...keys.map((k) => cols[k]!))
    if (exists) {
      const upd = names.filter((n) => !keys.includes(n))
      if (upd.length) db.prepare(`UPDATE ${op.table} SET ${upd.map((n) => `${n} = ?`).join(",")} WHERE ${where}`).run(...upd.map((n) => cols[n]!), ...keys.map((k) => cols[k]!))
      return
    }
  }
  db.prepare(`INSERT INTO ${op.table} (${names.join(",")}) VALUES (${names.map(() => "?").join(",")})`).run(...Object.values(cols))
}

export function append(db: DB, batch: number, turn: number, label: string, ops: Op[]): void {
  const ins = db.prepare("INSERT INTO ledger (batch, turn, label, op, at) VALUES (?,?,?,?,?)")
  const at = new Date().toISOString()
  for (const o of ops) ins.run(batch, turn, label, JSON.stringify(o), at)
}

/** Reconstrói o estado a partir do ledger (usado pelo undo e pela auditoria). */
export function replay(db: DB): void {
  const rows = db.prepare("SELECT op FROM ledger ORDER BY seq").all() as { op: string }[]
  db.exec("PRAGMA foreign_keys = OFF") // só vale fora de transação
  db.exec("BEGIN IMMEDIATE")
  try {
    resetState(db)
    db.exec("DELETE FROM meta WHERE key NOT IN ('premise','name','tone','edition','created','srd_version')")
    for (const r of rows) reduce(db, OpSchema.parse(JSON.parse(r.op)))
    db.exec("COMMIT")
  } catch (e) {
    db.exec("ROLLBACK")
    throw e
  } finally {
    db.exec("PRAGMA foreign_keys = ON")
  }
}
