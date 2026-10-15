import { useEffect, useRef, useState } from "react"
import { FastForward, Feather, LoaderCircle, Square, Volume2 } from "lucide-react"
import type { GameView } from "../api/types"
import { closedTurns } from "../lib/format"
import { plainText, renderLight } from "../lib/markdown"
import { speak, stopSpeaking, useVoiceStatus, voiceAvailable } from "../lib/speech"

const CHARS_PER_SECOND = 42
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Revela `length` caracteres aos poucos. Reinicia quando `key` muda; `skip()` mostra tudo. */
function useTypewriter(length: number, key: string) {
  const [shown, setShown] = useState(0)
  const frame = useRef(0)

  useEffect(() => {
    if (reducedMotion()) {
      setShown(length)
      return
    }
    setShown(0)
    const start = performance.now()
    const tick = (now: number) => {
      const n = Math.min(length, Math.floor(((now - start) / 1000) * CHARS_PER_SECOND))
      setShown(n)
      if (n < length) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [length, key])

  const skip = () => {
    cancelAnimationFrame(frame.current)
    setShown(length)
  }
  return { shown, done: shown >= length, skip }
}

/**
 * Narração em destaque: a última fala do Mestre no `chat` (com a fala do jogador que a provocou).
 * Sem conversa ainda (campanha antiga), cai para o último turno narrado do journal.
 */
function currentNarration(game: GameView): { key: string; text: string; player: string | null; label: string } | null {
  const idx = game.chat.findLastIndex((m) => m.role === "mestre")
  if (idx >= 0) {
    const msg = game.chat[idx]
    const player = game.chat.slice(0, idx).findLast((m) => m.role === "jogador")?.text ?? null
    const time = new Date(msg.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    return { key: `chat-${msg.id}`, text: msg.text, player, label: `O Mestre · ${time}` }
  }
  const turn = closedTurns(game).at(-1)
  if (!turn) return null
  return { key: `turn-${turn.n}`, text: turn.narration || turn.summary, player: turn.action || null, label: `Turno ${turn.n} · Dia ${turn.day}, ${turn.time}` }
}

export function NarrationStage({ game, voice }: { game: GameView; voice: boolean }) {
  const current = currentNarration(game)
  const plain = current ? plainText(current.text) : ""
  const { shown, done, skip } = useTypewriter(plain.length, current?.key ?? "")
  const firstKey = useRef(current?.key)
  const voiceStatus = useVoiceStatus()
  const speaking = voiceStatus === "carregando" || voiceStatus === "falando"

  // Voz: lê automaticamente só narrações novas (não a que já estava na tela ao abrir a mesa).
  useEffect(() => {
    if (!voice || !current || current.key === firstKey.current) return
    speak(current.key)
  }, [voice, current?.key]) // só reage a narração nova ou à voz ligar

  useEffect(() => {
    if (!voice) stopSpeaking()
  }, [voice])

  const toggleSpeech = () => {
    if (speaking) stopSpeaking()
    else if (current && plain) speak(current.key)
  }

  return (
    <section aria-labelledby="narration-title" className="dnd-panel relative overflow-hidden p-5 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_15%_0%,rgb(228_7_18/0.16),transparent_55%)]" />
      <div className="relative">
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Feather className="h-4 w-4 text-dnd-gold" aria-hidden />
          <h2 id="narration-title" className="dnd-label">
            {current?.label ?? "Narração"}
          </h2>
          <div className="ml-auto flex items-center gap-1">
            {!done && (
              <button
                type="button"
                onClick={skip}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-dnd-parchment-muted transition hover:bg-white/5 hover:text-dnd-parchment"
              >
                <FastForward className="h-3.5 w-3.5" aria-hidden /> Mostrar tudo
              </button>
            )}
            {voiceAvailable && plain && (
              <button
                type="button"
                onClick={toggleSpeech}
                title={voiceStatus === "erro" ? "A voz do servidor não respondeu. Clique para tentar de novo." : undefined}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition hover:bg-dnd-gold/10 ${voiceStatus === "erro" ? "text-dnd-ember-hover" : "text-dnd-gold"}`}
              >
                {voiceStatus === "carregando" ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : speaking ? (
                  <Square className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" aria-hidden />
                )}
                {speaking ? "Parar voz" : voiceStatus === "erro" ? "Voz indisponível" : "Ouvir"}
              </button>
            )}
          </div>
        </div>

        {current?.player && (
          <blockquote className="mb-5 border-l-2 border-dnd-ember pl-3 text-sm text-dnd-parchment-muted italic">
            <span className="dnd-label mr-2 text-dnd-ember-hover not-italic">Você</span>“{current.player}”
          </blockquote>
        )}

        {current ? (
          <>
            {/* Leitores de tela recebem o texto inteiro de uma vez; a digitação é só visual. */}
            <div className="sr-only" aria-live="polite">
              {plain}
            </div>
            <div
              aria-hidden
              onClick={skip}
              className={`dnd-narration font-narrative min-h-[6rem] space-y-4 text-xl leading-relaxed text-dnd-parchment sm:text-[1.6rem] sm:leading-[1.55] ${done ? "" : "dnd-typing cursor-pointer"}`}
            >
              {renderLight(current.text, shown)}
            </div>
          </>
        ) : (
          <p className="font-narrative text-xl text-dnd-parchment-muted italic">A história ainda não começou. Diga ao Mestre o que você quer fazer.</p>
        )}
      </div>
    </section>
  )
}
