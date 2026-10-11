import { useEffect, useRef, useState, type ReactNode } from "react"
import { Dices, FlaskConical, Footprints, Shield, Sparkles, Sword, Zap } from "lucide-react"
import type { PcView } from "../api/types"
import { ACTION_LABEL, useItemAction } from "../hooks/useItemAction"
import { signed } from "../lib/format"
import { playCue } from "../lib/sfx"
import { Chip, Portrait, ResourceBar } from "./ui"

function Stat({ icon, label, value, title }: { icon: ReactNode; label: string; value: string | number; title?: string }) {
  return (
    <div title={title ?? label} className="flex min-w-[3.25rem] flex-col items-center rounded-md border border-white/10 bg-black/50 px-2 py-1">
      <span className="flex items-center gap-1 text-[9px] tracking-widest text-dnd-parchment-muted uppercase">
        {icon}
        {label}
      </span>
      <span className="font-title text-base leading-tight text-dnd-parchment tabular-nums">{value}</span>
    </div>
  )
}

function Pips({ total, filled, tone, label }: { total: number; filled: number; tone: "gold" | "success" | "ember" | "arcane"; label: string }) {
  const color = { gold: "bg-dnd-gold", success: "bg-dnd-success", ember: "bg-dnd-ember", arcane: "bg-dnd-arcane" }[tone]
  return (
    <span className="flex gap-1" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-2.5 w-2.5 rotate-45 border border-white/30 ${i < filled ? color : "bg-black/60"}`} />
      ))}
    </span>
  )
}

/** Mostra "-5" / "+3" flutuando quando os PV mudam, com som. */
function useHpDelta(hp: number) {
  const prev = useRef(hp)
  const [delta, setDelta] = useState<{ value: number; key: number } | null>(null)
  useEffect(() => {
    const diff = hp - prev.current
    prev.current = hp
    if (diff === 0) return
    playCue(diff < 0 ? "hpLoss" : "hpGain")
    setDelta({ value: diff, key: Date.now() })
  }, [hp])
  return delta
}

export function Hotbar({ pc, pendingRolls, onOpenRoll }: { pc: PcView; pendingRolls: number; onOpenRoll: () => void }) {
  const delta = useHpDelta(pc.hp)
  const down = pc.status !== "vivo"
  const slots = pc.spellcasting?.slots.filter((s) => s.max > 0) ?? []
  const { run, pending } = useItemAction()
  // Slots rápidos estilo BG3: a arma equipada (empunhar/embainhar) e os consumíveis usáveis.
  const weapon = pc.inventory.find((i) => i.equipped && (i.kind === "arma" || typeof i.props.damage === "string"))
  const weaponAction = weapon?.actions.find((a) => a === "empunhar" || a === "embainhar")
  const consumables = pc.inventory.filter((i) => i.actions.includes("usar")).slice(0, 4)

  return (
    <footer
      aria-label="Herói"
      className="border-t border-dnd-gold/25 bg-gradient-to-t from-black via-dnd-obsidian/95 to-dnd-obsidian/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-5">
        <div className={`flex min-w-0 items-center gap-3 ${delta && delta.value < 0 ? "dnd-shake" : ""}`} key={delta?.key}>
          <div className="relative">
            <Portrait name={pc.name} src={pc.portrait} size="lg" ring={down ? "ember" : "gold"} />
            {delta && (
              <span
                className={`dnd-float-up font-display pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 text-xl font-bold ${delta.value < 0 ? "text-dnd-ember-hover" : "text-dnd-success"}`}
                aria-hidden
              >
                {delta.value > 0 ? `+${delta.value}` : delta.value}
              </span>
            )}
            <span className="font-title absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border border-dnd-gold bg-dnd-obsidian text-xs text-dnd-gold-bright">
              {pc.level}
            </span>
          </div>
          <div className="w-44 min-w-0 sm:w-64">
            <p className="font-title truncate text-sm text-dnd-gold-bright">{pc.name}</p>
            <p className="truncate text-[11px] text-dnd-parchment-muted">
              {pc.race} · {pc.classLabel}
              {pc.subclass ? ` (${pc.subclass})` : ""}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <ResourceBar value={pc.hp} max={pc.maxHp} extra={pc.tempHp} label="Pontos de vida" className="h-3" />
              <span className="shrink-0 text-xs font-semibold text-dnd-parchment tabular-nums">
                {pc.hp}/{pc.maxHp}
                {pc.tempHp > 0 && <span className="text-dnd-frost"> +{pc.tempHp}</span>}
              </span>
            </div>
            {pc.nextLevelXp !== null && (
              <div className="mt-1 flex items-center gap-2" title={`XP ${pc.xp} / ${pc.nextLevelXp}`}>
                <ResourceBar value={pc.xp} max={pc.nextLevelXp} tone="gold" label="Experiência" className="h-1" />
                {pc.levelUpReady && <span className="text-[10px] font-semibold whitespace-nowrap text-dnd-gold-bright">Subir de nível!</span>}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Stat icon={<Shield className="h-2.5 w-2.5" aria-hidden />} label="CA" value={pc.ac} title="Classe de Armadura" />
          <Stat icon={<Zap className="h-2.5 w-2.5" aria-hidden />} label="Inic" value={signed(pc.initiative)} title="Iniciativa" />
          <Stat icon={<Footprints className="h-2.5 w-2.5" aria-hidden />} label="Desl" value={`${pc.speed} m`} title="Deslocamento" />
          <Stat icon={null} label="Prof" value={signed(pc.profBonus)} title="Bônus de proficiência" />
        </div>

        {(weapon || consumables.length > 0) && (
          <div className="flex items-center gap-1.5" aria-label="Ações rápidas">
            {weapon && (
              <button
                type="button"
                disabled={!weaponAction || pending !== null}
                onClick={() => weaponAction && run(weaponAction, weapon.id, weapon.name)}
                title={weaponAction ? `${ACTION_LABEL[weaponAction]} ${weapon.name}` : weapon.name}
                aria-label={weaponAction ? `${ACTION_LABEL[weaponAction]} ${weapon.name}` : weapon.name}
                aria-pressed={weapon.drawn}
                className={`relative flex h-12 w-12 flex-col items-center justify-center rounded-md border transition disabled:opacity-50 ${
                  weapon.drawn ? "border-dnd-ember bg-dnd-ember-deep/50 text-dnd-parchment shadow-[0_0_16px_-4px_var(--color-dnd-ember)]" : "border-dnd-gold/30 bg-black/50 text-dnd-gold hover:border-dnd-gold"
                }`}
              >
                <Sword className="h-5 w-5" aria-hidden />
                <span className="text-[8px] tracking-wide uppercase">{weapon.drawn ? "em punho" : "bainha"}</span>
              </button>
            )}
            {consumables.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={pending !== null}
                onClick={() => run("usar", c.id, c.name)}
                title={`Usar ${c.name}${c.effect ? ` (${c.effect})` : ""}`}
                aria-label={`Usar ${c.name}, ${c.qty} restante${c.qty > 1 ? "s" : ""}`}
                className="relative flex h-12 w-12 items-center justify-center rounded-md border border-dnd-gold/30 bg-black/50 text-dnd-ember-hover transition hover:border-dnd-gold disabled:opacity-50"
              >
                <FlaskConical className="h-5 w-5" aria-hidden />
                <span className="absolute right-0.5 bottom-0 text-[10px] font-semibold text-dnd-parchment tabular-nums">{c.qty}</span>
              </button>
            ))}
          </div>
        )}

        {down && (
          <div className="flex flex-col gap-1 rounded-md border border-dnd-ember/40 bg-dnd-ember/10 px-3 py-1.5">
            <span className="dnd-label text-dnd-ember-hover">{pc.status}</span>
            {pc.status === "inconsciente" && (
              <div className="flex items-center gap-2 text-[10px] text-dnd-parchment-muted">
                Sucessos <Pips total={3} filled={pc.death.success} tone="success" label={`${pc.death.success} sucessos em testes de morte`} />
                Falhas <Pips total={3} filled={pc.death.fail} tone="ember" label={`${pc.death.fail} falhas em testes de morte`} />
              </div>
            )}
          </div>
        )}

        {slots.length > 0 && (
          <div className="hidden flex-col gap-1 md:flex" aria-label="Espaços de magia">
            {slots.map((s) => (
              <div key={s.level} className="flex items-center gap-2 text-[10px] text-dnd-parchment-muted">
                <Sparkles className="h-3 w-3 text-dnd-arcane" aria-hidden /> {s.level}º
                <Pips total={s.max} filled={s.max - s.used} tone="arcane" label={`Nível ${s.level}: ${s.max - s.used} de ${s.max} espaços`} />
              </div>
            ))}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {pc.conditions.map((c) => (
            <Chip key={c} tone={/envenen|amedront|cego|paralis|caído|agarr|incons|exaust/i.test(c) ? "ember" : "arcane"}>
              {c}
            </Chip>
          ))}
        </div>

        {pendingRolls > 0 && (
          <button
            type="button"
            onClick={onOpenRoll}
            className="animate-pulse-gold flex items-center gap-2 rounded-md border border-dnd-gold bg-dnd-ember-deep/60 px-3 py-2 text-sm font-semibold text-dnd-parchment"
          >
            <Dices className="h-4 w-4 text-dnd-gold-bright" aria-hidden />
            {pendingRolls === 1 ? "Rolagem pendente" : `${pendingRolls} rolagens pendentes`}
          </button>
        )}
      </div>
    </footer>
  )
}
