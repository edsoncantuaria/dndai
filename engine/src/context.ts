// Briefings em texto para o Mestre (ChatGPT). Incluem segredos, sempre marcados.
import { all, type DB, getMeta, metaNum, one } from "./db.ts"
import { drawnWeapon, reactionOf } from "./items.ts"
import { pendingRequests } from "./mechanics.ts"
import { itemsOf } from "./ops.ts"
import { ABILITIES, ABILITY_NAMES, attitudeLabel, CLASSES, fmtMod, levelForXp, SKILLS, XP_THRESHOLDS } from "./rules.ts"
import { getCombat } from "./simulation.ts"
import {
  abilityMod, type Character, type CharacterRow, charProf, clockParts, fmtClock, fmtMoney, getCharacter, getPlace, now, pcId,
  saveBonus, skillBonus, spellInfo,
} from "./world.ts"

function itemLine(i: { id: string; name: string; qty: number; equipped: number; props: string; notes: string }): string {
  const p = JSON.parse(i.props) as Record<string, unknown>
  const extra = [p.damage ? `dano ${p.damage}${p.damage_type ? ` ${p.damage_type}` : ""}` : "", i.notes].filter(Boolean).join(", ")
  return `${i.qty > 1 ? `${i.qty}× ` : ""}${i.name} [${i.id}]${extra ? ` (${extra})` : ""}`
}

export function pcBlock(db: DB, c: Character): string[] {
  const s = c.sheet
  const cls = CLASSES[s.class]
  const next = c.level < 20 ? XP_THRESHOLDS[c.level] : null
  const lines = [
    `${c.name} [${c.id}] — ${s.race} ${cls?.label ?? s.class}${s.subclass ? ` (${s.subclass})` : ""} nível ${c.level} — XP ${c.xp}${next ? `/${next}` : ""}${levelForXp(c.xp) > c.level ? " ⚠ SUBIDA DE NÍVEL DISPONÍVEL" : ""}`,
    `PV ${c.hp}/${c.max_hp}${c.temp_hp ? ` (+${c.temp_hp} temp)` : ""} · CA ${c.ac} · Status: ${c.status}${s.conditions.length ? ` · Condições: ${s.conditions.join(", ")}` : ""}${c.hp === 0 && c.status !== "morto" ? ` · Morte: ${s.death.success}✓ ${s.death.fail}✗` : ""}`,
    `Atributos: ${ABILITIES.map((a) => `${a.toUpperCase()} ${s.abilities[a]}(${fmtMod(abilityMod(c, a))})`).join(" ")} · Prof ${fmtMod(charProf(c))} · Percepção passiva ${10 + skillBonus(c, "percepcao", "sab")}`,
    `Salvaguardas: ${ABILITIES.map((a) => `${a.toUpperCase()} ${fmtMod(saveBonus(c, a))}${s.saves.includes(a) ? "*" : ""}`).join(" ")}`,
    `Perícias treinadas: ${[...s.skills, ...s.expertise.filter((x) => !s.skills.includes(x))].map((k) => `${SKILLS[k]?.label ?? k} ${fmtMod(skillBonus(c, k, SKILLS[k]?.ability ?? "for"))}`).join(", ") || "nenhuma"}`,
  ]
  const spell = spellInfo(c)
  if (spell) {
    const slots = Object.entries(s.slots).map(([l, v]) => `${l}º ${v.max - v.used}/${v.max}`).join(" ")
    lines.push(`Magia (${ABILITY_NAMES[spell.ability]}): CD ${spell.dc}, ataque ${fmtMod(spell.attack)} · Espaços: ${slots || "—"} · Magias: ${s.spells.join(", ") || "—"}`)
  }
  lines.push(`Dados de vida: ${s.hitDice.max - s.hitDice.used}/${s.hitDice.max} d${s.hitDice.die} · Dinheiro: ${fmtMoney(c.cp)}`)
  const items = itemsOf(db, c.id)
  const eq = items.filter((i) => i.equipped)
  if (eq.length) lines.push(`Equipado: ${eq.map(itemLine).join("; ")}`)
  const drawn = drawnWeapon(db, c.id)
  if (drawn) lines.push(`⚔ EM PUNHO: ${drawn} (todos em cena veem)`)
  const bag = items.filter((i) => !i.equipped)
  if (bag.length) lines.push(`Mochila: ${bag.map(itemLine).join("; ")}`)
  if (s.features.length) lines.push(`Habilidades: ${s.features.join("; ")}`)
  return lines
}

