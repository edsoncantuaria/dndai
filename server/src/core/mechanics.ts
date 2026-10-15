// Mecânica de jogo: testes, ataques, dano, descansos, itens e combate. Os dados são sempre do motor
// (RNG criptográfico); cada rolagem é gravada no ledger com os dados individuais para o cliente animar.
import type { Campaign } from "./campaign.ts"
import { getMeta, one } from "./db.ts"
import { cryptoRng, type RollResult, roll, rollD20, type Rng } from "./dice.ts"
import { del, meta, type Op, put } from "./ledger.ts"
import { alloc, type CharRow, itemsOf, pcView } from "./pc.ts"
import { ABILITIES, type Ability, type MonsterSheet, mod, MonsterSheetSchema, PcSheetSchema, profBonus } from "./sheet.ts"

export class RuleError extends Error {}
const fail = (m: string): never => { throw new RuleError(m) }

export type Mode = "normal" | "vantagem" | "desvantagem"

export interface RollOutcome {
  who: string; label: string; expr: string; natural?: number; total: number; dc?: number; success?: boolean
  crit?: "acerto" | "falha"; faces: RollResult["faces"]; text: string
}

export function character(c: Campaign, id: string): CharRow {
  return one<CharRow>(c.db, "SELECT * FROM characters WHERE id = ?", id) ?? fail(`personagem "${id}" não existe`)
}

function abilityOf(row: CharRow): Record<Ability, number> {
  return (JSON.parse(row.sheet) as { abilities: Record<Ability, number> }).abilities
}

function rollRecord(c: Campaign, o: RollOutcome, ops: Op[]): void {
  ops.push(put("rolls", { turn: c.turn, who: o.who, kind: "d20", label: o.label, expr: o.expr, total: o.total, natural: o.natural ?? null, dc: o.dc ?? null, success: o.success === undefined ? null : Number(o.success), result: { faces: o.faces, crit: o.crit } }))
}

/** d20 + bônus com vantagem/desvantagem. */
function d20(bonus: number, mode: Mode, rng: Rng) {
  const { natural, seen } = rollD20(mode, rng)
  return { natural, total: natural + bonus, faces: seen.map((v) => ({ sides: 20, value: v, kept: v === natural })) }
}

function bonusFor(c: Campaign, row: CharRow, what: string): { bonus: number; label: string } {
  const sheet = JSON.parse(row.sheet)
  if (sheet.type === "pc") {
    const d = pcView(c, row.id).derived
    if ((ABILITIES as readonly string[]).includes(what)) return { bonus: mod(sheet.abilities[what]), label: what.toUpperCase() }
    if (what in d.skills) return { bonus: d.skills[what]!, label: c.srd.require("skills", what).name }
    return fail(`"${what}" não é atributo nem perícia`)
  }
  const m = sheet as MonsterSheet
  if ((ABILITIES as readonly string[]).includes(what)) return { bonus: mod(m.abilities[what as Ability]), label: what.toUpperCase() }
  const sk = c.srd.get("skills", what, "en") ?? fail(`"${what}" não é atributo nem perícia`)
  const prof = (c.srd.require("monsters", m.srd, "en").proficiencies ?? []).find((p: any) => p.proficiency.index === `skill-${what}`)
  return { bonus: prof ? prof.value : mod(m.abilities[sk.ability_score.index as Ability]), label: sk.name }
}

export function check(c: Campaign, who: string, what: string, dc: number, mode: Mode = "normal", rng: Rng = cryptoRng): RollOutcome {
  const row = character(c, who)
  const { bonus, label } = bonusFor(c, row, what)
  const r = d20(bonus, mode, rng)
  const o: RollOutcome = { who, label: `${label}`, expr: `1d20${bonus >= 0 ? "+" : ""}${bonus}`, natural: r.natural, total: r.total, dc, success: r.total >= dc, faces: r.faces, text: "" }
  o.text = `${row.name} · ${label}: ${r.natural}${bonus >= 0 ? "+" : ""}${bonus} = ${r.total} vs CD ${dc} → ${o.success ? "sucesso" : "falha"}`
  const ops: Op[] = []
  rollRecord(c, o, ops)
  c.commit("teste", ops)
  return o
}

