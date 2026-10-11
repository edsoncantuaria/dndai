// GameView: o que a mesa (jogador) pode ver. NUNCA inclui segredos, agendas ou persona interna dos NPCs.
import { all, type DB, getMeta, metaNum, one } from "./db.ts"
import { pendingRequests, type RollOutcome } from "./mechanics.ts"
import { itemActions, itemEffect, reactionOf } from "./items.ts"
import { itemsOf } from "./ops.ts"
import { ABILITIES, ABILITY_NAMES, attitudeLabel, CLASSES, levelForXp, SKILLS, XP_THRESHOLDS } from "./rules.ts"
import { getCombat } from "./simulation.ts"
import {
  abilityMod, type CharacterRow, type ItemRow, charProf, clockParts, getCharacter, getPlace, now, pcId, saveBonus, skillBonus, spellInfo,
} from "./world.ts"

function itemView(db: DB, i: ItemRow) {
  return {
    id: i.id, name: i.name, qty: i.qty, kind: i.kind, equipped: !!i.equipped, notes: i.notes, props: JSON.parse(i.props) as Record<string, unknown>,
    actions: itemActions(db, i), drawn: !!i.drawn, effect: itemEffect(i),
  }
}

interface NpcView {
  id: string
  name: string
  summary: string
  status: string
  attitude: number
  attitudeLabel: string
  companion: boolean
  hp?: number
  maxHp?: number
  portrait: string | null
  reaction: string | null
}

