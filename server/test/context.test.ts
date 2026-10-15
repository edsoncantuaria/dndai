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

const novo = (slug: string) => {
  const c = Campaign.create(slug, { name: "Pedra Alta", premise: "Uma vila isolada esconde um culto.", tone: "sombrio" }, { home })
  createCharacter(c, {
    name: "Brann", class: "fighter", species: "human", background: "soldier", method: "standard",
    scores: { str: 15, dex: 13, con: 14, int: 8, wis: 10, cha: 12 }, bonus: { plus2: "str", plus1: "con" },
    classSkills: ["acrobatics", "history"], classEquipment: 0, backgroundEquipment: 0, equipmentPicks: ["dice"],
    languages: ["dwarvish", "elvish"], speciesChoices: { skill: "perception", feat: "alert" }, mastery: ["greatsword", "flail", "javelin"],
  })
  return c
}

describe("contexto e memória", () => {
  it("1ª leitura é a cena inteira; a 2ª só traz o que mudou", () => {
    const c = novo("c1")
    const a = context(c)
    assert.match(a, /Pedra Alta/); assert.match(a, /pc:/)
    const b = context(c)
    assert.match(b, /delta: true/); assert.match(b, /inalterado:/); assert.ok(b.length < a.length / 2)
    openTurn(c, "Olho em volta.")
    submit(c, { ops: [{ op: "create.npc", name: "Mira", summary: "Taberneira", place: "l0", persona: { secret: "Vende informações ao culto" } }] })
    const d = context(c)
    assert.match(d, /Mira/); assert.match(d, /🔒 Vende informações/)
    assert.doesNotMatch(d, /atributos/) // PC não mudou
    c.close()
  })

  it("fecha capítulo a cada 8 turnos; resume e recall enxergam a história", () => {
    const c = novo("c2")
    submit(c, { ops: [{ op: "create.npc", name: "Mira", summary: "Taberneira", place: "l0" }] })
    for (let i = 1; i <= 9; i++) {
      openTurn(c, `Ação ${i}`)
      submit(c, { narration: `Você espera enquanto o vento sopra na estrada, passo ${i}.`, summary: `Brann esperou na estrada, passo ${i}.` })
    }
    assert.equal(c.db.prepare("SELECT COUNT(*) n FROM chapters").get()!.n, 1)
    const r = resume(c)
    assert.match(r, /arco_atual/); assert.match(r, /ultima_narracao/)
    assert.ok(recall(c, "vento estrada").length > 0)
    submit(c, { ops: [{ op: "fact", text: "A ponte velha desabou na primavera passada" }] })
    assert.ok(recall(c, "ponte desabou").some((x) => x.kind === "fato"))
    c.close()
  })

  it("consolida memórias de NPC e mantém as originais apontando para o resumo", () => {
    const c = novo("c3")
    submit(c, { ops: [{ op: "create.npc", name: "Mira", summary: "Taberneira", place: "l0" }, { op: "memory", npcs: ["n1"], text: "Brann pagou a conta" }, { op: "memory", npcs: ["n1"], text: "Brann elogiou a sopa" }] })
    submit(c, { ops: [{ op: "memory.consolidate", npc: "n1", ids: [1, 2], text: "Brann é um cliente educado e paga em dia." }] })
    const ctx = context(c, { full: true })
    assert.match(ctx, /RELAÇÃO/)
    assert.doesNotMatch(ctx, /elogiou a sopa/)
    c.close()
  })
})
