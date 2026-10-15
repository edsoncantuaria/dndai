// Exploração de masmorras e emboscadas: entrar nas salas, procurar, desarmar, abrir, resolver enigmas, saquear.
// O motor rola, decide e grava; o Mestre narra o que acontece.
import type { Campaign } from "./campaign.ts"
import { all, one } from "./db.ts"
import { roll, type Rng, cryptoRng } from "./dice.ts"
import { buildEncounter, type Difficulty, THEME_TYPES } from "./encounters.ts"
import { dungeonOf, type Feature, feature, featuresAt } from "./dungeon.ts"
import { type Op, put } from "./ledger.ts"
import * as mx from "./mechanics.ts"
import { RuleError } from "./mechanics.ts"
import { pcView } from "./pc.ts"
import { grantMagicItem, grantMoney } from "./scope.ts"
import { mod, profBonus } from "./sheet.ts"
import { alloc } from "./pc.ts"

const fail = (m: string): never => { throw new RuleError(m) }
const pcId = "pc"

function setFeature(c: Campaign, id: number, patch: { state?: string; data?: unknown; dc_find?: number }): void {
  c.commit("caracteristica", [put("features", { id, ...patch })])
}

/** Revela uma característica oculta (e abre o elo de uma passagem secreta). */
export function reveal(c: Campaign, f: Feature): string {
  const ops: Op[] = [put("features", { id: f.id, state: "visivel" })]
  if (f.kind === "porta" && f.data.secret) {
    ops.push(put("features", { id: f.id, state: "visivel", data: { ...f.data, secret: 0 } }))
    ops.push(put("links", { from_id: f.data.a, to_id: f.data.b, minutes: 1, via: "passagem secreta" }), put("links", { from_id: f.data.b, to_id: f.data.a, minutes: 1, via: "passagem secreta" }))
  }
  c.commit("revelar", ops)
  return `${f.name}${f.kind === "armadilha" ? ` (armadilha: ${f.data.note})` : ""}`
}

function hidden(c: Campaign, place: string): Feature[] { return featuresAt(c, place).filter((f) => f.state === "oculto" && f.kind !== "monstros") }

function living(c: Campaign, place: string): { id: string; name: string }[] {
  return all<{ id: string; name: string }>(c.db, "SELECT id, name FROM characters WHERE kind = 'monster' AND status = 'vivo' AND place_id = ?", place)
}

/** O PC chegou a uma sala: monstros aparecem, a percepção passiva nota o que dá para notar. */
export function enterRoom(c: Campaign, place: string): string[] {
  const lines: string[] = []
  const d = dungeonOf(c, place)
  c.atomic("entrar-sala", () => {
    if (d?.status === "inexplorada") c.commit("masmorra", [put("dungeons", { id: d.id, status: "em_andamento" })])
    const passive = pcView(c).derived.passivePerception
    for (const f of featuresAt(c, place)) {
      if (f.kind === "monstros" && !f.data.spawned) {
        const ids: string[] = []
        for (const m of f.data.group as { srd: string; name: string; count: number }[]) {
          for (let i = 1; i <= m.count; i++) ids.push(mx.spawnMonster(c, m.srd, place, m.count > 1 ? `${m.name} ${i}` : m.name))
        }
        setFeature(c, f.id, { state: "visivel", data: { ...f.data, spawned: true, ids } })
        lines.push(`ENCONTRO (${f.data.difficulty}, ${f.data.total_xp} XP): ${(f.data.group as { count: number; name: string }[]).map((m) => `${m.count}× ${m.name}`).join(", ")} — ${f.data.stance}${f.data.boss ? " — CHEFE" : ""}`)
      } else if (f.state === "oculto" && f.dc_find > 0 && f.dc_find <= passive) lines.push(`você nota: ${reveal(c, f)}`)
      else if (f.kind === "perigo" && f.state === "visivel") lines.push(`perigo visível: ${f.name} — ${f.data.note}`)
    }
  })
  return lines
}

