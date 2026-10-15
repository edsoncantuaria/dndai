// Operações sobre o personagem do jogador: criar, consultar ficha derivada, PV, XP.
import type { Campaign } from "./campaign.ts"
import { CreationError, type CreationChoices, CreationChoicesSchema, createPc, rollAbilitySet } from "./creation.ts"
import { all, getMeta, one } from "./db.ts"
import { cryptoRng, type Rng } from "./dice.ts"
import { meta, type Op, put } from "./ledger.ts"
import { type Derived, derivePc, type ItemRow, PcSheetSchema, type PcSheet } from "./sheet.ts"

export interface CharRow {
  id: string; kind: "pc" | "npc" | "monster"; name: string; summary: string; place_id: string | null; status: string
  hp: number; max_hp: number; temp_hp: number; ac: number; level: number; xp: number; cp: number
  sheet: string; persona: string; attitude: number; companion: number
}

/** Aloca um id curto sequencial por prefixo; o contador viaja no mesmo commit. */
export function alloc(c: Campaign, prefix: string, ops: Op[]): string {
  const key = `seq:${prefix}`
  const used = ops.filter((o) => o.op === "meta" && o.key === key).length
  const n = Number(getMeta(c.db, key, "0")) + used + 1
  ops.push(meta(key, n))
  return `${prefix}${n}`
}

export function rollAbilities(c: Campaign, rng: Rng = cryptoRng): { token: string; scores: number[] } {
  const scores = rollAbilitySet(rng)
  const token = `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
  c.commit("rolar-atributos", [meta(`roll:${token}`, scores.join(","))])
  return { token, scores }
}

export function pcRow(c: Campaign): CharRow | undefined {
  return one<CharRow>(c.db, "SELECT * FROM characters WHERE kind = 'pc'")
}

export function itemsOf(c: Campaign, owner: string): ItemRow[] {
  return all<ItemRow & { props: string }>(c.db, "SELECT id, name, srd, qty, equipped, props FROM items WHERE owner_char = ? ORDER BY id", owner)
    .map((i) => ({ ...i, props: JSON.parse(i.props as string) }))
}

export function createCharacter(c: Campaign, input: CreationChoices, place = "l0"): string {
  const parsed = CreationChoicesSchema.safeParse(input)
  if (!parsed.success) throw new CreationError(parsed.error.issues.map((i) => `${i.path.join(".") || "escolhas"}: ${i.message}`).join("; "))
  const choices = parsed.data as CreationChoices
  if (pcRow(c)) throw new CreationError("a campanha já tem personagem")
  let rolled: number[] | undefined
  if (choices.method === "roll") {
    const raw = getMeta(c.db, `roll:${choices.rollToken ?? ""}`)
    if (!raw) throw new CreationError("rollToken desconhecido")
    rolled = raw.split(",").map(Number)
  }
  const made = createPc(c.srd, choices, rolled)
  const ops: Op[] = []
  const id = "pc"
  const derived = derivePc(c.srd, made.sheet, made.items.map((i, n) => ({ id: `tmp${n}`, name: i.name, srd: i.srd, qty: i.qty, equipped: Number(i.equip), props: {} })))
  ops.push(put("characters", {
    id, kind: "pc", name: choices.name.trim(), summary: `${c.srd.require("species", choices.species).name} ${c.srd.require("classes", choices.class).name}`,
    place_id: place, status: "vivo", hp: made.hp, max_hp: made.hp, temp_hp: 0, ac: derived.ac, level: 1, xp: 0, cp: made.cp,
    sheet: made.sheet, persona: {}, attitude: 0, schedule: [], companion: 0,
  }))
  for (const it of made.items) {
    ops.push(put("items", { id: alloc(c, "i", ops), owner_char: id, name: it.name, srd: it.srd, qty: it.qty, kind: it.kind, props: {}, equipped: Number(it.equip) }))
  }
  c.commit("criar-personagem", ops)
  return id
}

export interface PcView { row: CharRow; sheet: PcSheet; items: ItemRow[]; derived: Derived }

export function pcView(c: Campaign, id = "pc"): PcView {
  const row = one<CharRow>(c.db, "SELECT * FROM characters WHERE id = ?", id) ?? (() => { throw new Error(`personagem ${id} não existe`) })()
  const sheet = PcSheetSchema.parse(JSON.parse(row.sheet))
  const items = itemsOf(c, id)
  return { row, sheet, items, derived: derivePc(c.srd, sheet, items) }
}
