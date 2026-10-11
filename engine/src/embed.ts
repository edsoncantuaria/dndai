// Busca semântica local, sem API paga. O padrão é um embedding de n-gramas
// (mais um léxico curto de papéis) que cobre variação morfológica. Um modelo
// melhor entra por setEmbedder(); DNDAI_EMBED=off (ou setEmbedder(null)) cai no FTS.

export interface Embedder {
  name: string
  embed(text: string): Float32Array
}

const DIM = 128

/** Papéis que não compartilham prefixo mas são o mesmo ofício na mesa. */
const ROLES: Record<string, string> = {
  taverna: "taverna",
  taverneiro: "taverna",
  taberneiro: "taverna",
  estalajadeiro: "taverna",
  estalajadeira: "taverna",
  barman: "taverna",
  taberneira: "taverna",
  ferreiro: "forja",
  ferreira: "forja",
  forja: "forja",
  guarda: "guarda",
  sentinela: "guarda",
  soldado: "guarda",
  sacerdote: "templo",
  clerigo: "templo",
  padre: "templo",
  mago: "magia",
  feiticeiro: "magia",
  bruxa: "magia",
  bruxo: "magia",
}

const STOP = new Set("a o os as um uma uns umas de da do das dos e que em na no nas nos para por com sem sob cara homem mulher pessoa sujeito tipo npc o".split(" "))

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function tokenize(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t))
}

function l2(v: Float32Array): Float32Array {
  let n = 0
  for (const x of v) n += x * x
  const d = Math.sqrt(n)
  if (d === 0) return v
  for (let i = 0; i < v.length; i++) v[i] /= d
  return v
}

export const ngramEmbedder: Embedder = {
  name: "ngram-local",
  embed(text: string): Float32Array {
    const v = new Float32Array(DIM)
    const weight = new Map<string, number>()
    const add = (g: string, w: number) => weight.set(g, (weight.get(g) ?? 0) + w)
    for (const token of tokenize(text)) {
      const s = ` ${token} `
      for (let i = 0; i < s.length - 2; i++) add(s.slice(i, i + 3), 1)
      const role = ROLES[token]
      if (role) add(`papel:${role}`, 4)
    }
    for (const [g, w] of weight) v[hash(g) % DIM] += w
    return l2(v)
  },
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) s += a[i] * b[i]
  return s
}

let current: Embedder | null = ngramEmbedder

/** `null` desliga a busca semântica (só FTS). */
export function setEmbedder(embedder: Embedder | null): void {
  current = embedder
}

export function activeEmbedder(): Embedder | null {
  if (process.env.DNDAI_EMBED === "off") return null
  return current
}