export function search(c: Campaign, who = pcId, mode: "percepcao" | "investigacao" = "percepcao", rng: Rng = cryptoRng): string[] {
  const place = mx.character(c, who).place_id ?? fail("sem local")
  return c.atomic("procurar", () => {
    const h = hidden(c, place)
    const skill = mode === "percepcao" ? "perception" : "investigation"
    // Sempre rola, mesmo sem nada escondido, para não vazar que há (ou não há) algo.
    const dc = h.length ? Math.min(...h.map((f) => f.dc_find)) : 15
    const o = mx.check(c, who, skill, dc, "normal", rng)
    const out = [o.text]
    const found = h.filter((f) => f.dc_find <= o.total)
    for (const f of found) out.push(`achou: ${reveal(c, f)}`)
    if (!found.length) out.push("nada de novo")
    c.commit("tempo", [{ op: "meta", key: "time", value: c.time + 10 }])
    return out
  })
}

function toolBonus(c: Campaign, who: string): { bonus: number; note: string } {
  const v = pcView(c, who)
  const prof = v.sheet.tools.some((t) => /thieves/.test(t)) || v.items.some((i) => /thieves/.test(i.srd ?? "")) && v.sheet.class === "rogue"
  return { bonus: mod(v.sheet.abilities.dex) + (prof ? profBonus(v.sheet.level) : 0), note: prof ? "ferramentas de ladrão" : "sem proficiência" }
}

/** Dano e salvaguarda de uma armadilha/perigo. */
function applyHazard(c: Campaign, who: string, f: Feature, rng: Rng): string[] {
  const out: string[] = [`${f.name}!`]
  const sv = mx.save(c, who, f.data.save.ability, f.data.save.dc, "normal", rng)
  out.push(sv.text)
  const dmg = roll(f.data.damage, rng).total
  const amount = sv.success ? Math.floor(dmg / 2) : dmg
  out.push(mx.damage(c, who, amount, f.data.dtype, {}, rng))
  return out
}

export function trigger(c: Campaign, who: string, featureId: number, rng: Rng = cryptoRng): string[] {
  const f = feature(c, featureId)
  if (!["armadilha", "perigo"].includes(f.kind)) fail(`${f.name} não é armadilha nem perigo`)
  if (f.kind === "armadilha" && f.state === "resolvido") fail("a armadilha já foi desarmada")
  return c.atomic("armadilha", () => {
    const out = applyHazard(c, who, f, rng)
    if (f.kind === "armadilha") setFeature(c, f.id, { state: "acionado" })
    return out
  })
}

export function disarm(c: Campaign, who: string, featureId: number, rng: Rng = cryptoRng): string[] {
  const f = feature(c, featureId)
  if (f.kind !== "armadilha") fail(`${f.name} não é uma armadilha`)
  if (f.state === "oculto") fail("você ainda não achou essa armadilha (use search)")
  if (f.state !== "visivel") fail("a armadilha não está mais armada")
  const { bonus, note } = toolBonus(c, who)
  return c.atomic("desarmar", () => {
    const o = mx.customCheck(c, who, `Desarmar: ${f.name} (${note})`, bonus, f.data.disarm_dc, "dex", "normal", rng)
    const out = [o.text]
    if (o.success) { setFeature(c, f.id, { state: "resolvido" }); out.push("desarmada") }
    else if (o.total <= f.data.disarm_dc - 5 || o.natural === 1) out.push("falha feia: ela dispara!", ...applyHazard(c, who, f, rng)), setFeature(c, f.id, { state: "acionado" })
    else out.push("falhou, mas nada disparou (pode tentar de novo)")
    return out
  })
}

export function doorBetween(c: Campaign, a: string, b: string): Feature | undefined {
  return [...featuresAt(c, a), ...featuresAt(c, b)].find((f) => f.kind === "porta" && ((f.data.a === a && f.data.b === b) || (f.data.a === b && f.data.b === a)))
}

/** O caminho não pode atravessar porta trancada. Chamado por move. */
export function assertPath(c: Campaign, path: string[]): void {
  for (let i = 0; i + 1 < path.length; i++) {
    const door = doorBetween(c, path[i]!, path[i + 1]!)
    if (door && door.data.locked > 0 && !door.data.open) fail(`${door.name} está trancada (CD ${door.data.locked}): ${door.data.desc}. Use unlock (chave, ferramentas ou força).`)
  }
}

