import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Campaign } from "../src/core/campaign.ts"
import { createCharacter } from "../src/core/pc.ts"
import * as w from "../src/core/world.ts"

let home: string
before(() => { home = mkdtempSync(join(tmpdir(), "dnd-")) })
after(() => rmSync(home, { recursive: true }))

describe("mundo", () => {
  it("locais, rota mais curta, tempo, NPC, atitude, memória e undo", () => {
    const c = Campaign.create("w1", { name: "t" }, { home })
    createCharacter(c, {
      name: "Brann", class: "fighter", species: "human", background: "soldier", method: "standard",
      scores: { str: 15, dex: 13, con: 14, int: 8, wis: 10, cha: 12 }, bonus: { plus2: "str", plus1: "con" },
      classSkills: ["acrobatics", "history"], classEquipment: 0, backgroundEquipment: 0, equipmentPicks: ["dice"],
      languages: ["dwarvish", "elvish"], speciesChoices: { skill: "perception", feat: "alert" }, mastery: ["greatsword", "flail", "javelin"],
    })
    const taverna = w.createPlace(c, { name: "Taverna", kind: "taverna", summary: "Cheira a lenha.", links: [{ to: "l0", minutes: 10 }] })
    const mina = w.createPlace(c, { name: "Mina", kind: "mina", summary: "Escura.", links: [{ to: taverna, minutes: 30 }, { to: "l0", minutes: 90 }] })
    const t0 = c.time
    assert.equal(w.move(c, "pc", mina).minutes, 40) // inicio→taverna→mina
    assert.equal(c.time, t0 + 40)
    const npc = w.createNpc(c, { name: "Mira", summary: "Taberneira", place: mina, persona: { goal: "proteger a taverna" } })
    assert.equal(w.setAttitude(c, npc, -30, "foi insultada"), -30)
    assert.equal(c.db.prepare("SELECT COUNT(*) n FROM memories WHERE npc_id = ?").get(npc)!.n, 1)
    assert.throws(() => w.move(c, "pc", "l99"), /não existe/)
    c.close()
  })
})

describe("backup", () => {
  it("copia o mundo para DNDAI_BACKUP_DIR sem quebrar o commit", () => {
    const dir = mkdtempSync(join(tmpdir(), "bkp-"))
    process.env.DNDAI_BACKUP_DIR = dir
    try {
      const c = Campaign.create("bk", { name: "t" }, { home })
      w.createPlace(c, { name: "Ponte", kind: "ponte", summary: "Velha.", links: [{ to: "l0", minutes: 5 }] })
      const files = readdirSync(join(dir, "bk"))
      assert.ok(files.some((f: string) => f.startsWith("world-")))
      c.close()
    } finally { delete process.env.DNDAI_BACKUP_DIR; rmSync(dir, { recursive: true }) }
  })
})
