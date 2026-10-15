import { useRef, type KeyboardEvent } from "react"
import { BookOpen, Dices, Map as MapIcon, Scroll, ScrollText, User } from "lucide-react"
import type { GameView } from "../api/types"
import { usePref } from "../lib/prefs"
import { CharacterSheet } from "./panels/CharacterSheet"
import { Inventory } from "./panels/Inventory"
import { MapGraph } from "./panels/MapGraph"
import { Facts, Quests } from "./panels/Quests"
import { RollsLog } from "./panels/RollsLog"
import { Empty } from "./ui"

const TABS = [
  { id: "ficha", label: "Ficha", icon: User },
  { id: "inventario", label: "Inventário", icon: BookOpen },
  { id: "missoes", label: "Missões", icon: Scroll },
  { id: "mapa", label: "Mapa", icon: MapIcon },
  { id: "fatos", label: "Fatos", icon: ScrollText },
  { id: "dados", label: "Dados", icon: Dices },
] as const

type TabId = (typeof TABS)[number]["id"]

/** Painel de abas (padrão WAI-ARIA tabs: setas, Home/End). */
export function SidePanel({ game }: { game: GameView }) {
  const [tab, setTab] = usePref<TabId>("tab", "ficha")
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const active = TABS.some((t) => t.id === tab) ? tab : "ficha"

  function onKey(e: KeyboardEvent) {
    const i = TABS.findIndex((t) => t.id === active)
    const next =
      e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1
    if (next < 0) return
    e.preventDefault()
    setTab(TABS[next].id)
    refs.current[TABS[next].id]?.focus()
  }

  const pc = game.pc
  return (
    <section className="dnd-panel flex min-h-0 flex-col overflow-hidden" aria-label="Painéis do herói">
      <div role="tablist" aria-label="Painéis" onKeyDown={onKey} className="dnd-scroll flex overflow-x-auto border-b border-dnd-gold/15 bg-black/40">
        {TABS.map((t) => {
          const selected = t.id === active
          const Icon = t.icon
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el
              }}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 shrink-0 flex-col items-center gap-0.5 border-b-2 px-3 py-2.5 text-[11px] tracking-wide transition ${
                selected ? "border-dnd-gold bg-dnd-gold/10 text-dnd-gold-bright" : "border-transparent text-dnd-parchment-muted hover:text-dnd-parchment"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t.label}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} tabIndex={0} className="dnd-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {active === "ficha" && (pc ? <CharacterSheet pc={pc} locked={game.pendingRolls.length > 0} /> : <Empty>Nenhum herói criado.</Empty>)}
        {active === "inventario" && (pc ? <Inventory pc={pc} /> : <Empty>Nenhum herói criado.</Empty>)}
        {active === "missoes" && <Quests quests={game.quests} />}
        {active === "mapa" && <MapGraph map={game.map} />}
        {active === "fatos" && <Facts facts={game.facts} />}
        {active === "dados" && <RollsLog rolls={game.lastRolls} />}
      </div>
    </section>
  )
}
