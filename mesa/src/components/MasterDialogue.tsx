import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { AlertTriangle, Loader2, RotateCcw, Send } from "lucide-react"
import type { ChatMessage, GameView } from "../api/types"
import { api } from "../hooks/useGame"
import { renderLight } from "../lib/markdown"

const PLAYER_STATUS: Partial<Record<ChatMessage["status"], string>> = {
  fila: "na fila",
  enviando: "enviando ao Mestre…",
  aguardando: "o Mestre está lendo…",
}

/** Caixa de diálogo principal (estilo BG3): o jogador fala com o Mestre por aqui (POST /api/messages). */
export function MasterDialogue({ chat, master }: { chat: GameView["chat"]; master: GameView["master"] }) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const logRef = useRef<HTMLOListElement>(null)
  const busy = master.status === "na_fila" || master.status === "pensando"
  const lastPlayer = chat.findLast((m) => m.role === "jogador")

  // Mantém o histórico rolado até a última fala.
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.length, chat.at(-1)?.status])

  async function send(value: string) {
    if (!value || sending) return false
    setSending(true)
    setError(null)
    try {
      await api.postMessage(value)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err)) // 503: Mestre offline
      return false
    } finally {
      setSending(false)
    }
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    if (await send(text.trim())) setText("")
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <section aria-labelledby="dialogue-title" className="dnd-panel overflow-hidden">
      <h2 id="dialogue-title" className="sr-only">
        Conversa com o Mestre
      </h2>

      {chat.length > 0 && (
        <ol ref={logRef} className="dnd-scroll max-h-[22rem] space-y-3 overflow-y-auto border-b border-dnd-gold/10 p-4" aria-label="Histórico da conversa">
          {chat.map((m) => (
            <li key={m.id} className="animate-fade-in">
              {m.role === "jogador" ? (
                <div className="ml-auto max-w-[85%] rounded-lg border border-dnd-ember/35 bg-dnd-ember-deep/20 px-3 py-2 text-sm text-dnd-parchment">
                  <p className="dnd-label mb-0.5 text-dnd-ember-hover">Você</p>
                  <p className="whitespace-pre-line">{m.text}</p>
                  {m.status === "erro" ? (
                    <p className="mt-1 text-xs text-dnd-danger">Não entregue{m.error ? `: ${m.error}` : ""}</p>
                  ) : PLAYER_STATUS[m.status] ? (
                    <p className="mt-1 text-[11px] text-dnd-parchment-muted italic">{PLAYER_STATUS[m.status]}</p>
                  ) : null}
                </div>
              ) : m.role === "sistema" ? (
                <p className="text-center text-[11px] tracking-wide text-dnd-parchment-muted">— {m.text} —</p>
              ) : (
                <div className="max-w-[95%] space-y-2 font-narrative text-[1.02rem] leading-relaxed text-dnd-parchment/90">
                  <p className="dnd-label font-ui">O Mestre</p>
                  {renderLight(m.text)}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="space-y-3 p-4">
        {busy && (
          <p role="status" className="flex items-center gap-2 text-sm text-dnd-gold">
            <span className="h-2 w-2 animate-ping rounded-full bg-dnd-ember" aria-hidden />
            O Mestre está narrando…
            {master.activity && <span className="truncate text-xs text-dnd-parchment-muted">{master.activity}</span>}
          </p>
        )}
        {master.status === "erro" && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-dnd-ember/40 bg-dnd-ember/10 px-3 py-2 text-sm text-dnd-parchment">
            <AlertTriangle className="h-4 w-4 shrink-0 text-dnd-ember-hover" aria-hidden />
            <span className="min-w-0 flex-1">{master.error || "O Mestre não conseguiu responder."}</span>
            {lastPlayer && (
              <button
                type="button"
                disabled={sending}
                onClick={() => void send(lastPlayer.text)}
                className="flex items-center gap-1.5 rounded-md border border-dnd-gold/50 px-3 py-1.5 text-xs font-semibold text-dnd-gold-bright hover:bg-dnd-gold/10 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reenviar
              </button>
            )}
          </div>
        )}

        <form onSubmit={submit} className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">O que você faz ou diz?</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              maxLength={4000}
              placeholder="O que você faz ou diz? (Enter envia, Shift+Enter quebra a linha)"
              className="block w-full resize-y rounded-md border border-dnd-gold/25 bg-black/50 px-3 py-2.5 font-narrative text-lg text-dnd-parchment placeholder:font-ui placeholder:text-sm placeholder:text-dnd-parchment-muted/60 focus:border-dnd-gold focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="flex h-[3.25rem] items-center justify-center gap-2 rounded-md border border-dnd-ember-hover bg-gradient-to-b from-dnd-ember to-dnd-ember-deep px-4 text-sm font-semibold text-dnd-parchment transition hover:brightness-110 disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            <span className="hidden sm:inline">Falar</span>
            <span className="sr-only sm:hidden">Enviar ao Mestre</span>
          </button>
        </form>
        {error && (
          <p role="alert" className="text-xs text-dnd-danger">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