function memoriesOf(db: DB, npc: string, limit: number): string[] {
  const rows = all<{ text: string; at_min: number; importance: number }>(
    db,
    `SELECT text, at_min, importance FROM (
       SELECT * FROM memories WHERE npc_id = ? AND importance = 3
       UNION SELECT * FROM (SELECT * FROM memories WHERE npc_id = ? ORDER BY id DESC LIMIT ?)
     ) ORDER BY id`,
    npc, npc, limit
  )
  return rows.map((m) => `[dia ${clockParts(m.at_min).day}]${m.importance === 3 ? "!" : ""} ${m.text}`)
}

function npcBlock(db: DB, row: CharacterRow, detailed: boolean): string[] {
  const c = getCharacter(db, row.id)
  const p = c.persona
  const head = `- ${c.name} [${c.id}] — ${c.summary} · atitude ${attitudeLabel(c.attitude)} (${c.attitude}) · PV ${c.hp}/${c.max_hp} CA ${c.ac}${c.status !== "vivo" ? ` · ${c.status.toUpperCase()}` : ""}${c.companion ? " · COMPANHEIRO" : ""}`
  const lines = [head]
  const persona = [
    p.traits?.length ? `Traços: ${p.traits.join(", ")}` : "",
    p.voice ? `Voz: ${p.voice}` : "",
    p.wants ? `Quer: ${p.wants}` : "",
    p.fears ? `Teme: ${p.fears}` : "",
  ].filter(Boolean)
  if (persona.length) lines.push(`  ${persona.join(" · ")}`)
  const reaction = reactionOf(db, c.id)
  if (reaction) lines.push(`  Reagindo agora: ${reaction}`)
  if (p.secret) lines.push(`  🔒 SEGREDO (só Mestre): ${p.secret}`)
  if (p.notes) lines.push(`  Notas: ${p.notes}`)
  if (c.sheet.attacks.length && detailed) lines.push(`  Ataques: ${c.sheet.attacks.map((a) => `${a.name} ${fmtMod(a.bonus)} (${a.damage}${a.type ? ` ${a.type}` : ""})`).join("; ")}`)
  const mem = memoriesOf(db, c.id, detailed ? 50 : 4)
  if (mem.length) lines.push(`  Lembra: ${mem.join(" | ")}`)
  else lines.push("  Lembra: (nada sobre o PC ainda — é a primeira interação)")
  return lines
}

