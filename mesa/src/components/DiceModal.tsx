import { useCallback, useEffect, useRef, useState } from "react"
import type DiceBox from "@3d-dice/dice-box"
import { Dices, Loader2, RotateCcw, Sparkles, Target } from "lucide-react"
import { ApiError } from "../api/client"
import type { RollOutcome, RollRequest } from "../api/types"
import { api } from "../hooks/useGame"
import { OUTCOME_LABEL, OUTCOME_TONE, ROLL_KIND_LABEL, SOURCE_LABEL, diceNotation, signed } from "../lib/format"
import { assetPath } from "../lib/asset"
import { playCue } from "../lib/sfx"
import { DiceFaces } from "./panels/RollsLog"

const HOST_ID = "dice-canvas-host"
const INIT_TIMEOUT_MS = 20000

type Phase =
  | { name: "ready" }
  | { name: "rolling" }
  | { name: "submitting"; dice: number[] }
  /** resolved: 409/404 (já resolvida ou cancelada); invalid: 400 (rolar de novo); network: falha de rede/servidor (reenviar os mesmos valores). */
  | { name: "failed"; dice: number[]; message: string; kind: "resolved" | "invalid" | "network" }
  | { name: "result"; outcome: RollOutcome }

// Um único DiceBox por página: o canvas vive dentro do <dialog>, que nunca é desmontado.
// Carregado sob demanda (motor físico pesado) só quando a primeira rolagem aparece.
let boxPromise: Promise<DiceBox> | null = null
function getDiceBox(): Promise<DiceBox> {
  if (boxPromise) return boxPromise
  const init = import("@3d-dice/dice-box")
    .then(({ default: DiceBoxCtor }) => {
      document.getElementById(HOST_ID)?.replaceChildren() // nunca dois canvases (ex.: após HMR ou falha anterior)
      return new DiceBoxCtor({
        container: `#${HOST_ID}`,
        assetPath: assetPath("assets/dice-box/"),
        theme: "default",
        themeColor: "#8b0f14",
        offscreen: true,
        scale: 8,
      }).init()
    })
  // Falhas dentro do worker do dice-box não rejeitam a promessa: sem resposta, cai na rolagem sem 3D.
  boxPromise = Promise.race([
    init,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Dados 3D não iniciaram a tempo.")), INIT_TIMEOUT_MS)),
  ])
    .catch((err: unknown) => {
      boxPromise = null
      throw err
    })
  return boxPromise
}

/** Rola um dado por entrada de `request.dice`, na mesma ordem. */
async function roll3d(request: RollRequest): Promise<number[]> {
  const box = await getDiceBox()
  const groups = await box.roll(request.dice.map((d) => ({ qty: 1, sides: d.sides })))
  const values = [...groups].sort((a, b) => a.groupId - b.groupId).map((g) => g.value)
  if (values.length !== request.dice.length) throw new Error("O motor 3D devolveu uma quantidade inesperada de dados.")
  return values
}

function rollDigital(request: RollRequest): number[] {
  const buf = new Uint32Array(request.dice.length)
  crypto.getRandomValues(buf)
  return request.dice.map((d, i) => 1 + (buf[i] % d.sides))
}

const OUTCOME_CUE = { critico: "diceCritical", sucesso: "success", falha: "diceFailure", falha_critica: "diceFailure" } as const

