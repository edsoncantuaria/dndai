// Multiverso compartilhado. O atlas (campaigns/atlas.db) guarda a DEFINIÇÃO do mundo criado por todas as
// campanhas: locais, ligações, NPCs, facções, lore e os heróis dos jogadores (como NPCs). Cada campanha é um
// universo: nasce com o atlas inteiro, puxa novidades a cada turno e publica o que cria. O ESTADO (vida, morte,
// atitude, memórias, inventário, missões) é sempre local do universo, então histórias nunca conflitam.
//
// O atlas é anexado (ATTACH) à conexão da campanha: publicar e jogar acontecem na mesma transação.
import { join } from "node:path"
import { all, type DB, getMeta, index, metaNum, one, setMeta } from "./db.ts"
import { CLASSES } from "./rules.ts"
import { type CharacterRow, type PlaceRow, defaultSheet, type Sheet, slugify } from "./world.ts"

const ATLAS_SCHEMA = `
CREATE TABLE IF NOT EXISTS atlas.entities (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('place','npc','faction')),
  data TEXT NOT NULL,
  origin_campaign TEXT NOT NULL,
  origin_turn INTEGER NOT NULL,
  seq INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS atlas.links (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  via TEXT NOT NULL,
  origin_campaign TEXT NOT NULL,
  origin_turn INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  PRIMARY KEY (from_id, to_id)
);
CREATE TABLE IF NOT EXISTS atlas.lore (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  about_id TEXT,
  text TEXT NOT NULL,
  secret INTEGER NOT NULL,
  origin_campaign TEXT NOT NULL,
  origin_turn INTEGER NOT NULL,
  seq INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS atlas.reserved (id TEXT PRIMARY KEY, campaign TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS atlas.history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL,
  origin_campaign TEXT NOT NULL,
  origin_turn INTEGER NOT NULL,
  prev_data TEXT
);
CREATE TABLE IF NOT EXISTS atlas.counter (k TEXT PRIMARY KEY, v INTEGER NOT NULL);
`

/** Anexa o atlas compartilhado à conexão da campanha (cria se não existir). */
export function attachAtlas(db: DB, home: string): void {
  const attached = all<{ name: string }>(db, "PRAGMA database_list").some((d) => d.name === "atlas")
  if (attached) return
  db.prepare("ATTACH DATABASE ? AS atlas").run(join(home, "atlas.db"))
  db.exec("PRAGMA atlas.journal_mode = DELETE;")
  db.exec(ATLAS_SCHEMA)
}

function hasAtlas(db: DB): boolean {
  return all<{ name: string }>(db, "PRAGMA database_list").some((d) => d.name === "atlas")
}

function campaignSlug(db: DB): string {
  return getMeta(db, "slug")
}

function nextSeq(db: DB): number {
  db.prepare("INSERT INTO atlas.counter(k, v) VALUES('seq', 1) ON CONFLICT(k) DO UPDATE SET v = v + 1").run()
  return one<{ v: number }>(db, "SELECT v FROM atlas.counter WHERE k = 'seq'")!.v
}

/** Reserva o id no atlas (evita colisão entre campanhas). Retorna false se já for de outro. */
export function reserveId(db: DB, id: string): boolean {
  if (!hasAtlas(db)) return true
  const owner = one<{ campaign: string }>(db, "SELECT campaign FROM atlas.reserved WHERE id = ?", id)
  if (owner) return owner.campaign === campaignSlug(db)
  db.prepare("INSERT INTO atlas.reserved(id, campaign) VALUES(?, ?)").run(id, campaignSlug(db))
  return true
}

const SHARED = new Set(["place", "npc", "faction"])

/** Ids que vão para o atlas (o id do PC é local; o herói ganha um id de NPC próprio ao ser publicado). */
export function isSharedPrefix(prefix: string): boolean {
  return SHARED.has(prefix)
}

/** Primeiro id de NPC livre no atlas e neste universo para o herói (npc:kael, npc:kael-2, ...). */
function heroCanonId(db: DB, name: string): string {
  const base = `npc:${slugify(name)}`
  let id = base
  for (let i = 2; one(db, "SELECT 1 FROM characters WHERE id = ?", id) || !reserveId(db, id); i++) id = `${base}-${i}`
  return id
}

// ---------- definições (o que é compartilhado) ----------

function placeDef(p: PlaceRow) {
  return { name: p.name, kind: p.kind, parent_id: p.parent_id, summary: p.summary, details: p.details }
}

