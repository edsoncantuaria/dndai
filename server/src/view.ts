// Visão do jogo para o cliente (Godot): tudo já calculado pelo motor, o cliente só apresenta.
import type { Campaign } from "./core/campaign.ts"
import { all, getMeta } from "./core/db.ts"
import { authorityOf, faction as getFaction, membersOf, ranksOf, standing } from "./core/factions.ts"
import { dungeonOf, featuresAt } from "./core/dungeon.ts"
import { doorBetween } from "./core/explore.ts"
import { combatState } from "./core/mechanics.ts"
import { pcRow, pcView } from "./core/pc.ts"
import { ABILITIES, ABILITY_PT, mod, resourceList, XP_TABLE } from "./core/sheet.ts"
import { AURAS } from "./core/auras.ts"
import { clock } from "./mestre/context.ts"
import { bible } from "./world/seed.ts"
import { chatView } from "./mestre/queue.ts"

export function gameView(c: Campaign, slug: string) {
  const info = c.info()
  const base = { version: c.version, campaign: { slug, name: info.name, premise: info.premise, tone: info.tone, turn: c.turn, when: clock(c.time), minute: c.time } }
  if (!pcRow(c)) return { ...base, creation_needed: true }
  const v = pcView(c)
  const s = v.sheet, d = v.derived
  const nameOf = (coll: "features" | "feats" | "traits", idx: string) => c.srd.get(coll, idx, "pt-BR")?.name ?? idx
  const skills = c.srd.list("skills").map((k) => ({ index: k.index, name: k.name, ability: k.ability_score.index, bonus: d.skills[k.index], proficient: s.skills.includes(k.index), expertise: s.expertise.includes(k.index) }))
  const place = v.row.place_id ? all<{ id: string; name: string; kind: string; summary: string; details: string }>(c.db, "SELECT id, name, kind, summary, details FROM places WHERE id = ?", v.row.place_id)[0] : undefined
  const chat = chatView(slug, 1).master
  const xpNext = s.level < 20 ? XP_TABLE[s.level]! : null
  const combat = combatState(c)
  return {
    ...base, creation_needed: false,
    pc: {
      id: "pc", name: v.row.name, class: c.srd.get("classes", s.class)?.name ?? s.class, class_index: s.class, subclass: s.subclass ? c.srd.get("subclasses", s.subclass)?.name : null,
      species: c.srd.get("species", s.species)?.name ?? s.species, subspecies: s.subspecies ? c.srd.get("subspecies", s.subspecies)?.name : null, background: c.srd.get("backgrounds", s.background)?.name ?? s.background,
      level: s.level, hp: v.row.hp, max_hp: v.row.max_hp, temp_hp: v.row.temp_hp, ac: v.row.ac, xp: v.row.xp, xp_next: xpNext, can_level_up: xpNext !== null && v.row.xp >= xpNext,
      status: v.row.status, conditions: s.conditions, death_saves: s.deathSaves, inspiration: s.inspiration, exhaustion: s.exhaustion,
      abilities: Object.fromEntries(ABILITIES.map((a) => [a, { name: ABILITY_PT[a], score: s.abilities[a], mod: mod(s.abilities[a]), save: d.saves[a], save_proficient: s.saves.includes(a) }])),
      skills, prof: d.prof, initiative: d.initiative, passive_perception: d.passivePerception, speed: s.speed, size: s.size,
      spell: s.spell ? { ability: s.spell.ability, dc: d.spellDc, attack: d.spellAttack, cantrips: s.spell.cantrips.map((i) => ({ index: i, name: c.srd.get("spells", i)?.name ?? i })), prepared: s.spell.prepared.map((i) => ({ index: i, name: c.srd.get("spells", i)?.name ?? i, level: c.srd.get("spells", i)?.level })), spellbook: s.spell.spellbook ?? null } : null,
      slots: Object.entries(s.slots).map(([level, x]) => ({ level: Number(level), max: x.max, used: x.used })),
      resources: resourceList(s).map((r) => ({ key: r.key, label: r.label, max: r.max, left: r.max - (s.uses[r.key] ?? 0) })),
      raging: !!s.notes.raging, concentration: (s.notes.concentration as string | null) ?? null,
      hit_dice: { die: s.hitDie, left: s.hitDiceLeft, max: s.level }, money_cp: v.row.cp,
      features: s.features.map((i) => ({ index: i, name: nameOf("features", i) })), feats: s.feats.map((i) => ({ index: i, name: nameOf("feats", i) })), traits: s.traits.map((i) => ({ index: i, name: nameOf("traits", i) })),
      languages: s.languages.map((i) => c.srd.get("languages", i)?.name ?? i), tools: s.tools, mastery: s.mastery,
    },
    items: v.items.map((i) => {
      const kind = (all<{ kind: string }>(c.db, "SELECT kind FROM items WHERE id = ?", i.id)[0])?.kind ?? "equipamento"
      const wearable = ["arma", "armadura", "escudo", "magico"].includes(kind)
      return { id: i.id, name: i.name, srd: i.srd, qty: i.qty, equipped: !!i.equipped, kind, actions: [...(wearable ? [i.equipped ? "desequipar" : "equipar"] : []), "largar"] }
    }),
    attacks: d.attacks,
    bible: bible(c).map((b) => ({ key: b.key, title: b.title, text: b.text })),
    place: place ? { ...place, aura: ((a) => (a ? { id: a, name: AURAS[a]?.nome ?? a, effect: AURAS[a]?.efeito ?? "" } : null))(all<{ aura: string | null }>(c.db, "SELECT aura FROM places WHERE id = ?", place.id)[0]?.aura), control: ((a) => (a.faction ? { faction: a.faction.name, realm: a.realm && a.realm.id !== a.faction.id ? a.realm.name : null } : null))(authorityOf(c, place.id)) } : null,
    factions: all<{ id: string }>(c.db, "SELECT id FROM factions ORDER BY power DESC").map((f) => getFaction(c, f.id)).filter((f) => f.known || standing(c, f.id).value !== 0 || standing(c, f.id).status !== "nenhum").map((f) => {
      const st = standing(c, f.id)
      return { id: f.id, name: f.name, kind: f.kind, summary: f.summary, power: f.power, standing: st.value, status: st.status, rank: st.status === "membro" ? ranksOf(f)[st.rank] : null, parent: f.parent_id ? getFaction(c, f.parent_id).name : null }
    }),
    bounties: all<{ faction_id: string; amount_cp: number; reason: string }>(c.db, "SELECT * FROM bounties WHERE amount_cp > 0").map((b) => ({ faction: getFaction(c, b.faction_id).name, amount_cp: b.amount_cp, reason: b.reason })),
    exits: place ? all<{ id: string; name: string; minutes: number; visited: number }>(c.db, "SELECT p.id, p.name, l.minutes, p.visited FROM links l JOIN places p ON p.id = l.to_id WHERE l.from_id = ? ORDER BY l.minutes", place.id).map((e) => { const door = doorBetween(c, place.id, e.id); return { ...e, locked: !!(door && door.data.locked > 0 && !door.data.open) } }) : [],
    dungeon: place ? ((d) => d ? { name: d.name, theme: d.theme, level: d.level, status: d.status, visited: all<{ n: number }>(c.db, "SELECT COUNT(*) n FROM places WHERE dungeon_id = ? AND visited = 1", d.id)[0]!.n, total: all<{ n: number }>(c.db, "SELECT COUNT(*) n FROM places WHERE dungeon_id = ?", d.id)[0]!.n } : null)(dungeonOf(c, place.id)) : null,
    features: place ? featuresAt(c, place.id).filter((f) => f.state !== "oculto" && f.kind !== "monstros" && !(f.kind === "porta" && f.data.open)).map((f) => ({ id: f.id, kind: f.kind, name: f.name, state: f.state, note: f.data.note ?? f.data.prompt ?? f.data.desc ?? null })) : [],
    present: place ? all<{ id: string; kind: string; name: string; summary: string; status: string; hp: number; max_hp: number; attitude: number; companion: number }>(c.db, "SELECT id, kind, name, summary, status, hp, max_hp, attitude, companion FROM characters WHERE place_id = ? AND kind <> 'pc' ORDER BY companion DESC, id", place.id).map((n) => ({ ...n, factions: membersOf(c, n.id).filter((m) => getFaction(c, m.id).known).map((m) => ({ name: m.faction, rank: m.rank })), companion: !!n.companion, gender: (JSON.parse(all<{ persona: string }>(c.db, "SELECT persona FROM characters WHERE id = ?", n.id)[0]!.persona) as { gender?: string }).gender ?? null })) : [],
    combat: combat ? { round: combat.round, turn: combat.turn, order: combat.order.map((o) => { const r = all<{ name: string; hp: number; max_hp: number; status: string }>(c.db, "SELECT name, hp, max_hp, status FROM characters WHERE id = ?", o.id)[0]; return { id: o.id, init: o.init, name: r?.name, hp: r?.hp, max_hp: r?.max_hp, status: r?.status } }) } : null,
    quests: all<{ id: string; title: string; summary: string; status: string; objectives: string }>(c.db, "SELECT id, title, summary, status, objectives FROM quests WHERE secret = 0 ORDER BY status = 'ativa' DESC, updated_turn DESC").map((q) => ({ ...q, objectives: JSON.parse(q.objectives) })),
    journal: all<{ turn: number; text: string }>(c.db, "SELECT turn, text FROM narrations ORDER BY id DESC LIMIT 40").reverse().map((n) => ({ ...n, action: all<{ action: string }>(c.db, "SELECT action FROM turns WHERE n = ?", n.turn)[0]?.action ?? "" })),
    rolls: all<{ id: number; turn: number; who: string; label: string; expr: string; total: number; natural: number | null; dc: number | null; success: number | null; result: string }>(c.db, "SELECT * FROM rolls ORDER BY id DESC LIMIT 12").reverse().map((r) => ({ id: r.id, turn: r.turn, who: r.who, label: r.label, expr: r.expr, total: r.total, natural: r.natural, dc: r.dc, success: r.success === null ? null : !!r.success, ...(JSON.parse(r.result) as object) })),
    options: JSON.parse(getMeta(c.db, "options", "[]")) as string[],
    master: chat,
  }
}
