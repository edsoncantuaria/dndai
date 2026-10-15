import { Swords } from "lucide-react"
import type { CombatView } from "../api/types"
import { Portrait, ResourceBar } from "./ui"

/** Faixa de iniciativa no topo, estilo BG3: retratos em ordem, o atual em destaque. */
export function InitiativeBar({ combat }: { combat: CombatView }) {
  const current = combat.order.find((c) => c.current)
  return (
    <section
      aria-label={`Combate, rodada ${combat.round}`}
      className="animate-rise border-b border-dnd-ember/30 bg-gradient-to-b from-dnd-ember-deep/40 to-dnd-obsidian/90 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-3 py-2 sm:px-5">
        <div className="flex shrink-0 flex-col items-center pr-1">
          <Swords className="h-5 w-5 text-dnd-ember-hover" aria-hidden />
          <span className="font-title text-[10px] tracking-widest text-dnd-parchment-muted uppercase">Rodada</span>
          <span className="font-display text-lg leading-none text-dnd-gold-bright">{combat.round}</span>
        </div>
        <ol className="dnd-scroll flex flex-1 items-end gap-2 overflow-x-auto pb-1" aria-live="polite">
          {combat.order.map((c) => {
            const down = c.hp <= 0 || /morto|inconsciente/i.test(c.status)
            return (
              <li
                key={c.id}
                aria-current={c.current ? "true" : undefined}
                className={`flex w-[84px] shrink-0 flex-col items-center gap-1 rounded-lg border px-1.5 pt-1.5 pb-1 transition-all duration-500 ${
                  c.current
                    ? "animate-pulse-gold -translate-y-0.5 scale-105 border-dnd-gold bg-dnd-gold/10"
                    : "border-white/10 bg-black/40"
                } ${down ? "opacity-45 grayscale" : ""}`}
                title={`${c.name} · iniciativa ${c.initiative} · ${c.status}`}
              >
                <Portrait name={c.name} size="sm" ring={c.isPc ? "gold" : c.current ? "gold" : "ember"} />
                <span className={`w-full truncate text-center text-[11px] ${c.isPc ? "text-dnd-gold-bright" : "text-dnd-parchment"}`}>{c.name}</span>
                <ResourceBar value={c.hp} max={c.maxHp} label={`Vida de ${c.name}`} className="h-1" />
                <span className="text-[10px] text-dnd-parchment-muted tabular-nums">
                  {c.initiative} · {c.hp}/{c.maxHp}
                </span>
              </li>
            )
          })}
        </ol>
        {current && (
          <p className="hidden shrink-0 text-right lg:block">
            <span className="dnd-label block">Vez de</span>
            <span className="font-title text-sm text-dnd-gold-bright">{current.isPc ? "Você" : current.name}</span>
          </p>
        )}
      </div>
    </section>
  )
}
