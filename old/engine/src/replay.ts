// Replay de uma campanha gravada. Cada passo reexecuta a CLI e compara a saída.

export interface ReplayStep {
  argv: string[]
  input?: string
  /** Substring que a saída precisa conter. */
  expect?: string
  /** Saída inteira esperada. */
  exact?: string
}

export function parseReplay(raw: string): ReplayStep[] {
  const text = raw.trim()
  if (!text) throw new Error("Replay vazio.")
  const steps = (text.startsWith("[") ? JSON.parse(text) : text.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l))) as ReplayStep[]
  if (!Array.isArray(steps) || !steps.length) throw new Error("Replay sem passos.")
  for (const [i, s] of steps.entries()) {
    if (!Array.isArray(s.argv) || !s.argv.every((a) => typeof a === "string")) throw new Error(`Passo ${i + 1} sem argv: string[].`)
  }
  return steps
}

export function replaySteps(run: (argv: string[], input?: string) => string, steps: ReplayStep[]): { ok: boolean; lines: string[] } {
  const lines: string[] = []
  let ok = true
  steps.forEach((step, i) => {
    const n = i + 1
    let out = ""
    try {
      out = run(step.argv, step.input)
    } catch (error) {
      ok = false
      lines.push(`#${n} ERRO ${(error as Error).message}`)
      return
    }
    if (step.exact !== undefined && step.exact !== out) {
      ok = false
      lines.push(`#${n} divergiu.\n--- esperado\n${step.exact}\n--- obtido\n${out}`)
      return
    }
    if (step.expect !== undefined && !out.includes(step.expect)) {
      ok = false
      lines.push(`#${n} não contém ${JSON.stringify(step.expect)}.\n--- obtido\n${out}`)
      return
    }
    lines.push(`#${n} ok (${step.argv.join(" ")})`)
  })
  return { ok, lines }
}
