import type { TurnView } from "../api/types"
import { stripVoiceTags } from "../lib/markdown"
import { Empty, SectionTitle } from "./ui"

/** Crônica: turnos anteriores ao do palco, do mais novo para o mais antigo. Recebe só turnos fechados. */
export function Journal({ turns }: { turns: TurnView[] }) {
  const past = turns.slice(0, -1).reverse()
  return (
    <section aria-labelledby="journal-title" className="dnd-panel p-4 sm:p-5">
      <SectionTitle id="journal-title">Crônica</SectionTitle>
      {past.length === 0 ? (
        <Empty>As páginas anteriores ainda estão em branco.</Empty>
      ) : (
        <ol className="dnd-scroll max-h-[28rem] space-y-4 overflow-y-auto pr-2" tabIndex={0} aria-label="Turnos anteriores">
          {past.map((t) => (
            <li key={t.n} className="border-l border-dnd-gold/25 pl-4">
              <p className="dnd-label mb-1 text-dnd-parchment-muted">
                Turno {t.n} · Dia {t.day}, {t.time}
              </p>
              {t.action && <p className="mb-1 text-xs text-dnd-parchment-muted italic">“{t.action}”</p>}
              <p className="font-narrative leading-relaxed text-dnd-parchment/90">{stripVoiceTags(t.narration || t.summary)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
