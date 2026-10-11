import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"

process.env.DNDAI_HOME = mkdtempSync(join(tmpdir(), "dndai-atlas-"))

const { createCampaign, openCampaign } = await import("../src/campaign.ts")
const { publish } = await import("../src/atlas.ts")
const db = await import("../src/db.ts")
const { applyOps, parseOps } = await import("../src/ops.ts")
const { createPc } = await import("../src/pc.ts")
const { beginTurn, endTurn, undoTurn } = await import("../src/turns.ts")
const { getCharacter } = await import("../src/world.ts")

type DB = ReturnType<typeof openCampaign>

/** Mesma sequência do CLI: mutação + publicação numa transação. */
function apply(w: DB, ops: unknown) {
  return db.transaction(w, () => {
    const out = applyOps(w, parseOps(ops))
    publish(w)
    return out
  })
}

function places(w: DB): string[] {
  return db.all<{ name: string }>(w, "SELECT name FROM places ORDER BY name").map((p) => p.name)
}

function hero(w: DB, name: string) {
  db.transaction(w, () => {
    createPc(w, {
      name, race: "Humano", class: "guerreiro", ac: 16, place: "place:encruzilhada",
      abilities: { for: 16, des: 12, con: 14, int: 10, sab: 12, car: 10 },
    })
    publish(w)
  })
}