export function save(c: Campaign, who: string, ability: Ability, dc: number, mode: Mode = "normal", rng: Rng = cryptoRng): RollOutcome {
  const row = character(c, who)
  const sheet = JSON.parse(row.sheet)
  const prof = sheet.type === "pc" ? profBonus(sheet.level) : sheet.prof
  const proficient = sheet.type === "pc" ? sheet.saves.includes(ability) : (c.srd.require("monsters", sheet.srd, "en").proficiencies ?? []).some((p: any) => p.proficiency.index === `saving-throw-${ability}`)
  const bonus = mod(sheet.abilities[ability]) + (proficient ? prof : 0)
  const r = d20(bonus, mode, rng)
  const o: RollOutcome = { who, label: `Salvaguarda de ${ability.toUpperCase()}`, expr: `1d20${bonus >= 0 ? "+" : ""}${bonus}`, natural: r.natural, total: r.total, dc, success: r.total >= dc, faces: r.faces, text: "" }
  o.text = `${row.name} · ${o.label}: ${r.natural}${bonus >= 0 ? "+" : ""}${bonus} = ${r.total} vs CD ${dc} → ${o.success ? "sucesso" : "falha"}`
  const ops: Op[] = []
  rollRecord(c, o, ops)
  c.commit("salvaguarda", ops)
  return o
}

// ---------- PV, dano e cura ----------

const RES = (list: string[] | undefined, type: string) => (list ?? []).some((x) => x.toLowerCase().includes(type))

/** Calcula o efeito de `amount` de dano num personagem (PV temporários, morte instantânea, 0 PV). Não grava. */
function hurt(row: CharRow, sheet: any, amount: number, crit = false): { patch: Record<string, unknown>; note: string } {
  let left = amount
  let temp = row.temp_hp
  const absorbed = Math.min(temp, left)
  temp -= absorbed; left -= absorbed
  const hp = Math.max(0, row.hp - left)
  const patch: Record<string, unknown> = { id: row.id, hp, temp_hp: temp }
  let note = `${amount} de dano`
  if (row.hp === 0 && row.kind === "pc" && left > 0) {
    // Dano com 0 PV: falha automática na salvaguarda contra morte (crítico = 2).
    const ds = { ...sheet.deathSaves, fail: Math.min(3, sheet.deathSaves.fail + (crit ? 2 : 1)) }
    patch.sheet = { ...sheet, deathSaves: ds }
    if (ds.fail >= 3) { patch.status = "morto"; note += " — morreu" } else note += ` — falha na salvaguarda contra morte (${ds.fail}/3)`
    return { patch, note }
  }
  if (hp === 0) {
    if (row.kind === "pc") {
      if (left - row.hp >= row.max_hp) { patch.status = "morto"; note += " — morte instantânea" }
      else { patch.status = "inconsciente"; patch.sheet = { ...sheet, conditions: [...new Set([...(sheet.conditions ?? []), "unconscious"])], deathSaves: { ok: 0, fail: 0 } }; note += " — caiu inconsciente" }
    } else { patch.status = "morto"; note += " — morreu" }
  }
  return { patch, note }
}

export function damage(c: Campaign, target: string, amount: number, type = "", opts: { crit?: boolean } = {}): string {
  if (!Number.isInteger(amount) || amount < 0) fail("dano inválido")
  const row = character(c, target)
  if (row.status === "morto") fail(`${row.name} já está morto`)
  const sheet = JSON.parse(row.sheet)
  let n = amount
  if (sheet.type === "monster") {
    const m = c.srd.require("monsters", sheet.srd, "en")
    if (RES(m.damage_immunities, type)) n = 0
    else if (RES(m.damage_resistances, type)) n = Math.floor(n / 2)
    else if (RES(m.damage_vulnerabilities, type)) n *= 2
  }
  const { patch, note } = hurt(row, sheet, n, opts.crit)
  c.commit("dano", [put("characters", patch)])
  return `${row.name}: ${note}${n !== amount ? ` (ajustado por resistência: ${amount}→${n})` : ""}`
}

