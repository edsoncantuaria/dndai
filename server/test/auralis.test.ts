import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Campaign } from "../src/core/campaign.ts"
import { createCharacter } from "../src/core/pc.ts"
import * as A from "../src/world/auralis.ts"
import { bible, seedWorld } from "../src/world/seed.ts"
import { context, lore, worldBook } from "../src/mestre/context.ts"
import { autoChoices } from "./helpers.ts"

let home: string
before(() => { home = mkdtempSync(join(tmpdir(), "dnd-")) })
after(() => rmSync(home, { recursive: true }))

describe("mundo Auralis", () => {
  it("semeia o cenário inteiro: lugares conexos, facções com laços, NPCs com rotina, 10 masmorras, agendas", () => {
    const c = Campaign.create("aur", { name: "Auralis" }, { home })
    seedWorld(c, "auralis")
    const n = (sql: string) => (c.db.prepare(sql).get() as { n: number }).n
    assert.equal(n("SELECT COUNT(*) n FROM factions"), A.FACTIONS.length)
    const pairs = new Set(A.FACTIONS.flatMap((f) => (f.ties ?? []).map(([o]) => [f.key, o].sort().join("|"))))
    assert.equal(n("SELECT COUNT(*) n FROM faction_ties"), pairs.size)
    assert.equal(n("SELECT COUNT(*) n FROM characters WHERE kind = 'npc'"), A.NPCS.length)
    assert.equal(n("SELECT COUNT(*) n FROM dungeons"), A.DUNGEONS.length)
    assert.equal(n("SELECT COUNT(*) n FROM clocks"), A.CLOCKS.length)
    assert.ok(n("SELECT COUNT(*) n FROM places WHERE dungeon_id IS NULL") >= A.PLACES.length)
    // todo lugar do mundo é alcançável a partir da vila (sem passagens secretas)
    const links = c.db.prepare("SELECT from_id, to_id FROM links").all() as { from_id: string; to_id: string }[]
    const reach = new Set(["l0"]); let grow = true
    while (grow) { grow = false; for (const e of links) if (reach.has(e.from_id) && !reach.has(e.to_id)) { reach.add(e.to_id); grow = true } }
    const all = c.db.prepare("SELECT id, name FROM places WHERE dungeon_id IS NULL").all() as { id: string; name: string }[]
    for (const p of all) assert.ok(reach.has(p.id), `${p.name} inalcançável`)
    // as masmorras também
    for (const d of c.db.prepare("SELECT entrance, name FROM dungeons").all() as { entrance: string; name: string }[]) assert.ok(reach.has(d.entrance), d.name)
    // NPCs com bloco de estatística do SRD válido e facção existente
    assert.ok(n("SELECT COUNT(*) n FROM members") >= 12)
    // cada lugar com controle tem facção; auras válidas
    for (const a of c.db.prepare("SELECT DISTINCT aura FROM places WHERE aura IS NOT NULL").all() as { aura: string }[]) assert.ok(["hallowed", "arcane-surge", "shadowfell", "feybleed", "stormwild", "dead-magic", "ley-node"].includes(a.aura), a.aura)
    assert.equal(c.invariants().length, 0)
    c.close()
  })

  it("PC começa na vila; o contexto traz o mundo; o livro do mundo separa público de segredo", () => {
    const c = Campaign.create("aur2", { name: "Auralis" }, { home })
    seedWorld(c, "auralis")
    createCharacter(c, autoChoices("wizard"))
    const ctx = context(c, { full: true })
    assert.match(ctx, /Brisaverde/); assert.match(ctx, /Reino de Valdoria|Coroa de Valdoria/); assert.match(ctx, /Taverna do Javali Dourado/)
    assert.equal(bible(c).some((b) => b.secret), false)
    assert.equal(bible(c, { secret: true }).filter((b) => b.secret).length, 1)
    assert.match(c.info().premise, /três luas/)
    assert.throws(() => seedWorld(c, "auralis"), /campanha vazia/)
    assert.throws(() => seedWorld(Campaign.create("aur3", { name: "x" }, { home }), "outro"), /não existe/)
    // o tempo anda: o ferreiro vai à taverna depois das 19h
    const bram = c.db.prepare("SELECT id FROM characters WHERE name LIKE 'Bram%'").get() as { id: string }
    assert.ok(bram)
    c.close()
  })
})

import * as mx from "../src/core/mechanics.ts"
import { pcView } from "../src/core/pc.ts"
import { cast } from "../src/core/spells.ts"
import * as w from "../src/core/world.ts"
import { novoPc } from "./helpers.ts"

