import { randomInt } from "node:crypto"

export type Rng = (sides: number) => number

/** RNG criptográfico: nenhuma rolagem é decidida pelo LLM. */
export const cryptoRng: Rng = (sides) => randomInt(1, sides + 1)

export interface DiceTerm {
  sign: 1 | -1
  count: number
  sides: number // 0 = constante
  keep?: { mode: "kh" | "kl"; n: number }
  value: number // constante quando sides = 0
}

export interface RollResult {
  expr: string
  total: number
  detail: string
  /** d20 natural (o mantido) quando a expressão é um único d20 */
  natural?: number
}

const TERM_RE = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?$|^(\d+)$/

export function parseDice(expr: string): DiceTerm[] {
  const clean = expr.replace(/\s+/g, "").toLowerCase()
  if (!clean) throw new Error("Expressão de dados vazia.")
  const parts = clean.match(/[+-]?[^+-]+/g) ?? []
  if (parts.join("") !== clean) throw new Error(`Expressão de dados inválida: "${expr}"`)
  return parts.map((raw) => {
    const sign = raw.startsWith("-") ? -1 : 1
    const body = raw.replace(/^[+-]/, "")
    const m = TERM_RE.exec(body)
    if (!m) throw new Error(`Termo de dados inválido: "${raw}" em "${expr}"`)
    if (m[5] !== undefined) return { sign, count: 0, sides: 0, value: Number(m[5]) }
    const count = m[1] === "" ? 1 : Number(m[1])
    const sides = Number(m[2])
    if (count < 1 || count > 100) throw new Error(`Quantidade de dados fora do limite (1-100): "${raw}"`)
    if (![2, 3, 4, 6, 8, 10, 12, 20, 100].includes(sides)) throw new Error(`Dado d${sides} não suportado.`)
    const term: DiceTerm = { sign, count, sides, value: 0 }
    if (m[3]) {
      const n = Number(m[4])
      if (n < 1 || n > count) throw new Error(`Manter ${n} de ${count} dados é inválido: "${raw}"`)
      term.keep = { mode: m[3] as "kh" | "kl", n }
    }
    return term
  })
}

/** Rola uma expressão como "2d6+3", "4d6kh3", "1d8+1d6-1". `doubleDice` dobra os dados (crítico). */
export function roll(expr: string, rng: Rng = cryptoRng, doubleDice = false): RollResult {
  const terms = parseDice(expr)
  let total = 0
  const pieces: string[] = []
  let natural: number | undefined
  const singleD20 = terms.filter((t) => t.sides > 0).length === 1 && terms.some((t) => t.sides === 20 && t.count === 1)
  for (const t of terms) {
    const signStr = t.sign < 0 ? "-" : pieces.length ? "+" : ""
    if (t.sides === 0) {
      total += t.sign * t.value
      pieces.push(`${signStr}${t.value}`)
      continue
    }
    const count = doubleDice ? t.count * 2 : t.count
    const dice = Array.from({ length: count }, () => rng(t.sides))
    let kept = dice
    if (t.keep) {
      const sorted = [...dice].sort((a, b) => (t.keep!.mode === "kh" ? b - a : a - b))
      kept = sorted.slice(0, t.keep.n)
    }
    const sum = kept.reduce((a, b) => a + b, 0)
    total += t.sign * sum
    if (t.sides === 20 && kept.length === 1 && singleD20) natural = kept[0]
    const shown = t.keep ? `[${dice.join(",")}→${kept.join(",")}]` : `[${dice.join(",")}]`
    pieces.push(`${signStr}${count}d${t.sides}${shown}`)
  }
  return { expr, total, detail: pieces.join(""), natural }
}

/** d20 com vantagem/desvantagem. Retorna o natural escolhido e os dados vistos. */
export function rollD20(mode: "normal" | "vantagem" | "desvantagem", rng: Rng = cryptoRng): { natural: number; seen: number[] } {
  const a = rng(20)
  if (mode === "normal") return { natural: a, seen: [a] }
  const b = rng(20)
  return { natural: mode === "vantagem" ? Math.max(a, b) : Math.min(a, b), seen: [a, b] }
}
