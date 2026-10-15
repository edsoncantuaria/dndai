import { useState } from "react"
import { FlaskConical, X } from "lucide-react"
import { mockControls } from "../mock/mockApi"

const ACTIONS: { label: string; run: () => void }[] = [
  { label: "Mestre narra a cena seguinte", run: mockControls.masterNarrates },
  { label: "Próxima resposta do Mestre falha", run: mockControls.failNextReply },
  { label: "Mestre offline / online (503)", run: () => void mockControls.toggleOffline() },
  { label: "Mestre dá loot (+12 po, item, XP)", run: mockControls.giveLoot },
  { label: "Pedir rolagem", run: mockControls.requestRoll },
  { label: "Motor resolve a 1ª rolagem", run: mockControls.resolveByEngine },
  { label: "Entrar/sair de combate", run: mockControls.toggleCombat },
  { label: "Próximo na iniciativa", run: mockControls.nextCombatant },
  { label: "Herói sofre 6 de dano", run: () => mockControls.damagePc(6) },
  { label: "Herói cura 5", run: () => mockControls.damagePc(-5) },
  { label: "Restaurar fixture", run: mockControls.reset },
]

/** Painel só do modo mock: simula o Mestre mudando o mundo (como o ChatGPT faria pela CLI). */
export function MockControls() {
  const [open, setOpen] = useState(false)
  return (
    <div className="fixed right-3 bottom-[calc(var(--hotbar-h,0px)+0.75rem)] z-40">
      {open ? (
        <div className="dnd-panel w-64 p-3" role="region" aria-label="Controles do mock">
          <div className="mb-2 flex items-center justify-between">
            <span className="dnd-label">Modo mock</span>
            <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-dnd-parchment-muted hover:text-dnd-parchment" aria-label="Fechar controles do mock">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="space-y-1">
            {ACTIONS.map((a) => (
              <li key={a.label}>
                <button type="button" onClick={a.run} className="w-full rounded-md px-2 py-1.5 text-left text-xs text-dnd-parchment transition hover:bg-dnd-gold/10">
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-dnd-gold/40 bg-dnd-obsidian/90 px-3 py-2 text-xs text-dnd-gold shadow-lg"
        >
          <FlaskConical className="h-4 w-4" aria-hidden /> Mock
        </button>
      )}
    </div>
  )
}
