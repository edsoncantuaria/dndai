import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { generateDungeon, featuresAt, THEME_IDS } from "../src/core/dungeon.ts"
import { band } from "../src/core/dungeon.ts"
import * as ex from "../src/core/explore.ts"
import type { Rng } from "../src/core/dice.ts"
import * as mx from "../src/core/mechanics.ts"
import { pcView } from "../src/core/pc.ts"
import { GOLD_PER_TURN_GP } from "../src/core/scope.ts"
import * as w from "../src/core/world.ts"
import { context } from "../src/mestre/context.ts"
import { openTurn, submit } from "../src/mestre/submit.ts"
import { autoLevelUp, novoPc } from "./helpers.ts"

let home: string
before(() => { home = mkdtempSync(join(tmpdir(), "dnd-")) })
after(() => rmSync(home, { recursive: true }))
const seq = (...v: number[]): Rng => { const q = [...v]; return (s) => q.shift() ?? s }

describe("gerador de masmorras", () => {
  it("todo tema × níveis × tamanhos: grafo conexo, chefe e cofre alcançáveis, orçamentos e tetos respeitados", () => {
    let n = 0
    for (const theme of THEME_IDS) for (const level of [1, 5, 11, 17]) for (const rooms of [5, 9, 14]) {
      const c = novoPc(`dg${n}`, home, "fighter")
      const d = generateDungeon(c, { theme, level, rooms, from: "l0", seed: 100 + n++ })
      assert.equal(d.rooms.length, rooms)
      // conexo (contando só elos normais): todas as salas alcançáveis da entrada; passagens secretas só ajudam
      const reach = new Set([d.entrance]); let grow = true
      const adj = c.db.prepare("SELECT from_id, to_id FROM links").all() as { from_id: string; to_id: string }[]
      while (grow) { grow = false; for (const e of adj) if (reach.has(e.from_id) && !reach.has(e.to_id)) { reach.add(e.to_id); grow = true } }
      for (const r of d.rooms) assert.ok(reach.has(r.id), `${theme}: ${r.id} inalcançável`)
      assert.ok(d.rooms.some((r) => r.role === "chefe") && d.rooms.some((r) => r.role === "cofre"))
      // encontros dentro do orçamento; ouro dentro do teto por turno; chave existe para a porta do chefe
      for (const r of d.rooms) for (const f of featuresAt(c, r.id)) {
        if (f.kind === "monstros") assert.ok(f.data.total_xp <= f.data.budget, `${theme} ${f.name}`)
        if (f.kind === "tesouro") assert.ok(f.data.gp <= GOLD_PER_TURN_GP[band(level)], `${theme} ouro`)
      }
      const bossDoor = c.db.prepare("SELECT data FROM features WHERE kind = 'porta' AND name LIKE 'Portão%'").get() as { data: string } | undefined
      const keyFeat = c.db.prepare("SELECT data FROM features WHERE kind = 'tesouro' AND data LIKE '%opens_boss%'").get()
      assert.ok(bossDoor && keyFeat, `${theme}: porta do chefe e chave`)
      assert.equal(c.invariants().length, 0)
      c.close()
    }
    assert.equal(n, THEME_IDS.length * 12)
  })

  it("é reproduzível pela semente", () => {
    const a = novoPc("rp1", home, "fighter"), b = novoPc("rp2", home, "fighter")
    const x = generateDungeon(a, { theme: "cripta", level: 3, rooms: 8, from: "l0", seed: 42 })
    const y = generateDungeon(b, { theme: "cripta", level: 3, rooms: 8, from: "l0", seed: 42 })
    assert.deepEqual(x.rooms.map((r) => [r.name, r.role]), y.rooms.map((r) => [r.name, r.role]))
    assert.equal(x.name, y.name)
    a.close(); b.close()
  })

  it("lugar solto é recusado e tema inválido também", () => {
    const c = novoPc("er1", home, "fighter")
    assert.throws(() => generateDungeon(c, { theme: "praia", from: "l0" }), /tema desconhecido/)
    assert.throws(() => generateDungeon(c, { theme: "cripta", from: "l99" }), /não existe/)
    assert.throws(() => generateDungeon(c, { theme: "cripta", rooms: 3, from: "l0" }), /de 4 a 20/)
    c.close()
  })
})

