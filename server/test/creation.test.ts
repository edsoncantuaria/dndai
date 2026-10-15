import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Campaign } from "../src/core/campaign.ts"
import { CreationError, type CreationChoices } from "../src/core/creation.ts"
import { createCharacter, pcView, rollAbilities } from "../src/core/pc.ts"

let home: string
before(() => { home = mkdtempSync(join(tmpdir(), "dnd-")) })
after(() => rmSync(home, { recursive: true }))

const fighter: CreationChoices = {
  name: "Brann", class: "fighter", species: "human", background: "soldier", method: "standard",
  scores: { str: 15, dex: 13, con: 14, int: 8, wis: 10, cha: 12 }, bonus: { plus2: "str", plus1: "con" },
  classSkills: ["acrobatics", "history"], classEquipment: 0, backgroundEquipment: 0, equipmentPicks: ["dice"], languages: ["dwarvish", "elvish"],
  speciesChoices: { skill: "perception", feat: "alert" }, mastery: ["greatsword", "flail", "javelin"],
}

describe("criação 2024", () => {
  it("Guerreiro humano: PV, CA, ataques e perícias saem do SRD", () => {
    const c = Campaign.create("g1", { name: "t" }, { home })
    createCharacter(c, fighter)
    const v = pcView(c)
    assert.equal(v.row.max_hp, 10 + 2) // d10 + CON 14(+2)... con 14+1=15 → +2
    assert.equal(v.sheet.abilities.str, 17)
    assert.equal(v.derived.ac, 16) // cota de malha
    for (const k of ["athletics", "intimidation", "acrobatics", "history", "perception"]) assert.ok(v.sheet.skills.includes(k), k)
    assert.deepEqual(v.sheet.feats.sort(), ["alert", "savage-attacker"].sort())
    assert.ok(v.derived.attacks.some((a) => a.name === "Greatsword" && a.bonus === 3 + 2))
    c.close()
  })

  it("rejeita escolhas inválidas com mensagem clara", () => {
    const c = Campaign.create("g2", { name: "t" }, { home })
    assert.throws(() => createCharacter(c, { ...fighter, scores: { str: 18, dex: 13, con: 14, int: 8, wis: 10, cha: 12 } }), /array padrão/)
    assert.throws(() => createCharacter(c, { ...fighter, bonus: { plus2: "int", plus1: "con" } }), CreationError)
    assert.throws(() => createCharacter(c, { ...fighter, classSkills: ["acrobatics"] }), /exatamente 2/)
    c.close()
  })

  it("atributos rolados só valem se o motor rolou", () => {
    const c = Campaign.create("g3", { name: "t" }, { home })
    const { token, scores } = rollAbilities(c)
    const s = Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map((a, i) => [a, scores[i]])) as CreationChoices["scores"]
    assert.throws(() => createCharacter(c, { ...fighter, method: "roll", rollToken: "falso", scores: s }), /rollToken/)
    createCharacter(c, { ...fighter, method: "roll", rollToken: token, scores: s })
    assert.equal(pcView(c).sheet.abilities.str >= 8, true)
    c.close()
  })

  it("Mago elfo: magias, espaços e undo do ledger", () => {
    const c = Campaign.create("g4", { name: "t" }, { home })
    createCharacter(c, {
      name: "Ilyra", class: "wizard", species: "elf", subspecies: "elven-lineage-high-elf", background: "sage", method: "pointbuy",
      scores: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 8 }, bonus: { plus2: "int", plus1: "con" },
      classSkills: ["investigation", "medicine"], classEquipment: 0, backgroundEquipment: 0,
      languages: ["dwarvish", "elvish"], speciesChoices: { skill: "insight" },
      spells: { cantrips: ["light", "mage-hand", "ray-of-frost"], prepared: ["magic-missile", "shield", "mage-armor", "sleep"], spellbook: ["magic-missile", "shield", "mage-armor", "sleep", "detect-magic", "identify"] },
    })
    const v = pcView(c)
    assert.equal(v.sheet.slots["1"]?.max, 2)
    assert.equal(v.derived.spellDc, 8 + 2 + 3)
    assert.equal(v.row.max_hp, 6 + 2)
    assert.equal(c.undo(), "criar-personagem")
    assert.equal(c.db.prepare("SELECT COUNT(*) n FROM characters").get()!.n, 0)
    c.close()
  })
})