export function DiceModal({
  request,
  resolvedElsewhere,
  queued,
  onMinimize,
  onDone,
}: {
  request: RollRequest | null
  /** Resultado da mesma rolagem já presente em lastRolls (ex.: o Mestre resolveu pelo motor). */
  resolvedElsewhere: RollOutcome | null
  queued: number
  onMinimize: () => void
  onDone: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [phase, setPhase] = useState<Phase>({ name: "ready" })
  const [boxReady, setBoxReady] = useState<"loading" | "ok" | "failed">("loading")
  const open = request !== null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Nova rolagem: volta ao início e prepara os dados 3D (o canvas precisa do dialog visível para medir).
  useEffect(() => {
    if (!request) return
    setPhase({ name: "ready" })
    let alive = true
    getDiceBox()
      .then((box) => {
        if (!alive) return
        box.clear()
        box.resizeWorld()
        setBoxReady("ok")
      })
      .catch((err: unknown) => {
        console.error("[mesa] Falha ao iniciar dados 3D:", err)
        if (alive) setBoxReady("failed")
      })
    return () => {
      alive = false
    }
  }, [request?.id]) // só ao trocar de rolagem, não a cada novo objeto vindo do SSE

  const submit = useCallback(
    async (dice: number[]) => {
      if (!request) return
      setPhase({ name: "submitting", dice })
      try {
        const outcome = await api.submitRoll(request.id, dice)
        setPhase({ name: "result", outcome })
        playCue(outcome.outcome ? OUTCOME_CUE[outcome.outcome] : "success")
      } catch (err) {
        const status = err instanceof ApiError ? err.status : 0
        const message = err instanceof Error ? err.message : String(err)
        const kind = status === 409 || status === 404 ? "resolved" : status === 400 ? "invalid" : "network"
        setPhase({ name: "failed", dice, message, kind })
      }
    },
    [request],
  )

  async function doRoll(digital: boolean) {
    if (!request || phase.name !== "ready") return
    setPhase({ name: "rolling" })
    playCue("diceRoll")
    let dice: number[]
    try {
      dice = digital ? rollDigital(request) : await roll3d(request)
    } catch (err) {
      console.error("[mesa] Erro na rolagem 3D:", err)
      setBoxReady("failed")
      setPhase({ name: "ready" })
      return
    }
    await submit(dice)
  }

  const busy = phase.name === "rolling" || phase.name === "submitting"
  const outcome = phase.name === "result" ? phase.outcome : phase.name === "ready" ? resolvedElsewhere : null
  const flash = outcome?.outcome === "critico" ? "dnd-flash-critical" : outcome?.outcome === "falha_critica" ? "dnd-flash-failure" : ""

  return (
    <dialog
      ref={dialogRef}
      className="dnd-dialog"
      aria-labelledby="roll-title"
      aria-describedby={request?.reason ? "roll-reason" : undefined}
      onCancel={(e) => {
        e.preventDefault() // Esc minimiza; nunca fecha no meio da rolagem
        if (busy) return
        if (outcome) onDone()
        else onMinimize()
      }}
    >
      <div className={`flex min-h-full items-center justify-center p-0 sm:p-6 ${flash}`}>
        <div className="animate-rise dnd-border-gold flex w-full max-w-4xl flex-col overflow-hidden shadow-[var(--dnd-shadow-elevated)] max-sm:self-stretch sm:rounded-xl md:grid md:grid-cols-[1.15fr_1fr]">
          <div className="relative min-h-[42vh] overflow-hidden border-b border-dnd-gold/15 bg-[radial-gradient(circle_at_50%_60%,rgb(228_7_18/0.18),transparent_65%)] md:min-h-[26rem] md:border-r md:border-b-0">
            <div id={HOST_ID} className="absolute inset-0 overflow-hidden" aria-hidden />
            {boxReady === "loading" && (
              <p className="absolute inset-x-0 bottom-4 text-center text-xs text-dnd-parchment-muted">Preparando os dados…</p>
            )}
            {phase.name === "rolling" && (
              <p className="absolute inset-x-0 bottom-4 text-center">
                <span className="rounded-full border border-dnd-gold/30 bg-black/70 px-3 py-1 text-xs text-dnd-gold">Dados em movimento…</span>
              </p>
            )}
          </div>

          <div className="flex min-h-0 flex-col">
            <header className="border-b border-dnd-gold/15 bg-black/30 px-5 py-4">
              <p className="dnd-label flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {request ? ROLL_KIND_LABEL[request.kind] : "Rolagem"} · pedido do Mestre
              </p>
              <h2 id="roll-title" className="font-display mt-1.5 text-2xl leading-snug text-dnd-parchment">
                {request?.label}
              </h2>
              <p className="text-xs text-dnd-parchment-muted">{request?.whoName}</p>
            </header>

            <div className="flex flex-1 flex-col justify-center gap-4 px-5 py-5">
              {request?.reason && (
                <p id="roll-reason" className="font-narrative text-lg leading-relaxed text-dnd-parchment/90 italic">
                  {request.reason}
                </p>
              )}
              {request && (
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                  <span className="rounded-md border border-white/10 bg-black/50 px-3 py-1 text-dnd-parchment tabular-nums">
                    {diceNotation(request)} {signed(request.modifier)}
                  </span>
                  {(request.dc !== null || request.kind === "ataque") && (
                    <span className="flex items-center gap-1.5 rounded-md border border-dnd-gold/40 bg-dnd-gold/10 px-3 py-1 text-dnd-gold-bright">
                      <Target className="h-4 w-4" aria-hidden /> {request.dc !== null ? `CD ${request.dc}` : "CA oculta"}
                    </span>
                  )}
                  {request.mode !== "normal" && (
                    <span
                      className={`rounded-md border px-3 py-1 text-xs font-semibold tracking-[0.3em] uppercase ${
                        request.mode === "vantagem" ? "border-dnd-success/50 text-dnd-success" : "border-dnd-ember/50 text-dnd-ember-hover"
                      }`}
                    >
                      {request.mode}
                    </span>
                  )}
                </div>
              )}

              {request?.kind === "ataque" && request.dice.some((d) => d.sides !== 20) && phase.name === "ready" && !outcome && (
                <p className="text-center text-xs text-dnd-parchment-muted">Os dados de dano rolam junto; só contam se o golpe acertar.</p>
              )}

              <div aria-live="assertive" className="min-h-[1rem]">
                {outcome && (
                  <div className="animate-rise text-center">
                    {phase.name !== "result" && <p className="mb-2 text-xs text-dnd-parchment-muted">Esta rolagem já foi resolvida ({SOURCE_LABEL[outcome.source]}).</p>}
                    <p className={`font-display text-7xl leading-none tabular-nums ${outcome.outcome ? OUTCOME_TONE[outcome.outcome] : "text-dnd-gold-bright"} ${outcome.outcome === "critico" ? "drop-shadow-[0_0_24px_var(--color-dnd-gold)]" : ""}`}>
                      {outcome.total}
                    </p>
                    <p className="mt-2 text-sm text-dnd-parchment-muted tabular-nums">
                      <DiceFaces dice={outcome.dice} kept={outcome.kept} /> {signed(outcome.modifier)}
                      {outcome.dc !== null ? ` · contra ${outcome.dc}` : ""}
                    </p>
                    {outcome.outcome && (
                      <p className={`font-display mt-2 text-2xl ${OUTCOME_TONE[outcome.outcome]}`}>{OUTCOME_LABEL[outcome.outcome]}</p>
                    )}
                    {phase.name === "result" && <p className="mt-3 text-xs text-dnd-parchment-muted italic">O Mestre recebeu o resultado e vai narrar o que acontece.</p>}
                  </div>
                )}
                {phase.name === "submitting" && (
                  <p className="flex items-center justify-center gap-2 text-sm text-dnd-gold">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Dados: {phase.dice.join(", ")} — o motor está julgando…
                  </p>
                )}
                {phase.name === "failed" && (
                  <div role="alert" className="rounded-md border border-dnd-ember/40 bg-dnd-ember/10 px-3 py-2 text-sm text-dnd-parchment">
                    <p>{phase.message}</p>
                    <p className="mt-1 text-xs text-dnd-parchment-muted">Dados rolados: {phase.dice.join(", ")}</p>
                  </div>
                )}
              </div>

              <div className="mt-auto flex flex-col gap-2">
                {phase.name === "ready" && !outcome && (
                  <>
                    <button
                      type="button"
                      autoFocus
                      disabled={boxReady === "loading"}
                      onClick={() => doRoll(boxReady === "failed")}
                      className="flex items-center justify-center gap-2 rounded-md border border-dnd-ember-hover bg-gradient-to-b from-dnd-ember to-dnd-ember-deep px-4 py-3.5 font-semibold tracking-wide text-dnd-parchment shadow-[0_0_30px_-8px_var(--color-dnd-ember)] transition hover:brightness-110 disabled:opacity-50"
                    >
                      <Dices className="h-5 w-5" aria-hidden />
                      {boxReady === "loading" ? "Preparando os dados…" : boxReady === "failed" ? `Rolar ${request ? diceNotation(request) : ""} (sem 3D)` : `Rolar ${request ? diceNotation(request) : ""}`}
                    </button>
                    {boxReady === "failed" && <p className="text-center text-xs text-dnd-parchment-muted">Os dados 3D não carregaram neste navegador; a rolagem usa o sorteio seguro do navegador.</p>}
                    <button type="button" onClick={onMinimize} className="rounded-md px-4 py-2 text-sm text-dnd-parchment-muted transition hover:bg-white/5 hover:text-dnd-parchment">
                      Rolar depois
                    </button>
                  </>
                )}
                {phase.name === "failed" && phase.kind === "invalid" && (
                  <button
                    type="button"
                    onClick={() => setPhase({ name: "ready" })}
                    className="flex items-center justify-center gap-2 rounded-md border border-dnd-gold/50 bg-dnd-gold/10 px-4 py-3 font-semibold text-dnd-gold-bright transition hover:bg-dnd-gold/20"
                  >
                    <Dices className="h-4 w-4" aria-hidden /> Rolar de novo
                  </button>
                )}
                {phase.name === "failed" && phase.kind === "network" && (
                  <button
                    type="button"
                    onClick={() => submit(phase.dice)}
                    className="flex items-center justify-center gap-2 rounded-md border border-dnd-gold/50 bg-dnd-gold/10 px-4 py-3 font-semibold text-dnd-gold-bright transition hover:bg-dnd-gold/20"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden /> Reenviar os mesmos dados
                  </button>
                )}
                {(outcome || (phase.name === "failed" && phase.kind === "resolved")) && (
                  <button
                    type="button"
                    autoFocus
                    onClick={onDone}
                    className="rounded-md border border-dnd-gold/50 bg-dnd-gold/10 px-4 py-3 font-semibold text-dnd-gold-bright transition hover:bg-dnd-gold/20"
                  >
                    {queued > 0 ? `Próxima rolagem (${queued})` : "Continuar"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  )
}