export function heal(c: Campaign, target: string, amount: number): string {
  if (!Number.isInteger(amount) || amount <= 0) fail("cura inválida")
  const row = character(c, target)
  if (row.status === "morto") fail(`${row.name} está morto (cura não ressuscita)`)
  const hp = Math.min(row.max_hp, row.hp + amount)
  const patch: Record<string, unknown> = { id: row.id, hp }
  if (row.hp === 0 && hp > 0) {
    const sheet = JSON.parse(row.sheet)
    patch.status = "vivo"
    patch.sheet = { ...sheet, conditions: (sheet.conditions ?? []).filter((x: string) => x !== "unconscious"), deathSaves: { ok: 0, fail: 0 } }
  }
  c.commit("cura", [put("characters", patch)])
  return `${row.name}: +${hp - row.hp} PV (${hp}/${row.max_hp})`
}

export function tempHp(c: Campaign, target: string, amount: number): void {
  const row = character(c, target)
  c.commit("pv-temporario", [put("characters", { id: row.id, temp_hp: Math.max(row.temp_hp, amount) })])
}

export function deathSave(c: Campaign, who = "pc", rng: Rng = cryptoRng): string {
  const row = character(c, who)
  if (row.hp > 0 || row.status !== "inconsciente") fail(`${row.name} não está morrendo`)
  const sheet = JSON.parse(row.sheet)
  const nat = rng(20)
  const ds = { ...sheet.deathSaves }
  const patch: Record<string, unknown> = { id: row.id }
  let text: string
  if (nat === 20) { patch.hp = 1; patch.status = "vivo"; sheet.deathSaves = { ok: 0, fail: 0 }; sheet.conditions = (sheet.conditions ?? []).filter((x: string) => x !== "unconscious"); text = "20 natural: levanta com 1 PV" }
  else {
    if (nat === 1) ds.fail = Math.min(3, ds.fail + 2); else if (nat >= 10) ds.ok = Math.min(3, ds.ok + 1); else ds.fail = Math.min(3, ds.fail + 1)
    sheet.deathSaves = ds
    text = `${nat}: sucessos ${ds.ok}/3, falhas ${ds.fail}/3`
    if (ds.fail >= 3) { patch.status = "morto"; text += " — morreu" }
    else if (ds.ok >= 3) { patch.status = "estavel"; text += " — estabilizou" }
  }
  patch.sheet = sheet
  const ops: Op[] = [put("characters", patch)]
  ops.push(put("rolls", { turn: c.turn, who, kind: "d20", label: "Salvaguarda contra morte", expr: "1d20", total: nat, natural: nat, dc: 10, success: Number(nat >= 10), result: { faces: [{ sides: 20, value: nat, kept: true }] } }))
  c.commit("morte", ops)
  return `${row.name} · ${text}`
}

export function setCondition(c: Campaign, who: string, add: string[], remove: string[] = []): void {
  const row = character(c, who)
  const known = new Set(c.srd.list("conditions", "en").map((x) => x.index))
  for (const k of [...add, ...remove]) if (!known.has(k)) fail(`condição "${k}" não existe (${[...known].join(", ")})`)
  const sheet = JSON.parse(row.sheet)
  sheet.conditions = [...new Set([...(sheet.conditions ?? []).filter((x: string) => !remove.includes(x)), ...add])]
  c.commit("condicao", [put("characters", { id: who, sheet })])
}

// ---------- monstros e ataques ----------

export function spawnMonster(c: Campaign, srdIndex: string, place: string, name?: string): string {
  const m = c.srd.get("monsters", srdIndex, "en") ?? fail(`monstro "${srdIndex}" não existe no SRD`)
  const ops: Op[] = []
  const id = alloc(c, "m", ops)
  const sheet = MonsterSheetSchema.parse({
    type: "monster", srd: m.index, cr: m.challenge_rating, prof: m.proficiency_bonus, speed: Object.values(m.speed).join(", "),
    abilities: { str: m.strength, dex: m.dexterity, con: m.constitution, int: m.intelligence, wis: m.wisdom, cha: m.charisma },
  })
  ops.push(put("characters", { id, kind: "monster", name: name ?? m.name, summary: `${m.size} ${m.type}`, place_id: place, status: "vivo", hp: m.hit_points, max_hp: m.hit_points, temp_hp: 0, ac: m.armor_class[0].value, level: 0, xp: m.xp, cp: 0, sheet, persona: {}, attitude: -50, schedule: [], companion: 0 }))
  c.commit("monstro", ops)
  return id
}

export interface AttackResult { text: string; hit: boolean; crit: boolean; damage: number; outcome: RollOutcome }

