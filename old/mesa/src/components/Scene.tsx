import { DoorOpen, MapPin, Package } from "lucide-react"
import type { GameView, NpcView } from "../api/types"
import { minutesLabel } from "../lib/format"
import { Chip, Empty, Portrait, ResourceBar, SectionTitle } from "./ui"

const ATTITUDE: Record<NpcView["attitudeLabel"], { tone: "ember" | "muted" | "gold" | "success"; ring: "ember" | "muted" | "gold" | "success" }> = {
  hostil: { tone: "ember", ring: "ember" },
  desconfiado: { tone: "ember", ring: "muted" },
  neutro: { tone: "muted", ring: "muted" },
  amigável: { tone: "success", ring: "success" },
  leal: { tone: "gold", ring: "gold" },
}

export function ScenePanel({ game }: { game: GameView }) {
  const loc = game.location
  return (
    <section aria-labelledby="scene-title" className="dnd-panel p-4 sm:p-5">
      <SectionTitle id="scene-title">Cena</SectionTitle>
      {!loc ? (
        <Empty>Local desconhecido.</Empty>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <MapPin className="mt-1 h-4 w-4 shrink-0 text-dnd-ember-hover" aria-hidden />
            <div className="min-w-0">
              <h3 className="font-title text-lg text-dnd-gold-bright">{loc.name}</h3>
              <p className="text-xs text-dnd-parchment-muted first-letter:uppercase">
                {loc.kind}
                {loc.parent ? ` · ${loc.parent.name}` : ""}
              </p>
            </div>
          </div>
          <p className="font-narrative mt-3 text-[1.05rem] leading-relaxed text-dnd-parchment">{loc.summary}</p>
          {loc.details && <p className="font-narrative mt-2 text-sm leading-relaxed text-dnd-parchment-muted italic">{loc.details}</p>}

          {loc.exits.length > 0 && (
            <>
              <p className="dnd-label mt-4 mb-2">Saídas</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {loc.exits.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-3 py-2">
                    <DoorOpen className="h-4 w-4 shrink-0 text-dnd-gold" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-dnd-parchment">{e.name}</p>
                      <p className="truncate text-[11px] text-dnd-parchment-muted">
                        {e.via} · {minutesLabel(e.minutes)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {loc.items.length > 0 && (
            <>
              <p className="dnd-label mt-4 mb-2">No chão</p>
              <div className="flex flex-wrap gap-2">
                {loc.items.map((i) => (
                  <Chip key={i.id} tone="muted" title={i.notes || undefined}>
                    <Package className="h-3 w-3" aria-hidden /> {i.name}
                    {i.qty > 1 ? ` ×${i.qty}` : ""}
                  </Chip>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}

export function PresentNpcs({ npcs }: { npcs: NpcView[] }) {
  return (
    <section aria-labelledby="npcs-title" className="dnd-panel p-4 sm:p-5">
      <SectionTitle id="npcs-title">Presentes</SectionTitle>
      {npcs.length === 0 ? (
        <Empty>Ninguém à vista.</Empty>
      ) : (
        <ul className="grid gap-3">
          {npcs.map((n) => {
            const a = ATTITUDE[n.attitudeLabel]
            return (
              <li key={n.id} className={`animate-rise flex gap-3 rounded-lg border bg-black/40 p-3 ${n.reaction ? "dnd-shake border-dnd-ember/50" : "border-white/10"}`}>
                <Portrait name={n.name} src={n.portrait} ring={a.ring} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="font-title text-sm text-dnd-parchment">{n.name}</h3>
                    {n.companion && <Chip tone="gold">Companheiro</Chip>}
                    <Chip tone={a.tone} title={`Atitude ${n.attitude}`}>
                      {n.attitudeLabel}
                    </Chip>
                  </div>
                  {n.reaction && (
                    <p className="animate-fade-in mt-1 text-xs font-semibold text-dnd-ember-hover italic" role="status">
                      {n.reaction}
                    </p>
                  )}
                  <p className="mt-1 text-xs leading-relaxed text-dnd-parchment-muted">{n.summary}</p>
                  {n.hp !== undefined && n.maxHp !== undefined && (
                    <div className="mt-2 flex items-center gap-2">
                      <ResourceBar value={n.hp} max={n.maxHp} label={`Vida de ${n.name}`} className="h-1.5" />
                      <span className="shrink-0 text-[11px] text-dnd-parchment-muted tabular-nums">
                        {n.hp}/{n.maxHp}
                      </span>
                    </div>
                  )}
                  {n.status && !/^viv[oa]$/i.test(n.status) && <p className="mt-1 text-[11px] text-dnd-warning">{n.status}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
