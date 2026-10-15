import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Campaign } from "../src/core/campaign.ts"
import { createCharacter } from "../src/core/pc.ts"
import { context, recall, resume } from "../src/mestre/context.ts"
import { openTurn, submit } from "../src/mestre/submit.ts"

let home: string
before(() => { home = mkdtempSync(join(tmpdir(), "dnd-")) })
after(() => rmSync(home, { recursive: true }))

describe("campanha longa (Mestre simulado)", () => {
  it("100 turnos: cena e resume ficam limitados, nada se perde, invariantes valem", () => {
    const c = Campaign.create("longa", { name: "Longa", premise: "Uma vila isolada esconde um culto." }, { home })
    createCharacter(c, {
      name: "Brann", class: "fighter", species: "human", background: "soldier", method: "standard",
      scores: { str: 15, dex: 13, con: 14, int: 8, wis: 10, cha: 12 }, bonus: { plus2: "str", plus1: "con" },
      classSkills: ["acrobatics", "history"], classEquipment: 0, backgroundEquipment: 0, equipmentPicks: ["dice"],
      languages: ["dwarvish", "elvish"], speciesChoices: { skill: "perception", feat: "alert" }, mastery: ["greatsword", "flail", "javelin"],
    })
    let sceneChars = 0
    for (let t = 1; t <= 100; t++) {
      openTurn(c, `Ação ${t}`)
      submit(c, { ops: [
        { op: "create.place", as: "p", name: `Lugar ${t}`, kind: "campo", summary: `Um lugar qualquer número ${t}.`, links: [{ to: "l0", minutes: 10 }] },
        { op: "create.npc", as: "n", name: `Pessoa ${t}`, summary: `Habitante ${t}`, place: "$p" },
        { op: "fact", text: `Fato número ${t} sobre a vila` },
        { op: "hook", kind: "misterio", text: `Mistério ${t}` },
        { op: "move", who: "pc", to: "$p" }, { op: "move", who: "pc", to: "l0" },
      ], narration: `Você caminha pela estrada e encontra o lugar ${t}.`.replace(/\d+/, "") + " O vento sopra.", summary: `Brann explorou o lugar ${t} e conheceu a pessoa ${t}.` })
      if (t === 100) sceneChars = context(c, { full: true }).length
    }
    assert.ok(sceneChars < 12_000, `cena inteira ${sceneChars} chars`)
    assert.ok(resume(c).length < 20_000)
    assert.equal(c.invariants().length, 0)
    assert.equal(c.db.prepare("SELECT COUNT(*) n FROM chapters").get()!.n, 12)
    assert.ok(recall(c, "Mistério 3").length > 0)
    c.close()
  })
})
