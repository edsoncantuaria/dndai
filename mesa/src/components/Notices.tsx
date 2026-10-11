import { useEffect, useRef, useState } from "react"
import type { GameView } from "../api/types"
import { notify, onNotice, type Notice } from "../lib/notify"
import { playCue, type Cue } from "../lib/sfx"

const TTL_MS = 5500
const MAX = 4

const TONE = {
  gold: "border-dnd-gold/60 text-dnd-gold-bright",
  success: "border-dnd-success/60 text-dnd-success",
  ember: "border-dnd-ember/60 text-dnd-ember-hover",
  muted: "border-white/20 text-dnd-parchment-muted",
  arcane: "border-dnd-arcane/60 text-dnd-arcane",
}

const COIN = { po: "po", pp: "pp", pc: "pc" } as const

/**
 * Compara o estado anterior com o novo e anuncia o que mudou para o herói: itens, moedas, XP,
 * missões, descobertas, condições e reações dos NPCs. (Vida já tem o número flutuante na hotbar.)
 */
function diff(prev: GameView, next: GameView): { cue: Cue | null } {
  let cue: Cue | null = null
  const pc0 = prev.pc
  const pc1 = next.pc
  if (pc0 && pc1 && pc0.id === pc1.id) {
    const before = new Map(pc0.inventory.map((i) => [i.id, i]))
    const after = new Map(pc1.inventory.map((i) => [i.id, i]))
    for (const [id, item] of after) {
      const old = before.get(id)
      const delta = item.qty - (old?.qty ?? 0)
      if (delta > 0) {
        notify(old ? `+${delta} ${item.name}` : "Item recebido", "gold", old ? undefined : `${item.name}${item.qty > 1 ? ` ×${item.qty}` : ""}`)
        cue = "loot"
      } else if (delta < 0) notify(`−${-delta} ${item.name}`, "muted", `Restam ${item.qty}`)
      if (old && old.drawn !== item.drawn) notify(item.drawn ? `${item.name} em punho` : `${item.name} embainhada`, item.drawn ? "ember" : "muted")
    }
    for (const [id, item] of before) if (!after.has(id)) notify(`${item.name} saiu do inventário`, "muted")

    const coins = (Object.keys(COIN) as (keyof typeof COIN)[])
      .map((k) => ({ k, d: pc1.money[k] - pc0.money[k] }))
      .filter((c) => c.d !== 0)
    if (coins.length) {
      const gained = coins.every((c) => c.d > 0)
      notify(coins.map((c) => `${c.d > 0 ? "+" : "−"}${Math.abs(c.d)} ${COIN[c.k]}`).join(" "), gained ? "gold" : "muted", gained ? "Moedas recebidas" : "Moedas gastas")
      cue ??= "coins"
    }
    if (pc1.xp > pc0.xp) {
      notify(`+${pc1.xp - pc0.xp} XP`, "arcane")
      cue ??= "success"
    }
    if (pc1.levelUpReady && !pc0.levelUpReady) notify("Você pode subir de nível!", "gold")
    if (pc1.level > pc0.level) notify(`Nível ${pc1.level}!`, "gold")
    for (const c of pc1.conditions) if (!pc0.conditions.includes(c)) notify(`Condição: ${c}`, "ember")
    for (const c of pc0.conditions) if (!pc1.conditions.includes(c)) notify(`${c} terminou`, "muted")
  }

  const quests0 = new Map(prev.quests.map((q) => [q.id, q]))
  for (const q of next.quests) {
    const old = quests0.get(q.id)
    if (!old) notify("Nova missão", "gold", q.title)
    else if (old.status !== q.status && q.status !== "ativa")
      notify(q.status === "concluida" ? "Missão concluída" : q.status === "falhou" ? "Missão fracassada" : "Missão abandonada", q.status === "concluida" ? "success" : "ember", q.title)
  }
  const facts0 = new Set(prev.facts.map((f) => f.id))
  for (const f of next.facts) if (!facts0.has(f.id)) notify("Descoberta", "arcane", f.text)

  const npcs0 = new Map(prev.present.map((n) => [n.id, n]))
  for (const n of next.present) {
    const old = npcs0.get(n.id)
    if (n.reaction && old?.reaction !== n.reaction) {
      notify(n.name, "ember", n.reaction)
      cue = "tension"
    }
  }
  return { cue }
}

export function Notices({ game }: { game: GameView }) {
  const [list, setList] = useState<Notice[]>([])
  const prev = useRef<GameView | null>(null)

  useEffect(
    () =>
      onNotice((n) => {
        setList((l) => [...l, n].slice(-MAX))
        window.setTimeout(() => setList((l) => l.filter((x) => x.id !== n.id)), TTL_MS)
      }),
    [],
  )

  useEffect(() => {
    const before = prev.current
    prev.current = game
    // Primeira carga ou troca de campanha: nada a anunciar.
    if (!before || before.campaign.slug !== game.campaign.slug) return
    const { cue } = diff(before, game)
    if (cue) playCue(cue)
  }, [game])

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed top-[calc(var(--header-h,4rem)+0.75rem)] right-3 z-40 flex w-72 max-w-[calc(100vw-1.5rem)] flex-col gap-2"
    >
      {list.map((n) => (
        <div key={n.id} className={`animate-rise rounded-lg border bg-dnd-obsidian/95 px-3 py-2 shadow-[var(--dnd-shadow-elevated)] backdrop-blur ${TONE[n.tone]}`}>
          <p className="font-title text-sm">{n.title}</p>
          {n.detail && <p className="mt-0.5 line-clamp-2 text-xs text-dnd-parchment">{n.detail}</p>}
        </div>
      ))}
    </div>
  )
}