function statsOf(sheet: Sheet) {
  const { conditions: _c, death: _d, slots: _s, ...stats } = sheet
  return { ...stats, hitDice: { ...stats.hitDice, used: 0 } }
}

function npcDef(c: CharacterRow, home: string | null) {
  return {
    name: c.name, summary: c.summary, place_id: home, persona: JSON.parse(c.persona), sheet: statsOf(JSON.parse(c.sheet)),
    ac: c.ac, max_hp: c.max_hp, level: c.level, schedule: JSON.parse(c.schedule), faction_id: c.faction_id,
  }
}

/** O herói de um jogador, visto pelos outros universos como NPC. */
function heroDef(db: DB, c: CharacterRow) {
  const sheet = JSON.parse(c.sheet) as Sheet
  const cls = CLASSES[sheet.class]?.label ?? sheet.class
  const origin = getMeta(db, "name")
  // Os feitos viajam com o herói: os outros Mestres sabem quem ele é sem inventar o passado.
  const deeds = all<{ summary: string }>(db, "SELECT summary FROM turns WHERE ended = 1 ORDER BY n DESC LIMIT 5")
    .map((t) => t.summary.trim().replace(/\.*$/, "."))
    .reverse()
  return {
    name: c.name,
    summary: `${sheet.race} ${cls} nível ${c.level}, aventureiro(a) da crônica "${origin}".${c.summary ? ` ${c.summary}` : ""}`,
    place_id: c.place_id,
    persona: {
      traits: [],
      notes: `Herói de outro jogador (crônica "${origin}"). Feitos conhecidos: ${deeds.length ? deeds.join(" ") : "ainda nenhum"}. Interprete-o a partir disso, sem inventar outro passado.`,
    },
    sheet: statsOf(sheet), ac: c.ac, max_hp: c.max_hp, level: c.level, schedule: [], faction_id: null,
  }
}

function factionDef(f: { name: string; summary: string; goal: string }) {
  return { name: f.name, summary: f.summary, goal: f.goal }
}

// ---------- publicação ----------

interface StateRow {
  id: string
  canon_id: string
  owned: number
  def: string
  diverged: number
}

function upsertEntity(db: DB, id: string, kind: string, data: unknown, turn: number, createdTurn: number): void {
  const slug = campaignSlug(db)
  const prev = one<{ data: string; origin_campaign: string }>(db, "SELECT data, origin_campaign FROM atlas.entities WHERE id = ?", id)
  if (prev && prev.origin_campaign !== slug) return // id de outro universo: nunca sobrescreve
  // Criação é atribuída ao turno em que a entidade nasceu (o undo daquele turno a retira); edição, ao turno atual.
  const originTurn = prev ? turn : createdTurn
  db.prepare("INSERT INTO atlas.history(entity_id, origin_campaign, origin_turn, prev_data) VALUES(?,?,?,?)").run(id, slug, originTurn, prev?.data ?? null)
  db.prepare(
    `INSERT INTO atlas.entities(id, kind, data, origin_campaign, origin_turn, seq) VALUES(?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, seq = excluded.seq`
  ).run(id, kind, JSON.stringify(data), slug, originTurn, nextSeq(db))
}

/**
 * Publica no atlas o que esta campanha criou ou enriqueceu. Entidades vindas de outros universos
 * nunca são reescritas: se o universo as alterou, ficam marcadas como divergentes (estado local).
 */
