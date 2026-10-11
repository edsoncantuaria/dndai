import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, it } from "node:test"

process.env.DNDAI_HOME = mkdtempSync(join(tmpdir(), "dndai-test-"))

const { createCampaign, openCampaign } = await import("../src/campaign.ts")
const { buildContext, recall } = await import("../src/context.ts")
const db = await import("../src/db.ts")
const { parseDice, roll } = await import("../src/dice.ts")
const { requestRoll, resolveRequest, rollNow } = await import("../src/mechanics.ts")
const { applyOps, parseOps } = await import("../src/ops.ts")
const { createPc } = await import("../src/pc.ts")
const { spellSlots } = await import("../src/rules.ts")
const { advanceTime } = await import("../src/simulation.ts")
const { beginTurn, endTurn, narrate, undoTurn } = await import("../src/turns.ts")
const { buildView } = await import("../src/view.ts")
const { getCharacter, parseDuration, parseMoney } = await import("../src/world.ts")

type DB = ReturnType<typeof openCampaign>
let slugN = 0
let slug = ""
let w: DB

const apply = (ops: unknown) => db.transaction(w, () => applyOps(w, parseOps(ops)))
const fixed = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

beforeEach(() => {
  // Cada teste em um multiverso próprio (campanhas no mesmo diretório compartilham o mundo).
  process.env.DNDAI_HOME = mkdtempSync(join(tmpdir(), "dndai-test-"))
  slug = `t${++slugN}`
  w = createCampaign(slug, { name: "Teste", premise: "premissa", tone: "" })
  apply([
    { op: "create.place", as: "vila", name: "Vila", kind: "vila", summary: "Uma vila." },
    { op: "create.place", as: "mina", name: "Mina", kind: "masmorra", summary: "Mina escura.", links: [{ to: "$vila", minutes: "1h" }] },
    { op: "create.npc", as: "mara", name: "Mara", place: "$vila", summary: "ferreira", persona: { secret: "trai a vila" } },
  ])
  db.transaction(w, () =>
    createPc(w, {
      name: "Kael", race: "Humano", class: "guerreiro", ac: 16, place: "Vila", money: "10po",
      abilities: { for: 16, des: 12, con: 14, int: 10, sab: 12, car: 10 }, skills: ["percepcao"],
      items: [{ name: "Espada", props: { damage: "1d8" }, equipped: true }],
    })
  )
})

describe("dados e regras", () => {
  it("interpreta e rola expressões", () => {
    assert.equal(parseDice("2d6+3").length, 2)
    assert.equal(roll("2d6+3", fixed(4, 5)).total, 12)
    assert.equal(roll("4d6kh3", fixed(1, 6, 6, 6)).total, 18)
    assert.throws(() => parseDice("2d7"))
    assert.throws(() => parseDice("abc"))
  })
  it("calcula espaços de magia por tipo de conjurador", () => {
    assert.deepEqual(spellSlots("mago", 3), { 1: 4, 2: 2 })
    assert.deepEqual(spellSlots("paladino", 1), {})
    assert.deepEqual(spellSlots("paladino", 5), { 1: 4, 2: 2 })
    assert.deepEqual(spellSlots("bruxo", 5), { 3: 2 })
  })
  it("interpreta dinheiro e duração", () => {
    assert.equal(parseMoney("1po5pp"), 150)
    assert.equal(parseMoney("-3pc"), -3)
    assert.equal(parseDuration("1h30m"), 90)
    assert.throws(() => parseDuration("logo"))
  })
})

