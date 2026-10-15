import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Campaign } from "../src/core/campaign.ts"
import { createCharacter, pcView } from "../src/core/pc.ts"
import { openTurn, submit } from "../src/mestre/submit.ts"

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

describe("beat do Mestre", () => {
  it("cria, usa rótulos, narra com {id} e fecha o turno", () => {
    const c = novo("b1")
    openTurn(c, "Entro na taverna e falo com a taberneira.")
    const r = submit(c, {
      ops: [
        { op: "create.place", as: "taverna", name: "Taverna do Javali", kind: "taverna", summary: "Cheira a lenha.", links: [{ to: "l0", minutes: 5 }] },
        { op: "create.npc", as: "mira", name: "Mira", summary: "Taberneira desconfiada", place: "$taverna" },
        { op: "move", who: "pc", to: "$taverna" },
      ],
      narration: "Você empurra a porta e entra na {l1}. {n1} ergue os olhos do balcão e não sorri.",
      summary: "Brann chegou à Taverna do Javali e viu Mira.",
    })
    assert.equal(r.closed, true)
    assert.match(r.narration!, /Taverna do Javali/)
    assert.match(r.narration!, /Mira ergue/)
    assert.equal(c.db.prepare("SELECT ended FROM turns WHERE n = 1").get()!.ended, 1)
    c.close()
  })

  it("é tudo ou nada: op inválida desfaz o lote inteiro", () => {
    const c = novo("b2")
    assert.throws(() => submit(c, { ops: [{ op: "create.place", name: "Ruínas", kind: "ruína", summary: "x" }, { op: "move", who: "pc", to: "l99" }] }), /não existe/)
    assert.equal(c.db.prepare("SELECT COUNT(*) n FROM places").get()!.n, 1)
    c.close()
  })

  it("recusa narração com nome inventado, morto agindo e segredo vazado", () => {
    const c = novo("b3")
    submit(c, { ops: [
      { op: "create.npc", name: "Zorvak", summary: "Bandido", place: "l0" },
      { op: "fact", text: "O prefeito Aldric envenenou o poço da vila para culpar os goblins", secret: true },
    ] })
    assert.throws(() => submit(c, { narration: "Você vê Gandalf no fim da estrada.", summary: "Cena com Gandalf na estrada." }), /não é uma entidade/)
    assert.throws(() => submit(c, { narration: "O prefeito Aldric envenenou o poço da vila para culpar os goblins, você descobre.", summary: "Revelou o segredo do poço." }), /segredo/)
    submit(c, { ops: [{ op: "spawn", as: "g", srd: "goblin-warrior", place: "l0" }, { op: "attack", attacker: "pc", target: "$g", using: "Greatsword" }] })
    c.db.prepare("UPDATE characters SET status='morto', hp=0 WHERE id='n1'").run()
    assert.throws(() => submit(c, { narration: "{n1} sorri e saca a adaga.", summary: "Zorvak sorri e saca a adaga." }), /está morto/)
    c.close()
  })

  it("magia inexistente, item mágico acima do nível e compra sem dinheiro são recusados", () => {
    const c = novo("b4")
    assert.throws(() => submit(c, { ops: [{ op: "cast", who: "pc", spell: "bola-de-fogo-suprema", targets: [] }] }), /não existe no SRD/)
    assert.throws(() => submit(c, { ops: [{ op: "item.magic", to: "pc", srd: "vorpal-sword" }] }), /nível/)
    assert.throws(() => submit(c, { ops: [{ op: "buy", who: "pc", srd: "plate-armor" }] }), /insuficiente/)
    assert.equal(pcView(c).items.some((i) => i.srd === "plate-armor"), false)
    c.close()
  })
})