export function publish(db: DB): string[] {
  if (!hasAtlas(db)) return []
  // Fora de turno aberto, o que falta publicar é de turnos já encerrados (ou da preparação).
  const turn = getMeta(db, "turn_open") === "1" ? metaNum(db, "turn") : 0
  const slug = campaignSlug(db)
  const out: string[] = []
  const state = new Map(all<StateRow>(db, "SELECT * FROM atlas_state").map((r) => [r.id, r]))
  const track = (id: string, canonId: string, def: string) =>
    db.prepare("INSERT INTO atlas_state(id, canon_id, owned, def) VALUES(?,?,1,?) ON CONFLICT(id) DO UPDATE SET def = excluded.def").run(id, canonId, def)
  const consider = (id: string, kind: string, def: object, createdTurn: number, canonId = id) => {
    const json = JSON.stringify(def)
    const st = state.get(id)
    if (st && !st.owned) {
      if (st.def !== json && !st.diverged) db.prepare("UPDATE atlas_state SET diverged = 1 WHERE id = ?").run(id)
      return
    }
    if (st?.def === json) return
    upsertEntity(db, canonId, kind, def, turn, createdTurn)
    track(id, canonId, json)
    out.push(`${st ? "~" : "+"} atlas ${kind} ${def && "name" in def ? (def as { name: string }).name : canonId}`)
  }

  for (const p of all<PlaceRow & { created_turn: number }>(db, "SELECT * FROM places ORDER BY created_turn, rowid")) consider(p.id, "place", placeDef(p), p.created_turn)
  for (const f of all<{ id: string; name: string; summary: string; goal: string; created_turn: number }>(db, "SELECT * FROM factions")) consider(f.id, "faction", factionDef(f), f.created_turn)
  for (const c of all<CharacterRow>(db, "SELECT * FROM characters ORDER BY created_turn, rowid")) {
    if (c.kind === "pc") {
      const st = state.get(c.id)
      consider(c.id, "npc", heroDef(db, c), c.created_turn, st?.canon_id ?? heroCanonId(db, c.name))
    } else {
      // A "casa" do NPC é onde ele foi criado; mudanças de lugar são estado local do universo.
      const st = state.get(c.id)
      const home = st?.def ? (JSON.parse(st.def).place_id as string | null) : c.place_id
      consider(c.id, "npc", npcDef(c, home), c.created_turn)
    }
  }
  for (const l of all<{ from_id: string; to_id: string; minutes: number; via: string }>(db, "SELECT * FROM links")) {
    const key = `link:${l.from_id}>${l.to_id}`
    if (state.has(key)) continue
    db.prepare(
      `INSERT INTO atlas.links(from_id, to_id, minutes, via, origin_campaign, origin_turn, seq) VALUES(?,?,?,?,?,?,?)
       ON CONFLICT(from_id, to_id) DO NOTHING`
    ).run(l.from_id, l.to_id, l.minutes, l.via, slug, turn, nextSeq(db))
    track(key, key, "")
  }
  for (const f of all<{ id: number; about_id: string | null; text: string; secret: number; turn: number }>(db, "SELECT id, about_id, text, secret, turn FROM facts WHERE lore = 1")) {
    const key = `fact:${f.id}`
    if (state.has(key)) continue
    db.prepare("INSERT INTO atlas.lore(about_id, text, secret, origin_campaign, origin_turn, seq) VALUES(?,?,?,?,?,?)").run(f.about_id, f.text, f.secret, slug, f.turn, nextSeq(db))
    track(key, key, "")
    out.push(`+ atlas lore: ${f.text.slice(0, 60)}`)
  }
  return out
}

// ---------- sincronização (atlas → universo) ----------

