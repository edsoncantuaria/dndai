import type { Ability, GameView, RollOutcome, RollRequest } from "../api/types"

export const ABILITY_LABEL: Record<Ability, string> = {
  for: "Força",
  des: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  sab: "Sabedoria",
  car: "Carisma",
}

export const ABILITY_SHORT: Record<Ability, string> = { for: "FOR", des: "DES", con: "CON", int: "INT", sab: "SAB", car: "CAR" }

export const ABILITIES = Object.keys(ABILITY_LABEL) as Ability[]

export const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`)

export function initials(name: string): string {
  const parts = name.replace(/[,.]/g, "").split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p))
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase()
}

export function minutesLabel(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Notação curta dos dados pedidos, ex.: "2d20 (vantagem)" ou "1d8 + 1d6". */
export function diceNotation(req: RollRequest): string {
  const counts = new Map<number, number>()
  for (const d of req.dice) counts.set(d.sides, (counts.get(d.sides) ?? 0) + 1)
  return [...counts].map(([sides, qty]) => `${qty}d${sides}`).join(" + ")
}

export const ROLL_KIND_LABEL: Record<RollRequest["kind"], string> = {
  pericia: "Teste de perícia",
  atributo: "Teste de atributo",
  resistencia: "Salvaguarda",
  ataque: "Jogada de ataque",
  dano: "Rolagem de dano",
  livre: "Rolagem livre",
}

export const OUTCOME_LABEL: Record<NonNullable<RollOutcome["outcome"]>, string> = {
  critico: "Sucesso crítico!",
  sucesso: "Sucesso",
  falha: "Falha",
  falha_critica: "Falha crítica!",
}

export const OUTCOME_TONE: Record<NonNullable<RollOutcome["outcome"]>, string> = {
  critico: "text-dnd-gold-bright",
  sucesso: "text-dnd-success",
  falha: "text-dnd-danger",
  falha_critica: "text-dnd-ember-hover",
}

export const SOURCE_LABEL: Record<RollOutcome["source"], string> = {
  mesa: "rolado na mesa",
  motor: "rolado pelo motor",
  manual: "informado pelo Mestre",
}

/** Turnos já narrados: o turno aberto também vem no journal (sem narração) e não deve ocupar o palco. */
export function closedTurns(game: GameView) {
  return game.turn.open ? game.journal.filter((t) => t.n !== game.turn.n) : game.journal
}
