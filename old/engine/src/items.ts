// Ações de item do jogador (mesa ou Mestre): o motor aplica a regra; o Mestre só narra o resultado.
import { all, type DB, index, log, one } from "./db.ts"
import { roll } from "./dice.ts"
import { heal } from "./mechanics.ts"
import { attitudeLabel, mod, norm } from "./rules.ts"
import { getCharacter, getPlace, type ItemRow, now, requirePc } from "./world.ts"

export const ITEM_ACTIONS = ["usar", "equipar", "guardar", "empunhar", "embainhar", "largar"] as const
export type ItemAction = (typeof ITEM_ACTIONS)[number]

const INCAPACITATED = ["inconsciente", "paralisado", "petrificado", "atordoado", "incapacitado"]
// Lugares onde sacar uma arma assusta as pessoas.
const PEACEFUL = /taverna|estalagem|templo|santu|mercado|feira|loja|casa|praça|vila|aldeia|cidade|porto|biblioteca|palácio|corte/i
// Um NPC reage com perda de atitude no máximo uma vez a cada hora de jogo (reempunhar na mesma cena não pune de novo).
const REACTION_COOLDOWN_MIN = 60

interface Props {
  heal?: string
  damage?: string
  ac?: number
  max_dex?: number
  ac_bonus?: number
  [k: string]: unknown
}

function props(i: ItemRow): Props {
  return JSON.parse(i.props) as Props
}

const RARITY_ALIASES: Record<string, string> = {
  comum: "comum", common: "comum",
  incomum: "incomum", uncommon: "incomum",
  raro: "raro", rare: "raro",
  muitoraro: "muito raro", veryrare: "muito raro",
  lendario: "lendário", legendary: "lendário",
  artefato: "artefato", artifact: "artefato",
}

/** Raridade para a mesa. Só valores conhecidos; qualquer outro texto vira null. */
export function itemRarity(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  return RARITY_ALIASES[norm(raw)] ?? null
}

/** Resumo do efeito mecânico do item (exibido na mesa). */
export function itemEffect(i: ItemRow): string | null {
  const p = props(i)
  if (typeof p.heal === "string") return `Cura ${p.heal} PV`
  if (typeof p.damage === "string") return `Dano ${p.damage}${typeof p.damage_type === "string" ? ` ${p.damage_type}` : ""}`
  if (typeof p.ac === "number") return `CA ${p.ac}${typeof p.max_dex === "number" ? ` + Des (máx. ${p.max_dex})` : " + Des"}`
  if (typeof p.ac_bonus === "number") return `CA +${p.ac_bonus}`
  return null
}

function isWeapon(i: ItemRow): boolean {
  return i.kind === "arma" || typeof props(i).damage === "string"
}

function isWearable(i: ItemRow): boolean {
  return i.kind === "armadura" || i.kind === "escudo"
}

/** Ações válidas agora para um item do PC (a mesa só mostra estas). */
export function itemActions(db: DB, i: ItemRow): ItemAction[] {
  if (!i.owner_char) return []
  const c = getCharacter(db, i.owner_char)
  if (c.kind !== "pc" || c.status !== "vivo" || c.sheet.conditions.some((x) => INCAPACITATED.includes(x))) return []
  if (i.kind === "consumível" || typeof props(i).heal === "string") return ["usar", "largar"]
  if (isWeapon(i)) return i.drawn ? ["embainhar", "guardar"] : i.equipped ? ["empunhar", "guardar", "largar"] : ["equipar", "empunhar", "largar"]
  if (isWearable(i)) return i.equipped ? ["guardar"] : ["equipar", "largar"]
  return ["largar"]
}

/** CA a partir da armadura/escudo equipados — só quando esses itens declaram `ac`/`ac_bonus`. */
function recomputeAc(db: DB, pcId: string, changed: ItemRow): string | null {
  const p = props(changed)
  if (typeof p.ac !== "number" && typeof p.ac_bonus !== "number") return null
  const c = getCharacter(db, pcId)
  const worn = all<ItemRow>(db, "SELECT * FROM items WHERE owner_char = ? AND equipped = 1", pcId)
  const armor = worn.find((i) => i.kind === "armadura" && typeof props(i).ac === "number")
  const dex = mod(c.sheet.abilities.des)
  const base = armor ? props(armor).ac! + Math.min(dex, props(armor).max_dex ?? 99) : 10 + dex
  const shields = worn.filter((i) => i.kind === "escudo").reduce((sum, i) => sum + (props(i).ac_bonus ?? 2), 0)
  const ac = base + shields
  db.prepare("UPDATE characters SET ac = ? WHERE id = ?").run(ac, pcId)
  return c.ac === ac ? null : `CA ${c.ac} → ${ac}`
}

