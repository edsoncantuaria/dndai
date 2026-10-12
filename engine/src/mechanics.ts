// Resolução mecânica determinística. Todas as rolagens viram registro em roll_requests
// (resolvidas na hora pelo motor ou pendentes para o jogador rolar na mesa).
import { all, type DB, getMeta, log, metaNum, one } from "./db.ts"
import { assertBonus } from "./guard.ts"
import { recordRoll } from "./journal.ts"
import { applyLevelChoices, chooseFeature, type LevelChoices } from "./progression.ts"
import { cryptoRng, parseDice, type Rng } from "./dice.ts"
import {
  ABILITY_NAMES, type Ability, CLASSES, fmtMod, levelForXp, mod, parseAbility, parseSkill, SKILLS, XP_THRESHOLDS,
} from "./rules.ts"
import {
  abilityMod, type Character, charProf, getCharacter, type ItemRow, maxSlotsFor, resolveRef, saveBonus, saveSheet,
  skillBonus, spellInfo,
} from "./world.ts"

export type Mode = "normal" | "vantagem" | "desvantagem"

export type RollSpec =
  | { kind: "pericia" | "atributo" | "resistencia"; who: string; key: string; dc: number | null; mode: Mode; bonus: number; reason: string }
  | {
      kind: "ataque"; who: string; target: string; with: string | null; spell: boolean; damage: string | null
      mode: Mode; bonus: number; reason: string
    }
  | { kind: "dano"; who: string; target: string | null; expr: string; reason: string }
  | { kind: "livre"; who: string; expr: string; reason: string }
  | { kind: "morte"; who: string; reason: string }

interface Prepared {
  label: string
  sides: number[]
  mode: Mode
  modifier: number
  dc: number | null
  d20Count: number
  /** dados de dano após os d20 (ataque) ou todos (dano/livre) */
  damageSides: number[]
  damageMod: number
  damageType: string
}

export interface RollOutcome {
  id: number
  label: string
  whoName: string
  dice: number[]
  kept: number[]
  modifier: number
  total: number
  dc: number | null
  outcome: "sucesso" | "falha" | "critico" | "falha_critica" | null
  source: "mesa" | "motor" | "manual"
  at: string
  text: string
}

function splitExpr(expr: string): { sides: number[]; constant: number } {
  const sides: number[] = []
  let constant = 0
  for (const t of parseDice(expr)) {
    if (t.sides === 0) constant += t.sign * t.value
    else if (t.keep || t.sign < 0) throw new Error(`Expressão "${expr}" não suportada aqui (sem kh/kl ou dados negativos).`)
    else for (let i = 0; i < t.count; i++) sides.push(t.sides)
  }
  return { sides, constant }
}

interface AttackProfile {
  name: string
  bonus: number
  damage: string
  type: string
}

function attackProfile(db: DB, c: Character, withRef: string | null, spell: boolean, damage: string | null): AttackProfile {
  const prof = charProf(c)
  if (spell) {
    const info = spellInfo(c)
    if (!info) throw new Error(`${c.name} não conjura magias por classe; informe --bonus e --damage sem --spell.`)
    if (!damage) throw new Error("Ataque de magia exige --damage (ex.: 1d10).")
    return { name: withRef ?? "Ataque mágico", bonus: info.attack, damage, type: "mágico" }
  }
  const items = all<ItemRow>(db, "SELECT * FROM items WHERE owner_char = ?", c.id)
  const fromItem = (it: ItemRow): AttackProfile | undefined => {
    const p = JSON.parse(it.props) as { damage?: string; damage_type?: string; finesse?: boolean; ranged?: boolean; bonus?: number }
    if (!p.damage) return undefined
    const str = abilityMod(c, "for")
    const dex = abilityMod(c, "des")
    const m = p.ranged ? dex : p.finesse ? Math.max(str, dex) : str
    const magic = p.bonus ?? 0
    const dmgMod = m + magic
    return { name: it.name, bonus: m + prof + magic, damage: `${p.damage}${dmgMod ? fmtMod(dmgMod) : ""}`, type: p.damage_type ?? "" }
  }
  if (withRef) {
    const natural = c.sheet.attacks.find((a) => norm2(a.name) === norm2(withRef))
    if (natural) return { ...natural, damage: damage ?? natural.damage }
    const item = items.find((i) => i.id === withRef || norm2(i.name) === norm2(withRef))
    if (!item) {
      const options = [...c.sheet.attacks.map((a) => a.name), ...items.filter((i) => JSON.parse(i.props).damage).map((i) => `${i.name} [${i.id}]`)]
      throw new Error(`${c.name} não tem ataque "${withRef}". Opções: ${options.join("; ") || "nenhuma (use --bonus/--damage)"}.`)
    }
    const p = fromItem(item)
    if (!p) throw new Error(`${item.name} não tem "damage" nas props; não é arma.`)
    return damage ? { ...p, damage } : p
  }
  const equipped = items.find((i) => i.equipped && JSON.parse(i.props).damage)
  const p = equipped ? fromItem(equipped) : c.sheet.attacks[0]
  if (p) return damage ? { ...p, damage } : p
  const str = abilityMod(c, "for")
  return { name: "Desarmado", bonus: str + prof, damage: damage ?? `${Math.max(1, 1 + str)}`, type: "contundente" }
}

