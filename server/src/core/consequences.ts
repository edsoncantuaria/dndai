// Consequências sociais do que o herói faz: quem viu lembra, a facção da vítima reage.
import type { Campaign } from "./campaign.ts"
import { all } from "./db.ts"
import { put } from "./ledger.ts"
import { adjustStanding, membersOf } from "./factions.ts"
import { character } from "./mechanics.ts"

/** NPCs vivos (não companheiros) no mesmo lugar: as testemunhas. */
export function witnessesAt(c: Campaign, place: string | null, except: string[] = []): { id: string; name: string }[] {
  if (!place) return []
  return all<{ id: string; name: string; companion: number }>(c.db, "SELECT id, name, companion FROM characters WHERE kind = 'npc' AND status = 'vivo' AND place_id = ?", place)
    .filter((n) => !except.includes(n.id) && !n.companion)
}

/** Quem estava no lugar passa a lembrar do fato. */
export function witnessMemory(c: Campaign, place: string | null, text: string, importance = 2, except: string[] = []): number {
  const w = witnessesAt(c, place, except)
  if (w.length) c.commit("testemunhas", w.map((n) => put("memories", { npc_id: n.id, text, importance, turn: c.turn, at_min: c.time })))
  return w.length
}

/** Um NPC morreu pelas mãos do herói: testemunhas lembram e a(s) facção(ões) da vítima perdem confiança nele. */
export function afterKill(c: Campaign, victim: string, killer = "pc"): string[] {
  const v = character(c, victim)
  if (v.kind !== "npc") return []
  const k = character(c, killer)
  const lines: string[] = []
  const seen = witnessMemory(c, v.place_id, `${k.name} matou ${v.name}`, 3, [victim])
  for (const m of membersOf(c, victim)) {
    try {
      adjustStanding(c, m.id, seen ? -10 : -4, `${seen ? "matou em público" : "o corpo foi achado"}: ${v.name}, ${m.rank || "membro"} de ${m.faction}`).forEach((l) => lines.push(l))
    } catch { /* limite de reputação do turno: a fama já foi abalada o bastante */ }
  }
  if (seen) lines.push(`${seen} testemunha(s) viram.`)
  return lines
}
