import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, it } from "node:test"

const { createCampaign, openCampaign } = await import("../src/campaign.ts")
const { buildContext } = await import("../src/context.ts")
const db = await import("../src/db.ts")
const { applyItemAction } = await import("../src/items.ts")
const { requestRoll, resolveRequest } = await import("../src/mechanics.ts")
const { applyOps, parseOps } = await import("../src/ops.ts")
const { createPc } = await import("../src/pc.ts")
const { buildView } = await import("../src/view.ts")
const { getCharacter } = await import("../src/world.ts")

type DB = ReturnType<typeof openCampaign>
let w: DB
let n = 0
const act = (action: string, item: string) => db.transaction(w, () => applyItemAction(w, action, item))
const pc = () => getCharacter(w, "pc:lyra")
const npc = (id: string) => getCharacter(w, id)

beforeEach(() => {
  process.env.DNDAI_HOME = mkdtempSync(join(tmpdir(), "dndai-items-"))
  w = createCampaign(`i${++n}`, { name: "Itens", premise: "p", tone: "" })
  db.transaction(w, () => {
    applyOps(w, parseOps([
      { op: "create.place", as: "t", name: "Taverna do Javali", kind: "taverna", summary: "Taverna." },
      { op: "create.place", name: "Trilha", kind: "floresta", summary: "Trilha.", links: [{ to: "$t", minutes: 10 }] },
      { op: "create.npc", name: "Brom", place: "$t", summary: "taverneiro anão", attitude: 30 },
      { op: "create.npc", name: "Sargento Vel", place: "$t", summary: "guarda da cidade", attitude: 0 },
      { op: "create.npc", name: "Bandido", place: "$t", summary: "bandido", attitude: -80 },
    ]))
    createPc(w, {
      name: "Lyra", race: "Elfa", class: "ladino", ac: 12, place: "Taverna do Javali",
      abilities: { for: 10, des: 16, con: 12, int: 13, sab: 12, car: 14 },
      items: [
        { name: "Poção de Cura", kind: "consumível", qty: 2, props: { heal: "2d4+2" } },
        { name: "Rapieira", kind: "arma", props: { damage: "1d8", finesse: true } },
        { name: "Couro Batido", kind: "armadura", props: { ac: 12 } },
        { name: "Escudo", kind: "escudo", props: { ac_bonus: 2 } },
      ],
    })
  })
})

