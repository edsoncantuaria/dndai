// Conjuração: valida (SRD, conhecida/preparada, espaço) e automatiza o que o SRD descreve em dados
// (dano por nível de espaço, ataque de magia, salvaguarda e metade do dano lidos da descrição).
// Efeitos sem dados no SRD (utilidade, condição, cura) ficam para o Mestre, com o espaço já gasto.
import type { Campaign } from "./campaign.ts"
import { cryptoRng, roll, type Rng } from "./dice.ts"
import { RuleError, character, damage, save, useSlot, type Mode } from "./mechanics.ts"
import { pcView } from "./pc.ts"
import type { Ability } from "./sheet.ts"
import { put } from "./ledger.ts"

const fail = (m: string): never => { throw new RuleError(m) }
const ABIL: Record<string, Ability> = { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" }

export interface CastResult { lines: string[]; slotUsed?: number; manual: boolean; description: string }

function cantripDice(base: string, level: number): string {
  const mult = 1 + Number(level >= 5) + Number(level >= 11) + Number(level >= 17)
  return base.replace(/^(\d+)d/, (_, n) => `${Number(n) * mult}d`)
}

function dicePerSlot(spell: any, slot: number): string | undefined {
  const by: Record<string, string> | undefined = spell.damage?.damage_at_slot_level
  if (!by) return undefined
  const keys = Object.keys(by).map(Number).sort((a, b) => a - b)
  const base = keys.filter((k) => k <= slot).pop()
  if (base === undefined) return by[String(keys[0])]
  let dice = by[String(base)]!
  const up = /increases by (\d+)d(\d+)/i.exec(spell.higher_level ?? "")
  if (up && slot > base && keys.length === 1) dice = dice.replace(/^(\d+)d(\d+)/, (_, n, d) => `${Number(n) + Number(up[1]) * (slot - base)}d${d}`)
  return dice
}

export function cast(c: Campaign, who: string, spellIndex: string, o: { slot?: number; targets?: string[]; mode?: Mode } = {}, rng: Rng = cryptoRng): CastResult {
  return c.atomic("conjurar", () => {
    const v = pcView(c, who)
    if (v.row.status !== "vivo") fail(`${v.row.name} não pode conjurar (${v.row.status})`)
    const sp = c.srd.get("spells", spellIndex, "en") ?? fail(`magia "${spellIndex}" não existe no SRD (não invente magias)`)
    const sheet = v.sheet
    if (!sheet.spell) fail(`${v.row.name} não conjura`)
    const isCantrip = sp.level === 0
    const known = isCantrip ? sheet.spell!.cantrips : sheet.spell!.prepared
    if (!known.includes(sp.index)) fail(`${v.row.name} não ${isCantrip ? "conhece" : "tem preparada"} ${sp.name}`)
    if (v.sheet.conditions.some((x) => ["incapacitated", "unconscious", "paralyzed", "stunned", "petrified"].includes(x))) fail("condição impede a conjuração")
    let slot = 0
    const lines: string[] = []
    if (!isCantrip) {
      slot = o.slot ?? sp.level
      if (slot < sp.level) fail(`${sp.name} exige espaço de nível ${sp.level} ou mais`)
      lines.push(`${sp.name}: ${useSlot(c, who, slot)}`)
    }
    const targets = o.targets ?? []
    for (const t of targets) character(c, t)
    const dice0 = isCantrip ? (sp.damage?.damage_at_slot_level?.["0"] ? cantripDice(sp.damage.damage_at_slot_level["0"], sheet.level) : undefined) : dicePerSlot(sp, slot)
    const type = sp.damage?.damage_type?.index ?? ""
    let manual = true
    if (dice0 && targets.length) {
      manual = false
      const saveAb = ABIL[(/\b(strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw/i.exec(sp.description) ?? [])[1]?.toLowerCase() ?? ""]
      const half = /half as much damage/i.test(sp.description)
      const total = roll(dice0, rng)
      for (const t of targets) {
        const tr = character(c, t)
        if (saveAb) {
          const r = save(c, t, saveAb, v.derived.spellDc!, o.mode ?? "normal", rng)
          lines.push(r.text)
          const dmg = r.success ? (half ? Math.floor(total.total / 2) : 0) : total.total
          lines.push(dmg ? damage(c, t, dmg, type) : `${tr.name}: sem dano`)
        } else if (sp.attack_type) {
          const bonus = v.derived.spellAttack!
          const a = rollD20Local(rng, o.mode ?? "normal")
          const hit = a.natural !== 1 && (a.natural === 20 || a.natural + bonus >= tr.ac)
          const dmg = hit ? roll(dice0, rng, a.natural === 20).total : 0
          c.commit("ataque-magico", [put("rolls", { turn: c.turn, who, kind: "d20", label: `Ataque de magia: ${sp.name}`, expr: `1d20+${bonus}`, total: a.natural + bonus, natural: a.natural, dc: tr.ac, success: Number(hit), result: { faces: a.seen.map((x) => ({ sides: 20, value: x, kept: x === a.natural })) } })])
          lines.push(`${v.row.name} → ${tr.name} (${sp.name}): ${a.natural}+${bonus}=${a.natural + bonus} vs CA ${tr.ac} → ${hit ? (a.natural === 20 ? "CRÍTICO" : "acerta") : "erra"}`)
          if (dmg) lines.push(damage(c, t, dmg, type, { crit: a.natural === 20 }))
        } else lines.push(damage(c, t, total.total, type))
      }
    }
    lines.push(manual ? `Efeito sem automação no SRD: resolva pela descrição (${sp.name}) e grave as consequências por ops.` : "")
    return { lines: lines.filter(Boolean), slotUsed: slot || undefined, manual, description: sp.description }
  })
}

function rollD20Local(rng: Rng, mode: Mode) {
  const a = rng(20)
  if (mode === "normal") return { natural: a, seen: [a] }
  const b = rng(20)
  return { natural: mode === "vantagem" ? Math.max(a, b) : Math.min(a, b), seen: [a, b] }
}