describe("lote atômico", () => {
  it("desfaz o lote inteiro quando uma operação falha", () => {
    assert.throws(() => apply([{ op: "money", who: "pc", amount: "5po" }, { op: "money", who: "pc", amount: "-100po" }]), /NADA foi gravado/)
    assert.equal(getCharacter(w, "pc:kael").cp, 1000)
  })
  it("rejeita referências inexistentes com sugestão", () => {
    assert.throws(() => apply([{ op: "move", who: "pc", to: "Minas" }]), /não encontrado/)
    assert.throws(() => apply([{ op: "memory", npcs: ["npc:ninguem"], text: "x" }]), /não existe/)
  })
  it("rejeita campos desconhecidos", () => {
    assert.throws(() => parseOps([{ op: "fact", text: "x", inventado: 1 }]), /inválida/)
  })
  it("viagem só por ligação registrada e consome o tempo", () => {
    apply([{ op: "move", who: "pc", to: "Mina" }])
    assert.equal(getCharacter(w, "pc:kael").place_id, "place:mina")
    assert.equal(db.metaNum(w, "now"), 8 * 60 + 60)
  })
  it("atitude gera memória no NPC", () => {
    apply([{ op: "attitude", npc: "Mara", delta: 25, reason: "Kael salvou o irmão dela" }])
    const m = getCharacter(w, "npc:mara")
    assert.equal(m.attitude, 25)
    assert.match(buildContext(w, slug), /Kael salvou o irmão dela/)
  })
})

describe("mundo vivo", () => {
  it("relógios, eventos e rotinas avançam com o tempo", () => {
    apply([
      { op: "create.clock", name: "Ritual", segments: 2, every: "6h", on_complete: "desaba" },
      { op: "create.event", in: "3h", text: "caravana chega" },
      { op: "update", id: "Mara", schedule: [{ from: "19:00", to: "06:00", place: "Mina" }] },
    ])
    const out = db.transaction(w, () => advanceTime(w, 12 * 60))
    assert.ok(out.some((l) => l.includes("AGENDA DISPAROU")))
    assert.ok(out.some((l) => l.includes("EVENTO VENCEU")))
    assert.equal(getCharacter(w, "npc:mara").place_id, "place:mina")
  })
})

describe("rolagens", () => {
  it("ataque aplica dano e mata NPC a 0 PV", () => {
    const r = db.transaction(w, () =>
      rollNow(w, { kind: "ataque", who: "pc:kael", target: "npc:mara", with: null, spell: false, damage: null, mode: "normal", bonus: 0, reason: "" }, [15, 6])
    )
    assert.equal(r.outcome, "sucesso")
    assert.equal(getCharacter(w, "npc:mara").status, "morto")
  })
  it("pedido da mesa valida dados e não resolve duas vezes", () => {
    const { id } = db.transaction(w, () => requestRoll(w, { kind: "pericia", who: "pc:kael", key: "percepcao", dc: 15, mode: "vantagem", bonus: 0, reason: "" }))
    assert.throws(() => resolveRequest(w, id, [3], "mesa"), /espera 2/)
    assert.throws(() => resolveRequest(w, id, [3, 21], "mesa"), /inválido/)
    const r = db.transaction(w, () => resolveRequest(w, id, [3, 14], "mesa"))
    assert.equal(r.total, 14 + 3)
    assert.equal(r.outcome, "sucesso")
    assert.throws(() => resolveRequest(w, id, [3, 14], "mesa"), /já está/)
  })
})

describe("turnos e memória", () => {
  it("exige turno aberto após a preparação, registra a crônica e desfaz", () => {
    beginTurn(w, slug, "Kael fala com Mara")
    apply([{ op: "fact", text: "Mara esconde um mapa da mina" }])
    endTurn(w, "Kael conversou com Mara sobre a mina.", "")
    assert.match(recall(w, "mapa"), /Mara esconde um mapa/)
    w.close()
    undoTurn(slug)
    w = openCampaign(slug)
    assert.doesNotMatch(recall(w, "mapa"), /esconde/)
    assert.equal(db.metaNum(w, "turn"), 0)
  })
  it("narrate + turn end com o mesmo texto não duplica a narração", () => {
    beginTurn(w, slug, "Kael canta")
    narrate(w, "Você canta.")
    endTurn(w, "Kael cantou na praça da vila.", "Você canta.\n")
    assert.equal(db.all<{ n: number }>(w, "SELECT COUNT(*) AS n FROM narrations")[0].n, 1)
  })

  it("a visão do jogador não contém segredos", () => {
    apply([{ op: "fact", text: "o culto domina a mina", secret: true }])
    const view = JSON.stringify(buildView(w, slug))
    assert.doesNotMatch(view, /culto domina|trai a vila/)
    assert.match(buildContext(w, slug), /trai a vila/)
  })
})