export function clearReactions(db: DB, placeId: string | null): void {
  if (!placeId) return
  db.prepare("UPDATE reactions SET text = '' WHERE npc_id IN (SELECT id FROM characters WHERE place_id = ?)").run(placeId)
}

/** Arma em punho: quem está em cena reage conforme o lugar, a atitude e o papel (guardas advertem). */
export function reactToDrawnWeapon(db: DB, pcName: string, weapon: string, placeId: string | null): string[] {
  if (!placeId) return []
  const place = getPlace(db, placeId)
  const parent = place.parent_id ? getPlace(db, place.parent_id) : null
  const peaceful = PEACEFUL.test(`${place.kind} ${place.name} ${parent?.kind ?? ""} ${parent?.name ?? ""}`)
  const t = now(db)
  const out: string[] = []
  for (const n of all<{ id: string; name: string; summary: string; attitude: number }>(
    db, "SELECT id, name, summary, attitude FROM characters WHERE kind = 'npc' AND companion = 0 AND status = 'vivo' AND place_id = ?", placeId
  )) {
    const guard = /guarda|soldad|sentinela|patrulh|vigia|miliciano/i.test(`${n.name} ${n.summary}`)
    const prev = one<{ penalized_at: number }>(db, "SELECT penalized_at FROM reactions WHERE npc_id = ?", n.id)
    const fresh = !prev || t - prev.penalized_at >= REACTION_COOLDOWN_MIN
    let reaction: string
    let delta = 0
    if (attitudeLabel(n.attitude) === "hostil") reaction = "encara a arma como um desafio"
    else if (guard) {
      reaction = "adverte para guardar a arma, mão no cabo da própria"
      delta = fresh ? -20 : 0
    } else if (peaceful) {
      delta = fresh ? -15 : 0
      reaction = n.attitude + delta > 0 ? "com medo da sua arma" : "tenso, pronto para brigar"
    } else reaction = "de olho na sua arma"
    const attitude = Math.max(-100, n.attitude + delta)
    if (delta) {
      db.prepare("UPDATE characters SET attitude = ? WHERE id = ?").run(attitude, n.id)
      const text = `${pcName} sacou ${weapon} em ${place.name} (atitude ${delta})`
      const res = db.prepare("INSERT INTO memories(npc_id, text, importance, turn, at_min) VALUES(?,?,2,(SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'turn'),?)").run(n.id, text, t)
      index(db, `mem:${res.lastInsertRowid}`, "memória", `${n.name}: ${text}`)
    }
    db.prepare(
      "INSERT INTO reactions(npc_id, text, penalized_at) VALUES(?,?,?) ON CONFLICT(npc_id) DO UPDATE SET text = excluded.text, penalized_at = CASE WHEN ? THEN excluded.penalized_at ELSE penalized_at END"
    ).run(n.id, reaction, t, delta ? 1 : 0)
    out.push(`${n.name} ${reaction}${delta ? ` (atitude ${n.attitude} → ${attitude}, ${attitudeLabel(attitude)})` : ""}`)
  }
  return out
}