/** Ataque de um PC (item de arma ou desarmado) ou de um monstro (ação do bloco de estatísticas) contra um alvo. */
export function attack(c: Campaign, attacker: string, target: string, using: string, mode: Mode = "normal", rng: Rng = cryptoRng): AttackResult {
  const a = character(c, attacker), t = character(c, target)
  if (a.status !== "vivo") fail(`${a.name} não pode atacar (${a.status})`)
  if (t.status === "morto") fail(`${t.name} já está morto`)
  const sheet = JSON.parse(a.sheet)
  let bonus: number, dmgExpr: string, dmgType: string, label: string
  if (sheet.type === "pc") {
    const opts = pcView(c, attacker).derived.attacks
    const opt = opts.find((o) => o.item === using || o.name.toLowerCase() === using.toLowerCase()) ?? fail(`arma "${using}" não encontrada (${opts.map((o) => o.item || o.name).join(", ")})`)
    ;({ bonus, damage: dmgExpr, damageType: dmgType, name: label } = opt)
  } else {
    const m = c.srd.require("monsters", sheet.srd, "en")
    const act = (m.actions ?? []).find((x: any) => x.name.toLowerCase() === using.toLowerCase() && x.attack_bonus !== undefined) ?? fail(`ação "${using}" não existe (${(m.actions ?? []).filter((x: any) => x.attack_bonus !== undefined).map((x: any) => x.name).join(", ")})`)
    bonus = act.attack_bonus; label = act.name
    dmgExpr = act.damage[0].damage_dice; dmgType = act.damage[0].damage_type.index
  }
  const r = d20(bonus, mode, rng)
  const crit = r.natural === 20, miss = r.natural === 1
  const hit = !miss && (crit || r.total >= t.ac)
  const o: RollOutcome = { who: attacker, label: `Ataque: ${label}`, expr: `1d20${bonus >= 0 ? "+" : ""}${bonus}`, natural: r.natural, total: r.total, dc: t.ac, success: hit, crit: crit ? "acerto" : miss ? "falha" : undefined, faces: r.faces, text: "" }
  const ops: Op[] = []
  let dmg = 0
  let faces = o.faces
  if (hit) {
    const d = roll(dmgExpr, rng, crit)
    dmg = Math.max(0, d.total)
    faces = [...faces, ...d.faces]
    o.faces = faces
  }
  rollRecord(c, o, ops)
  c.commit("ataque", ops)
  let text = `${a.name} → ${t.name} (${label}): ${r.natural}${bonus >= 0 ? "+" : ""}${bonus} = ${r.total} vs CA ${t.ac} → ${crit ? "ACERTO CRÍTICO" : hit ? "acerta" : miss ? "erro crítico" : "erra"}`
  if (hit) text += ` · ${damage(c, target, dmg, dmgType, { crit })}`
  o.text = text
  return { text, hit, crit, damage: dmg, outcome: o }
}

// ---------- iniciativa e rodadas ----------

export interface CombatState { round: number; turn: number; order: { id: string; init: number }[] }
export function combatState(c: Campaign): CombatState | undefined {
  const raw = getMeta(c.db, "combat")
  return raw ? (JSON.parse(raw) as CombatState) : undefined
}

export function startCombat(c: Campaign, ids: string[], rng: Rng = cryptoRng): CombatState {
  if (combatState(c)) fail("já há um combate em andamento")
  if (ids.length < 2) fail("combate precisa de ao menos dois combatentes")
  const ops: Op[] = []
  const order = ids.map((id) => {
    const row = character(c, id)
    const sheet = JSON.parse(row.sheet)
    const bonus = sheet.type === "pc" ? pcView(c, id).derived.initiative : mod(sheet.abilities.dex)
    const r = d20(bonus, "normal", rng)
    rollRecord(c, { who: id, label: "Iniciativa", expr: `1d20${bonus >= 0 ? "+" : ""}${bonus}`, natural: r.natural, total: r.total, faces: r.faces, text: "" }, ops)
    return { id, init: r.total * 100 + bonus * 2 + (r.natural === 20 ? 1 : 0) }
  }).sort((a, b) => b.init - a.init).map((o) => ({ id: o.id, init: Math.floor(o.init / 100) }))
  const st: CombatState = { round: 1, turn: 0, order }
  ops.push(meta("combat", JSON.stringify(st)))
  c.commit("iniciativa", ops)
  return st
}

