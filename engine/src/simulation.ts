// Mundo vivo: o tempo só passa pelo motor, e cada passagem move rotinas, agendas e eventos.
import { all, type DB, getMeta, log, metaNum, one, setMeta } from "./db.ts"
import { insertFact } from "./facts.ts"
import { cryptoRng, type Rng } from "./dice.ts"
import { clearReactions, drawnWeapon, reactToDrawnWeapon } from "./items.ts"
import { initiativeBonus } from "./mechanics.ts"
import { type CharacterRow, fmtClock, getCharacter, getPlace, now, pcId, scheduledPlace } from "./world.ts"

interface ClockRow {
  id: string
  name: string
  segments: number
  filled: number
  every_min: number | null
  last_tick_min: number
  on_complete: string
  status: string
}

export function advanceTime(db: DB, minutes: number): string[] {
  if (!Number.isInteger(minutes) || minutes <= 0) throw new Error("Avanço de tempo deve ser inteiro positivo (minutos).")
  if (minutes > 30 * 1440) throw new Error("Avanço máximo de 30 dias por vez.")
  const from = now(db)
  const to = from + minutes
  setMeta(db, "now", to)
  const out = [`Tempo: ${fmtClock(from)} → ${fmtClock(to)}.`]

  for (const c of all<ClockRow>(db, "SELECT * FROM clocks WHERE status = 'ativo' AND every_min IS NOT NULL")) {
    const ticks = Math.floor((to - c.last_tick_min) / c.every_min!)
    if (ticks <= 0) continue
    const filled = Math.min(c.segments, c.filled + ticks)
    const triggered = filled >= c.segments
    db.prepare("UPDATE clocks SET filled = ?, last_tick_min = ?, status = ? WHERE id = ?").run(
      filled, c.last_tick_min + ticks * c.every_min!, triggered ? "disparado" : "ativo", c.id
    )
    out.push(triggered
      ? `⚠ AGENDA DISPAROU: "${c.name}" [${c.id}] → ${c.on_complete}. Resolva com clock.resolve.`
      : `Agenda "${c.name}" [${c.id}] avançou para ${filled}/${c.segments}.`)
  }

  for (const e of all<{ id: number; text: string }>(db, "SELECT id, text FROM events WHERE status = 'pendente' AND at_min <= ?", to)) {
    db.prepare("UPDATE events SET status = 'vencido' WHERE id = ?").run(e.id)
    out.push(`⚠ EVENTO VENCEU #${e.id}: ${e.text}. Resolva com event.resolve.`)
  }

  const pc = pcId(db)
  const pcPlace = pc ? getCharacter(db, pc).place_id : null
  const npcs = all<CharacterRow>(db, "SELECT * FROM characters WHERE kind = 'npc' AND status = 'vivo' AND companion = 0 AND schedule <> '[]'")
  for (const n of npcs) {
    const target = scheduledPlace(JSON.parse(n.schedule), to)
    if (!target || target === n.place_id) continue
    const left = n.place_id
    db.prepare("UPDATE characters SET place_id = ? WHERE id = ?").run(target, n.id)
    const dest = getPlace(db, target).name
    insertFact(db, { about: n.id, text: `FORA DE CENA: ${n.name} foi para ${dest} pela rotina.`, secret: true, source: "motor", truth: "verdade" })
    if (pcPlace && (pcPlace === target || pcPlace === left)) {
      out.push(pcPlace === target ? `${n.name} [${n.id}] chegou ao local do PC (rotina).` : `${n.name} [${n.id}] saiu do local do PC para ${dest} (rotina).`)
    }
  }

  const chunk = 12 * 60
  if (minutes >= chunk) {
    const steps = Math.floor(minutes / chunk)
    for (const f of all<{ id: string; name: string; goal: string }>(db, "SELECT id, name, goal FROM factions WHERE goal <> ''")) {
      const key = `offscreen:${f.id}`
      const already = metaNum(db, key)
      if (already >= to) continue
      for (let i = 0; i < steps; i++) {
        insertFact(db, {
          about: f.id,
          text: `FORA DE CENA: ${f.name} avançou o objetivo "${f.goal}" enquanto o PC estava longe.`,
          secret: true,
          source: "motor",
          truth: "verdade",
        })
      }
      setMeta(db, key, to)
      out.push(`Fora de cena: ${f.name} moveu a agenda (${steps} passo(s)). Fato secreto para narrar.`)
    }
  }
  log(db, "tempo", out.join(" | "))
  return out
}

