import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { BookMarked, KeyRound, Loader2, RefreshCw } from "lucide-react"
import { ApiError, goToCampaign, saveToken } from "../api/client"
import type { CampaignSummary } from "../api/types"
import { api } from "../hooks/useGame"
import { asset } from "../lib/asset"

/** Tela cheia cinematográfica para tudo que vem antes da mesa (carregando, erros, escolhas). */
export function Splash({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="dnd-backdrop" aria-hidden>
        <div className="dnd-backdrop-image" style={{ backgroundImage: `url(${asset("assets/cinematic/rpg-still-life.jpg")})` }} />
      </div>
      <h1 className="font-display dnd-text-gold text-3xl sm:text-4xl">Crônicas de Aventuras</h1>
      {children}
    </div>
  )
}

/** 401: o `dnd serve` foi aberto com --token. Guarda o token na sessão e recarrega. */
export function TokenPrompt({ message }: { message?: string }) {
  const [token, setToken] = useState("")
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    saveToken(token.trim())
    location.reload()
  }
  return (
    <Splash>
      <form onSubmit={submit} className="dnd-panel w-full max-w-sm space-y-3 p-5 text-left">
        <p className="flex items-center gap-2 text-dnd-parchment">
          <KeyRound className="h-4 w-4 text-dnd-gold" aria-hidden /> Esta mesa está protegida por token.
        </p>
        {message && <p className="text-xs text-dnd-parchment-muted">{message}</p>}
        <label className="block">
          <span className="dnd-label mb-1.5 block">Token do dnd serve</span>
          <input
            type="password"
            autoComplete="off"
            autoFocus
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full rounded-md border border-dnd-gold/25 bg-black/50 px-3 py-2.5 text-sm text-dnd-parchment focus:border-dnd-gold focus:outline-none"
          />
        </label>
        <button type="submit" disabled={!token.trim()} className="w-full rounded-md border border-dnd-gold/50 bg-dnd-gold/10 px-4 py-2.5 text-sm font-semibold text-dnd-gold-bright hover:bg-dnd-gold/20 disabled:opacity-40">
          Entrar
        </button>
      </form>
    </Splash>
  )
}

/** Sem `?campaign=`: lista as campanhas do motor para o jogador escolher (cada chat do Mestre é uma campanha). */
export function CampaignPicker() {
  const [list, setList] = useState<CampaignSummary[] | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setError(null)
    api
      .listCampaigns()
      .then((l) => {
        if (!alive) return
        // Uma só campanha: entra direto.
        if (l.length === 1) goToCampaign(l[0].slug)
        else setList(l)
      })
      .catch((err: unknown) => alive && setError(err instanceof ApiError ? err : new ApiError(0, String(err))))
    return () => {
      alive = false
    }
  }, [attempt])

  if (error?.status === 401) return <TokenPrompt />
  return (
    <Splash>
      {error ? (
        <div role="alert" className="dnd-panel max-w-md p-5">
          <p className="text-dnd-parchment">{error.message}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="mx-auto mt-4 flex items-center gap-2 rounded-md border border-dnd-gold/50 px-4 py-2 text-sm text-dnd-gold-bright hover:bg-dnd-gold/10">
            <RefreshCw className="h-4 w-4" aria-hidden /> Tentar de novo
          </button>
        </div>
      ) : !list ? (
        <p role="status" className="flex items-center gap-2 text-dnd-parchment-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Procurando campanhas…
        </p>
      ) : list.length === 0 ? (
        <p className="dnd-panel max-w-md p-5 text-dnd-parchment">
          Nenhuma campanha ainda. Peça ao Mestre no ChatGPT para começar uma (<code className="text-dnd-gold">dnd campaign new</code>).
        </p>
      ) : (
        <nav aria-label="Campanhas" className="w-full max-w-md">
          <p className="dnd-label mb-3">Escolha a campanha</p>
          <ul className="space-y-2">
            {list.map((c) => (
              <li key={c.slug}>
                <button
                  type="button"
                  onClick={() => goToCampaign(c.slug)}
                  className="dnd-panel flex w-full items-center gap-3 px-4 py-3 text-left transition hover:border-dnd-gold/50"
                >
                  <BookMarked className="h-5 w-5 shrink-0 text-dnd-gold" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="font-title block truncate text-dnd-gold-bright">{c.name}</span>
                    <span className="text-xs text-dnd-parchment-muted">{c.slug}</span>
                  </span>
                  {c.current && <span className="text-[11px] text-dnd-success">atual</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </Splash>
  )
}
