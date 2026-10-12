import { useRef, useState } from "react"
import type { PcView } from "../../api/types"
import { api } from "../../hooks/useGame"
import { notify } from "../../lib/notify"
import { playCue } from "../../lib/sfx"
import { SectionTitle } from "../ui"

export function ResourcePanel({ pc, locked }: { pc: PcView; locked: boolean }) {
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const resources = pc.resources ?? []
  async function use(id: string) {
    if (sending.current || locked) return
    sending.current = true
    setBusy(true)
    try {
      const { text } = await api.useResource(id, amounts[id] ?? 1)
      if (["segundo-folego", "cura-pelas-maos", "integridade-corporal"].includes(id)) playCue("use")
      notify("Habilidade usada", "success", text)
    } catch (error) {
      notify("Não foi possível usar a habilidade", "ember", error instanceof Error ? error.message : String(error))
    } finally {
      sending.current = false
      setBusy(false)
    }
  }
  if (!resources.length) return null
  return (
    <section aria-label="Recursos de habilidades">
      <SectionTitle>Recursos de habilidades</SectionTitle>
      {locked && <p className="text-xs text-dnd-parchment-muted">Role os dados pendentes para usar habilidades.</p>}
      <ul className="space-y-2">
        {resources.map((r) => (
          <li key={r.id} className="rounded-md border border-dnd-gold/25 p-3 text-sm">
            <div className="flex justify-between gap-2 text-dnd-gold-bright"><span>{r.name}</span><span>{r.unlimited ? "Ilimitado" : `${r.max - r.used}/${r.max}`}</span></div>
            <p className="mt-1 text-xs text-dnd-parchment-muted">{r.effect}</p>
            <p className="mt-1 text-xs text-dnd-parchment-muted">Recarga: descanso {r.resets_on === "short" ? "curto ou longo" : "longo"}</p>
            <div className="mt-2 flex items-center gap-2">
              {["cura-pelas-maos", "ki", "pontos-de-feiticaria"].includes(r.id) && (
                <label className="text-xs text-dnd-parchment">Pontos
                  <input aria-label={`Pontos de ${r.name}`} type="number" min={1} max={r.max - r.used} value={amounts[r.id] ?? 1} disabled={busy || locked || !r.available} onChange={(e) => setAmounts((a) => ({ ...a, [r.id]: Number(e.target.value) }))} className="ml-2 w-14 rounded border border-white/20 bg-black/40 p-1" />
                </label>
              )}
              <button type="button" disabled={busy || locked || !r.available} onClick={() => void use(r.id)} aria-label={`Usar ${r.name}`} className="rounded-md border border-dnd-gold/50 px-3 py-1 text-dnd-gold hover:bg-dnd-gold/10 disabled:opacity-40">{r.id === "cura-pelas-maos" ? "Curar a si mesmo" : "Usar"}</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