/** Traz para este universo tudo o que outros universos criaram desde a última sincronização. */
export function sync(db: DB): string[] {
  if (!hasAtlas(db)) return []
  const slug = campaignSlug(db)
  const since = metaNum(db, "atlas_seq")
  const turn = metaNum(db, "turn")
  const pcPlace = one<{ place_id: string | null }>(db, "SELECT place_id FROM characters WHERE kind = 'pc' LIMIT 1")?.place_id ?? null
  db.exec("PRAGMA defer_foreign_keys = ON")
  const added: string[] = []
  const updated: string[] = []
  const arrivals: string[] = []
  let maxSeq = since

  const entities = all<{ id: string; kind: string; data: string; seq: number }>(
    db, "SELECT id, kind, data, seq FROM atlas.entities WHERE seq > ? AND origin_campaign <> ? ORDER BY kind = 'npc', kind = 'faction', seq", since, slug
  )
  // Locais primeiro (pais antes de filhos), depois facções e NPCs.
  entities.sort((a, b) => ["place", "faction", "npc"].indexOf(a.kind) - ["place", "faction", "npc"].indexOf(b.kind) || a.seq - b.seq)
  for (const e of entities) {
    maxSeq = Math.max(maxSeq, e.seq)
    const data = JSON.parse(e.data)
    const st = one<StateRow>(db, "SELECT * FROM atlas_state WHERE id = ?", e.id)
    const existsLocally = one(db, `SELECT 1 FROM ${e.kind === "place" ? "places" : e.kind === "faction" ? "factions" : "characters"} WHERE id = ?`, e.id)
    if (st?.owned) continue
    if (existsLocally && !st) continue // id local antigo não ligado ao atlas: preserva o universo
    if (existsLocally) {
      if (st?.diverged) continue
      applyDefinition(db, e.kind, e.id, data)
      db.prepare("UPDATE atlas_state SET def = ? WHERE id = ?").run(e.data, e.id)
      updated.push(data.name)
      continue
    }
    insertDefinition(db, e.kind, e.id, data, turn)
    db.prepare("INSERT INTO atlas_state(id, canon_id, owned, def) VALUES(?,?,0,?)").run(e.id, e.id, e.data)
    added.push(`${data.name} (${e.kind === "place" ? "local" : e.kind === "npc" ? "NPC" : "facção"})`)
    if (e.kind === "npc" && pcPlace && data.place_id === pcPlace) arrivals.push(data.name)
  }

  for (const l of all<{ from_id: string; to_id: string; minutes: number; via: string; seq: number }>(
    db, "SELECT * FROM atlas.links WHERE seq > ? AND origin_campaign <> ? ORDER BY seq", since, slug
  )) {
    maxSeq = Math.max(maxSeq, l.seq)
    const both = one(db, "SELECT 1 FROM places a, places b WHERE a.id = ? AND b.id = ?", l.from_id, l.to_id)
    if (!both) continue
    const key = `link:${l.from_id}>${l.to_id}`
    const res = db.prepare("INSERT INTO links(from_id, to_id, minutes, via) VALUES(?,?,?,?) ON CONFLICT DO NOTHING").run(l.from_id, l.to_id, l.minutes, l.via)
    if (res.changes) db.prepare("INSERT INTO atlas_state(id, canon_id, owned) VALUES(?,?,0) ON CONFLICT DO NOTHING").run(key, key)
  }

  let lore = 0
  for (const f of all<{ about_id: string | null; text: string; secret: number; seq: number }>(
    db, "SELECT about_id, text, secret, seq FROM atlas.lore WHERE seq > ? AND origin_campaign <> ? ORDER BY seq", since, slug
  )) {
    maxSeq = Math.max(maxSeq, f.seq)
    const res = db.prepare("INSERT INTO facts(about_id, text, secret, turn, at_min, lore) VALUES(?,?,?,?,?,1)").run(f.about_id, f.text, f.secret, turn, metaNum(db, "now"))
    db.prepare("INSERT INTO atlas_state(id, canon_id, owned) VALUES(?,?,0)").run(`fact:${res.lastInsertRowid}`, `fact:${res.lastInsertRowid}`)
    index(db, `fact:${res.lastInsertRowid}`, f.secret ? "segredo" : "fato", f.text)
    lore++
  }
  // Também avança sobre o que este universo publicou (não precisa reimportar).
  const top = one<{ v: number }>(db, "SELECT v FROM atlas.counter WHERE k = 'seq'")?.v ?? 0
  setMeta(db, "atlas_seq", Math.max(maxSeq, top))

  const out: string[] = []
  if (added.length) out.push(`Multiverso: chegaram ${added.length} novidade(s) de outras crônicas: ${added.slice(0, 15).join(", ")}${added.length > 15 ? "…" : ""}.`)
  if (updated.length) out.push(`Multiverso: ${updated.length} definição(ões) enriquecida(s) por outras crônicas.`)
  if (lore) out.push(`Multiverso: +${lore} fato(s) de lore.`)
  if (arrivals.length) out.push(`⚠ Recém-chegados ao local do PC vindos do multiverso: ${arrivals.join(", ")}. Introduza-os com coerência (ou mova-os com move se não fizer sentido estarem aqui agora).`)
  return out
}

function insertDefinition(db: DB, kind: string, id: string, d: Record<string, any>, turn: number): void {
  if (kind === "place") {
    db.prepare("INSERT INTO places(id, name, kind, parent_id, summary, details, created_turn) VALUES(?,?,?,?,?,?,?)").run(id, d.name, d.kind, d.parent_id ?? null, d.summary, d.details ?? "", turn)
    index(db, id, "entidade", [d.name, d.kind, d.summary, d.details].filter(Boolean).join(" — "))
  } else if (kind === "faction") {
    db.prepare("INSERT INTO factions(id, name, summary, goal, created_turn) VALUES(?,?,?,?,?)").run(id, d.name, d.summary, d.goal ?? "", turn)
    index(db, id, "entidade", [d.name, d.summary, d.goal].filter(Boolean).join(" — "))
  } else {
    const place = d.place_id && one(db, "SELECT 1 FROM places WHERE id = ?", d.place_id) ? d.place_id : null
    const faction = d.faction_id && one(db, "SELECT 1 FROM factions WHERE id = ?", d.faction_id) ? d.faction_id : null
    const schedule = (d.schedule ?? []).filter((s: { place: string }) => one(db, "SELECT 1 FROM places WHERE id = ?", s.place))
    db.prepare(
      `INSERT INTO characters(id, kind, name, summary, place_id, hp, max_hp, ac, level, sheet, persona, attitude, faction_id, schedule, companion, created_turn)
       VALUES(?, 'npc', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?)`
    ).run(id, d.name, d.summary, place, d.max_hp, d.max_hp, d.ac, d.level, JSON.stringify(defaultSheet(d.sheet)), JSON.stringify(d.persona ?? {}), faction, JSON.stringify(schedule), turn)
    index(db, id, "entidade", [d.name, d.summary, d.persona?.traits?.join(", "), d.persona?.wants].filter(Boolean).join(" — "))
  }
}

