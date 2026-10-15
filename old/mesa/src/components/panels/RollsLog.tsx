import type { RollOutcome } from "../../api/types"
import { OUTCOME_LABEL, OUTCOME_TONE, SOURCE_LABEL, signed } from "../../lib/format"
import { Empty } from "../ui"

/** Dados naturais, riscando os descartados por vantagem/desvantagem. */
export function DiceFaces({ dice, kept }: { dice: number[]; kept: number[] }) {
  const remaining = [...kept]
  return (
    <span>
      [
      {dice.map((d, i) => {
        const k = remaining.indexOf(d)
        if (k >= 0) remaining.splice(k, 1)
        return (
          <span key={i} className={k >= 0 ? "" : "line-through opacity-50"}>
            {i > 0 ? ", " : ""}
            {d}
            {k < 0 && <span className="sr-only"> (descartado)</span>}
          </span>
        )
      })}
      ]
    </span>
  )
}

/** Últimas rolagens resolvidas (lastRolls), da mais nova para a mais antiga. */
export function RollsLog({ rolls }: { rolls: RollOutcome[] }) {
  if (rolls.length === 0) return <Empty>Nenhum dado rolado ainda.</Empty>
  return (
    <ol className="space-y-2">
      {[...rolls].reverse().map((r) => (
        <li key={r.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
          <span
            className={`font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-dnd-gold/30 bg-black/60 text-lg tabular-nums ${r.outcome ? OUTCOME_TONE[r.outcome] : "text-dnd-parchment"}`}
          >
            {r.total}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-dnd-parchment">{r.label}</p>
            <p className="text-[11px] text-dnd-parchment-muted tabular-nums">
              <DiceFaces dice={r.dice} kept={r.kept} /> {signed(r.modifier)}
              {r.dc !== null ? ` · CD ${r.dc}` : ""} · {SOURCE_LABEL[r.source]}
            </p>
          </div>
          {r.outcome && <span className={`text-xs font-semibold whitespace-nowrap ${OUTCOME_TONE[r.outcome]}`}>{OUTCOME_LABEL[r.outcome]}</span>}
        </li>
      ))}
    </ol>
  )
}
