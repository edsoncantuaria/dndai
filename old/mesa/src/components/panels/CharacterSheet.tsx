import type { PcView } from "../../api/types"
import { ABILITIES, ABILITY_LABEL, ABILITY_SHORT, signed } from "../../lib/format"
import { Chip, SectionTitle } from "../ui"
import { ResourcePanel } from "./ResourcePanel"

export function CharacterSheet({ pc, locked = false }: { pc: PcView; locked?: boolean }) {
  const sc = pc.spellcasting
  return (
    <div className="space-y-6">
      <div>
        <p className="font-title text-lg text-dnd-gold-bright">{pc.name}</p>
        <p className="text-xs text-dnd-parchment-muted">
          {pc.race} · {pc.classLabel} {pc.level}
          {pc.subclass ? ` · ${pc.subclass}` : ""} · {pc.background}
        </p>
        <p className="mt-1 text-xs text-dnd-parchment-muted">
          XP {pc.xp}
          {pc.nextLevelXp !== null ? ` / ${pc.nextLevelXp}` : ""} · Percepção passiva {pc.passivePerception} · Dados de vida {pc.hitDice.max - pc.hitDice.used}/
          {pc.hitDice.max} d{pc.hitDice.die}
        </p>
      </div>

      <section aria-label="Atributos">
        <SectionTitle>Atributos</SectionTitle>
        <ul className="grid grid-cols-3 gap-2">
          {ABILITIES.map((a) => {
            const v = pc.abilities[a]
            return (
              <li key={a} className="dnd-border-gold flex flex-col items-center rounded-lg py-2" title={ABILITY_LABEL[a]}>
                <span className="text-[10px] tracking-[0.25em] text-dnd-parchment-muted">{ABILITY_SHORT[a]}</span>
                <span className="font-display text-2xl leading-tight text-dnd-parchment">{signed(v.mod)}</span>
                <span className="rounded-full border border-dnd-gold/30 px-2 text-[11px] text-dnd-gold tabular-nums">{v.score}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-label="Salvaguardas">
        <SectionTitle>Salvaguardas</SectionTitle>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
          {ABILITIES.map((a) => {
            const v = pc.abilities[a]
            return (
              <li key={a} className="flex items-center gap-2 text-sm">
                <span className={`h-2 w-2 rotate-45 ${v.proficientSave ? "bg-dnd-gold" : "border border-white/30"}`} aria-label={v.proficientSave ? "proficiente" : undefined} />
                <span className="flex-1 text-dnd-parchment">{ABILITY_LABEL[a]}</span>
                <span className="text-dnd-gold-bright tabular-nums">{signed(v.save)}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-label="Perícias">
        <SectionTitle>Perícias</SectionTitle>
        <ul className="grid gap-y-1">
          {pc.skills.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-sm">
              <span
                className={`h-2 w-2 rotate-45 ${s.expertise ? "bg-dnd-gold-bright ring-2 ring-dnd-gold/40" : s.proficient ? "bg-dnd-gold" : "border border-white/30"}`}
                aria-label={s.expertise ? "especialista" : s.proficient ? "proficiente" : undefined}
              />
              <span className={`flex-1 ${s.proficient ? "text-dnd-parchment" : "text-dnd-parchment-muted"}`}>{s.label}</span>
              <span className="text-[10px] text-dnd-parchment-muted">{ABILITY_SHORT[s.ability]}</span>
              <span className="w-8 text-right text-dnd-gold-bright tabular-nums">{signed(s.bonus)}</span>
            </li>
          ))}
        </ul>
      </section>

      {sc && (
        <section aria-label="Conjuração">
          <SectionTitle>Magias</SectionTitle>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border border-white/10 bg-black/40 py-1.5">
              <p className="text-[10px] text-dnd-parchment-muted">Atributo</p>
              <p className="font-title text-dnd-parchment" title={sc.abilityLabel}>
                {ABILITY_SHORT[sc.ability]}
              </p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/40 py-1.5">
              <p className="text-[10px] text-dnd-parchment-muted">CD</p>
              <p className="font-title text-dnd-parchment">{sc.saveDc}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/40 py-1.5">
              <p className="text-[10px] text-dnd-parchment-muted">Ataque</p>
              <p className="font-title text-dnd-parchment">{signed(sc.attackBonus)}</p>
            </div>
          </div>
          <ul className="mb-3 space-y-1.5">
            {sc.slots.map((s) => (
              <li key={s.level} className="flex items-center gap-3 text-sm">
                <span className="w-16 text-dnd-parchment-muted">Nível {s.level}</span>
                <span className="flex gap-1.5" role="img" aria-label={`${s.max - s.used} de ${s.max} espaços livres`}>
                  {Array.from({ length: s.max }, (_, i) => (
                    <span key={i} className={`h-3 w-3 rotate-45 border border-dnd-arcane/60 ${i < s.max - s.used ? "bg-dnd-arcane shadow-[0_0_8px_var(--color-dnd-arcane)]" : "bg-black/60"}`} />
                  ))}
                </span>
                <span className="ml-auto text-xs text-dnd-parchment-muted tabular-nums">
                  {s.max - s.used}/{s.max}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-1.5">
            {sc.spells.map((s) => (
              <Chip key={s} tone="arcane">
                {s}
              </Chip>
            ))}
          </div>
        </section>
      )}

      <ResourcePanel pc={pc} locked={locked} />
      {(["race", "class", "subclass", "feat"] as const).map((source) => {
        const details = (pc.featureDetails ?? []).filter((f) => f.source === source)
        const title = { race: "Características raciais", class: "Habilidades de classe", subclass: "Habilidades de arquétipo", feat: "Talentos" }[source]
        return details.length > 0 && (
          <section key={source} aria-label={title}>
            <SectionTitle>{title}</SectionTitle>
            {details.map((f) => (
              <details key={f.id} className="mb-2 rounded-md border border-white/10 p-2 text-sm text-dnd-parchment">
                <summary className="cursor-pointer">{f.name}</summary>
                <p className="mt-2 whitespace-pre-line text-dnd-parchment-muted">{f.description}</p>
              </details>
            ))}
          </section>
        )
      })}
      {(pc.pendingChoices ?? []).length > 0 && (
        <section aria-label="Escolhas pendentes">
          <SectionTitle>Escolhas pendentes</SectionTitle>
          <p className="text-xs text-dnd-parchment-muted">Combine suas escolhas com o Mestre no chat.</p>
          {pc.pendingChoices.map((c) => <p key={c.id} className="mt-2 text-sm text-dnd-gold">{c.name}: escolha {c.choose} — {c.options.map((o) => o.name).join(", ")}</p>)}
        </section>
      )}
      {pc.features.some((name) => !(pc.featureDetails ?? []).some((f) => f.name === name)) && (
        <section aria-label="Características">
          <SectionTitle>Características</SectionTitle>
          <ul className="list-inside list-[square] space-y-1 text-sm text-dnd-parchment marker:text-dnd-gold">
            {pc.features.filter((name) => !(pc.featureDetails ?? []).some((f) => f.name === name)).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