/** Enriquecimento vindo do atlas para uma entidade não divergente: só campos de definição, nunca estado. */
function applyDefinition(db: DB, kind: string, id: string, d: Record<string, any>): void {
  if (kind === "place") {
    db.prepare("UPDATE places SET name = ?, kind = ?, summary = ?, details = ? WHERE id = ?").run(d.name, d.kind, d.summary, d.details ?? "", id)
  } else if (kind === "faction") {
    db.prepare("UPDATE factions SET name = ?, summary = ?, goal = ? WHERE id = ?").run(d.name, d.summary, d.goal ?? "", id)
  } else {
    const local = one<{ sheet: string; max_hp: number; hp: number }>(db, "SELECT sheet, max_hp, hp FROM characters WHERE id = ?", id)!
    const sheet = { ...JSON.parse(local.sheet), ...d.sheet, conditions: JSON.parse(local.sheet).conditions ?? [], death: JSON.parse(local.sheet).death }
    db.prepare("UPDATE characters SET name = ?, summary = ?, persona = ?, sheet = ?, ac = ?, level = ?, max_hp = ?, hp = MIN(hp + MAX(0, ? - max_hp), ?) WHERE id = ?").run(
      d.name, d.summary, JSON.stringify(d.persona ?? {}), JSON.stringify(sheet), d.ac, d.level, d.max_hp, d.max_hp, d.max_hp, id
    )
  }
}

// ---------- undo ----------

/** Retira do atlas o que a campanha publicou no turno `turn` (chamado pelo dnd undo). */
export function retract(db: DB, slug: string, turn: number): number {
  if (!hasAtlas(db)) return 0
  let n = 0
  for (const h of all<{ id: number; entity_id: string; prev_data: string | null }>(
    db, "SELECT * FROM atlas.history WHERE origin_campaign = ? AND origin_turn = ? ORDER BY id DESC", slug, turn
  )) {
    if (h.prev_data === null) {
      db.prepare("DELETE FROM atlas.entities WHERE id = ? AND origin_campaign = ?").run(h.entity_id, slug)
    } else {
      db.prepare("UPDATE atlas.entities SET data = ?, seq = ? WHERE id = ?").run(h.prev_data, nextSeq(db), h.entity_id)
    }
    n++
  }
  db.prepare("DELETE FROM atlas.history WHERE origin_campaign = ? AND origin_turn = ?").run(slug, turn)
  n += Number(db.prepare("DELETE FROM atlas.links WHERE origin_campaign = ? AND origin_turn = ?").run(slug, turn).changes)
  n += Number(db.prepare("DELETE FROM atlas.lore WHERE origin_campaign = ? AND origin_turn = ?").run(slug, turn).changes)
  return n
}

export function atlasStats(db: DB): { places: number; npcs: number; factions: number; lore: number; campaigns: number } | null {
  if (!hasAtlas(db)) return null
  const c = (kind: string) => one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM atlas.entities WHERE kind = ?", kind)!.n
  return {
    places: c("place"), npcs: c("npc"), factions: c("faction"),
    lore: one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM atlas.lore")!.n,
    campaigns: one<{ n: number }>(db, "SELECT COUNT(DISTINCT origin_campaign) AS n FROM atlas.entities")!.n,
  }
}

/** Remove do atlas tudo o que uma campanha publicou (ex.: campanhas de teste). Universos que já importaram mantêm suas cópias. */
export function forgetCampaign(db: DB, slug: string): number {
  if (!hasAtlas(db)) return 0
  let n = 0
  n += Number(db.prepare("DELETE FROM atlas.entities WHERE origin_campaign = ?").run(slug).changes)
  n += Number(db.prepare("DELETE FROM atlas.links WHERE origin_campaign = ?").run(slug).changes)
  n += Number(db.prepare("DELETE FROM atlas.lore WHERE origin_campaign = ?").run(slug).changes)
  db.prepare("DELETE FROM atlas.history WHERE origin_campaign = ?").run(slug)
  db.prepare("DELETE FROM atlas.reserved WHERE campaign = ?").run(slug)
  return n
}
