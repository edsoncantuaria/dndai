import { CheckCircle2, Circle } from "lucide-react"
import type { GameView, QuestView } from "../../api/types"
import { Chip, Empty, SectionTitle } from "../ui"

const STATUS: Record<QuestView["status"], { label: string; tone: "gold" | "success" | "ember" | "muted" }> = {
  ativa: { label: "Ativa", tone: "gold" },
  concluida: { label: "Concluída", tone: "success" },
  falhou: { label: "Falhou", tone: "ember" },
  abandonada: { label: "Abandonada", tone: "muted" },
}

export function Quests({ quests }: { quests: QuestView[] }) {
  const active = quests.filter((q) => q.status === "ativa")
  const closed = quests.filter((q) => q.status !== "ativa")
  return (
    <div className="space-y-6">
      <section aria-label="Missões ativas">
        <SectionTitle>Missões ativas</SectionTitle>
        {active.length === 0 ? <Empty>Nenhuma missão em aberto.</Empty> : <QuestList quests={active} />}
      </section>
      {closed.length > 0 && (
        <section aria-label="Missões encerradas">
          <SectionTitle>Encerradas</SectionTitle>
          <QuestList quests={closed} />
        </section>
      )}
    </div>
  )
}

function QuestList({ quests }: { quests: QuestView[] }) {
  return (
    <ul className="space-y-3">
      {quests.map((q) => (
        <li key={q.id} className={`rounded-lg border border-white/10 bg-black/40 p-3 ${q.status !== "ativa" ? "opacity-70" : ""}`}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-title text-dnd-gold-bright">{q.title}</h3>
            <Chip tone={STATUS[q.status].tone}>{STATUS[q.status].label}</Chip>
          </div>
          {q.giver && <p className="text-[11px] text-dnd-parchment-muted">Dada por {q.giver}</p>}
          <p className="font-narrative mt-1.5 text-sm text-dnd-parchment">{q.summary}</p>
          <ul className="mt-2 space-y-1">
            {q.objectives.map((o) => (
              <li key={o.text} className={`flex items-start gap-2 text-sm ${o.done ? "text-dnd-parchment-muted line-through" : "text-dnd-parchment"}`}>
                {o.done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-dnd-success" aria-label="concluído" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-dnd-gold/60" aria-label="pendente" />
                )}
                {o.text}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

export function Facts({ facts }: { facts: GameView["facts"] }) {
  const groups = new Map<string, GameView["facts"]>()
  for (const f of facts) {
    const key = f.about ?? "Geral"
    groups.set(key, [...(groups.get(key) ?? []), f])
  }
  if (facts.length === 0) return <Empty>Você ainda não sabe nada de importante.</Empty>
  return (
    <div className="space-y-5">
      {[...groups].map(([about, list]) => (
        <section key={about} aria-label={about}>
          <SectionTitle>{about}</SectionTitle>
          <ul className="space-y-2">
            {list.map((f) => (
              <li key={f.id} className="font-narrative flex gap-3 text-[0.95rem] leading-relaxed text-dnd-parchment">
                <span className="dnd-label shrink-0 pt-1 text-dnd-parchment-muted">D{f.day}</span>
                {f.text}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
