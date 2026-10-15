import { BookMarked, Moon, Sun, Sunrise, Sunset, Volume2, VolumeX, Mic, MicOff } from "lucide-react"
import { goToCampaign, type ConnectionStatus } from "../api/client"
import type { GameView } from "../api/types"
import { voiceAvailable } from "../lib/speech"

const PERIOD_ICON = { madrugada: Moon, manhã: Sunrise, tarde: Sun, noite: Sunset }

const STATUS = {
  online: { dot: "bg-dnd-success", label: "Ao vivo" },
  conectando: { dot: "bg-dnd-warning animate-pulse", label: "Conectando…" },
  offline: { dot: "bg-dnd-ember", label: "Sem conexão" },
}

export function TopBar({
  game,
  status,
  mock,
  voice,
  onVoice,
  sound,
  onSound,
}: {
  game: GameView
  status: ConnectionStatus
  mock: boolean
  voice: boolean
  onVoice: (v: boolean) => void
  sound: boolean
  onSound: (v: boolean) => void
}) {
  const PeriodIcon = PERIOD_ICON[game.clock.period]
  const s = STATUS[status]
  return (
    <header className="border-b border-dnd-gold/15 bg-dnd-obsidian/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-3 py-2 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="dnd-label hidden sm:block">Crônicas de Aventuras</p>
          <h1 className="font-display dnd-text-gold truncate text-base leading-tight sm:text-xl">{game.campaign.name}</h1>
        </div>

        <div className="hidden min-w-0 text-right md:block">
          <p className="dnd-label">{game.location?.parent?.name ?? "Local"}</p>
          <p className="font-title truncate text-sm text-dnd-parchment">{game.location?.name ?? "—"}</p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-dnd-gold/20 bg-black/40 px-3 py-1.5" title={`Período: ${game.clock.period}`}>
          <PeriodIcon className="h-4 w-4 text-dnd-gold" aria-hidden />
          <span className="text-xs whitespace-nowrap text-dnd-parchment tabular-nums">
            Dia {game.clock.day} · {game.clock.time}
          </span>
        </div>

        <div className="flex items-center gap-1.5" role="status" aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
          <span className="hidden text-xs text-dnd-parchment-muted lg:inline">{mock ? `Mock · ${s.label}` : s.label}</span>
          <span className="sr-only lg:hidden">{s.label}</span>
        </div>

        {!mock && (
          <button
            type="button"
            onClick={() => goToCampaign(null)}
            title="Trocar de campanha"
            className="rounded-full border border-dnd-gold/25 p-2 text-dnd-gold transition hover:bg-dnd-gold/10"
          >
            <BookMarked className="h-4 w-4" aria-hidden />
            <span className="sr-only">Trocar de campanha</span>
          </button>
        )}
        {voiceAvailable && (
          <button
            type="button"
            onClick={() => onVoice(!voice)}
            aria-pressed={voice}
            title={voice ? "Desligar voz da narração" : "Ligar voz da narração"}
            className="rounded-full border border-dnd-gold/25 p-2 text-dnd-gold transition hover:bg-dnd-gold/10"
          >
            {voice ? <Mic className="h-4 w-4" aria-hidden /> : <MicOff className="h-4 w-4" aria-hidden />}
            <span className="sr-only">Voz da narração</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onSound(!sound)}
          aria-pressed={sound}
          title={sound ? "Silenciar efeitos" : "Ligar efeitos sonoros"}
          className="rounded-full border border-dnd-gold/25 p-2 text-dnd-gold transition hover:bg-dnd-gold/10"
        >
          {sound ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
          <span className="sr-only">Efeitos sonoros</span>
        </button>
      </div>
    </header>
  )
}
