import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError, config, httpApi, type ConnectionStatus, type MesaApi } from "../api/client"
import type { GameView } from "../api/types"
import { mockApi } from "../mock/mockApi"

export const api: MesaApi = config.mock ? mockApi : httpApi

/** Estado do jogo espelhado do motor: carga inicial + releitura a cada `change` do SSE. */
export function useGame() {
  const [game, setGame] = useState<GameView | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>("conectando")
  /** `status` 0 = rede; 401 = token; 404 = campanha inexistente. */
  const [error, setError] = useState<{ message: string; status: number } | null>(null)
  const inFlight = useRef(false)
  const dirty = useRef(false)

  const refresh = useCallback(async () => {
    // Coalesce: se já há leitura em voo, marca para reler ao fim (o servidor pode ter mudado de novo).
    if (inFlight.current) {
      dirty.current = true
      return
    }
    inFlight.current = true
    try {
      do {
        dirty.current = false
        // Leituras são sequenciais (nunca duas em voo), então a última resposta é sempre a mais nova.
        const next = await api.getState()
        setGame(next)
        setError(null)
      } while (dirty.current)
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : String(err), status: err instanceof ApiError ? err.status : 0 })
    } finally {
      inFlight.current = false
    }
  }, [])

  useEffect(() => {
    void refresh()
    return api.subscribe(
      // Qualquer evento relê o estado: a conversa (`chat`) muda sem alterar `version`.
      () => void refresh(),
      setStatus,
    )
  }, [refresh])

  return { game, status, error, refresh }
}
