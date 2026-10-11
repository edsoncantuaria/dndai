import { ApiError } from "../api/client"
import type { GameView, ItemAction, ItemView, NpcView } from "../api/types"

// Regras de itens do mock, espelhando a spec enviada ao motor (side-session-notes/spec-itens-e-reacoes.md).
// No modo real, tudo isto é do motor; a mesa só desenha `actions` e chama POST /api/actions.

const alarmed = new Set<string>()
const PEACEFUL_PLACES = /taverna|templo|mercado|casa|praça|loja|estalagem|vila/i

function roll(expr: string): { total: number; detail: string } {
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(expr.replace(/\s/g, ""))
  if (!m) return { total: 0, detail: expr }
  const dice = Array.from({ length: Number(m[1]) }, () => 1 + Math.floor(Math.random() * Number(m[2])))
  const bonus = Number(m[3] ?? 0)
  return { total: dice.reduce((a, b) => a + b, 0) + bonus, detail: `${expr} = [${dice.join(", ")}]${bonus ? (bonus > 0 ? `+${bonus}` : bonus) : ""}` }
}

export function attitudeLabel(attitude: number): NpcView["attitudeLabel"] {
  if (attitude <= -50) return "hostil"
  if (attitude <= -10) return "desconfiado"
  if (attitude < 20) return "neutro"
  if (attitude < 60) return "amigável"
  return "leal"
}

const isWeapon = (i: ItemView) => i.kind === "arma" || typeof i.props.damage === "string"

function effectOf(i: ItemView): string | null {
  const p = i.props
  if (typeof p.heal === "string") return `Cura ${p.heal} PV`
  if (typeof p.damage === "string") return `Dano ${p.damage}`
  if (typeof p.ac === "number") return `CA ${p.ac}${typeof p.max_dex === "number" ? ` + Des (máx. ${p.max_dex})` : ""}`
  if (typeof p.ac_bonus === "number") return `CA +${p.ac_bonus}`
  return null
}

function actionsOf(i: ItemView, alive: boolean): ItemAction[] {
  if (!alive) return []
  // Como no motor: `props.heal` faz do item um consumível; arma é kind "arma" ou qualquer item com `props.damage`.
  if (i.kind === "consumível" || typeof i.props.heal === "string") return ["usar", "largar"]
  if (isWeapon(i)) return i.drawn ? ["embainhar", "guardar"] : i.equipped ? ["empunhar", "guardar", "largar"] : ["equipar", "empunhar", "largar"]
  if (i.kind === "armadura" || i.kind === "escudo") return i.equipped ? ["guardar"] : ["equipar", "largar"]
  return ["largar"]
}

/** Recalcula campos derivados (ações válidas, efeito, CA). Chamado a cada commit do mock. */
export function deriveItems(s: GameView) {
  const pc = s.pc
  if (!pc) return
  const alive = pc.status === "vivo"
  for (const i of pc.inventory) {
    i.effect = effectOf(i)
    i.actions = actionsOf(i, alive)
  }
  for (const i of s.location?.items ?? []) {
    i.effect = effectOf(i)
    i.actions = []
  }
  const armor = pc.inventory.find((i) => i.equipped && i.kind === "armadura")
  const shield = pc.inventory.find((i) => i.equipped && i.kind === "escudo")
  const dex = pc.abilities.des.mod
  const base = armor && typeof armor.props.ac === "number" ? armor.props.ac + Math.min(dex, Number(armor.props.max_dex ?? 99)) : 10 + dex
  pc.ac = base + (shield ? Number(shield.props.ac_bonus ?? 2) : 0)
}

