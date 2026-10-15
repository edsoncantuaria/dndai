// TOON (Token-Oriented Object Notation): objetos aninhados e tabelas uniformes,
// bem mais curto que JSON para o Mestre. Subconjunto estável do formato tabular.

function needsQuote(value: string): boolean {
  return value === "" || /[\n\r,"\\:]/.test(value) || /^\s|\s$/.test(value) || value === "null" || value === "true" || value === "false"
}

function quote(value: string): string {
  if (!needsQuote(value)) return value
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (typeof value === "string") return quote(value)
  return quote(JSON.stringify(value))
}

function sameKeys(rows: unknown[]): rows is Record<string, unknown>[] {
  if (!rows.length || rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))) return false
  const keys = Object.keys(rows[0] as object)
  if (!keys.length) return false
  return rows.every((r) => {
    const k = Object.keys(r as object)
    return k.length === keys.length && keys.every((key, i) => k[i] === key)
  }) && rows.every((r) => Object.values(r as object).every((v) => v === null || ["string", "number", "boolean"].includes(typeof v)))
}

function linesOf(value: unknown, indent: number): string[] {
  const pad = "  ".repeat(indent)
  if (Array.isArray(value)) {
    if (sameKeys(value)) {
      const keys = Object.keys(value[0])
      const head = `${pad}[${value.length}]{${keys.join(",")}}:`
      const rows = value.map((row) => `${pad}  ${keys.map((k) => cell((row as Record<string, unknown>)[k])).join(",")}`)
      return [head, ...rows]
    }
    return value.flatMap((item) => {
      if (item && typeof item === "object") return linesOf(item, indent).map((l, i) => (i === 0 ? `${pad}- ${l.trimStart()}` : `${pad}  ${l.trimStart()}`))
      return [`${pad}- ${cell(item)}`]
    })
  }
  if (value && typeof value === "object") {
    const out: string[] = []
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (child === undefined) continue
      if (Array.isArray(child) && sameKeys(child)) {
        const keys = Object.keys(child[0])
        out.push(`${pad}${key}[${child.length}]{${keys.join(",")}}:`)
        for (const row of child) out.push(`${pad}  ${keys.map((k) => cell((row as Record<string, unknown>)[k])).join(",")}`)
      } else if (child && typeof child === "object") {
        out.push(`${pad}${key}:`)
        out.push(...linesOf(child, indent + 1))
      } else {
        out.push(`${pad}${key}: ${cell(child)}`)
      }
    }
    return out
  }
  return [`${pad}${cell(value)}`]
}

export function encodeToon(value: unknown): string {
  return linesOf(value, 0).join("\n")
}

/** Contagem aproximada de tokens (palavras + pontuação), estável para comparar formatos. */
export function countTokens(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length
  const punct = text.match(/[.,;:!?{}[\]()"']/g)?.length ?? 0
  return words + punct
}
