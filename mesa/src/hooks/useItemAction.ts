import { useState } from "react"
import type { ItemAction } from "../api/types"
import { notify } from "../lib/notify"
import { playCue } from "../lib/sfx"
import { api } from "./useGame"

export const ACTION_LABEL: Record<ItemAction, string> = {
  usar: "Usar",
  equipar: "Equipar",
  guardar: "Guardar",
  empunhar: "Empunhar",
  embainhar: "Embainhar",
  largar: "Largar",
}

/** Envia a ação ao motor (POST /api/actions). O resultado vira aviso; o estado novo chega pelo SSE. */
export function useItemAction() {
  const [pending, setPending] = useState<string | null>(null)

  async function run(action: ItemAction, itemId: string, itemName: string) {
    if (pending) return
    setPending(itemId)
    try {
      const { text } = await api.itemAction(action, itemId)
      if (action === "usar") playCue("use")
      notify(`${ACTION_LABEL[action]}: ${itemName}`, "success", text)
    } catch (err) {
      notify(`Não deu para ${ACTION_LABEL[action].toLowerCase()} ${itemName}`, "ember", err instanceof Error ? err.message : String(err))
    } finally {
      setPending(null)
    }
  }

  return { run, pending }
}
