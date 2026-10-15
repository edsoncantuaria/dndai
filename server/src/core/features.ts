// Características de classe com efeito automático: Retomar o Fôlego, Surto de Ação, Fúria, Mãos Consagradas.
// O que o SRD só descreve em texto (Inspiração de Bardo, Forma Selvagem...) gasta o recurso e o Mestre narra.
import type { Campaign } from "./campaign.ts"
import { cryptoRng, roll, type Rng } from "./dice.ts"
import { put } from "./ledger.ts"
import { character, heal, itemQty, RuleError, setNotes } from "./mechanics.ts"
import { one } from "./db.ts"
import { PcSheetSchema, type PcSheet, resourceList } from "./sheet.ts"

const fail = (m: string): never => { throw new RuleError(m) }

function pc(c: Campaign, who: string): { sheet: PcSheet; hp: number; status: string; name: string } {
  const row = character(c, who)
  if (row.kind !== "pc") fail("só o personagem do jogador tem características de classe")
  if (row.status !== "vivo") fail(`${row.name} não pode usar características (${row.status})`)
  return { sheet: PcSheetSchema.parse(JSON.parse(row.sheet)), hp: row.hp, status: row.status, name: row.name }
}

/** Gasta `n` usos de um recurso (SRD ou calculado). Devolve o que sobrou. */
export function spend(c: Campaign, who: string, key: string, n = 1): string {
  const { sheet } = pc(c, who)
  const res = resourceList(sheet).find((r) => r.key === key) ?? fail(`recurso "${key}" não existe (${resourceList(sheet).map((r) => r.key).join(", ") || "nenhum"})`)
  const used = sheet.uses[key] ?? 0
  if (used + n > res.max) fail(`sem usos de ${res.label}: ${res.max - used}/${res.max} restantes`)
  sheet.uses[key] = used + n
  c.commit("recurso", [put("characters", { id: who, sheet })])
  return `${res.label}: ${res.max - used - n}/${res.max}`
}

export function secondWind(c: Campaign, who = "pc", rng: Rng = cryptoRng): string {
  const { sheet } = pc(c, who)
  if (sheet.class !== "fighter") fail("Retomar o Fôlego é do Guerreiro")
  return c.atomic("retomar-folego", () => {
    const left = spend(c, who, "second_wind_uses")
    const d = roll(`1d10+${sheet.level}`, rng)
    return `${left} · ${heal(c, who, d.total)}`
  })
}

export function actionSurge(c: Campaign, who = "pc"): string {
  const { sheet } = pc(c, who)
  if (sheet.class !== "fighter" || sheet.level < 2) fail("Surto de Ação exige Guerreiro nível 2+")
  return `${spend(c, who, "action_surge")} · uma ação extra neste turno (exceto a ação Usar Magia)`
}

export function rageStart(c: Campaign, who = "pc"): string {
  const { sheet } = pc(c, who)
  if (sheet.class !== "barbarian") fail("Fúria é do Bárbaro")
  if (sheet.notes.raging) fail("já está em Fúria")
  const heavy = sheet.armorProf.length && c.db.prepare("SELECT srd FROM items WHERE owner_char = ? AND equipped = 1").all(who).some((i: any) => i.srd && c.srd.get("equipment", i.srd, "en")?.equipment_categories?.some((x: any) => x.index === "heavy-armor"))
  if (heavy) fail("não se entra em Fúria com armadura pesada")
  return c.atomic("furia", () => {
    const left = spend(c, who, "rage_count")
    setNotes(c, who, { raging: true, concentration: null })
    return `Fúria! ${left} · resistência a contundente/perfurante/cortante, +${sheet.classSpecific.rage_damage_bonus} de dano com Força, vantagem em Força`
  })
}

export function rageEnd(c: Campaign, who = "pc"): string {
  const { sheet } = pc(c, who)
  if (!sheet.notes.raging) fail("não está em Fúria")
  setNotes(c, who, { raging: false })
  return "A Fúria termina."
}

export function layOnHands(c: Campaign, who: string, target: string, amount: number): string {
  const { sheet } = pc(c, who)
  if (sheet.class !== "paladin") fail("Mãos Consagradas é do Paladino")
  if (!Number.isInteger(amount) || amount <= 0) fail("quantidade inválida")
  return c.atomic("maos-consagradas", () => {
    const left = spend(c, who, "lay_on_hands", amount)
    return `${left} · ${heal(c, target, amount)}`
  })
}

/** Usa um item consumível: poção de cura (cura de verdade), kit de curandeiro (estabiliza) ou outro consumível (só gasta; o Mestre narra). */
export function useItem(c: Campaign, who: string, itemId: string, target?: string, rng: Rng = cryptoRng): string {
  const it = one<{ srd: string | null; name: string; qty: number; owner_char: string; props: string }>(c.db, "SELECT srd, name, qty, owner_char, props FROM items WHERE id = ?", itemId) ?? fail(`item "${itemId}" não existe`)
  if (it.owner_char !== who) fail(`${it.name} não está com ${who}`)
  pc(c, who) // quem usa precisa estar consciente
  const e = it.srd ? c.srd.get("equipment", it.srd, "en") : undefined
  if (!e) fail(`${it.name} não tem uso automático (itens mágicos: o Mestre decide o efeito)`)
  const desc: string = e!.description ?? ""
  const to = target ?? who
  return c.atomic("usar-item", () => {
    const heals = /regains? (\d+d\d+(?:\s*\+\s*\d+)?) Hit Points/i.exec(desc)
    if (heals) { itemQty(c, itemId, -1); return `${it.name}: ${heal(c, to, roll(heals[1]!.replace(/\s+/g, ""), rng).total)}` }
    if (e!.index === "healers-kit") {
      const row = character(c, to)
      if (row.hp !== 0 || row.status !== "inconsciente") fail(`${row.name} não está inconsciente com 0 PV`)
      const props = JSON.parse(it.props) as { uses?: number }
      const left = (props.uses ?? 10) - 1
      c.commit("kit-curandeiro", [put("characters", { id: to, status: "estavel" }), put("items", { id: itemId, props: { ...props, uses: left } })])
      if (left <= 0) itemQty(c, itemId, -1)
      return `${row.name} estabilizado com o Kit de Curandeiro (${Math.max(0, left)} usos restantes)`
    }
    if (/^As a Bonus Action, you can drink|potion|elixir|antitoxin/i.test(`${desc} ${e!.name}`)) { itemQty(c, itemId, -1); return `${it.name} usado: ${desc}` }
    return fail(`${it.name} não é consumível`)
  })
}
