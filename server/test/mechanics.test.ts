import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Campaign } from "../src/core/campaign.ts"
import type { CreationChoices } from "../src/core/creation.ts"
import type { Rng } from "../src/core/dice.ts"
import { spend } from "../src/core/features.ts"
import * as mx from "../src/core/mechanics.ts"
import { createCharacter, pcView } from "../src/core/pc.ts"
import { awardXp, levelUp } from "../src/core/progression.ts"

let home: string
before(() => { home = mkdtempSync(join(tmpdir(), "dnd-")) })
after(() => rmSync(home, { recursive: true }))

/** RNG roteirizado: consome a fila e depois devolve o máximo. */
const seq = (...v: number[]): Rng => { const q = [...v]; return (s) => q.shift() ?? s }

const fighter: CreationChoices = {
  name: "Brann", class: "fighter", species: "human", background: "soldier", method: "standard",
  scores: { str: 15, dex: 13, con: 14, int: 8, wis: 10, cha: 12 }, bonus: { plus2: "str", plus1: "con" },
  classSkills: ["acrobatics", "history"], classEquipment: 0, backgroundEquipment: 0, equipmentPicks: ["dice"],
  languages: ["dwarvish", "elvish"], speciesChoices: { skill: "perception", feat: "alert" }, mastery: ["greatsword", "flail", "javelin"],
}
const novo = (slug: string) => { const c = Campaign.create(slug, { name: "t" }, { home }); createCharacter(c, fighter); return c }

describe("mecânica", () => {
  it("ataque contra monstro do SRD: acerto, dano e morte", () => {
    const c = novo("m1")
    const g = mx.spawnMonster(c, "goblin-warrior", "l0")
    const r = mx.attack(c, "pc", g, "Greatsword", "normal", seq(15, 6, 6)) // d20=15 (+5=20 vs 15), 2d6=12... +3
    assert.equal(r.hit, true)
    assert.equal(mx.character(c, g).status, "morto") // 10 PV, dano 6+6+3
    c.close()
  })

  it("crítico dobra os dados e 1 natural sempre erra", () => {
    const c = novo("m2")
    const g = mx.spawnMonster(c, "goblin-warrior", "l0")
    assert.equal(mx.attack(c, "pc", g, "Greatsword", "normal", seq(1)).hit, false)
    const crit = mx.attack(c, "pc", g, "Greatsword", "normal", seq(20, 1, 1, 1, 1))
    assert.equal(crit.crit, true)
    assert.equal(crit.damage, 4 + 3) // 4d6 de 1 + 3
    c.close()
  })

  it("PC a 0 PV cai inconsciente; salvaguardas contra morte; cura levanta", () => {
    const c = novo("m3")
    const max = pcView(c).row.max_hp
    mx.damage(c, "pc", max, "slashing")
    assert.equal(pcView(c).row.status, "inconsciente")
    assert.match(mx.deathSave(c, "pc", seq(12)), /sucessos 1\/3/)
    assert.match(mx.deathSave(c, "pc", seq(1)), /falhas 2\/3/)
    mx.heal(c, "pc", 4)
    assert.equal(pcView(c).row.status, "vivo")
    assert.deepEqual(pcView(c).sheet.deathSaves, { ok: 0, fail: 0 })
    mx.damage(c, "pc", max + 4 + pcView(c).row.max_hp, "fire") // morte instantânea
    assert.equal(pcView(c).row.status, "morto")
    c.close()
  })

  it("equipar escudo muda a CA; dinheiro nunca fica negativo", () => {
    const c = novo("m4")
    const before = pcView(c).derived.ac
    const id = mx.giveItem(c, "pc", "shield")
    mx.equip(c, id, true)
    assert.equal(pcView(c).row.ac, before + 2)
    assert.throws(() => mx.money(c, "pc", -999999), /insuficiente/)
    c.close()
  })

  it("iniciativa, turnos e fim de combate", () => {
    const c = novo("m5")
    const g = mx.spawnMonster(c, "goblin-warrior", "l0")
    const st = mx.startCombat(c, ["pc", g], seq(10, 18))
    assert.equal(st.order[0]!.id, g)
    assert.equal(mx.nextTurn(c).turn, 1)
    assert.equal(mx.nextTurn(c).round, 2)
    mx.endCombat(c)
    assert.equal(mx.combatState(c), undefined)
    c.close()
  })

  it("descansos restauram PV, dados de vida e recursos", () => {
    const c = novo("m6")
    mx.damage(c, "pc", 8, "fire")
    spend(c, "pc", "second_wind_uses")
    assert.match(mx.shortRest(c, "pc", 1, seq(6)), /dado\(s\) de vida/)
    assert.equal(pcView(c).sheet.uses.second_wind_uses ?? 0, 0)
    assert.match(mx.longRest(c), /restaurados/)
    assert.equal(pcView(c).row.hp, pcView(c).row.max_hp)
    c.close()
  })

  it("subida de nível exige XP e escolhas válidas; undo desfaz", () => {
    const c = novo("m7")
    assert.throws(() => levelUp(c, { hp: "average" }), /faltam 300 XP/)
    awardXp(c, 300)
    const hp0 = pcView(c).row.max_hp
    levelUp(c, { hp: "average", mastery: undefined })
    const v = pcView(c)
    assert.equal(v.sheet.level, 2)
    assert.equal(v.row.max_hp, hp0 + 6 + 2) // média d10 = 6, CON +2
    assert.ok(v.sheet.features.includes("fighter-action-surge"))
    assert.equal(c.undo(), "subir-nivel")
    assert.equal(pcView(c).sheet.level, 1)
    c.close()
  })
})

describe("necessidades de subida de nível", () => {
  it("Guerreiro nível 3 pede subclasse; nível 4 pede aumento de atributo; Mago pede magias", async () => {
    const { levelUpNeeds } = await import("../src/core/progression.ts")
    const c = novo("ln1")
    awardXp(c, 900)
    levelUp(c, { hp: "average" })
    const n3 = levelUpNeeds(c)
    assert.equal(n3.level, 3); assert.ok(n3.subclass!.some((s: { index: string }) => s.index === "champion"))
    levelUp(c, { hp: "average", subclass: "champion" })
    awardXp(c, 2700)
    const n4 = levelUpNeeds(c)
    assert.ok(n4.asi!.feats.length >= 1 && n4.asi!.abilities.length === 6); assert.equal(n4.subclass, null)
    assert.throws(() => levelUp(c, { hp: "average" }), /Aumento de Atributo/)
    levelUp(c, { hp: "average", asi: { plus: { str: 2 } }, mastery: ["greatsword", "flail", "javelin", "longsword"] })
    assert.equal(pcView(c).sheet.abilities.str, 19)
    c.close()
  })
})
