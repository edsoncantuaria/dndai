// Invariantes do mundo. As duras desfazem o turno; as brandas só avisam o Mestre.
import { all, type DB } from "./db.ts"

export interface WorldReport {
  hard: string[]
  soft: string[]
}

export function worldProblems(db: DB): WorldReport {
  const hard: string[] = []
  const soft: string[] = []
  for (const c of all<{ id: string; name: string }>(db, "SELECT id, name FROM characters WHERE status = 'vivo' AND hp = 0")) {
    hard.push(`${c.name} [${c.id}] está vivo com 0 PV.`)
  }
  for (const c of all<{ id: string; name: string; hp: number; max_hp: number }>(db, "SELECT id, name, hp, max_hp FROM characters WHERE hp > max_hp")) {
    hard.push(`${c.name} [${c.id}] tem ${c.hp} PV acima do máximo ${c.max_hp}.`)
  }
  for (const c of all<{ id: string; name: string; place_id: string }>(
    db,
    "SELECT c.id, c.name, c.place_id FROM characters c LEFT JOIN places p ON p.id = c.place_id WHERE c.place_id IS NOT NULL AND p.id IS NULL",
  )) {
    hard.push(`${c.name} [${c.id}] aponta para o local inexistente ${c.place_id}.`)
  }
  for (const i of all<{ id: string; name: string; owner_char: string }>(
    db,
    "SELECT i.id, i.name, i.owner_char FROM items i LEFT JOIN characters c ON c.id = i.owner_char WHERE i.owner_char IS NOT NULL AND c.id IS NULL",
  )) {
    hard.push(`Item ${i.name} [${i.id}] pertence a ${i.owner_char}, que não existe.`)
  }
  for (const c of all<{ id: string; name: string; hp: number }>(db, "SELECT id, name, hp FROM characters WHERE status = 'morto' AND hp > 0")) {
    soft.push(`${c.name} [${c.id}] está morto mas ainda tem ${c.hp} PV.`)
  }
  for (const q of all<{ id: string; title: string; giver_id: string }>(
    db,
    "SELECT q.id, q.title, q.giver_id FROM quests q LEFT JOIN characters c ON c.id = q.giver_id WHERE q.giver_id IS NOT NULL AND c.id IS NULL",
  )) {
    soft.push(`Missão ${q.title} [${q.id}] cita o doador ${q.giver_id}, que não existe.`)
  }
  return { hard, soft }
}

export function assertWorld(db: DB): string[] {
  const report = worldProblems(db)
  if (report.hard.length) {
    throw new Error(`Invariantes do mundo falharam (nada deste fechamento foi gravado):\n${report.hard.map((p) => `- ${p}`).join("\n")}`)
  }
  return report.soft
}