/** Briefing obrigatório antes de narrar. Tudo o que a narração afirmar precisa estar aqui ou ser criado via apply. */
export function buildContext(db: DB, slug: string): string {
  const out: string[] = []
  const turn = metaNum(db, "turn")
  const open = getMeta(db, "turn_open") === "1"
  const action = open ? one<{ action: string }>(db, "SELECT action FROM turns WHERE n = ?", turn)?.action : undefined
  out.push(`# ${getMeta(db, "name")} [${slug}] — ${fmtClock(now(db))} — Turno ${turn}${open ? ` ABERTO: "${action}"` : " (fechado)"}`)
  out.push(`Premissa: ${getMeta(db, "premise")}`)
  if (getMeta(db, "tone")) out.push(`Tom: ${getMeta(db, "tone")}`)

  const pid = pcId(db)
  if (!pid) {
    out.push("", "⚠ Sem personagem do jogador. Conduza a criação com o jogador e grave com: dnd pc create (JSON pela entrada padrão).")
    return out.join("\n")
  }
  const pc = getCharacter(db, pid)
  out.push("", "## PERSONAGEM DO JOGADOR", ...pcBlock(db, pc))

  if (pc.place_id) {
    const place = getPlace(db, pc.place_id)
    const parent = place.parent_id ? getPlace(db, place.parent_id) : null
    out.push("", `## LOCAL: ${place.name} [${place.id}] (${place.kind})${parent ? ` — em ${parent.name} [${parent.id}]` : ""}`, place.summary)
    if (place.details) out.push(place.details)
    const exits = all<{ id: string; name: string; minutes: number; via: string; visited: number }>(
      db, "SELECT p.id, p.name, l.minutes, l.via, p.visited FROM links l JOIN places p ON p.id = l.to_id WHERE l.from_id = ? ORDER BY l.minutes", place.id
    )
    out.push(`Saídas: ${exits.map((e) => `${e.name} [${e.id}] ${e.minutes} min${e.via ? ` via ${e.via}` : ""}${e.visited ? "" : " (inexplorado)"}`).join("; ") || "nenhuma registrada (crie com link/create.place)"}`)
    const ground = itemsOf(db, place.id)
    if (ground.length) out.push(`Itens aqui: ${ground.map(itemLine).join("; ")}`)
    const here = all<CharacterRow>(db, "SELECT * FROM characters WHERE kind = 'npc' AND place_id = ? AND status <> 'morto' ORDER BY companion DESC, name", place.id)
    out.push("", "## PRESENTES (só estes NPCs estão em cena)")
    if (here.length) for (const n of here) out.push(...npcBlock(db, n, false))
    else out.push("Ninguém além do PC. Para introduzir alguém, crie com create.npc ANTES de narrar.")
    const dead = all<{ name: string; id: string }>(db, "SELECT name, id FROM characters WHERE kind = 'npc' AND place_id = ? AND status = 'morto'", place.id)
    if (dead.length) out.push(`Corpos aqui: ${dead.map((d) => `${d.name} [${d.id}]`).join(", ")}`)
  } else {
    out.push("", "⚠ O PC não está em nenhum local. Crie o local inicial (create.place) e mova o PC (move).")
  }

  const combat = getCombat(db)
  if (combat) {
    out.push("", `## COMBATE — rodada ${combat.round}`)
    combat.order.forEach((o, i) => {
      const c = getCharacter(db, o.id)
      out.push(`${i === combat.index ? "▶" : " "} ${o.init} ${c.name} [${c.id}] PV ${c.hp}/${c.max_hp} CA ${c.ac}${c.status !== "vivo" ? ` ${c.status}` : ""}`)
    })
  }

  const pend: string[] = []
  for (const r of pendingRequests(db)) pend.push(`Rolagem #${r.id} aguardando o jogador na mesa: ${r.label}${r.dc !== null ? ` (CD/CA ${r.dc})` : ""} — veja com dnd rolls`)
  if (open) {
    for (const r of all<{ id: number; result: string }>(db, "SELECT id, result FROM roll_requests WHERE status = 'resolvida' AND created_turn = ? ORDER BY id", turn)) {
      pend.push(`Resultado #${r.id}: ${(JSON.parse(r.result) as { text: string }).text.replaceAll("\n", " · ")}`)
    }
  }
  for (const e of all<{ id: number; text: string }>(db, "SELECT id, text FROM events WHERE status = 'vencido'")) pend.push(`Evento vencido #${e.id}: ${e.text} → narre/resolva (event.resolve)`)
  for (const c of all<{ id: string; name: string; on_complete: string }>(db, "SELECT id, name, on_complete FROM clocks WHERE status = 'disparado'")) pend.push(`Agenda disparada ${c.name} [${c.id}]: ${c.on_complete} → aplique as consequências (clock.resolve)`)
  for (const i of all<{ id: number; text: string }>(db, "SELECT id, text FROM intents WHERE status = 'pendente'")) pend.push(`Intenção do jogador pela mesa #${i.id}: "${i.text}"`)
  if (pend.length) out.push("", "## PENDÊNCIAS E RESULTADOS DESTE TURNO (narre a partir disto)", ...pend.map((p) => `- ${p}`))

  const quests = all<{ id: string; title: string; summary: string; objectives: string; secret: number }>(db, "SELECT * FROM quests WHERE status = 'ativa' ORDER BY updated_turn DESC")
  if (quests.length) {
    out.push("", "## MISSÕES ATIVAS")
    for (const q of quests) {
      const obj = (JSON.parse(q.objectives) as { text: string; done: boolean }[]).map((o, i) => `${i}:${o.done ? "✓" : "○"} ${o.text}`).join(" ")
      out.push(`- ${q.title} [${q.id}]${q.secret ? " (oculta)" : ""}: ${q.summary}${obj ? ` — ${obj}` : ""}`)
    }
  }

  const clocks = all<{ id: string; name: string; filled: number; segments: number; on_complete: string; every_min: number | null }>(db, "SELECT * FROM clocks WHERE status = 'ativo' ORDER BY filled * 1.0 / segments DESC")
  if (clocks.length) {
    out.push("", "## AGENDAS DO MUNDO (o mundo se move sozinho; jogador não vê)")
    for (const c of clocks) out.push(`- ${c.name} [${c.id}] ${c.filled}/${c.segments}${c.every_min ? ` (+1 a cada ${c.every_min} min)` : ""} → ${c.on_complete}`)
  }

  const sceneIds = [pc.id, pc.place_id, ...all<{ id: string }>(db, "SELECT id FROM characters WHERE place_id = ? AND kind = 'npc'", pc.place_id ?? "").map((x) => x.id)].filter(Boolean) as string[]
  const facts = all<{ id: number; text: string; secret: number; about_id: string | null }>(
    db, `SELECT id, text, secret, about_id FROM facts WHERE about_id IN (${sceneIds.map(() => "?").join(",")}) OR about_id IS NULL ORDER BY id DESC LIMIT 20`, ...sceneIds
  )
  if (facts.length) {
    out.push("", "## FATOS ESTABELECIDOS (cena atual e gerais)")
    for (const f of facts.reverse()) out.push(`- #${f.id}${f.secret ? " 🔒" : ""} ${f.text}`)
  }

  const turns = all<{ n: number; summary: string; started_min: number }>(db, "SELECT n, summary, started_min FROM turns WHERE ended = 1 ORDER BY n DESC LIMIT 6")
  if (turns.length) {
    out.push("", "## ÚLTIMOS TURNOS")
    for (const t of turns.reverse()) out.push(`- T${t.n} (dia ${clockParts(t.started_min).day}): ${t.summary}`)
  }

  const elsewhere = all<{ id: string; name: string; place: string | null; status: string }>(
    db, "SELECT c.id, c.name, p.name AS place, c.status FROM characters c LEFT JOIN places p ON p.id = c.place_id WHERE c.kind = 'npc' AND (c.place_id IS NULL OR c.place_id <> ?) ORDER BY c.created_turn DESC LIMIT 30", pc.place_id ?? ""
  )
  if (elsewhere.length) out.push("", `## NPCs EM OUTROS LUGARES (não estão em cena): ${elsewhere.map((n) => `${n.name} [${n.id}]${n.status !== "vivo" ? ` ${n.status}` : ""} @ ${n.place ?? "?"}`).join("; ")}`)

  out.push(
    "",
    "Lembrete: narre só o que está acima ou foi criado via apply; resolva incertezas com dnd check/save/attack (ou --mesa); grave consequências (memory, attitude, fact, item, money, time) e feche com dnd turn end."
  )
  return out.join("\n")
}