function entityCode(db: DB, id: string): string {
  return one<{ code: string }>(db, "SELECT code FROM codes WHERE entity = ?", id)?.code ?? id
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()

/**
 * Item do PC por id curto (i3), id longo, nome exato ou parte única do nome ("espada" → "Espada longa").
 * Só entre os itens do próprio PC, então a parte do nome não acha nada fora do inventário.
 */
function pcItem(db: DB, pcId: string, ref: string): ItemRow | undefined {
  const id = one<{ entity: string }>(db, "SELECT entity FROM codes WHERE code = ?", ref)?.entity ?? ref
  const exact = one<ItemRow>(db, "SELECT * FROM items WHERE owner_char = ? AND (id = ? OR lower(name) = lower(?))", pcId, id, ref)
  if (exact) return exact
  const want = fold(ref)
  const partial = all<ItemRow>(db, "SELECT * FROM items WHERE owner_char = ? AND qty > 0", pcId).filter((i) => fold(i.name).includes(want))
  return partial.length === 1 ? partial[0] : undefined
}

/** Aplica uma ação de item do PC. Deve rodar dentro de uma transação. */
export function applyItemAction(db: DB, action: string, itemRef: string): string {
  if (!(ITEM_ACTIONS as readonly string[]).includes(action)) throw new Error(`Ação inválida "${action}". Use: ${ITEM_ACTIONS.join(", ")}.`)
  const pc = requirePc(db)
  const item = pcItem(db, pc.id, itemRef)
  if (!item) {
    const owned = all<{ id: string; name: string }>(db, "SELECT id, name FROM items WHERE owner_char = ? AND qty > 0", pc.id)
    const list = owned.map((i) => `${i.name} [${entityCode(db, i.id)}]`).join(", ")
    // O id existe, mas o item está em outro lugar (largado, com um NPC): diga onde, para o Mestre pegar com item.give.
    const id = one<{ entity: string }>(db, "SELECT entity FROM codes WHERE code = ?", itemRef)?.entity ?? itemRef
    const away = one<{ name: string; owner_char: string | null; owner_place: string | null }>(db, "SELECT name, owner_char, owner_place FROM items WHERE id = ?", id)
    const where = away ? ` ${away.name} está ${away.owner_place ? `em ${getPlace(db, away.owner_place).name}` : `com ${getCharacter(db, away.owner_char!).name}`}: traga com item.give {item, to: "pc"} se fizer sentido.` : ""
    throw new Error(`${pc.name} não tem "${itemRef}". Itens dele: ${list || "nenhum"}.${where}`)
  }
  const valid = itemActions(db, item)
  if (!valid.includes(action as ItemAction)) {
    throw new Error(valid.length ? `Não dá para ${action} ${item.name} agora (possível: ${valid.join(", ")}).` : `${pc.name} não pode agir agora (${[...new Set([pc.status, ...pc.sheet.conditions])].join(", ")}).`)
  }
  const p = props(item)
  let text: string
  switch (action as ItemAction) {
    case "usar": {
      const parts: string[] = []
      if (typeof p.heal === "string") {
        const r = roll(p.heal)
        parts.push(`${p.heal}: ${r.detail} = ${r.total}. ${heal(db, pc.id, r.total)}`)
      }
      if (item.qty > 1) db.prepare("UPDATE items SET qty = qty - 1 WHERE id = ?").run(item.id)
      else db.prepare("DELETE FROM items WHERE id = ?").run(item.id)
      parts.push(item.qty > 1 ? `Restam ${item.qty - 1}.` : "Acabou.")
      text = `${pc.name} usa ${item.name}. ${parts.join(" ")}`
      break
    }
    case "equipar":
    case "empunhar": {
      // Um item equipado por tipo (arma, armadura, escudo).
      const slot = isWeapon(item) ? "arma" : item.kind
      for (const other of all<ItemRow>(db, "SELECT * FROM items WHERE owner_char = ? AND equipped = 1 AND id <> ?", pc.id, item.id)) {
        if ((isWeapon(other) ? "arma" : other.kind) === slot) db.prepare("UPDATE items SET equipped = 0, drawn = 0 WHERE id = ?").run(other.id)
      }
      db.prepare("UPDATE items SET equipped = 1, drawn = ? WHERE id = ?").run(action === "empunhar" ? 1 : 0, item.id)
      const ac = recomputeAc(db, pc.id, item)
      if (action === "equipar") {
        text = `${pc.name} equipa ${item.name}.${ac ? ` ${ac}.` : ""}`
        break
      }
      const reactions = reactToDrawnWeapon(db, pc.name, item.name, pc.place_id)
      text = `${pc.name} empunha ${item.name}.${reactions.length ? ` Reações: ${reactions.join("; ")}.` : " Ninguém por perto reage."}`
      break
    }
    case "embainhar":
      db.prepare("UPDATE items SET drawn = 0 WHERE id = ?").run(item.id)
      clearReactions(db, pc.place_id)
      text = `${pc.name} embainha ${item.name}. Os ânimos esfriam, mas quem viu se lembra.`
      break
    case "guardar": {
      db.prepare("UPDATE items SET equipped = 0, drawn = 0 WHERE id = ?").run(item.id)
      if (item.drawn) clearReactions(db, pc.place_id)
      const ac = recomputeAc(db, pc.id, item)
      text = `${pc.name} guarda ${item.name} na mochila.${ac ? ` ${ac}.` : ""}`
      break
    }
    case "largar": {
      if (!pc.place_id) throw new Error(`${pc.name} não está em nenhum local.`)
      db.prepare("UPDATE items SET owner_char = NULL, owner_place = ?, equipped = 0, drawn = 0 WHERE id = ?").run(pc.place_id, item.id)
      if (item.drawn) clearReactions(db, pc.place_id)
      const ac = item.equipped ? recomputeAc(db, pc.id, item) : null
      text = `${pc.name} larga ${item.name} no chão de ${getPlace(db, pc.place_id).name}.${ac ? ` ${ac}.` : ""}`
      break
    }
  }
  log(db, "item", text)
  return text
}

/** Arma em punho do PC (para o contexto do Mestre). */
export function drawnWeapon(db: DB, pcId: string): string | null {
  return one<{ name: string }>(db, "SELECT name FROM items WHERE owner_char = ? AND drawn = 1", pcId)?.name ?? null
}

export function reactionOf(db: DB, npcId: string): string | null {
  return one<{ text: string }>(db, "SELECT text FROM reactions WHERE npc_id = ? AND text <> ''", npcId)?.text ?? null
}