export function nextTurn(c: Campaign): CombatState {
  const st = combatState(c) ?? fail("não há combate")
  const alive = (id: string) => character(c, id).status !== "morto"
  if (!st.order.some((o) => alive(o.id))) fail("todos morreram")
  do {
    st.turn += 1
    if (st.turn >= st.order.length) { st.turn = 0; st.round += 1 }
  } while (!alive(st.order[st.turn]!.id))
  c.commit("turno-combate", [meta("combat", JSON.stringify(st))])
  return st
}

export function endCombat(c: Campaign): void {
  if (!combatState(c)) fail("não há combate")
  c.commit("fim-combate", [meta("combat", "")])
}

// ---------- descansos e recursos ----------

const SHORT_REST_FULL = ["focus_points"]
const SHORT_REST_ONE = ["second_wind_uses", "channel_divinity_charges", "wild_shape_uses"]

export function useResource(c: Campaign, who: string, key: string, n = 1): string {
  const row = character(c, who)
  const sheet = PcSheetSchema.parse(JSON.parse(row.sheet))
  const max = Number((sheet.classSpecific as Record<string, unknown>)[key])
  if (!Number.isFinite(max)) fail(`recurso "${key}" não existe (${Object.keys(sheet.classSpecific).join(", ")})`)
  const used = sheet.uses[key] ?? 0
  if (used + n > max) fail(`sem usos de ${key}: ${max - used}/${max} restantes`)
  sheet.uses[key] = used + n
  c.commit("recurso", [put("characters", { id: who, sheet })])
  return `${key}: ${max - used - n}/${max}`
}

export function useSlot(c: Campaign, who: string, level: number): string {
  const row = character(c, who)
  const sheet = PcSheetSchema.parse(JSON.parse(row.sheet))
  const s = sheet.slots[String(level)] ?? fail(`sem espaços de nível ${level}`)
  if (s.used >= s.max) fail(`espaços de nível ${level} esgotados`)
  s.used += 1
  c.commit("espaco-magia", [put("characters", { id: who, sheet })])
  return `espaço ${level}: ${s.max - s.used}/${s.max}`
}

export function shortRest(c: Campaign, who = "pc", spendDice = 0, rng: Rng = cryptoRng): string {
  const v = pcView(c, who)
  const sheet = structuredClone(v.sheet)
  if (v.row.status !== "vivo") fail("só personagens conscientes descansam")
  if (spendDice > sheet.hitDiceLeft) fail(`só restam ${sheet.hitDiceLeft} dados de vida`)
  let gained = 0
  for (let i = 0; i < spendDice; i++) gained += Math.max(0, roll(`1d${sheet.hitDie}`, rng).total + mod(sheet.abilities.con))
  sheet.hitDiceLeft -= spendDice
  const hp = Math.min(v.row.max_hp, v.row.hp + gained)
  for (const k of SHORT_REST_FULL) delete sheet.uses[k]
  for (const k of SHORT_REST_ONE) if (sheet.uses[k]) sheet.uses[k] = Math.max(0, sheet.uses[k]! - 1)
  if (sheet.class === "warlock") for (const s of Object.values(sheet.slots)) s.used = 0
  c.commit("descanso-curto", [put("characters", { id: who, hp, sheet }), meta("time", c.time + 60)])
  return `descanso curto: +${hp - v.row.hp} PV (${hp}/${v.row.max_hp}), ${sheet.hitDiceLeft} dado(s) de vida`
}

export function longRest(c: Campaign, who = "pc"): string {
  const v = pcView(c, who)
  const sheet = structuredClone(v.sheet)
  if (v.row.status !== "vivo") fail("só personagens conscientes descansam")
  sheet.hitDiceLeft = sheet.level
  sheet.uses = {}
  for (const s of Object.values(sheet.slots)) s.used = 0
  sheet.exhaustion = Math.max(0, sheet.exhaustion - 1)
  sheet.deathSaves = { ok: 0, fail: 0 }
  c.commit("descanso-longo", [put("characters", { id: who, hp: v.row.max_hp, temp_hp: 0, sheet }), meta("time", c.time + 8 * 60)])
  return `descanso longo: PV ${v.row.max_hp}/${v.row.max_hp}, espaços e dados de vida restaurados`
}

