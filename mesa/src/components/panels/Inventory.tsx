import { Loader2 } from "lucide-react"
import type { ItemAction, ItemView, PcView } from "../../api/types"
import { ACTION_LABEL, useItemAction } from "../../hooks/useItemAction"
import { Chip, Empty, SectionTitle } from "../ui"

const COINS = [
  { key: "po", label: "Ouro", ring: "from-dnd-gold-bright to-dnd-gold-dim" },
  { key: "pp", label: "Prata", ring: "from-dnd-parchment to-dnd-parchment-muted" },
  { key: "pc", label: "Cobre", ring: "from-dnd-warning to-dnd-warning-deep" },
] as const

/** Ação principal em destaque; as demais como botões discretos. */
const PRIMARY: ItemAction[] = ["usar", "empunhar", "embainhar", "equipar"]

export function Inventory({ pc }: { pc: PcView }) {
  const equipped = pc.inventory.filter((i) => i.equipped)
  const pack = pc.inventory.filter((i) => !i.equipped)
  const { run, pending } = useItemAction()
  return (
    <div className="space-y-6">
      <section aria-label="Moedas">
        <SectionTitle>Bolsa</SectionTitle>
        <ul className="grid grid-cols-3 gap-2">
          {COINS.map((c) => (
            <li key={c.key} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
              <span className={`h-5 w-5 shrink-0 rounded-full bg-gradient-to-br ${c.ring} ring-1 ring-black/60`} aria-hidden />
              <span>
                <span className="font-title block text-lg leading-none text-dnd-parchment tabular-nums">{pc.money[c.key]}</span>
                <span className="text-[10px] text-dnd-parchment-muted">
                  {c.label} ({c.key})
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <ItemList title="Equipado" items={equipped} run={run} pending={pending} />
      <ItemList title="Mochila" items={pack} run={run} pending={pending} />
      {pc.status !== "vivo" && <p className="text-xs text-dnd-parchment-muted italic">{pc.name} está {pc.status} e não pode usar itens.</p>}
    </div>
  )
}

function ItemList({
  title,
  items,
  run,
  pending,
}: {
  title: string
  items: ItemView[]
  run: (action: ItemAction, id: string, name: string) => void
  pending: string | null
}) {
  return (
    <section aria-label={title}>
      <SectionTitle>{title}</SectionTitle>
      {items.length === 0 ? (
        <Empty>Nada aqui.</Empty>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {items.map((i) => (
            <li
              key={i.id}
              className={`rounded-lg border bg-black/40 px-3 py-2 transition ${i.drawn ? "border-dnd-ember/50 shadow-[0_0_18px_-8px_var(--color-dnd-ember)]" : "border-white/10"}`}
            >
              <div className="flex items-start gap-3">
                <span className="font-title flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dnd-gold/30 bg-gradient-to-br from-dnd-obsidian-tint to-black text-dnd-gold">
                  {i.qty > 1 ? `×${i.qty}` : i.name[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm text-dnd-parchment">{i.name}</span>
                    <Chip tone="muted">{i.kind}</Chip>
                    {i.drawn && <Chip tone="ember">em punho</Chip>}
                  </div>
                  {i.effect && <p className="mt-0.5 text-xs text-dnd-gold">{i.effect}</p>}
                  {i.notes && <p className="mt-0.5 text-xs text-dnd-parchment-muted">{i.notes}</p>}
                </div>
              </div>
              {i.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 pl-12">
                  {[...i.actions]
                    .sort((a, b) => Number(PRIMARY.includes(b)) - Number(PRIMARY.includes(a)))
                    .map((a) => (
                      <button
                        key={a}
                        type="button"
                        disabled={pending !== null}
                        onClick={() => run(a, i.id, i.name)}
                        aria-label={`${ACTION_LABEL[a]} ${i.name}`}
                        className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-40 ${
                          PRIMARY.includes(a)
                            ? "border-dnd-gold/50 bg-dnd-gold/10 text-dnd-gold-bright hover:bg-dnd-gold/20"
                            : "border-white/15 text-dnd-parchment-muted hover:bg-white/5 hover:text-dnd-parchment"
                        }`}
                      >
                        {pending === i.id && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                        {ACTION_LABEL[a]}
                      </button>
                    ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