/** Detalhe completo de qualquer entidade (inclui segredos e todas as memórias). */
export function showEntity(db: DB, id: string): string {
  const prefix = id.split(":")[0]
  const out: string[] = []
  if (prefix === "pc" || prefix === "npc") {
    const c = getCharacter(db, id)
    if (c.kind === "pc") out.push(...pcBlock(db, c))
    else {
      out.push(...npcBlock(db, one<CharacterRow>(db, "SELECT * FROM characters WHERE id = ?", id)!, true))
      out.push(`  Local: ${c.place_id ? getPlace(db, c.place_id).name : "desconhecido"}${c.faction_id ? ` · Facção: ${c.faction_id}` : ""}`)
      out.push(`  Atributos: ${ABILITIES.map((a) => `${a.toUpperCase()} ${c.sheet.abilities[a]}`).join(" ")}`)
      if (c.schedule.length) out.push(`  Rotina: ${c.schedule.map((s) => `${s.from}-${s.to} ${s.place}`).join("; ")}`)
      const items = itemsOf(db, id)
      if (items.length) out.push(`  Carrega: ${items.map(itemLine).join("; ")}`)
    }
  } else if (prefix === "place") {
    const p = getPlace(db, id)
    out.push(`${p.name} [${p.id}] (${p.kind})${p.visited ? "" : " — inexplorado"}`, p.summary, p.details)
    const children = all<{ id: string; name: string }>(db, "SELECT id, name FROM places WHERE parent_id = ?", id)
    if (children.length) out.push(`Contém: ${children.map((c) => `${c.name} [${c.id}]`).join("; ")}`)
    const people = all<{ id: string; name: string; status: string }>(db, "SELECT id, name, status FROM characters WHERE place_id = ?", id)
    if (people.length) out.push(`Pessoas: ${people.map((c) => `${c.name} [${c.id}] ${c.status}`).join("; ")}`)
  } else if (prefix === "faction") {
    const f = one<{ name: string; summary: string; goal: string; attitude: number }>(db, "SELECT * FROM factions WHERE id = ?", id)
    if (!f) throw new Error(`${id} não existe.`)
    out.push(`${f.name} [${id}] — atitude ${attitudeLabel(f.attitude)}`, f.summary, `Objetivo: ${f.goal}`)
    const members = all<{ id: string; name: string }>(db, "SELECT id, name FROM characters WHERE faction_id = ?", id)
    if (members.length) out.push(`Membros: ${members.map((m) => `${m.name} [${m.id}]`).join("; ")}`)
  } else if (prefix === "quest") {
    const q = one<{ title: string; summary: string; status: string; objectives: string; giver_id: string | null }>(db, "SELECT * FROM quests WHERE id = ?", id)
    if (!q) throw new Error(`${id} não existe.`)
    out.push(`${q.title} [${id}] — ${q.status}${q.giver_id ? ` · dada por ${q.giver_id}` : ""}`, q.summary)
    ;(JSON.parse(q.objectives) as { text: string; done: boolean }[]).forEach((o, i) => out.push(`${i}: ${o.done ? "✓" : "○"} ${o.text}`))
  } else if (prefix === "item") {
    const i = one<{ name: string; qty: number; kind: string; props: string; notes: string; owner_char: string | null; owner_place: string | null }>(db, "SELECT * FROM items WHERE id = ?", id)
    if (!i) throw new Error(`${id} não existe.`)
    out.push(`${i.qty}× ${i.name} [${id}] (${i.kind}) com ${i.owner_char ?? i.owner_place}`, `Props: ${i.props}`, i.notes)
  } else if (prefix === "clock") {
    const c = one<{ name: string; filled: number; segments: number; on_complete: string; status: string; outcome: string }>(db, "SELECT * FROM clocks WHERE id = ?", id)
    if (!c) throw new Error(`${id} não existe.`)
    out.push(`${c.name} [${id}] ${c.filled}/${c.segments} — ${c.status}`, `Ao completar: ${c.on_complete}`, c.outcome)
  } else {
    throw new Error(`Id desconhecido: ${id}`)
  }
  const facts = all<{ id: number; text: string; secret: number }>(db, "SELECT id, text, secret FROM facts WHERE about_id = ? ORDER BY id", id)
  if (facts.length) out.push("Fatos:", ...facts.map((f) => `- #${f.id}${f.secret ? " 🔒" : ""} ${f.text}`))
  return out.filter((l) => l !== "").join("\n")
}

