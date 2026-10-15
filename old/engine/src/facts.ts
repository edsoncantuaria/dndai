// Fatos canônicos com proveniência. Boato e mentira não entram na visão do jogador.
import { ensureCode } from "./codes.ts"
import { type DB, index, metaNum } from "./db.ts"
import { now } from "./world.ts"

export type FactSource = "motor" | "jogador" | "mestre" | "npc"
export type FactTruth = "verdade" | "boato" | "mentira"

export function insertFact(
  db: DB,
  f: { about?: string | null; text: string; secret?: boolean; lore?: boolean; source?: FactSource; truth?: FactTruth; sourceRef?: string; turn?: number }
): number {
  const source = f.source ?? "mestre"
  const truth = f.truth ?? "verdade"
  const secret = f.secret ? 1 : 0
  const res = db
    .prepare("INSERT INTO facts(about_id, text, secret, turn, at_min, lore, source, truth, source_ref) VALUES(?,?,?,?,?,?,?,?,?)")
    .run(f.about ?? null, f.text, secret, f.turn ?? metaNum(db, "turn"), now(db), f.lore ? 1 : 0, source, truth, f.sourceRef ?? "")
  const id = Number(res.lastInsertRowid)
  ensureCode(db, `fact:${id}`)
  const kind = truth === "verdade" ? (secret ? "segredo" : "fato") : truth
  index(db, `fact:${id}`, kind, f.text)
  return id
}

export function factLabel(truth: string, source: string, sourceRef = ""): string {
  if (truth === "verdade" && source === "mestre" && !sourceRef) return ""
  const who = sourceRef ? `${source}:${sourceRef}` : source
  if (truth === "boato") return `⚠ BOATO (${who}, não é fato) `
  if (truth === "mentira") return `⚠ MENTIRA (${who}, não é fato) `
  return `[${truth} · ${who}] `
}
