import { useEffect, useRef, useState, type RefObject } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { config, goToCampaign } from "./api/client"
import type { RollRequest } from "./api/types"
import { DiceModal } from "./components/DiceModal"
import { CampaignPicker, Splash, TokenPrompt } from "./components/Gate"
import { Hotbar } from "./components/Hotbar"
import { InitiativeBar } from "./components/InitiativeBar"
import { Journal } from "./components/Journal"
import { MasterDialogue } from "./components/MasterDialogue"
import { MockControls } from "./components/MockControls"
import { Notices } from "./components/Notices"
import { NarrationStage } from "./components/NarrationStage"
import { PresentNpcs, ScenePanel } from "./components/Scene"
import { SidePanel } from "./components/SidePanel"
import { TopBar } from "./components/TopBar"
import { useGame } from "./hooks/useGame"
import { asset } from "./lib/asset"
import { closedTurns } from "./lib/format"
import { usePref } from "./lib/prefs"
import { setSfxEnabled } from "./lib/sfx"

/** Publica a altura de um elemento fixo como variável CSS (o layout se ajusta ao header e à hotbar). */
function useHeightVar(ref: RefObject<HTMLElement | null>, name: string) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new ResizeObserver(() => document.documentElement.style.setProperty(name, `${el.offsetHeight}px`))
    obs.observe(el)
    return () => obs.disconnect()
  })
}

/** Fila de rolagens: mostra a primeira pendente não adiada; mantém o pedido na tela até o jogador ver o resultado. */
function useRollQueue(pending: RollRequest[]) {
  const [active, setActive] = useState<RollRequest | null>(null)
  const [deferred, setDeferred] = useState<Set<number>>(new Set())
  // Já resolvidas aqui: o SSE pode demorar a tirá-las de pendingRolls; não reabrir.
  const finished = useRef(new Set<number>())

  useEffect(() => {
    if (active) return
    const next = pending.find((r) => !deferred.has(r.id) && !finished.current.has(r.id))
    if (next) setActive(next)
  }, [pending, active, deferred])

  return {
    active,
    done: () => {
      if (active) finished.current.add(active.id)
      setActive(null)
    },
    defer: () => {
      if (active) setDeferred((s) => new Set(s).add(active.id))
      setActive(null)
    },
    openFirst: () => {
      setDeferred(new Set())
      setActive(pending.find((r) => !finished.current.has(r.id)) ?? null)
    },
  }
}

/** Sem campanha na URL (e fora do mock), o jogador escolhe uma antes de abrir a mesa. */
export default function App() {
  return config.mock || config.campaign ? <Table /> : <CampaignPicker />
}

function Table() {
  const { game, status, error, refresh } = useGame()
  const [voice, setVoice] = usePref("voice", false)
  const [sound, setSound] = usePref("sound", true)
  const headerRef = useRef<HTMLDivElement>(null)
  const hotbarRef = useRef<HTMLDivElement>(null)
  useHeightVar(headerRef, "--header-h")
  useHeightVar(hotbarRef, "--hotbar-h")
  useEffect(() => setSfxEnabled(sound), [sound])

  const rolls = useRollQueue(game?.pendingRolls ?? [])

  if (error?.status === 401) return <TokenPrompt message={error.message} />
  if (!game) {
    return (
      <Splash>
        {error ? (
          <div role="alert" className="dnd-panel max-w-md p-5">
            <p className="text-dnd-parchment">{error.message}</p>
            {error.status === 0 && (
              <p className="mt-2 text-xs text-dnd-parchment-muted">
                Ligue o motor com <code className="text-dnd-gold">dnd serve</code> ou abra a mesa com <code className="text-dnd-gold">?mock=1</code>.
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => void refresh()} className="flex items-center gap-2 rounded-md border border-dnd-gold/50 px-4 py-2 text-sm text-dnd-gold-bright hover:bg-dnd-gold/10">
                <RefreshCw className="h-4 w-4" aria-hidden /> Tentar de novo
              </button>
              {!config.mock && (
                <button type="button" onClick={() => goToCampaign(null)} className="rounded-md px-4 py-2 text-sm text-dnd-parchment-muted hover:bg-white/5">
                  Escolher outra campanha
                </button>
              )}
            </div>
          </div>
        ) : (
          <p role="status" className="flex items-center gap-2 text-dnd-parchment-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Abrindo o grimório…
          </p>
        )}
      </Splash>
    )
  }

  const pendingCount = game.pendingRolls.length
  const resolvedElsewhere = rolls.active ? (game.lastRolls.find((r) => r.id === rolls.active!.id) ?? null) : null
  const backdrop = game.combat ? "greet-final-battle.jpg" : "spooky-castle.jpg"

  return (
    <>
      <div className="dnd-backdrop" aria-hidden>
        <div className="dnd-backdrop-image" style={{ backgroundImage: `url(${asset(`assets/cinematic/${backdrop}`)})` }} />
      </div>

      <div ref={headerRef} className="sticky top-0 z-30">
        <TopBar game={game} status={status} mock={config.mock} voice={voice} onVoice={setVoice} sound={sound} onSound={setSound} />
        {game.combat && <InitiativeBar combat={game.combat} />}
        {error && (
          <p role="alert" className="bg-dnd-ember-deep/80 px-4 py-1.5 text-center text-xs text-dnd-parchment">
            {error.message}
          </p>
        )}
      </div>

      <main className="mx-auto grid max-w-[1500px] gap-4 px-3 pt-4 pb-[calc(var(--hotbar-h,8rem)+1.5rem)] sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <div className="min-w-0 space-y-4">
          <NarrationStage game={game} voice={voice} />
          <MasterDialogue chat={game.chat} master={game.master} />
          <div className="grid gap-4 xl:grid-cols-2">
            <ScenePanel game={game} />
            <PresentNpcs npcs={game.present} />
          </div>
          <Journal turns={closedTurns(game)} />
        </div>
        <aside className="min-w-0 lg:sticky lg:top-[calc(var(--header-h,4rem)+1rem)] lg:flex lg:h-[calc(100dvh-var(--header-h,4rem)-var(--hotbar-h,8rem)-2rem)] lg:flex-col">
          <SidePanel game={game} />
        </aside>
      </main>

      <div ref={hotbarRef} className="fixed inset-x-0 bottom-0 z-30">
        {game.pc ? (
          <Hotbar pc={game.pc} pendingRolls={rolls.active ? 0 : pendingCount} onOpenRoll={rolls.openFirst} />
        ) : (
          <footer className="border-t border-dnd-gold/25 bg-dnd-obsidian/95 px-4 py-3 text-center text-sm text-dnd-parchment-muted">
            Nenhum herói nesta campanha ainda. Crie um com o Mestre.
          </footer>
        )}
      </div>

      <DiceModal
        request={rolls.active}
        resolvedElsewhere={resolvedElsewhere}
        queued={game.pendingRolls.filter((r) => r.id !== rolls.active?.id).length}
        onMinimize={rolls.defer}
        onDone={rolls.done}
      />

      <Notices game={game} />
      {config.mock && <MockControls />}
    </>
  )
}