function norm2(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

function prepare(db: DB, spec: RollSpec): Prepared {
  if ("bonus" in spec) assertBonus(spec.bonus)
  if ((spec.kind === "ataque" || spec.kind === "dano") && spec.target) {
    const target = getCharacter(db, spec.target)
    if (target.status === "morto") throw new Error(`${target.name} já está morto. Não há ataque nem dano contra um corpo.`)
  }
  const c = getCharacter(db, spec.who)
  if (spec.kind === "pericia" || spec.kind === "atributo" || spec.kind === "resistencia") {
    let modifier: number
    let label: string
    if (spec.kind === "pericia") {
      const skill = SKILLS[spec.key]
      modifier = skillBonus(c, spec.key, skill.ability)
      label = `${skill.label} (${ABILITY_NAMES[skill.ability].slice(0, 3)})`
    } else if (spec.kind === "atributo") {
      modifier = abilityMod(c, spec.key as Ability)
      label = `Teste de ${ABILITY_NAMES[spec.key as Ability]}`
    } else {
      modifier = saveBonus(c, spec.key as Ability)
      label = `Salvaguarda de ${ABILITY_NAMES[spec.key as Ability]}`
    }
    const poisoned = c.sheet.conditions.includes("envenenado") && spec.kind !== "resistencia" && spec.mode === "normal"
    const rollMode: Mode = poisoned ? "desvantagem" : spec.mode
    modifier += spec.bonus
    const n = rollMode === "normal" ? 1 : 2
    return { label, sides: Array(n).fill(20), mode: rollMode, modifier, dc: spec.dc, d20Count: n, damageSides: [], damageMod: 0, damageType: "" }
  }
  if (spec.kind === "ataque") {
    const target = getCharacter(db, spec.target)
    const p = attackProfile(db, c, spec.with, spec.spell, spec.damage)
    const dmg = splitExpr(p.damage)
    const n = spec.mode === "normal" ? 1 : 2
    return {
      label: `Ataque: ${p.name} → ${target.name}`, sides: [...Array(n).fill(20), ...dmg.sides], mode: spec.mode,
      modifier: p.bonus + spec.bonus, dc: target.ac, d20Count: n, damageSides: dmg.sides, damageMod: dmg.constant, damageType: p.type,
    }
  }
  if (spec.kind === "morte") {
    if (c.hp > 0 || c.status === "morto") throw new Error(`${c.name} não está fazendo testes contra a morte.`)
    return { label: "Teste contra a morte", sides: [20], mode: "normal", modifier: 0, dc: 10, d20Count: 1, damageSides: [], damageMod: 0, damageType: "" }
  }
  if (spec.kind !== "dano" && spec.kind !== "livre") throw new Error(`Tipo de rolagem desconhecido: ${(spec as { kind: string }).kind}`)
  const e = splitExpr(spec.expr)
  return {
    label: spec.kind === "dano" ? `Dano${spec.target ? ` → ${getCharacter(db, spec.target).name}` : ""}` : `Rolagem ${spec.expr}`,
    sides: e.sides, mode: "normal", modifier: e.constant, dc: null, d20Count: 0, damageSides: e.sides, damageMod: e.constant, damageType: "",
  }
}

/** Tipo exibido na mesa (o teste contra a morte é uma salvaguarda sem modificador). */
function publicKind(spec: RollSpec): string {
  return spec.kind === "morte" ? "resistencia" : spec.kind
}

/** Cria um pedido de rolagem para o jogador rolar na mesa (dados 3D). */
export function requestRoll(db: DB, spec: RollSpec): { id: number; text: string } {
  const p = prepare(db, spec)
  const turn = metaNum(db, "turn")
  const res = db
    .prepare("INSERT INTO roll_requests(who, kind, label, dice, mode, modifier, dc, reason, created_turn) VALUES(?,?,?,?,?,?,?,?,?)")
    .run(spec.who, publicKind(spec), p.label, JSON.stringify({ sides: p.sides, spec }), p.mode, p.modifier, p.dc, spec.reason, turn)
  const id = Number(res.lastInsertRowid)
  const dice = p.sides.map((s) => `d${s}`).join(" ")
  return { id, text: `Pedido de rolagem #${id} enviado à mesa: ${p.label} — rolar ${dice} (${fmtMod(p.modifier)})${p.dc !== null ? `, CD/CA ${p.dc}` : ""}. Aguarde o jogador e leia o resultado com "dnd rolls".` }
}

/** Rola imediatamente com o RNG do motor (ou valores informados) e aplica efeitos. */
export function rollNow(db: DB, spec: RollSpec, manual?: number[], rng: Rng = cryptoRng): RollOutcome {
  const p = prepare(db, spec)
  const turn = metaNum(db, "turn")
  const res = db
    .prepare("INSERT INTO roll_requests(who, kind, label, dice, mode, modifier, dc, reason, created_turn) VALUES(?,?,?,?,?,?,?,?,?)")
    .run(spec.who, publicKind(spec), p.label, JSON.stringify({ sides: p.sides, spec }), p.mode, p.modifier, p.dc, spec.reason, turn)
  const values = manual ?? p.sides.map((s) => rng(s))
  return resolveRequest(db, Number(res.lastInsertRowid), values, manual ? "manual" : "motor", rng)
}

interface RequestRow {
  id: number
  who: string
  kind: string
  label: string
  dice: string
  mode: Mode
  modifier: number
  dc: number | null
  reason: string
  status: string
  result: string | null
  created_turn: number
}

/** Resolve um pedido com os valores naturais dos dados (vindos da mesa, do motor ou manuais). */
export function resolveRequest(db: DB, id: number, values: number[], source: RollOutcome["source"], rng: Rng = cryptoRng): RollOutcome {
  const row = one<RequestRow>(db, "SELECT * FROM roll_requests WHERE id = ?", id)
  if (!row) throw new Error(`Pedido de rolagem #${id} não existe.`)
  if (row.status !== "pendente") throw new Error(`Pedido #${id} já está ${row.status}.`)
  const { sides, spec } = JSON.parse(row.dice) as { sides: number[]; spec: RollSpec }
  if (values.length !== sides.length) throw new Error(`Pedido #${id} espera ${sides.length} dado(s) (${sides.map((s) => `d${s}`).join(" ")}), recebeu ${values.length}.`)
  values.forEach((v, i) => {
    if (!Number.isInteger(v) || v < 1 || v > sides[i]) throw new Error(`Valor ${v} inválido para d${sides[i]}.`)
  })
  const p = prepare(db, spec)
  const c = getCharacter(db, spec.who)
  let kept: number[] = values
  let total: number
  let outcome: RollOutcome["outcome"] = null
  const lines: string[] = []

  if (spec.kind === "morte") {
    const nat = values[0]
    kept = [nat]
    total = nat
    outcome = nat === 20 ? "critico" : nat === 1 ? "falha_critica" : nat >= 10 ? "sucesso" : "falha"
    lines.push(deathSave(db, spec.who, rng, nat))
  } else if (p.d20Count > 0) {
    const d20s = values.slice(0, p.d20Count)
    const nat = p.mode === "vantagem" ? Math.max(...d20s) : p.mode === "desvantagem" ? Math.min(...d20s) : d20s[0]
    kept = [nat, ...values.slice(p.d20Count)]
    total = nat + row.modifier
    const modeTxt = p.mode === "normal" ? "" : ` (${p.mode}: ${d20s.join(",")})`
    if (spec.kind === "ataque") {
      const crit = nat === 20
      const hit = crit || (nat !== 1 && total >= (row.dc ?? 0))
      outcome = crit ? "critico" : nat === 1 ? "falha_critica" : hit ? "sucesso" : "falha"
      lines.push(`${p.label}: d20=${nat}${modeTxt} ${fmtMod(row.modifier)} = ${total} vs CA ${row.dc} → ${crit ? "CRÍTICO" : hit ? "ACERTO" : nat === 1 ? "FALHA CRÍTICA" : "ERROU"}`)
      if (hit) {
        let dmgDice = values.slice(p.d20Count)
        if (crit) dmgDice = [...dmgDice, ...p.damageSides.map((s) => rng(s))]
        const dmg = Math.max(0, dmgDice.reduce((a, b) => a + b, 0) + p.damageMod)
        lines.push(`Dano: [${dmgDice.join(",")}]${p.damageMod ? fmtMod(p.damageMod) : ""} = ${dmg}${p.damageType ? ` ${p.damageType}` : ""}`)
        lines.push(applyDamage(db, spec.target, dmg, crit))
      }
    } else {
      if (row.dc !== null) outcome = total >= row.dc ? "sucesso" : "falha"
      lines.push(`${p.label} — ${c.name}: d20=${nat}${modeTxt} ${fmtMod(row.modifier)} = ${total}${row.dc !== null ? ` vs CD ${row.dc} → ${outcome === "sucesso" ? "SUCESSO" : "FALHA"}` : ""}${nat === 20 ? " (20 natural)" : nat === 1 ? " (1 natural)" : ""}`)
    }
  } else {
    total = Math.max(0, values.reduce((a, b) => a + b, 0) + row.modifier)
    lines.push(`${p.label}: [${values.join(",")}]${row.modifier ? fmtMod(row.modifier) : ""} = ${total}`)
    if (spec.kind === "dano" && spec.target) lines.push(applyDamage(db, spec.target, total, false))
  }
  const text = lines.filter(Boolean).join("\n")
  const at = new Date().toISOString()
  const outcomeRow: RollOutcome = {
    id, label: row.label, whoName: c.name, dice: values, kept, modifier: row.modifier, total, dc: row.dc, outcome, source, at, text,
  }
  db.prepare("UPDATE roll_requests SET status = 'resolvida', result = ? WHERE id = ?").run(JSON.stringify(outcomeRow), id)
  log(db, "rolagem", `#${id} [${source}] ${spec.reason ? `(${spec.reason}) ` : ""}${text}`)
  recordRoll(getMeta(db, "slug"), row.created_turn, { worldId: id, label: row.label, text, values, source, reason: spec.reason })
  return outcomeRow
}

// ---------- vida, morte e condições ----------

export function applyDamage(db: DB, targetId: string, amount: number, crit: boolean): string {
  const t = getCharacter(db, targetId)
  if (t.status === "morto") return `${t.name} já está morto.`
  let rest = amount
  const absorbed = Math.min(t.temp_hp, rest)
  rest -= absorbed
  const tempHp = t.temp_hp - absorbed
  if (t.hp === 0 && rest > 0) {
    if (t.kind === "pc" || t.companion) {
      if (rest >= t.max_hp) return setDead(db, t, "dano massivo enquanto caído")
      t.sheet.death.fail += crit ? 2 : 1
      saveSheet(db, t.id, t.sheet)
      db.prepare("UPDATE characters SET temp_hp = ? WHERE id = ?").run(tempHp, t.id)
      if (t.sheet.death.fail >= 3) return setDead(db, t, "três falhas contra a morte")
      return `${t.name} sofre dano caído: falhas contra a morte ${t.sheet.death.fail}/3.`
    }
    return setDead(db, t, "dano")
  }
  const overflow = rest - t.hp
  const hp = Math.max(0, t.hp - rest)
  db.prepare("UPDATE characters SET hp = ?, temp_hp = ? WHERE id = ?").run(hp, tempHp, t.id)
  if (hp > 0) return `${t.name}: ${hp}/${t.max_hp} PV${tempHp ? ` (+${tempHp} temp)` : ""}.`
  if ((t.kind === "pc" || t.companion) && overflow >= t.max_hp) return setDead(db, t, "dano massivo")
  if (t.kind === "pc" || t.companion) {
    t.sheet.death = { success: 0, fail: 0 }
    if (!t.sheet.conditions.includes("inconsciente")) t.sheet.conditions.push("inconsciente")
    saveSheet(db, t.id, t.sheet)
    db.prepare("UPDATE characters SET status = 'inconsciente' WHERE id = ?").run(t.id)
    return `${t.name} cai a 0 PV e fica INCONSCIENTE (testes contra a morte a partir do próximo turno dele).`
  }
  return setDead(db, t, "0 PV")
}

function setDead(db: DB, t: Character, why: string): string {
  db.prepare("UPDATE characters SET status = 'morto', hp = 0 WHERE id = ?").run(t.id)
  log(db, "morte", `${t.name} morreu (${why}).`)
  return `${t.name} MORREU (${why}).`
}

export function heal(db: DB, id: string, amount: number): string {
  const t = getCharacter(db, id)
  if (t.status === "morto") throw new Error(`${t.name} está morto; cura comum não funciona.`)
  const hp = Math.min(t.max_hp, t.hp + amount)
  if (t.hp === 0 && hp > 0) {
    t.sheet.conditions = t.sheet.conditions.filter((x) => x !== "inconsciente")
    t.sheet.death = { success: 0, fail: 0 }
    saveSheet(db, id, t.sheet)
    db.prepare("UPDATE characters SET status = 'vivo' WHERE id = ?").run(id)
  }
  db.prepare("UPDATE characters SET hp = ? WHERE id = ?").run(hp, id)
  return `${t.name} recupera ${hp - t.hp} PV: ${hp}/${t.max_hp}.`
}

/** Aplica o resultado já rolado de um teste contra a morte. Quem chama é que registra o dado. */
export function applyDeathNat(db: DB, id: string, nat: number): string {
  const t = getCharacter(db, id)
  if (t.hp > 0 || t.status === "morto") throw new Error(`${t.name} não está fazendo testes contra a morte.`)
  if (t.sheet.death.success >= 3) return `${t.name} já está estável.`
  if (nat === 20) return `Teste contra a morte: 20 natural! ${heal(db, id, 1)}`
  if (nat === 1) t.sheet.death.fail += 2
  else if (nat >= 10) t.sheet.death.success += 1
  else t.sheet.death.fail += 1
  saveSheet(db, id, t.sheet)
  if (t.sheet.death.fail >= 3) return `Teste contra a morte: d20=${nat}. ${setDead(db, t, "três falhas contra a morte")}`
  if (t.sheet.death.success >= 3) return `Teste contra a morte: d20=${nat}. ${t.name} está ESTÁVEL (inconsciente, 0 PV).`
  return `Teste contra a morte: d20=${nat} → sucessos ${t.sheet.death.success}/3, falhas ${t.sheet.death.fail}/3.`
}

export function deathSave(db: DB, id: string, rng: Rng = cryptoRng, manual?: number): string {
  const text = applyDeathNat(db, id, manual ?? rng(20))
  log(db, "rolagem", text)
  return text
}

// ---------- descanso, XP e nível ----------

export function longRest(db: DB, id: string): string {
  const c = getCharacter(db, id)
  if (c.status === "morto") throw new Error(`${c.name} está morto.`)
  for (const s of Object.values(c.sheet.slots)) s.used = 0
  for (const r of Object.values(c.sheet.resources)) r.used = 0
  const regain = Math.max(1, Math.floor(c.sheet.hitDice.max / 2))
  c.sheet.hitDice.used = Math.max(0, c.sheet.hitDice.used - regain)
  c.sheet.death = { success: 0, fail: 0 }
  c.sheet.conditions = c.sheet.conditions.filter((x) => x !== "inconsciente")
  saveSheet(db, id, c.sheet)
  db.prepare("UPDATE characters SET hp = max_hp, temp_hp = 0, status = 'vivo' WHERE id = ?").run(id)
  return `${c.name}: descanso longo — PV ${c.max_hp}/${c.max_hp}, espaços de magia restaurados, dados de vida disponíveis ${c.sheet.hitDice.max - c.sheet.hitDice.used}/${c.sheet.hitDice.max}.`
}

export function shortRest(db: DB, id: string, diceToSpend: number, rng: Rng = cryptoRng): string {
  const c = getCharacter(db, id)
  if (c.status !== "vivo") throw new Error(`${c.name} precisa estar consciente.`)
  if (!Number.isInteger(diceToSpend) || diceToSpend < 0) throw new Error("Quantidade de dados de vida deve ser inteiro não negativo.")
  for (const r of Object.values(c.sheet.resources)) if (r.resets_on === "short") r.used = 0
  const available = c.sheet.hitDice.max - c.sheet.hitDice.used
  const n = Math.min(diceToSpend, available)
  const con = abilityMod(c, "con")
  const rolls = Array.from({ length: n }, () => rng(c.sheet.hitDice.die))
  const gained = rolls.reduce((a, r) => a + Math.max(0, r + con), 0)
  c.sheet.hitDice.used += n
  if (CLASSES[c.sheet.class]?.caster === "pact") for (const s of Object.values(c.sheet.slots)) s.used = 0
  saveSheet(db, id, c.sheet)
  const healed = n ? heal(db, id, gained) : `${c.name} descansa.`
  return `Descanso curto: ${n} dado(s) de vida [${rolls.join(",")}] ${fmtMod(con)} cada → ${healed}`
}

export function gainXp(db: DB, id: string, amount: number): string {
  const c = getCharacter(db, id)
  const xp = c.xp + amount
  db.prepare("UPDATE characters SET xp = ? WHERE id = ?").run(xp, id)
  const ready = levelForXp(xp) > c.level
  return `${c.name} ganha ${amount} XP (total ${xp}).${ready ? ` SUBIDA DE NÍVEL disponível (${c.level} → ${c.level + 1}): dnd levelup ${id}` : ""}`
}

export function levelUp(db: DB, id: string, hpMode: "media" | "rolar", rng: Rng = cryptoRng, options: LevelChoices = {}): string {
  if (pendingRequests(db).length) throw new Error("Role os dados primeiro.")
  const c = getCharacter(db, id)
  if (c.level >= 20) throw new Error("Nível máximo.")
  if (c.kind === "pc" && c.xp < XP_THRESHOLDS[c.level]) throw new Error(`${c.name} tem ${c.xp} XP; precisa de ${XP_THRESHOLDS[c.level]} para o nível ${c.level + 1}.`)
  if (c.status === "morto") throw new Error(`${c.name} está morto.`)
  const oldCon = abilityMod(c, "con")
  const oldDex = abilityMod(c, "des")
  const level = c.level + 1
  if (c.sheet.class) applyLevelChoices(c.sheet, level, options)
  const die = c.sheet.hitDice.die
  const base = hpMode === "rolar" ? rng(die) : Math.floor(die / 2) + 1
  const gain = Math.max(1, base + abilityMod(c, "con")) + (abilityMod(c, "con") - oldCon) * c.level
  c.sheet.hitDice.max = level
  const slots = maxSlotsFor({ ...c, level })
  const next: Character["sheet"]["slots"] = {}
  for (const [lvl, max] of Object.entries(slots)) next[lvl] = { max, used: Math.min(c.sheet.slots[lvl]?.used ?? 0, max) }
  c.sheet.slots = next
  saveSheet(db, id, c.sheet)
  const armor = all<ItemRow>(db, "SELECT * FROM items WHERE owner_char = ? AND equipped = 1 AND kind = 'armadura'", id).find((i) => typeof JSON.parse(i.props).ac === "number")
  const cap = armor ? (JSON.parse(armor.props).max_dex ?? 99) as number : 99
  const acDelta = Math.min(abilityMod(c, "des"), cap) - Math.min(oldDex, cap)
  db.prepare("UPDATE characters SET level = ?, max_hp = max_hp + ?, hp = CASE WHEN hp > 0 THEN hp + ? ELSE hp END, ac = ac + ? WHERE id = ?").run(level, gain, gain, acDelta, id)
  return `${c.name} sobe para o nível ${level}: +${gain} PV (${hpMode === "rolar" ? `d${die}=${base}` : "média"} ${fmtMod(abilityMod(c, "con"))}), proficiência +${charProf({ ...c, level })}. Habilidades e recursos SRD atualizados.`
}

export function selectFeature(db: DB, id: string, feature: string, selected: string[]): string {
  if (pendingRequests(db).length) throw new Error("Role os dados primeiro.")
  const c = getCharacter(db, id)
  chooseFeature(c.sheet, c.level, feature, selected)
  saveSheet(db, id, c.sheet)
  return `${c.name}: ${feature} → ${selected.join(", ")}.`
}

export function resourceAvailable(c: Character, resource: string): boolean {
  const r = c.sheet.resources[resource]
  return !!r && c.status === "vivo" && c.hp > 0 && !c.sheet.conditions.some((x) => ["inconsciente", "paralisado", "petrificado", "atordoado", "incapacitado"].includes(x)) && (r.unlimited === true || r.used < r.max)
}

/** Deve executar numa transação, tanto para CLI/apply quanto para ações da mesa. */
export function useResource(db: DB, id: string, resource: string, amount = 1, target?: string, rng: Rng = cryptoRng): string {
  if (pendingRequests(db).length) throw new Error("Role os dados primeiro.")
  const c = getCharacter(db, id)
  const r = c.sheet.resources[resource]
  if (!r) throw new Error(`Recurso "${resource}" não existe para ${c.name}.`)
  if (!resourceAvailable(c, resource)) throw new Error(`${c.name} não pode usar ${r.name} agora (esgotado ou incapaz de agir).`)
  if (!Number.isInteger(amount) || amount < 1 || (!r.unlimited && r.used + amount > r.max)) throw new Error("Quantidade inválida ou recurso insuficiente.")
  if (!["cura-pelas-maos", "ki", "pontos-de-feiticaria"].includes(resource) && amount !== 1) throw new Error("Este recurso gasta uma carga por uso.")
  if (target && resource !== "cura-pelas-maos") throw new Error("Este recurso não aceita alvo de cura.")
  const recipient = target ? getCharacter(db, target) : c
  if (resource === "cura-pelas-maos" && (recipient.status === "morto" || recipient.place_id !== c.place_id)) throw new Error("Alvo deve estar vivo e no mesmo local.")
  r.used += r.unlimited ? 0 : amount
  saveSheet(db, id, c.sheet)
  let effect = r.effect
  if (resource === "segundo-folego") {
    const outcome = rollNow(db, { kind: "livre", who: id, expr: `1d10+${c.level}`, reason: "Segundo Fôlego" }, undefined, rng)
    effect = `${outcome.text} ${heal(db, id, outcome.total)}`
  } else if (resource === "cura-pelas-maos") effect = heal(db, recipient.id, amount)
  else if (resource === "integridade-corporal") effect = heal(db, id, c.level * 3)
  const text = `${c.name} usa ${r.name}: ${effect} Restam ${r.unlimited ? "usos ilimitados" : `${r.max - r.used}/${r.max}`} (descanso ${r.resets_on === "short" ? "curto" : "longo"}).`
  log(db, "recurso", text)
  return text
}

export function useSlot(db: DB, id: string, level: number): string {
  const c = getCharacter(db, id)
  const slot = c.sheet.slots[String(level)]
  if (!slot) throw new Error(`${c.name} não tem espaços de magia de nível ${level}.`)
  if (slot.used >= slot.max) {
    const free = Object.entries(c.sheet.slots).filter(([, s]) => s.used < s.max).map(([l]) => l)
    throw new Error(`${c.name} não tem espaços de nível ${level} livres (${slot.used}/${slot.max}). Livres: ${free.join(", ") || "nenhum"}.`)
  }
  slot.used++
  saveSheet(db, id, c.sheet)
  return `${c.name} gasta espaço de nível ${level} (${slot.max - slot.used}/${slot.max} restantes).`
}

// ---------- utilidades de parse para o CLI/lote ----------

export function parseCheckKey(raw: string): { kind: "pericia" | "atributo"; key: string } {
  const skill = parseSkill(raw)
  if (skill) return { kind: "pericia", key: skill }
  const ability = parseAbility(raw)
  if (ability) return { kind: "atributo", key: ability }
  throw new Error(`"${raw}" não é perícia nem atributo. Perícias: ${Object.keys(SKILLS).join(", ")}. Atributos: for, des, con, int, sab, car.`)
}

export function parseMode(adv: boolean, dis: boolean): Mode {
  if (adv && dis) return "normal"
  return adv ? "vantagem" : dis ? "desvantagem" : "normal"
}

export function resolveCharRef(db: DB, ref: string, labels?: Map<string, string>): string {
  return resolveRef(db, ref, ["pc", "npc"], labels)
}

export function initiativeBonus(c: Character): number {
  return mod(c.sheet.abilities.des)
}

export function pendingRequests(db: DB): RequestRow[] {
  return all<RequestRow>(db, "SELECT * FROM roll_requests WHERE status = 'pendente' ORDER BY id")
}

export function cancelRequest(db: DB, id: number): string {
  const r = one<RequestRow>(db, "SELECT * FROM roll_requests WHERE id = ?", id)
  if (!r || r.status !== "pendente") throw new Error(`Pedido #${id} não está pendente.`)
  db.prepare("UPDATE roll_requests SET status = 'cancelada' WHERE id = ?").run(id)
  return `Pedido #${id} cancelado.`
}