function conj(slug: string, aura: string | null) {
  const c = novoPc(slug, home, "wizard")
  const s = pcView(c).sheet
  const slots: Record<string, { max: number; used: number }> = { "1": { max: 4, used: 0 }, "2": { max: 3, used: 0 }, "3": { max: 3, used: 0 } }
  c.commit("t", [{ op: "put", table: "characters", row: { id: "pc", hp: 100, max_hp: 100, sheet: { ...s, slots, spell: { ...s.spell!, cantrips: ["fire-bolt"], prepared: ["burning-hands", "shield", "mage-armor", "sleep"] } } } }, { op: "put", table: "places", row: { id: "l0", aura } }])
  return c
}

describe("auras mágicas dos lugares", () => {
  it("Zona Morta: nenhuma magia, nem truque", () => {
    const c = conj("au1", "dead-magic")
    assert.throws(() => cast(c, "pc", "fire-bolt", {}), /Zona Morta/)
    assert.throws(() => cast(c, "pc", "shield", {}), /Zona Morta/)
    c.close()
  })

  it("Nó Arcano: 1 natural no d20 vira surto (reembolso, proteção, potência, retorno); descanso curto devolve espaços", () => {
    const surge = (r4: number): ((s: number) => number) => (sides) => (sides === 4 ? r4 : 1)
    const c = conj("au2", "arcane-surge")
    const g = mx.spawnMonster(c, "goblin-warrior", "l0")
    let out = cast(c, "pc", "burning-hands", { slot: 1, targets: [g] }, surge(1))
    assert.ok(out.lines.some((l) => /devolve o espaço/.test(l))); assert.equal(pcView(c).sheet.slots["1"]!.used, 0)
    out = cast(c, "pc", "burning-hands", { slot: 1, targets: [g] }, surge(2))
    assert.ok(out.lines.some((l) => /PV temporários/.test(l))); assert.ok(pcView(c).row.temp_hp >= 1)
    const hp = pcView(c).row.hp
    out = cast(c, "pc", "burning-hands", { slot: 1, targets: [g] }, surge(4))
    assert.ok(out.lines.some((l) => /fere o conjurador/.test(l)))
    assert.ok(pcView(c).row.hp + pcView(c).row.temp_hp < hp + 100)
    // sem surto no resto do tempo e descanso devolve até 2 espaços
    const s = pcView(c).sheet; s.slots["1"]!.used = 2
    c.commit("t", [{ op: "put", table: "characters", row: { id: "pc", sheet: s } }])
    assert.match(mx.shortRest(c), /o Nó devolve 2 espaço/)
    c.close()
  })

  it("Pálido: cura pela metade; Solo Sagrado: morto-vivo ataca com desvantagem; Cume de Tempestade: à distância com desvantagem", () => {
    const c = conj("au3", "shadowfell")
    mx.damage(c, "pc", 40, "fire")
    assert.match(mx.heal(c, "pc", 20), /\+10 PV/)
    c.commit("t", [{ op: "put", table: "places", row: { id: "l0", aura: "hallowed" } }])
    const z = mx.spawnMonster(c, "zombie", "l0")
    assert.match(mx.attack(c, z, "pc", "Slam", "normal", (s) => (s === 20 ? 15 : 1)).text, /desvantagem: Solo Sagrado/)
    c.commit("t", [{ op: "put", table: "places", row: { id: "l0", aura: "stormwild" } }])
    const a = mx.spawnMonster(c, "goblin-warrior", "l0")
    assert.match(mx.attack(c, a, "pc", "Shortbow", "normal", () => 10).text, /desvantagem: vento de tempestade/)
    assert.doesNotMatch(mx.attack(c, a, "pc", "Scimitar", "normal", () => 10).text, /vento de tempestade/)
    c.close()
  })

  it("Clareira Feérica: horas lá dentro cobram salvaguarda de SAB e acabam enfeitiçando", () => {
    const c = conj("au4", "feybleed")
    let charmed = false
    for (let i = 0; i < 60 && !charmed; i++) { w.advanceTime(c, 60); charmed = pcView(c).sheet.conditions.includes("charmed") }
    assert.ok(charmed)
    c.close()
  })
})

describe("o Mestre consulta o livro do mundo", () => {
  it("mundo lista seções e devolve segredos; lore acha segredo; contexto mostra a aura do lugar", () => {
    const c = Campaign.create("au5", { name: "A" }, { home })
    seedWorld(c, "auralis")
    createCharacter(c, autoChoices("cleric"))
    assert.match(worldBook(c), /colapso-verdade/)
    assert.match(worldBook(c, "panteao"), /Solenne/)
    assert.match(worldBook(c, "colapso-verdade"), /Veyrion/)
    assert.ok(lore(c, "Sem-Nome").some((l) => l.kind.includes("🔒")), "o saber secreto aparece para o Mestre")
    c.db.prepare("UPDATE places SET aura = 'hallowed' WHERE id = 'l0'").run()
    assert.match(context(c, { full: true }), /Solo Sagrado/)
    c.close()
  })
})