describe("ações de item", () => {
  it("poção cura com dado do motor, consome e some ao acabar", () => {
    db.transaction(w, () => applyOps(w, parseOps([{ op: "hp", who: "pc", damage: 5 }])))
    const out = act("usar", "Poção de Cura")
    assert.match(out, /2d4\+2/)
    assert.ok(pc().hp > 4)
    act("usar", "Poção de Cura")
    assert.throws(() => act("usar", "Poção de Cura"), /não tem/)
  })

  it("armadura e escudo recalculam a CA; guardar desfaz", () => {
    act("equipar", "Couro Batido")
    assert.equal(pc().ac, 12 + 3)
    act("equipar", "Escudo")
    assert.equal(pc().ac, 17)
    act("guardar", "Escudo")
    assert.equal(pc().ac, 15)
  })

  it("arma em punho na taverna: medo, guarda adverte, hostil desafia; memória e sem punição repetida", () => {
    const out = act("empunhar", "Rapieira")
    assert.match(out, /Brom com medo/)
    assert.match(out, /Sargento Vel adverte/)
    assert.match(out, /Bandido encara a arma/)
    assert.equal(npc("npc:brom").attitude, 15)
    assert.equal(npc("npc:sargento-vel").attitude, -20)
    assert.match(buildContext(w, "x"), /EM PUNHO: Rapieira[\s\S]*Reagindo agora: com medo/)
    const brom = buildView(w, "x").present.find((p) => p.id === "npc:brom")!
    assert.equal(brom.reaction, "com medo da sua arma")
    act("embainhar", "Rapieira")
    assert.equal(buildView(w, "x").present.find((p) => p.id === "npc:brom")!.reaction, null)
    act("empunhar", "Rapieira") // mesma cena: não pune de novo
    assert.equal(npc("npc:brom").attitude, 15)
    assert.match(buildContext(w, "x"), /Lyra sacou Rapieira em Taverna do Javali/)
  })

  it("só oferece ações válidas e bloqueia herói incapacitado", () => {
    const inv = () => (buildView(w, "x").pc!.inventory as { name: string; actions: string[]; effect: string | null }[])
    assert.deepEqual(inv().find((i) => i.name === "Rapieira")!.actions, ["equipar", "empunhar", "largar"])
    assert.equal(inv().find((i) => i.name === "Poção de Cura")!.effect, "Cura 2d4+2 PV")
    assert.throws(() => act("embainhar", "Rapieira"), /Não dá para embainhar/)
    db.transaction(w, () => applyOps(w, parseOps([{ op: "hp", who: "pc", damage: 50 }])))
    assert.deepEqual(inv().find((i) => i.name === "Rapieira")!.actions, [])
    assert.throws(() => act("usar", "Poção de Cura"), /não pode agir/)
  })

  it("teste contra a morte pela mesa: d20 sem modificador, CD 10, aplica o resultado", () => {
    db.transaction(w, () => applyOps(w, parseOps([{ op: "hp", who: "pc", damage: 9 }])))
    assert.equal(pc().status, "inconsciente")
    const { id } = db.transaction(w, () => requestRoll(w, { kind: "morte", who: "pc:lyra", reason: "" }))
    const view = buildView(w, "x").pendingRolls[0]
    assert.equal(view.kind, "resistencia")
    assert.deepEqual(view.dice, [{ sides: 20 }])
    const r = db.transaction(w, () => resolveRequest(w, id, [12], "mesa"))
    assert.equal(r.outcome, "sucesso")
    assert.equal(pc().sheet.death.success, 1)
  })

  it("rolagem pendente não pode ficar para depois: bloqueia novo turno até rolar ou cancelar", async () => {
    const { beginTurn } = await import("../src/turns.ts")
    const { cancelRequest } = await import("../src/mechanics.ts")
    const { id } = db.transaction(w, () => requestRoll(w, { kind: "pericia", who: "pc:lyra", key: "percepcao", dc: 10, mode: "normal", bonus: 0, reason: "" }))
    assert.throws(() => beginTurn(w, db.getMeta(w, "slug"), "faz outra coisa"), /rolagem pendente/)
    db.transaction(w, () => cancelRequest(w, id))
    assert.match(beginTurn(w, db.getMeta(w, "slug"), "faz outra coisa")[0], /Turno 1 aberto/)
  })

  it("raridade só entra na visão quando é conhecida; retrato do combate vem da ficha", async () => {
    const { startCombat } = await import("../src/simulation.ts")
    db.transaction(w, () => {
      applyOps(w, parseOps([
        { op: "create.item", owner: "pc", name: "Manto", kind: "manto", props: { rarity: "very rare" } },
        { op: "create.item", owner: "pc", name: "Seixo", kind: "equipamento", props: { rarity: "brilhante" } },
        { op: "update", id: "pc", portrait: "https://example.test/lyra.png" },
        { op: "update", id: "npc:brom", portrait: "https://example.test/brom.png" },
      ]))
      startCombat(w, ["npc:brom"])
    })
    const view = buildView(w, "x")
    const inv = view.pc!.inventory as { name: string; rarity: string | null }[]
    assert.equal(inv.find((i) => i.name === "Manto")!.rarity, "muito raro")
    assert.equal(inv.find((i) => i.name === "Seixo")!.rarity, null)
    assert.equal(inv.find((i) => i.name === "Rapieira")!.rarity, null)
    const order = view.combat!.order as { name: string; portrait: string | null }[]
    assert.equal(order.find((o) => o.name === "Lyra")!.portrait, "https://example.test/lyra.png")
    assert.equal(order.find((o) => o.name === "Brom")!.portrait, "https://example.test/brom.png")
    assert.doesNotMatch(JSON.stringify(view), /gancho|boato|persona/)
  })

  it("chegar com a arma em punho provoca reação no novo local e limpa a do anterior", () => {
    act("empunhar", "Rapieira")
    db.transaction(w, () => applyOps(w, parseOps([{ op: "move", who: "pc", to: "Trilha" }])))
    assert.equal(buildView(w, "x").present.length, 0)
    const reactions = db.all<{ text: string }>(w, "SELECT text FROM reactions WHERE text <> ''")
    assert.equal(reactions.length, 0)
  })
})
