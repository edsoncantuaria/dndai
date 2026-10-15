import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Campaign } from "../src/core/campaign.ts"
import * as mx from "../src/core/mechanics.ts"
import { createCharacter, pcView } from "../src/core/pc.ts"
import * as sc from "../src/core/scope.ts"

let home: string
before(() => { home = mkdtempSync(join(tmpdir(), "dnd-")) })
after(() => rmSync(home, { recursive: true }))

const novo = (slug: string) => {
  const c = Campaign.create(slug, { name: "t" }, { home })
  createCharacter(c, {
    name: "Brann", class: "fighter", species: "human", background: "soldier", method: "standard",
    scores: { str: 15, dex: 13, con: 14, int: 8, wis: 10, cha: 12 }, bonus: { plus2: "str", plus1: "con" },
    classSkills: ["acrobatics", "history"], classEquipment: 0, backgroundEquipment: 0, equipmentPicks: ["dice"],
    languages: ["dwarvish", "elvish"], speciesChoices: { skill: "perception", feat: "alert" }, mastery: ["greatsword", "flail", "javelin"],
  })
  return c
}

describe("escopo jogável", () => {
  it("recusa monstro inventado e ND acima do limite sem confirmação", () => {
    const c = novo("s1")
    assert.throws(() => sc.spawnChecked(c, "balrog-do-mestre", "l0"), /não invente/)
    assert.throws(() => sc.spawnChecked(c, "adult-red-dragon", "l0"), /passa do limite/)
    assert.ok(sc.spawnChecked(c, "goblin-warrior", "l0"))
    c.close()
  })

  it("item mágico: existe no SRD, raridade por nível, único", () => {
    const c = novo("s2")
    assert.throws(() => sc.grantMagicItem(c, "pc", "espada-do-destino"), /não existe no SRD/)
    assert.throws(() => sc.grantMagicItem(c, "pc", "vorpal-sword"), /só a partir do nível/)
    c.close()
  })

  it("dinheiro tem fonte e teto por turno; XP de combate conta uma vez", () => {
    const c = novo("s3")
    assert.throws(() => sc.grantMoney(c, "pc", 100, "achei"), /fonte/)
    assert.throws(() => sc.grantMoney(c, "pc", 200 * 100, "tesouro do covil do dragão"), /teto/)
    sc.grantMoney(c, "pc", 50 * 100, "bolsa do chefe goblin")
    const g = mx.spawnMonster(c, "goblin-warrior", "l0")
    assert.equal(sc.claimKillXp(c).xp, 0)
    mx.damage(c, g, 99, "fire")
    assert.equal(sc.claimKillXp(c).xp, 50)
    assert.equal(sc.claimKillXp(c).xp, 0)
    assert.equal(pcView(c).row.xp, 50)
    c.close()
  })

  it("XP de marco tem teto e intervalo", () => {
    const c = novo("s4")
    assert.throws(() => sc.grantMilestoneXp(c, "curto"), /motivo/)
    assert.equal(sc.grantMilestoneXp(c, "salvou a vila de Pedra Alta"), 75)
    assert.throws(() => sc.grantMilestoneXp(c, "salvou a vila de novo"), /já concedido/)
    c.close()
  })

  it("scopeText descreve o contrato para o Mestre", () => {
    assert.match(sc.scopeText(), /Proibido/)
  })
})