/** Busca textual (FTS5, sem acento) em fatos, memórias, entidades e resumos de turnos. */
export function recall(db: DB, query: string, limit = 15): string {
  const terms = query.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 2)
  if (!terms.length) throw new Error("Consulta vazia.")
  const match = terms.map((t) => `"${t}"*`).join(" OR ")
  const rows = all<{ ref: string; kind: string; text: string }>(db, "SELECT ref, kind, text FROM search WHERE search MATCH ? ORDER BY rank LIMIT ?", match, limit)
  if (!rows.length) return `Nada encontrado para "${query}". Se não está registrado, NÃO é fato estabelecido.`
  return rows.map((r) => `- [${r.kind}${r.kind === "segredo" ? " 🔒" : ""}] ${r.ref}: ${r.text}`).join("\n")
}

/** Recapitulação longa para retomar a campanha num chat novo (ou após o chat perder contexto). */
export function resume(db: DB, slug: string): string {
  const out = [buildContext(db, slug), "", "## CRÔNICA COMPLETA (resumos)"]
  for (const t of all<{ n: number; summary: string; action: string; started_min: number }>(db, "SELECT * FROM turns WHERE ended = 1 ORDER BY n")) {
    out.push(`T${t.n} ${fmtClock(t.started_min)} — Jogador: ${t.action} → ${t.summary}`)
  }
  const places = all<{ id: string; name: string; summary: string; visited: number }>(db, "SELECT id, name, summary, visited FROM places ORDER BY created_turn")
  out.push("", "## LOCAIS DO MUNDO", ...places.map((p) => `- ${p.name} [${p.id}]${p.visited ? "" : " (inexplorado)"}: ${p.summary}`))
  const factions = all<{ id: string; name: string; summary: string }>(db, "SELECT id, name, summary FROM factions")
  if (factions.length) out.push("", "## FACÇÕES", ...factions.map((f) => `- ${f.name} [${f.id}]: ${f.summary}`))
  const done = all<{ title: string; status: string }>(db, "SELECT title, status FROM quests WHERE status <> 'ativa'")
  if (done.length) out.push("", `## MISSÕES ENCERRADAS: ${done.map((q) => `${q.title} (${q.status})`).join("; ")}`)
  return out.join("\n")
}