export function unlock(c: Campaign, who: string, featureId: number, method: "chave" | "ferramentas" | "forca", rng: Rng = cryptoRng): string[] {
  const f = feature(c, featureId)
  if (f.kind !== "porta") fail(`${f.name} não é uma porta`)
  if (f.state === "oculto") fail("você ainda não achou essa passagem")
  if (f.data.open || !f.data.locked) fail(`${f.name} não está trancada`)
  return c.atomic("destrancar", () => {
    const out: string[] = []
    const open = () => { setFeature(c, f.id, { state: "resolvido", data: { ...f.data, open: true } }); out.push(`${f.name} abre`) }
    if (method === "chave") {
      const has = pcView(c, who).items.some((i) => (i.props as { key?: string }).key && (i.props as { key?: string }).key === f.data.key)
      if (!f.data.key) fail("esta porta não tem chave: use ferramentas ou força")
      if (!has) fail(`você não tem a chave (${f.data.key})`)
      open()
    } else if (method === "ferramentas") {
      const { bonus, note } = toolBonus(c, who)
      if (!pcView(c, who).items.some((i) => /thieves/.test(i.srd ?? ""))) fail("você não tem ferramentas de ladrão")
      const o = mx.customCheck(c, who, `Arrombar fechadura (${note})`, bonus, f.data.locked, "dex", "normal", rng)
      out.push(o.text)
      if (o.success) open(); else out.push("a fechadura resiste (pode tentar de novo)")
    } else {
      const o = mx.check(c, who, "athletics", f.data.locked + 2, "normal", rng)
      out.push(o.text)
      if (o.success) { open(); out.push("o barulho ecoa pela masmorra") } else out.push("a porta resiste")
    }
    return out
  })
}

export function solve(c: Campaign, who: string, featureId: number, skill?: string, rng: Rng = cryptoRng): string[] {
  const f = feature(c, featureId)
  if (f.kind !== "enigma") fail(`${f.name} não é um enigma`)
  if (f.state === "resolvido") fail("o enigma já foi resolvido")
  const opts = [f.data.check, f.data.alt].filter(Boolean) as { skill: string; dc: number }[]
  const pickOpt = skill ? opts.find((o) => o.skill === skill) ?? fail(`abordagens possíveis: ${opts.map((o) => o.skill).join(", ")}`) : opts[0]!
  return c.atomic("enigma", () => {
    const o = mx.check(c, who, pickOpt.skill, pickOpt.dc, "normal", rng)
    const out = [o.text]
    if (o.success) {
      setFeature(c, f.id, { state: "resolvido" })
      for (const t of featuresAt(c, f.place_id).filter((x) => x.kind === "tesouro" && x.data.sealed_by === "enigma")) setFeature(c, t.id, { state: "visivel" })
      out.push(`enigma resolvido: ${f.name}. Algo se revela.`)
    } else out.push(`não deu certo. Dica: ${f.data.hint}`)
    return out
  })
}

export function loot(c: Campaign, who: string, featureId: number): string[] {
  const f = feature(c, featureId)
  if (f.kind !== "tesouro") fail(`${f.name} não é um tesouro`)
  if (f.state === "resolvido") fail("já foi recolhido")
  if (f.state === "oculto") fail("você ainda não achou isso (use search)")
  const guards = living(c, f.place_id)
  if (guards.length) fail(`ainda há criaturas vivas na sala (${guards.map((g) => g.name).join(", ")})`)
  return c.atomic("saquear", () => {
    const out: string[] = []
    const d = f.data as { gp: number; items: { srd: string; qty: number }[]; magic?: string; key?: string }
    if (d.gp > 0) { grantMoney(c, who, d.gp * 100, `Tesouro: ${f.name}`); out.push(`${d.gp} PO`) }
    for (const it of d.items ?? []) { mx.giveItem(c, who, it.srd, it.qty); out.push(`${it.qty}× ${c.srd.get("equipment", it.srd)?.name ?? it.srd}`) }
    if (d.magic) { grantMagicItem(c, who, d.magic); out.push(`ITEM MÁGICO: ${c.srd.get("magic-items", d.magic)?.name ?? d.magic}`) }
    if (d.key) {
      const ops: Op[] = []
      const id = alloc(c, "i", ops)
      ops.push(put("items", { id, owner_char: who, name: d.key, qty: 1, kind: "chave", props: { key: d.key }, equipped: 0 }))
      c.commit("chave", ops)
      out.push(`CHAVE: ${d.key}`)
    }
    setFeature(c, f.id, { state: "resolvido" })
    return out
  })
}

