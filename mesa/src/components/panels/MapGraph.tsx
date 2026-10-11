import { useMemo } from "react"
import type { GameView } from "../../api/types"
import { minutesLabel } from "../../lib/format"
import { Empty, SectionTitle } from "../ui"

const SIZE = 520
const CENTER = SIZE / 2
const RING = 104

type Pos = { x: number; y: number }

/**
 * O contrato não traz coordenadas: desenha o grafo em anéis concêntricos pela distância (em saltos)
 * a partir do local atual. Locais sem ligação conhecida vão para o anel externo.
 */
function layout(map: GameView["map"]): Map<string, Pos> {
  const adj = new Map<string, string[]>()
  for (const p of map.places) adj.set(p.id, [])
  for (const l of map.links) {
    adj.get(l.from)?.push(l.to)
    adj.get(l.to)?.push(l.from)
  }
  const start = map.places.find((p) => p.current)?.id ?? map.places[0]?.id
  const depth = new Map<string, number>()
  const angleOf = new Map<string, number>()
  const rings: string[][] = []
  if (start) {
    depth.set(start, 0)
    rings.push([start])
    for (let d = 0; rings[d]?.length; d++) {
      const next: string[] = []
      for (const id of rings[d]) for (const n of adj.get(id) ?? []) if (!depth.has(n)) (depth.set(n, d + 1), next.push(n))
      if (next.length) rings.push(next)
    }
  }
  const orphans = map.places.filter((p) => !depth.has(p.id)).map((p) => p.id)
  if (orphans.length) rings.push(orphans)

  const pos = new Map<string, Pos>()
  rings.forEach((ids, d) => {
    if (d === 0 && ids.length === 1) {
      pos.set(ids[0], { x: CENTER, y: CENTER })
      angleOf.set(ids[0], -Math.PI / 2)
      return
    }
    // Ordena pelo ângulo do vizinho já posicionado para reduzir cruzamentos.
    const parentAngle = (id: string) => {
      const a = (adj.get(id) ?? []).map((n) => angleOf.get(n)).find((v) => v !== undefined)
      return a ?? 0
    }
    const sorted = [...ids].sort((a, b) => parentAngle(a) - parentAngle(b))
    const r = Math.min(RING * (d || 1), CENTER - 40)
    const offset = d * 0.6 - Math.PI / 2
    sorted.forEach((id, i) => {
      const angle = offset + (i / sorted.length) * Math.PI * 2
      angleOf.set(id, angle)
      pos.set(id, { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) })
    })
  })
  return pos
}

export function MapGraph({ map }: { map: GameView["map"] }) {
  const pos = useMemo(() => layout(map), [map])
  const name = (id: string) => map.places.find((p) => p.id === id)?.name ?? id
  if (map.places.length === 0) return <Empty>Nenhum lugar descoberto ainda.</Empty>

  return (
    <div className="space-y-5">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full rounded-xl border border-dnd-gold/15 bg-[radial-gradient(circle_at_50%_50%,rgb(212_175_55/0.08),transparent_70%)]" aria-hidden>
        {[1, 2].map((k) => (
          <circle key={k} cx={CENTER} cy={CENTER} r={RING * k} fill="none" stroke="rgb(212 175 55 / 0.08)" strokeDasharray="2 6" />
        ))}
        {map.links.map((l) => {
          const a = pos.get(l.from)
          const b = pos.get(l.to)
          if (!a || !b) return null
          return (
            <g key={`${l.from}-${l.to}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgb(212 175 55 / 0.35)" strokeWidth={1.5} />
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} textAnchor="middle" className="fill-dnd-parchment-muted" fontSize={10} opacity={0.8}>
                {minutesLabel(l.minutes)}
              </text>
            </g>
          )
        })}
        {map.places.map((p) => {
          const at = pos.get(p.id)
          if (!at) return null
          return (
            <g key={p.id} transform={`translate(${at.x} ${at.y})`}>
              {p.current && (
                <circle r={18} fill="none" stroke="var(--color-dnd-gold-bright)" strokeWidth={1.5}>
                  <animate attributeName="r" values="14;22;14" dur="2.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.2;0.9" dur="2.4s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                r={p.current ? 11 : 8}
                fill={p.current ? "var(--color-dnd-ember)" : p.visited ? "var(--color-dnd-gold)" : "var(--color-dnd-obsidian)"}
                stroke={p.visited || p.current ? "var(--color-dnd-gold-bright)" : "var(--color-dnd-parchment-muted)"}
                strokeDasharray={p.visited || p.current ? undefined : "3 3"}
                strokeWidth={1.5}
              />
              {!p.visited && !p.current && (
                <text y={3.5} textAnchor="middle" fontSize={10} className="fill-dnd-parchment-muted">
                  ?
                </text>
              )}
              <text
                y={at.y < CENTER - 1 ? -16 : p.current ? 28 : 23}
                textAnchor={at.x > SIZE * 0.72 ? "end" : at.x < SIZE * 0.28 ? "start" : "middle"}
                x={at.x > SIZE * 0.72 ? 10 : at.x < SIZE * 0.28 ? -10 : 0}
                fontSize={p.current ? 15 : 13}
                className={p.current ? "fill-dnd-gold-bright" : p.visited ? "fill-dnd-parchment" : "fill-dnd-parchment-muted"}
                style={{ fontFamily: "var(--font-title)", paintOrder: "stroke", stroke: "#050506", strokeWidth: 3 }}
              >
                {p.name}
              </text>
            </g>
          )
        })}
      </svg>

      <section aria-label="Locais descobertos">
        <SectionTitle>Locais</SectionTitle>
        <ul className="space-y-1.5 text-sm">
          {map.places.map((p) => (
            <li key={p.id} className="flex items-center gap-2" aria-current={p.current ? "location" : undefined}>
              <span className={`h-2.5 w-2.5 rotate-45 ${p.current ? "bg-dnd-ember" : p.visited ? "bg-dnd-gold" : "border border-dnd-parchment-muted"}`} aria-hidden />
              <span className={p.current ? "text-dnd-gold-bright" : p.visited ? "text-dnd-parchment" : "text-dnd-parchment-muted"}>{p.name}</span>
              <span className="inline-block text-[11px] text-dnd-parchment-muted first-letter:uppercase">
                {p.kind}
                {p.parent ? ` · em ${name(p.parent)}` : ""}
                {p.current ? " · você está aqui" : p.visited ? "" : " · não visitado"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