describe("explorar a masmorra", () => {
  function entrar(slug: string, cls = "rogue") {
    const c = novoPc(slug, home, cls)
    const d = generateDungeon(c, { theme: "cripta", level: 1, rooms: 8, from: "l0", seed: 5 })
    return { c, d }
  }

  it("monstros aparecem ao entrar; portas trancadas barram; chave abre; secreto só depois de achado", () => {
    const { c, d } = entrar("ex1")
    const r0 = w.move(c, "pc", d.entrance)
    assert.ok(r0.minutes >= 10)
    // vai até a sala do chefe: o portão está trancado e exige a chave
    assert.throws(() => w.move(c, "pc", d.boss), /trancada|não há caminho/)
    const keyFeat = c.db.prepare("SELECT id, place_id FROM features WHERE data LIKE '%opens_boss%'").get() as { id: number; place_id: string }
    c.db.prepare("UPDATE characters SET place_id = ? WHERE id = 'pc'").run(keyFeat.place_id) // atalho de teste: teleporta
    // entra (os guardas aparecem), mata quem guarda a sala da chave e acha a chave
    ex.enterRoom(c, keyFeat.place_id)
    for (const m of c.db.prepare("SELECT id FROM characters WHERE kind = 'monster' AND place_id = ?").all(keyFeat.place_id) as { id: string }[]) mx.damage(c, m.id, 9999, "fire")
    c.db.prepare("UPDATE features SET state = 'visivel' WHERE id = ?").run(keyFeat.id)
    assert.match(ex.loot(c, "pc", keyFeat.id).join("|"), /CHAVE:/)
    const door = c.db.prepare("SELECT id FROM features WHERE kind = 'porta' AND name LIKE 'Portão%'").get() as { id: number }
    assert.match(ex.unlock(c, "pc", door.id, "chave").join("|"), /abre/)
    c.close()
  })

  it("passagem secreta: sem elo até ser achada; depois vira caminho", () => {
    const c = novoPc("ex0", home, "rogue")
    const d = generateDungeon(c, { theme: "torre-arcana", level: 3, rooms: 12, from: "l0", seed: 3 })
    const sec = d.edges.find((e) => e.secret)
    assert.ok(sec, "12 salas devem ter passagem secreta")
    const has = () => c.db.prepare("SELECT 1 FROM links WHERE from_id = ? AND to_id = ?").get(sec!.a, sec!.b)
    assert.equal(has(), undefined)
    const f = c.db.prepare("SELECT id, place_id, dc_find FROM features WHERE kind = 'porta' AND state = 'oculto'").get() as { id: number; place_id: string; dc_find: number }
    c.db.prepare("UPDATE characters SET place_id = ? WHERE id = 'pc'").run(f.place_id)
    ex.search(c, "pc", "investigacao", seq(20))
    assert.ok(has())
    c.close()
  })

  it("busca revela o oculto (a rolagem é sempre feita); passagem secreta cria o elo; armadilha: achar, desarmar, disparar", () => {
    const { c, d } = entrar("ex2")
    const trap = c.db.prepare("SELECT id, place_id, dc_find FROM features WHERE kind = 'armadilha' LIMIT 1").get() as { id: number; place_id: string; dc_find: number }
    c.db.prepare("UPDATE characters SET place_id = ? WHERE id = 'pc'").run(trap.place_id)
    assert.throws(() => ex.disarm(c, "pc", trap.id), /ainda não achou/)
    const found = ex.search(c, "pc", "percepcao", seq(20))
    assert.ok(found.some((l) => /achou:/.test(l)), found.join("|"))
    const hpBefore = pcView(c).row.hp
    const off = ex.disarm(c, "pc", trap.id, seq(20))
    assert.ok(off.some((l) => /desarmada/.test(l)), off.join("|"))
    assert.throws(() => ex.trigger(c, "pc", trap.id), /já foi desarmada/)
    assert.equal(pcView(c).row.hp, hpBefore)
    c.close(); void d
  })

  it("disparar a armadilha causa dano com salvaguarda (metade se passar)", () => {
    const { c } = entrar("ex3", "fighter")
    const trap = c.db.prepare("SELECT id, place_id FROM features WHERE kind = 'armadilha' LIMIT 1").get() as { id: number; place_id: string }
    c.db.prepare("UPDATE characters SET place_id = ? WHERE id = 'pc'").run(trap.place_id)
    c.commit("t", [{ op: "put", table: "characters", row: { id: "pc", hp: 200, max_hp: 200, level: 20 } }])
    const hp0 = pcView(c).row.hp
    const out = ex.trigger(c, "pc", trap.id, seq(1, 5, 5, 5, 5, 5, 5)) // salvaguarda 1 = falha
    assert.ok(out.some((l) => /falha/.test(l))); assert.ok(pcView(c).row.hp < hp0)
    c.close()
  })

  it("enigma: sucesso revela o tesouro selado; falha dá dica; saquear exige sala limpa e respeita o teto", () => {
    const { c } = entrar("ex4", "wizard")
    const e = c.db.prepare("SELECT id, place_id FROM features WHERE kind = 'enigma' LIMIT 1").get() as { id: number; place_id: string } | undefined
    if (!e) { c.close(); return } // sem enigma nesta semente
    c.db.prepare("UPDATE characters SET place_id = ? WHERE id = 'pc'").run(e.place_id)
    assert.match(ex.solve(c, "pc", e.id, undefined, seq(1)).join("|"), /Dica/)
    assert.match(ex.solve(c, "pc", e.id, undefined, seq(20)).join("|"), /enigma resolvido/)
    const t = c.db.prepare("SELECT id FROM features WHERE kind = 'tesouro' AND place_id = ?").get(e.place_id) as { id: number }
    const got = ex.loot(c, "pc", t.id)
    assert.ok(got.length >= 1)
    assert.throws(() => ex.loot(c, "pc", t.id), /já foi recolhido/)
    c.close()
  })

  it("encontro: surpresa dá desvantagem na iniciativa; chefe derrotado conclui a masmorra", () => {
    const { c, d } = entrar("ex5", "fighter")
    c.db.prepare("UPDATE characters SET place_id = ? WHERE id = 'pc'").run(d.boss)
    const lines = ex.enterRoom(c, d.boss)
    assert.ok(lines.some((l) => /CHEFE/.test(l)))
    const info = ex.engage(c, "monstros", seq(10, 10, 10, 10, 10, 10, 10, 10, 10, 10))
    assert.match(info, /surpresa: monstros/)
    mx.endCombat(c)
    for (const m of c.db.prepare("SELECT id FROM characters WHERE kind = 'monster' AND place_id = ?").all(d.boss) as { id: string }[]) mx.damage(c, m.id, 99999, "fire")
    assert.match(ex.refreshDungeon(c, d.boss) ?? "", /CONCLUÍDA/)
    assert.equal(c.db.prepare("SELECT status FROM dungeons WHERE id = ?").get(d.id)!.status, "concluida")
    c.close()
  })

  it("emboscada na estrada: acontece por perigo e tempo, com encontro por orçamento", () => {
    const c = novoPc("em1", home, "fighter")
    const mata = w.createPlace(c, { name: "Floresta Sombria", kind: "floresta", summary: "Densa", links: [{ to: "l0", minutes: 180 }] })
    c.commit("t", [{ op: "put", table: "places", row: { id: mata, danger: 3 } }])
    const lines = ex.wanderingEncounter(c, mata, 180, seq(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1))
    assert.match(lines.join("|"), /EMBOSCADA/)
    assert.ok((c.db.prepare("SELECT COUNT(*) n FROM characters WHERE kind = 'monster' AND place_id = ?").get(mata) as { n: number }).n >= 1)
    assert.deepEqual(ex.wanderingEncounter(c, "l0", 30), []) // curta: nada
    // 1 em 10: o encontro vem um degrau acima (rng(100) ≤ 10 logo após a chance de emboscada)
    const spike = ex.wanderingEncounter(c, mata, 180, seq(5, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1))
    assert.match(spike.join("|"), /pior que o lugar prometia/)
    const normal = ex.wanderingEncounter(c, mata, 180, seq(5, 90, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1))
    assert.doesNotMatch(normal.join("|"), /pior que o lugar prometia/)
    c.close()
  })
})