export function engage(c: Campaign, surprise: "jogador" | "monstros" | "nenhum" = "nenhum", rng: Rng = cryptoRng): string {
  const pc = mx.character(c, pcId)
  const place = pc.place_id ?? fail("sem local")
  const foes = living(c, place).map((m) => m.id)
  if (!foes.length) fail("não há criaturas hostis vivas aqui")
  const allies = all<{ id: string }>(c.db, "SELECT id FROM characters WHERE companion = 1 AND status = 'vivo' AND place_id = ?", place).map((a) => a.id)
  const side = [pcId, ...allies]
  const st = mx.startCombat(c, [...side, ...foes], rng, { disadvantage: surprise === "jogador" ? foes : surprise === "monstros" ? side : [] })
  return `combate: ${st.order.map((o) => `${o.id}(${o.init})`).join(" > ")}${surprise !== "nenhum" ? ` — surpresa: ${surprise}` : ""}`
}

const KIND_THEME: [RegExp, string][] = [[/floresta|bosque|mata/, "floresta"], [/montanha|serra|pico/, "montanha"], [/p[âa]ntano|brejo/, "pantano"], [/deserto|dunas/, "deserto"], [/mar|costa|praia|porto/, "mar"], [/estrada|caminho|trilha/, "estrada"]]

/** Viagem longa por lugar perigoso: chance de emboscada por hora, com encontro por orçamento. */
export function wanderingEncounter(c: Campaign, dest: string, minutes: number, rng: Rng = cryptoRng): string[] {
  const row = one<{ kind: string; danger: number; dungeon_id: string | null; name: string }>(c.db, "SELECT kind, danger, dungeon_id, name FROM places WHERE id = ?", dest)
  if (!row || row.dungeon_id || row.danger < 1 || minutes < 60) return []
  const pct = Math.min(50, row.danger * 10 * Math.floor(minutes / 60))
  if (rng(100) > pct) return []
  const theme = KIND_THEME.find(([re]) => re.test(`${row.kind} ${row.name}`.toLowerCase()))?.[1] ?? "estrada"
  const diff: Difficulty = row.danger >= 3 ? "alta" : row.danger === 2 ? "moderada" : "baixa"
  const level = pcView(c).sheet.level
  const party = 1 + (one<{ n: number }>(c.db, "SELECT COUNT(*) n FROM characters WHERE companion = 1 AND status = 'vivo'")?.n ?? 0)
  const enc = buildEncounter(c.srd, rng, { level, party, difficulty: diff, types: THEME_TYPES[theme], maxCreatures: 5 })
  return c.atomic("emboscada", () => {
    const ids: string[] = []
    for (const m of enc.group) for (let i = 1; i <= m.count; i++) ids.push(mx.spawnMonster(c, m.srd, dest, m.count > 1 ? `${m.name} ${i}` : m.name))
    c.commit("emboscada", [put("features", { place_id: dest, kind: "monstros", name: `Emboscada (${diff})`, data: { group: enc.group, total_xp: enc.total, budget: enc.budget, difficulty: diff, stance: "emboscada", spawned: true, ids }, state: "visivel", dc_find: 0, created_turn: c.turn })])
    return [`EMBOSCADA no caminho (${diff}, ${enc.total} XP): ${enc.group.map((m) => `${m.count}× ${m.name}`).join(", ")}`]
  })
}

/** Marca a masmorra como concluída quando o chefe e seu grupo caem. */
export function refreshDungeon(c: Campaign, place: string): string | undefined {
  const d = dungeonOf(c, place)
  if (!d || d.status === "concluida" || !d.boss_room) return undefined
  const boss = featuresAt(c, d.boss_room).find((f) => f.kind === "monstros" && f.data.boss)
  if (!boss?.data.spawned) return undefined
  if ((boss.data.ids as string[]).every((id) => one<{ status: string }>(c.db, "SELECT status FROM characters WHERE id = ?", id)?.status === "morto")) {
    c.commit("masmorra", [put("dungeons", { id: d.id, status: "concluida" }), put("facts", { about_id: d.id, text: `A masmorra ${d.name} foi vencida: o chefe caiu`, secret: 0, turn: c.turn, at_min: c.time })])
    return `masmorra ${d.name} CONCLUÍDA`
  }
  return undefined
}
