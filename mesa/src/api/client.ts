import type { ApiErrorBody, CampaignSummary, GameView, ItemAction, RollOutcome } from "./types"

export type ConnectionStatus = "conectando" | "online" | "offline"

/** Superfície que a mesa usa do motor. Implementada pelo servidor HTTP real e pelo mock local. */
export interface MesaApi {
  readonly mode: "http" | "mock"
  listCampaigns(): Promise<CampaignSummary[]>
  getState(): Promise<GameView>
  /** Chama `onChange` a cada mudança do mundo ou da conversa (SSE `change`) e a cada reconexão; `onStatus` quando a conexão muda. Retorna o cancelamento. */
  subscribe(onChange: () => void, onStatus: (status: ConnectionStatus) => void): () => void
  submitRoll(id: number, dice: number[]): Promise<RollOutcome>
  /** Mensagem do jogador para o Mestre (202). 503 se o Mestre estiver offline; a resposta chega em `chat` pelo SSE. */
  postMessage(text: string): Promise<{ id: number }>
  /** Usar/equipar/empunhar… um item do herói: o motor aplica as regras e avisa o Mestre. Retorna o resumo mecânico. */
  itemAction(action: ItemAction, item: string): Promise<{ text: string }>
}

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const params = new URLSearchParams(window.location.search)
const TOKEN_KEY = "mesa:token"

/** Token do `dnd serve --token`: chega uma vez por `?token=`, fica no sessionStorage e sai da barra de endereço. */
function readToken(): string | null {
  const fromUrl = params.get("token")
  try {
    if (fromUrl) {
      sessionStorage.setItem(TOKEN_KEY, fromUrl)
      params.delete("token")
      const qs = params.toString()
      history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`)
    }
    return sessionStorage.getItem(TOKEN_KEY) ?? fromUrl
  } catch {
    return fromUrl // sem storage: vale só enquanto a URL tiver o token
  }
}

export function saveToken(token: string) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* sem storage */
  }
}

/** Troca a campanha na URL (a mesa recarrega com o novo `?campaign=`; null volta à escolha). */
export function goToCampaign(slug: string | null) {
  const next = new URLSearchParams(location.search)
  if (slug) next.set("campaign", slug)
  else next.delete("campaign")
  const qs = next.toString()
  location.assign(`${location.pathname}${qs ? `?${qs}` : ""}`)
}

// Produção: o `dnd serve --static ../mesa/dist` serve mesa e API na mesma origem.
// Dev: VITE_API_URL (ex.: http://127.0.0.1:8790). `?api=` sobrescreve os dois.
export const config = {
  baseUrl: (params.get("api") ?? import.meta.env.VITE_API_URL ?? window.location.origin).replace(/\/+$/, ""),
  /** Obrigatória no motor: cada chat do Mestre é uma campanha. */
  campaign: params.get("campaign"),
  token: readToken(),
  mock: params.has("mock") ? params.get("mock") !== "0" : import.meta.env.VITE_MESA_MOCK === "1",
}

/** Monta a URL com `campaign` e, se `withToken`, o token (EventSource não envia cabeçalhos). */
function apiUrl(path: string, withToken = false): string {
  const q = new URLSearchParams()
  if (config.campaign) q.set("campaign", config.campaign)
  if (withToken && config.token) q.set("token", config.token)
  const qs = q.toString()
  return config.baseUrl + path + (qs ? `?${qs}` : "")
}

/** URL do MP3 da narração (`key` = `chat-<id>` ou `turn-<n>`). Vai num `<audio>`, que não envia cabeçalhos. */
export function ttsUrl(key: string): string {
  return `${apiUrl("/api/tts", true)}${config.campaign || config.token ? "&" : "?"}key=${encodeURIComponent(key)}`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    const headers: Record<string, string> = {}
    if (init?.body) headers["Content-Type"] = "application/json"
    if (config.token) headers.Authorization = `Bearer ${config.token}`
    res = await fetch(apiUrl(path), { ...init, headers })
  } catch {
    throw new ApiError(0, `Não foi possível falar com o motor em ${config.baseUrl}. O \`dnd serve\` está ligado?`)
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const message = (body as ApiErrorBody | null)?.error ?? `Erro ${res.status} do motor.`
    throw new ApiError(res.status, message)
  }
  return body as T
}

export const httpApi: MesaApi = {
  mode: "http",
  listCampaigns: () => request<CampaignSummary[]>("/api/campaigns"),
  getState: () => request<GameView>("/api/state"),
  submitRoll: (id, dice) => request<RollOutcome>(`/api/rolls/${id}`, { method: "POST", body: JSON.stringify({ dice }) }),
  itemAction: (action, item) => request<{ text: string }>("/api/actions", { method: "POST", body: JSON.stringify({ action, item }) }),
  postMessage: (text) => request<{ id: number }>("/api/messages", { method: "POST", body: JSON.stringify({ text }) }),
  subscribe(onChange, onStatus) {
    let source: EventSource | null = null
    let retry: number | undefined
    const connect = () => {
      onStatus("conectando")
      const es = new EventSource(apiUrl("/api/events", true))
      source = es
      // A cada (re)abertura a mesa relê o estado: pode ter perdido eventos enquanto caiu.
      es.onopen = () => {
        onStatus("online")
        onChange()
      }
      es.onerror = (event) => {
        if (event instanceof MessageEvent) return // `event: error` enviado pelo servidor, não queda de conexão
        if (es.readyState !== EventSource.CLOSED) return onStatus("conectando") // o navegador tenta de novo
        onStatus("offline")
        retry = window.setTimeout(connect, 3000) // fechado de vez (ex.: servidor desligado): tentamos nós
      }
      // `data: {version, chat}`: a mesa não precisa dos números, só relê o estado.
      es.addEventListener("change", () => onChange())
    }
    connect()
    return () => {
      window.clearTimeout(retry)
      source?.close()
    }
  },
}