/** Aplica a ação; devolve o resumo mecânico e uma narração de exemplo para o Mestre simulado. */
export function applyItemAction(s: GameView, action: ItemAction, itemId: string): { text: string; narration: string } {
  const pc = s.pc
  if (!pc) throw new ApiError(409, "Não há herói nesta campanha.")
  const item = pc.inventory.find((i) => i.id === itemId)
  if (!item) throw new ApiError(404, "Esse item não está com você.")
  if (pc.status !== "vivo") throw new ApiError(409, `${pc.name} está ${pc.status} e não pode agir.`)
  if (!item.actions.includes(action)) throw new ApiError(400, `Não dá para ${action} ${item.name} agora.`)

  switch (action) {
    case "usar": {
      const heal = typeof item.props.heal === "string" ? roll(item.props.heal) : null
      const before = pc.hp
      if (heal) pc.hp = Math.min(pc.maxHp, pc.hp + heal.total)
      item.qty -= 1
      if (item.qty <= 0) pc.inventory = pc.inventory.filter((i) => i !== item)
      const left = item.qty > 0 ? ` Restam ${item.qty}.` : " Acabou."
      return {
        text: heal ? `${item.name}: ${heal.detail} → ${pc.hp - before} PV (${before} → ${pc.hp}).${left}` : `${item.name} usado.${left}`,
        narration: heal
          ? "Você leva o frasco aos lábios. O líquido rubro desce morno e amargo, e as feridas se fecham com um formigar que lembra brasas se apagando."
          : `Você usa ${item.name}.`,
      }
    }
    case "equipar":
    case "empunhar": {
      // Um só item equipado por tipo (arma, armadura, escudo).
      const slot = (i: ItemView) => (isWeapon(i) ? "arma" : i.kind)
      for (const other of pc.inventory) if (other !== item && slot(other) === slot(item)) Object.assign(other, { equipped: false, drawn: false })
      item.equipped = true
      if (action === "equipar") return { text: `${item.name} equipado.`, narration: `Você ajusta ${item.name} ao corpo, pronta para o que vier.` }
      item.drawn = true
      const reacted = reactToDrawnWeapon(s)
      return {
        text: `${item.name} em punho.${reacted.length ? ` Reações: ${reacted.join("; ")}.` : ""}`,
        narration: `${item.name} sai com um sussurro de couro e ferro. ${
          reacted.length ? "A conversa ao redor morre de repente; cadeiras arrastam, olhares se desviam e alguém leva a mão à cintura." : "Ninguém está perto o bastante para se importar."
        }`,
      }
    }
    case "embainhar":
      item.drawn = false
      for (const n of s.present) n.reaction = null
      return { text: `${item.name} guardada na bainha.`, narration: "Você guarda a arma. Os ombros ao redor relaxam aos poucos, mas os olhares ainda medem cada gesto seu." }
    case "guardar":
      Object.assign(item, { equipped: false, drawn: false })
      if (isWeapon(item)) for (const n of s.present) n.reaction = null
      return { text: `${item.name} guardado na mochila.`, narration: `Você guarda ${item.name} na mochila.` }
    case "largar":
      pc.inventory = pc.inventory.filter((i) => i !== item)
      s.location?.items.push({ ...item, equipped: false, drawn: false })
      return { text: `${item.name} largado no chão.`, narration: `${item.name} cai no chão com um baque seco.` }
  }
}

/** Arma em punho: NPCs não hostis num local pacífico ficam com medo ou tensos (atitude cai); hostis encaram como desafio. */
function reactToDrawnWeapon(s: GameView): string[] {
  const peaceful = PEACEFUL_PLACES.test(`${s.location?.kind ?? ""} ${s.location?.parent?.name ?? ""}`)
  const out: string[] = []
  for (const n of s.present) {
    if (n.companion) continue
    if (n.attitudeLabel === "hostil") n.reaction = "encara a arma como um desafio"
    else if (peaceful) {
      // A perda de atitude acontece uma vez por NPC; empunhar de novo não pune outra vez.
      if (!alarmed.has(n.id)) {
        alarmed.add(n.id)
        n.attitude = Math.max(-100, n.attitude - 15)
        n.attitudeLabel = attitudeLabel(n.attitude)
      }
      n.reaction = n.attitude > 0 ? "com medo da sua arma" : "tenso, pronto para brigar"
    } else n.reaction = "de olho na sua arma"
    out.push(`${n.name} ${n.reaction}`)
  }
  return out
}