// ---------- itens e dinheiro ----------

export function giveItem(c: Campaign, to: string, srdIndex: string, qty = 1): string {
  character(c, to)
  const e = c.srd.get("equipment", srdIndex, "en") ?? fail(`equipamento "${srdIndex}" não existe`)
  const have = itemsOf(c, to).find((i) => i.srd === e.index)
  const ops: Op[] = []
  const id = have?.id ?? alloc(c, "i", ops)
  const kind = e.damage ? "arma" : e.armor_class ? (e.equipment_categories?.some((x: any) => x.index === "shields") ? "escudo" : "armadura") : "equipamento"
  ops.push(put("items", have ? { id, qty: have.qty + qty } : { id, owner_char: to, name: e.name, srd: e.index, qty, kind, props: {}, equipped: 0 }))
  c.commit("item", ops)
  return id
}

export function itemQty(c: Campaign, itemId: string, delta: number): void {
  const it = one<{ qty: number; owner_char: string }>(c.db, "SELECT qty, owner_char FROM items WHERE id = ?", itemId) ?? fail(`item "${itemId}" não existe`)
  const qty = it.qty + delta
  if (qty < 0) fail("quantidade insuficiente")
  c.commit("item", [qty === 0 ? del("items", { id: itemId }) : put("items", { id: itemId, qty })])
}

export function equip(c: Campaign, itemId: string, on: boolean): void {
  const it = one<{ owner_char: string; kind: string; srd: string | null }>(c.db, "SELECT owner_char, kind, srd FROM items WHERE id = ?", itemId) ?? fail(`item "${itemId}" não existe`)
  const ops: Op[] = []
  if (on && (it.kind === "armadura" || it.kind === "escudo")) {
    for (const o of itemsOf(c, it.owner_char)) {
      const k = one<{ kind: string }>(c.db, "SELECT kind FROM items WHERE id = ?", o.id)!.kind
      if (o.equipped && k === it.kind && o.id !== itemId) ops.push(put("items", { id: o.id, equipped: 0 }))
    }
  }
  ops.push(put("items", { id: itemId, equipped: Number(on) }))
  c.commit("equipar", ops)
  const row = character(c, it.owner_char)
  if (row.kind === "pc") c.commit("ca", [put("characters", { id: row.id, ac: pcView(c, row.id).derived.ac })])
}

export function money(c: Campaign, who: string, deltaCp: number): number {
  const row = character(c, who)
  const cp = row.cp + deltaCp
  if (cp < 0) fail(`dinheiro insuficiente (tem ${row.cp} PC, precisa de ${-deltaCp})`)
  c.commit("dinheiro", [put("characters", { id: who, cp })])
  return cp
}


// ---------- comércio (preços do SRD) ----------

import { moneyCp } from "./creation.ts"

export function buy(c: Campaign, who: string, srdIndex: string, qty = 1): string {
  const e = c.srd.get("equipment", srdIndex, "en") ?? fail(`equipamento "${srdIndex}" não existe no SRD`)
  if (!e.cost) fail(`${e.name} não tem preço no SRD`)
  const cost = moneyCp(e.cost.quantity, e.cost.unit) * qty
  return c.atomic("compra", () => {
    money(c, who, -cost)
    giveItem(c, who, srdIndex, qty)
    return `${qty}× ${e.name} por ${cost / 100} PO`
  })
}

export function sell(c: Campaign, itemId: string, qty = 1): string {
  const it = one<{ srd: string | null; name: string; qty: number; owner_char: string; equipped: number }>(c.db, "SELECT srd, name, qty, owner_char, equipped FROM items WHERE id = ?", itemId) ?? fail(`item "${itemId}" não existe`)
  const e = it.srd ? c.srd.get("equipment", it.srd, "en") : undefined
  if (!e?.cost) fail(`${it.name} não tem preço de revenda`)
  if (it.equipped) fail(`${it.name} está equipado`)
  const gain = Math.floor((moneyCp(e!.cost.quantity, e!.cost.unit) * qty) / 2)
  return c.atomic("venda", () => {
    itemQty(c, itemId, -qty)
    money(c, it.owner_char, gain)
    return `${qty}× ${it.name} por ${gain / 100} PO (metade do preço)`
  })
}