/** Move o PC por uma ligação existente (o tempo de viagem passa) ou reposiciona um NPC. */
export function move(db: DB, who: string, to: string): string[] {
  const c = getCharacter(db, who)
  getPlace(db, to)
  if (c.status === "morto") throw new Error(`${c.name} está morto.`)
  if (c.kind === "npc") {
    db.prepare("UPDATE characters SET place_id = ? WHERE id = ?").run(to, who)
    return [`${c.name} agora está em ${getPlace(db, to).name}.`]
  }
  if (getMeta(db, "combat")) throw new Error("Há combate em andamento; encerre com dnd combat end antes de viajar.")
  if (c.place_id === to) return [`${c.name} já está em ${getPlace(db, to).name}.`]
  const out: string[] = []
  if (c.place_id) {
    // Entrar num sublocal ou sair para o local de cima (Forja ↔ Vila) é caminho sem tempo, como a cena anuncia.
    const link = one<{ minutes: number }>(db, "SELECT minutes FROM links WHERE from_id = ? AND to_id = ?", c.place_id, to)
      ?? one<{ minutes: number }>(db, "SELECT 0 AS minutes FROM places WHERE (id = ? AND parent_id = ?) OR (id = ? AND parent_id = ?)", to, c.place_id, c.place_id, to)
    if (!link) {
      const exits = all<{ id: string; name: string }>(
        db,
        "SELECT p.id, p.name FROM links l JOIN places p ON p.id = l.to_id WHERE l.from_id = ? UNION SELECT id, name FROM places WHERE parent_id = ? UNION SELECT p.id, p.name FROM places c JOIN places p ON p.id = c.parent_id WHERE c.id = ?",
        c.place_id, c.place_id, c.place_id,
      )
      const short = (id: string) => one<{ code: string }>(db, "SELECT code FROM codes WHERE entity = ?", id)?.code ?? id
      throw new Error(`Não há caminho registrado de ${getPlace(db, c.place_id).name} para ${getPlace(db, to).name}. Saídas daqui: ${exits.map((e) => `${e.name} [${short(e.id)}]`).join("; ") || "nenhuma"}. Vá por elas (um move por trecho) ou crie a ligação (link, minutos > 0), se fizer sentido no mundo.`)
    }
    if (link.minutes > 0) out.push(...advanceTime(db, link.minutes))
  }
  clearReactions(db, c.place_id)
  db.prepare("UPDATE characters SET place_id = ? WHERE id = ? OR (companion = 1 AND status IN ('vivo','inconsciente'))").run(to, who)
  db.prepare("UPDATE places SET visited = 1 WHERE id = ?").run(to)
  out.push(`${c.name} chega a ${getPlace(db, to).name}.`)
  const weapon = drawnWeapon(db, who)
  if (weapon) {
    const reactions = reactToDrawnWeapon(db, c.name, weapon, to)
    if (reactions.length) out.push(`Chegou com ${weapon} em punho. Reações: ${reactions.join("; ")}.`)
  }
  const companions = all<{ name: string }>(db, "SELECT name FROM characters WHERE companion = 1 AND place_id = ?", to)
  if (companions.length) out.push(`Acompanhado por: ${companions.map((x) => x.name).join(", ")}.`)
  return out
}

// ---------- combate ----------

export interface CombatState {
  round: number
  index: number
  order: { id: string; init: number }[]
}

export function getCombat(db: DB): CombatState | null {
  const raw = getMeta(db, "combat")
  return raw ? (JSON.parse(raw) as CombatState) : null
}

export function startCombat(db: DB, ids: string[], rng: Rng = cryptoRng): string[] {
  if (getCombat(db)) throw new Error("Já há um combate em andamento (dnd combat end para encerrar).")
  const pc = pcId(db)
  const participants = [...new Set([...(pc ? [pc] : []), ...ids])]
  if (participants.length < 2) throw new Error("Combate precisa de pelo menos dois participantes.")
  const order = participants.map((id) => {
    const c = getCharacter(db, id)
    if (c.status === "morto") throw new Error(`${c.name} está morto.`)
    const roll = rng(20)
    return { id, init: roll + initiativeBonus(c), roll, name: c.name, dex: c.sheet.abilities.des }
  })
  order.sort((a, b) => b.init - a.init || b.dex - a.dex)
  setMeta(db, "combat", JSON.stringify({ round: 1, index: 0, order: order.map(({ id, init }) => ({ id, init })) }))
  log(db, "combate", `Início: ${order.map((o) => `${o.name} ${o.init}`).join(", ")}`)
  return ["Combate iniciado. Iniciativa:", ...order.map((o, i) => `${i + 1}. ${o.name} [${o.id}] ${o.init} (d20=${o.roll})`), `Vez de: ${order[0].name}.`]
}

export function nextTurn(db: DB): string[] {
  const state = getCombat(db)
  if (!state) throw new Error("Não há combate em andamento.")
  for (let step = 0; step < state.order.length; step++) {
    state.index++
    if (state.index >= state.order.length) {
      state.index = 0
      state.round++
    }
    const c = getCharacter(db, state.order[state.index].id)
    if (c.status !== "morto") {
      setMeta(db, "combat", JSON.stringify(state))
      const note = c.hp === 0 && (c.kind === "pc" || c.companion) ? " (caído: role dnd deathsave)" : ""
      return [`Rodada ${state.round} — vez de ${c.name} [${c.id}] (${c.hp}/${c.max_hp} PV)${note}.`]
    }
  }
  throw new Error("Todos os participantes estão mortos; encerre o combate.")
}

export function endCombat(db: DB): string[] {
  const state = getCombat(db)
  if (!state) throw new Error("Não há combate em andamento.")
  setMeta(db, "combat", "")
  const out = [`Combate encerrado após ${state.round} rodada(s).`]
  out.push(...advanceTime(db, Math.max(1, Math.ceil((state.round * 6) / 60))))
  return out
}