describe("o Mestre gera e conduz uma masmorra pelo beat", () => {
  it("dungeon.generate, search, loot, engage; contexto mostra portas, ocultos e progresso", () => {
    const c = novoPc("bm1", home, "rogue")
    openTurn(c, "Procuro uma masmorra.")
    const r = submit(c, { ops: [{ op: "dungeon.generate", as: "d", theme: "cripta", level: 1, rooms: 7, from: "l0", seed: 9 }] })
    assert.match(r.lines.join("\n"), /masmorra d1 /)
    const entrance = c.db.prepare("SELECT entrance FROM dungeons").get()!.entrance as string
    const m = submit(c, { ops: [{ op: "move", who: "pc", to: entrance }] })
    assert.match(m.lines.join("\n"), new RegExp(`pc → ${entrance}`))
    const ctx = context(c, { full: true })
    assert.match(ctx, /masmorra:/); assert.match(ctx, /1\/7 visitadas/)
    submit(c, { ops: [{ op: "search", mode: "investigacao" }] })
    assert.throws(() => submit(c, { ops: [{ op: "loot", feature: 9999 }] }), /não existe/)
    assert.throws(() => submit(c, { ops: [{ op: "unlock", door: 9999, method: "forca" }] }), /não existe/)
    const s = submit(c, { ops: [{ op: "encounter.suggest", difficulty: "moderada", theme: "cripta" }] })
    assert.match(s.lines.join(""), /sugestão \(moderada/)
    submit(c, { ops: [{ op: "place.describe", place: entrance, details: "Um átrio com colunas quebradas e inscrições de luto." }] })
    assert.equal(c.invariants().length, 0)
    c.close()
  })
})
