import type { ReactNode } from "react"
import { initials } from "../lib/format"

export function SectionTitle({ children, id, aside }: { children: ReactNode; id?: string; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 id={id} className="font-title text-sm tracking-[0.18em] text-dnd-gold uppercase">
        {children}
      </h2>
      <div className="dnd-divider flex-1" aria-hidden />
      {aside}
    </div>
  )
}

/** Barra de recurso (vida, etc.). `tone` escolhe a cor; `extra` desenha PV temporários por cima. */
export function ResourceBar({
  value,
  max,
  extra = 0,
  tone = "hp",
  label,
  className = "h-2",
}: {
  value: number
  max: number
  extra?: number
  tone?: "hp" | "gold" | "arcane"
  label: string
  className?: string
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const extraPct = max > 0 ? Math.min(100 - pct, (extra / max) * 100) : 0
  const color =
    tone === "gold"
      ? "bg-gradient-to-r from-dnd-gold-dim to-dnd-gold-bright"
      : tone === "arcane"
        ? "bg-gradient-to-r from-dnd-arcane-deep to-dnd-arcane"
        : pct > 50
          ? "bg-gradient-to-r from-dnd-success-deep to-dnd-success"
          : pct > 25
            ? "bg-gradient-to-r from-dnd-warning-deep to-dnd-warning"
            : "bg-gradient-to-r from-dnd-ember-deep to-dnd-ember-hover"
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`relative w-full overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10 ${className}`}
    >
      <div className={`h-full ${color} transition-[width] duration-700`} style={{ width: `${pct}%` }} />
      {extraPct > 0 && (
        <div
          className="absolute top-0 h-full bg-dnd-frost/70 transition-[width] duration-700"
          style={{ left: `${pct}%`, width: `${extraPct}%` }}
        />
      )}
    </div>
  )
}

export function Portrait({ name, src, size = "md", ring = "gold" }: { name: string; src?: string | null; size?: "sm" | "md" | "lg"; ring?: "gold" | "ember" | "muted" | "success" }) {
  const dims = size === "lg" ? "h-16 w-16 text-xl" : size === "sm" ? "h-9 w-9 text-xs" : "h-12 w-12 text-base"
  const ringColor = ring === "ember" ? "ring-dnd-ember" : ring === "muted" ? "ring-white/20" : ring === "success" ? "ring-dnd-success" : "ring-dnd-gold"
  return (
    <div
      className={`${dims} ${ringColor} relative shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-dnd-obsidian-tint to-black ring-2 ring-offset-2 ring-offset-dnd-obsidian`}
      aria-hidden
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-title flex h-full w-full items-center justify-center text-dnd-gold-bright">{initials(name)}</span>
      )}
    </div>
  )
}

export function Chip({ children, tone = "gold", title }: { children: ReactNode; tone?: "gold" | "ember" | "muted" | "success" | "arcane"; title?: string }) {
  const tones = {
    gold: "border-dnd-gold/40 text-dnd-gold-bright bg-dnd-gold/10",
    ember: "border-dnd-ember/50 text-dnd-parchment bg-dnd-ember/15",
    muted: "border-white/15 text-dnd-parchment-muted bg-white/5",
    success: "border-dnd-success/50 text-dnd-parchment bg-dnd-success/15",
    arcane: "border-dnd-arcane/50 text-dnd-parchment bg-dnd-arcane/15",
  }
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="font-narrative py-4 text-center text-sm text-dnd-parchment-muted italic">{children}</p>
}