export function buildView(db: DB, slug: string) {
  const turnN = metaNum(db, "turn")
  const open = getMeta(db, "turn_open") === "1"
  const minutes = now(db)
  const pid = pcId(db)
  const pcChar = pid ? getCharacter(db, pid) : null

  const pc = pcChar && (() => {
    const c = pcChar
    const s = c.sheet
    const spell = spellInfo(c)
    return {
      id: c.id, name: c.name, race: s.race, class: s.class, classLabel: CLASSES[s.class]?.label ?? s.class, subclass: s.subclass, background: s.background,
      level: c.level, xp: c.xp, nextLevelXp: c.level < 20 ? XP_THRESHOLDS[c.level] : null, levelUpReady: levelForXp(c.xp) > c.level,
      hp: c.hp, maxHp: c.max_hp, tempHp: c.temp_hp, ac: c.ac, speed: s.speed, initiative: abilityMod(c, "des"), profBonus: charProf(c),
      status: c.status,
      abilities: Object.fromEntries(ABILITIES.map((a) => [a, { score: s.abilities[a], mod: abilityMod(c, a), save: saveBonus(c, a), proficientSave: s.saves.includes(a) }])),
      skills: Object.entries(SKILLS).map(([key, def]) => ({
        key, label: def.label, ability: def.ability, bonus: skillBonus(c, key, def.ability), proficient: s.skills.includes(key) || s.expertise.includes(key), expertise: s.expertise.includes(key),
      })),
      passivePerception: 10 + skillBonus(c, "percepcao", "sab"),
      conditions: s.conditions, death: s.death, hitDice: s.hitDice,
      spellcasting: spell ? {
        ability: spell.ability, abilityLabel: ABILITY_NAMES[spell.ability], saveDc: spell.dc, attackBonus: spell.attack,
        slots: Object.entries(s.slots).map(([l, v]) => ({ level: Number(l), max: v.max, used: v.used })), spells: s.spells,
      } : null,
      money: { po: Math.floor(c.cp / 100), pp: Math.floor((c.cp % 100) / 10), pc: c.cp % 10 },
      inventory: itemsOf(db, c.id).map((i) => itemView(db, i)),
      features: s.features,
      portrait: s.portrait ?? null,
    }
  })()

  let location = null
  let present: NpcView[] = []
  if (pcChar?.place_id) {
    const p = getPlace(db, pcChar.place_id)
    const parent = p.parent_id ? getPlace(db, p.parent_id) : null
    location = {
      id: p.id, name: p.name, kind: p.kind, summary: p.summary, details: p.details,
      parent: parent ? { id: parent.id, name: parent.name } : null,
      exits: all<{ id: string; name: string; minutes: number; via: string }>(db, "SELECT p.id, p.name, l.minutes, l.via FROM links l JOIN places p ON p.id = l.to_id WHERE l.from_id = ? ORDER BY l.minutes", p.id),
      items: itemsOf(db, p.id).map((i) => itemView(db, i)),
    }
    const combatIds = new Set((getCombat(db)?.order ?? []).map((o) => o.id))
    present = all<CharacterRow>(db, "SELECT * FROM characters WHERE kind = 'npc' AND place_id = ? AND status <> 'morto' ORDER BY companion DESC, name", p.id).map((n) => {
      const showHp = n.companion === 1 || combatIds.has(n.id)
      return {
        id: n.id, name: n.name, summary: n.summary, status: n.status, attitude: n.attitude, attitudeLabel: attitudeLabel(n.attitude), companion: !!n.companion,
        ...(showHp ? { hp: n.hp, maxHp: n.max_hp } : {}),
        portrait: (JSON.parse(n.sheet) as { portrait?: string }).portrait ?? null,
        reaction: reactionOf(db, n.id),
      }
    })
  }

  const combatState = getCombat(db)
  const combat = combatState && {
    round: combatState.round,
    order: combatState.order.map((o, i) => {
      const c = getCharacter(db, o.id)
      return { id: c.id, name: c.name, initiative: o.init, hp: c.hp, maxHp: c.max_hp, status: c.status, current: i === combatState.index, isPc: c.kind === "pc" }
    }),
  }

  const quests = all<{ id: string; title: string; summary: string; status: string; giver_id: string | null; objectives: string }>(
    db, "SELECT * FROM quests WHERE secret = 0 ORDER BY status = 'ativa' DESC, updated_turn DESC"
  ).map((q) => ({
    id: q.id, title: q.title, summary: q.summary, status: q.status,
    giver: q.giver_id ? one<{ name: string }>(db, "SELECT name FROM characters WHERE id = ?", q.giver_id)?.name ?? null : null,
    objectives: JSON.parse(q.objectives) as { text: string; done: boolean }[],
  }))

  const facts = all<{ id: number; text: string; about_id: string | null; at_min: number }>(db, "SELECT id, text, about_id, at_min FROM facts WHERE secret = 0 ORDER BY id DESC LIMIT 100")
    .map((f) => ({ id: f.id, text: f.text, about: f.about_id, day: clockParts(f.at_min).day }))

  const journal = all<{ n: number; started_min: number; action: string; summary: string; narration: string }>(
    db, "SELECT * FROM (SELECT * FROM turns ORDER BY n DESC LIMIT 50) ORDER BY n"
  ).map((t) => ({ n: t.n, ...(({ day, time }) => ({ day, time }))(clockParts(t.started_min)), action: t.action, summary: t.summary, narration: t.narration }))

  const places = all<{ id: string; name: string; kind: string; parent_id: string | null; visited: number }>(db, "SELECT id, name, kind, parent_id, visited FROM places")
  const visited = new Set(places.filter((p) => p.visited).map((p) => p.id))
  const links = all<{ from_id: string; to_id: string; minutes: number; via: string }>(db, "SELECT * FROM links")
  // O jogador conhece locais visitados e os vizinhos diretos deles (saídas que já viu).
  const known = new Set(visited)
  for (const l of links) if (visited.has(l.from_id)) known.add(l.to_id)
  for (const p of places) if (p.parent_id && known.has(p.id)) known.add(p.parent_id)

  const pendingRolls = pendingRequests(db).map((r) => {
    const parsed = JSON.parse(r.dice) as { sides: number[] }
    return {
      id: r.id, who: r.who, whoName: getCharacter(db, r.who).name, kind: r.kind, label: r.label, dice: parsed.sides.map((sides) => ({ sides })),
      mode: r.mode, modifier: r.modifier, dc: r.kind === "ataque" ? null : r.dc, reason: r.reason, createdTurn: r.created_turn,
    }
  })
  const lastRolls = all<{ result: string }>(db, "SELECT result FROM roll_requests WHERE status = 'resolvida' ORDER BY id DESC LIMIT 10")
    .map((r) => {
      const { text: _text, ...rest } = JSON.parse(r.result) as RollOutcome
      return rest
    })

  return {
    version: metaNum(db, "version"),
    campaign: { slug, name: getMeta(db, "name"), premise: getMeta(db, "premise"), tone: getMeta(db, "tone") },
    clock: { ...clockParts(minutes), minutes },
    turn: { n: turnN, open, action: open ? one<{ action: string }>(db, "SELECT action FROM turns WHERE n = ?", turnN)?.action ?? null : null },
    pc, location, present, combat, quests, facts, journal,
    map: {
      places: places.filter((p) => known.has(p.id)).map((p) => ({ id: p.id, name: p.name, kind: p.kind, parent: p.parent_id, visited: !!p.visited, current: p.id === pcChar?.place_id })),
      links: links.filter((l) => known.has(l.from_id) && known.has(l.to_id) && (visited.has(l.from_id) || visited.has(l.to_id))).map((l) => ({ from: l.from_id, to: l.to_id, minutes: l.minutes, via: l.via })),
    },
    pendingRolls, lastRolls,
    intents: all<{ id: number; text: string; status: string }>(db, "SELECT id, text, status FROM intents ORDER BY id DESC LIMIT 20"),
  }
}