describe("multiverso compartilhado", () => {
  const a = createCampaign("mundo-a", { name: "Crônica A", premise: "p", tone: "" })
  apply(a, [
    { op: "create.place", as: "x", name: "Encruzilhada", kind: "estrada", summary: "Cruzamento de estradas." },
    { op: "create.place", name: "Moinho Velho", kind: "construção", summary: "Moinho abandonado.", links: [{ to: "$x", minutes: 30 }] },
    { op: "create.place", name: "Bosque Cinzento", kind: "floresta", summary: "Bosque de troncos pálidos.", links: [{ to: "$x", minutes: "1h" }] },
    { op: "create.npc", name: "Velha Ina", place: "Moinho Velho", summary: "moleira cega", persona: { secret: "esconde um mapa" } },
    { op: "fact", text: "O Bosque Cinzento foi plantado por druidas há três séculos.", about: "Bosque Cinzento", lore: true },
  ])
  hero(a, "Kael")

  const b = createCampaign("mundo-b", { name: "Crônica B", premise: "p", tone: "" })
  apply(b, [
    { op: "create.place", name: "Porto Salgado", kind: "cidade", summary: "Porto de pescadores.", links: [{ to: "Encruzilhada", minutes: "3h" }] },
    { op: "create.place", name: "Farol Quebrado", kind: "construção", summary: "Farol em ruínas.", links: [{ to: "Porto Salgado", minutes: 40 }] },
  ])

  it("campanha nova nasce com os POIs de todos os mundos (3 + 2 = 5)", () => {
    const c = createCampaign("mundo-c", { name: "Crônica C", premise: "p", tone: "" })
    assert.deepEqual(places(c), ["Bosque Cinzento", "Encruzilhada", "Farol Quebrado", "Moinho Velho", "Porto Salgado"])
    const links = db.all<{ n: number }>(c, "SELECT COUNT(*) AS n FROM links")[0].n
    assert.equal(links, 8) // 4 ligações bidirecionais
    assert.match(db.all<{ text: string }>(c, "SELECT text FROM facts WHERE lore = 1")[0].text, /druidas/)
    c.close()
  })

  it("o herói de um jogador vira NPC nos outros universos", () => {
    const c = openCampaign("mundo-c")
    const kael = getCharacter(c, "npc:kael")
    assert.equal(kael.kind, "npc")
    assert.match(kael.summary, /Crônica A/)
    assert.equal(kael.place_id, "place:encruzilhada")
    c.close()
    assert.equal(getCharacter(a, "pc:kael").kind, "pc") // no universo de origem continua sendo o PC
  })

  it("estado é por universo: morte em A não mata em C", () => {
    beginTurn(a, "mundo-a", "Kael enfrenta a moleira")
    apply(a, [{ op: "hp", who: "Velha Ina", damage: 10 }])
    endTurn(a, "A moleira morreu no moinho.", "")
    assert.equal(getCharacter(a, "npc:velha-ina").status, "morto")
    const c = openCampaign("mundo-c")
    assert.equal(getCharacter(c, "npc:velha-ina").status, "vivo")
    c.close()
  })

  it("novidades chegam a cada turn begin; ids nunca colidem entre universos", () => {
    beginTurn(b, "mundo-b", "explora")
    apply(b, [{ op: "create.place", name: "Encruzilhada", kind: "estrada", summary: "Outra encruzilhada, no litoral." }])
    endTurn(b, "B achou outra encruzilhada.", "")
    const out = beginTurn(a, "mundo-a", "segue viagem")
    assert.ok(out.some((l) => l.includes("Multiverso")))
    assert.deepEqual(db.all<{ id: string }>(a, "SELECT id FROM places WHERE name = 'Encruzilhada' ORDER BY id").map((p) => p.id), ["place:encruzilhada", "place:encruzilhada-2"])
    endTurn(a, "Kael seguiu viagem pela estrada.", "")
  })

  it("enriquecimento do dono propaga; alteração local de outro universo diverge e não sobrescreve", () => {
    beginTurn(a, "mundo-a", "examina o moinho")
    apply(a, [{ op: "update", id: "Moinho Velho", details: "Roda d'água quebrada, farinha velha no chão." }])
    endTurn(a, "Kael examinou o moinho.", "")
    beginTurn(b, "mundo-b", "olha o bosque")
    assert.match(db.all<{ details: string }>(b, "SELECT details FROM places WHERE id = 'place:moinho-velho'")[0].details, /Roda d'água/)
    apply(b, [{ op: "update", id: "Bosque Cinzento", summary: "Bosque em chamas." }])
    endTurn(b, "O bosque pegou fogo neste universo.", "")
    beginTurn(a, "mundo-a", "volta ao bosque")
    assert.equal(db.all<{ summary: string }>(a, "SELECT summary FROM places WHERE id = 'place:bosque-cinzento'")[0].summary, "Bosque de troncos pálidos.")
    endTurn(a, "Kael voltou ao bosque intacto.", "")
  })

  it("heróis de mesmo nome em universos diferentes viram NPCs distintos", () => {
    const e = createCampaign("mundo-e", { name: "Crônica E", premise: "p", tone: "" })
    hero(e, "Kael")
    assert.equal(getCharacter(e, "pc:kael").kind, "pc")
    assert.equal(getCharacter(e, "npc:kael").kind, "npc") // o Kael da Crônica A, como NPC
    e.close()
    const f = createCampaign("mundo-f", { name: "Crônica F", premise: "p", tone: "" })
    assert.match(getCharacter(f, "npc:kael").summary, /Crônica A/)
    assert.match(getCharacter(f, "npc:kael-2").summary, /Crônica E/)
    f.close()
  })

  it("undo de um turno não retira do atlas o que nasceu antes dele", () => {
    const g = createCampaign("mundo-g", { name: "Crônica G", premise: "p", tone: "" })
    apply(g, [{ op: "create.place", name: "Pedra Rúnica", kind: "marco", summary: "Pedra com runas antigas." }])
    beginTurn(g, "mundo-g", "olha a pedra")
    endTurn(g, "Nada aconteceu ainda.", "")
    g.close()
    undoTurn("mundo-g")
    const h = createCampaign("mundo-h", { name: "Crônica H", premise: "p", tone: "" })
    assert.ok(places(h).includes("Pedra Rúnica"))
    h.close()
  })

  it("undo retira do atlas o que o turno publicou", () => {
    beginTurn(a, "mundo-a", "descobre uma caverna")
    apply(a, [{ op: "create.place", name: "Caverna do Eco", kind: "caverna", summary: "Caverna que repete vozes.", links: [{ to: "Bosque Cinzento", minutes: 20 }] }])
    endTurn(a, "Kael achou a caverna.", "")
    a.close()
    undoTurn("mundo-a")
    const d = createCampaign("mundo-d", { name: "Crônica D", premise: "p", tone: "" })
    assert.ok(!places(d).includes("Caverna do Eco"))
    assert.equal(db.all<{ n: number }>(d, "SELECT COUNT(*) AS n FROM links WHERE from_id = 'place:caverna-do-eco' OR to_id = 'place:caverna-do-eco'")[0].n, 0)
    d.close()
  })
})
