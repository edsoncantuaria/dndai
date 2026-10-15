// Auras mágicas dos lugares (o "místico" com dentes): efeitos que o motor aplica quando o herói conjura, descansa, luta ou cura.
import type { Campaign } from "./campaign.ts"
import { one } from "./db.ts"
import type { Rng } from "./dice.ts"
import { roll } from "./dice.ts"
import { RuleError } from "./mechanics.ts"

export const AURAS: Record<string, { nome: string; efeito: string }> = {
  "arcane-surge": { nome: "Nó Arcano", efeito: "feitiços podem transbordar (1 em 20: surto imprevisível); descansos curtos recuperam até 2 espaços de nível ≤ 3" },
  "dead-magic": { nome: "Zona Morta", efeito: "nenhuma magia funciona aqui (truques e magias falham; itens mágicos ficam inertes)" },
  hallowed: { nome: "Solo Sagrado", efeito: "mortos-vivos e ínferos atacam com desvantagem; quem descansa aqui recupera 1 dado de vida extra" },
  shadowfell: { nome: "Pálido", efeito: "toda cura é reduzida à metade; descansos longos recuperam metade dos PV" },
  feybleed: { nome: "Clareira Feérica", efeito: "a cada hora, salvaguarda de SAB (CD 12) ou fica enfeitiçado pelo encanto do lugar" },
  stormwild: { nome: "Cume de Tempestade", efeito: "ataques à distância têm desvantagem pelo vento; relâmpagos dão +1 dado de dano" },
  "ley-node": { nome: "Nó de Veio", efeito: "um descanso curto recupera até 2 espaços de magia de nível ≤ 3" },
}

const RuleFail = (m: string): never => { throw new RuleError(m) }

export function auraAt(c: Campaign, place: string | null | undefined): string | undefined {
  if (!place) return undefined
  return one<{ aura: string | null }>(c.db, "SELECT aura FROM places WHERE id = ?", place)?.aura ?? undefined
}
export function auraOfCharacter(c: Campaign, who: string): string | undefined {
  return auraAt(c, one<{ place_id: string | null }>(c.db, "SELECT place_id FROM characters WHERE id = ?", who)?.place_id)
}

export function assertCanCast(c: Campaign, who: string): void {
  if (auraOfCharacter(c, who) === "dead-magic") RuleFail("Zona Morta: a magia não responde aqui (nem truques)")
}

export type Surge = { kind: "reembolso" | "protecao" | "potencia" | "retorno"; text: string }

/** Surto arcano em Nó Arcano: 1 natural num d20 transforma o feitiço. */
export function rollSurge(c: Campaign, who: string, spellLevel: number, rng: Rng): Surge | undefined {
  if (auraOfCharacter(c, who) !== "arcane-surge" || spellLevel < 0) return undefined
  if (rng(20) !== 1) return undefined
  const r = rng(4)
  if (r === 1) return { kind: "reembolso", text: "SURTO ARCANO: a magia do Nó devolve o espaço gasto" }
  if (r === 2) return { kind: "protecao", text: "SURTO ARCANO: uma onda de mana protege o conjurador (PV temporários iguais ao nível)" }
  if (r === 3) return { kind: "potencia", text: "SURTO ARCANO: o feitiço transborda e causa 50% mais dano" }
  return { kind: "retorno", text: `SURTO ARCANO: o feitiço reverbera e fere o conjurador (${roll("1d6", rng).total} de dano de energia)` }
}

export function isHallowedFoe(c: Campaign, attacker: string, place: string | null): boolean {
  if (auraAt(c, place) !== "hallowed") return false
  const sheet = JSON.parse(one<{ sheet: string }>(c.db, "SELECT sheet FROM characters WHERE id = ?", attacker)?.sheet ?? "{}")
  if (sheet.type !== "monster") return false
  const t = String(c.srd.get("monsters", sheet.srd, "en")?.type ?? "").toLowerCase()
  return t.startsWith("undead") || t.startsWith("fiend")
}
