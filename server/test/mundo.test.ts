import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as fc from "../src/core/factions.ts"
import * as lv from "../src/core/living.ts"
import * as mx from "../src/core/mechanics.ts"
import { pcView } from "../src/core/pc.ts"
import * as w from "../src/core/world.ts"
import { context, recall, showEntity } from "../src/mestre/context.ts"
import { openTurn, submit } from "../src/mestre/submit.ts"
import { novoPc } from "./helpers.ts"

let home: string
before(() => { home = mkdtempSync(join(tmpdir(), "dnd-")) })
after(() => rmSync(home, { recursive: true }))

/** Mundo-base: reino, guilda aliada, culto rival e uma vila com taberna. */
function mundo(slug: string) {
  const c = novoPc(slug, home, "rogue")
  const reino = fc.createFaction(c, { name: "Reino de Valdren", kind: "reino", summary: "Reino do norte", power: 8, known: true })
  const guilda = fc.createFaction(c, { name: "Guilda das Sombras", kind: "guilda", summary: "Ladrões organizados", parent: reino, power: 5, known: true, ranks: ["Aprendiz", "Ladrão", "Mestre-ladrão"], join: { min_standing: 20 } })
  const culto = fc.createFaction(c, { name: "Culto do Corvo", kind: "culto", summary: "Adora algo antigo", power: 6, secret: "Quer ressuscitar o rei", ties: [{ with: guilda, stance: -80 }] })
  const vila = w.createPlace(c, { name: "Vila de Pedra", kind: "vila", summary: "Vila de mineiros", links: [{ to: "l0", minutes: 30 }] })
  const taberna = w.createPlace(c, { name: "Taberna do Javali", kind: "taverna", summary: "Cheirando a lenha", parent: vila, links: [{ to: vila, minutes: 2 }] })
  fc.setControl(c, vila, reino)
  return { c, reino, guilda, culto, vila, taberna }
}

describe("facções e reputação", () => {
  it("reputação tem passo máximo, teto por turno e cascata pelos laços e pela hierarquia", () => {
    const { c, reino, guilda, culto } = mundo("f1")
    assert.throws(() => fc.adjustStanding(c, guilda, 30, "resgatou o chefe da guilda"), /entre -25 e \+25/)
    assert.throws(() => fc.adjustStanding(c, guilda, 10, "curto"), /motivo/)
    const l = fc.adjustStanding(c, guilda, 20, "resgatou o filho do chefe da guilda")
    assert.ok(l.some((x) => /Reino de Valdren.*\+10 \(reflexo\)/.test(x)), l.join("|")) // pai: 50%
    assert.ok(l.some((x) => /Culto do Corvo.*-8 \(reflexo\)/.test(x)), l.join("|"))     // rival -80%: -20*0.8*0.5
    assert.equal(fc.standing(c, guilda).value, 20); assert.equal(fc.standing(c, reino).value, 10); assert.equal(fc.standing(c, culto).value, -8)
    fc.adjustStanding(c, guilda, 20, "entregou o carregamento roubado ao cofre")
    assert.throws(() => fc.adjustStanding(c, guilda, 5, "mais um favor pequeno"), /muito neste turno/)
    c.close()
  })

  it("entrar: reputação mínima, missão exigida, conflito de lealdade; promoção por reputação", () => {
    const { c, guilda, culto } = mundo("f2")
    assert.throws(() => fc.join(c, guilda), /ainda não confia.*precisa de 20/)
    fc.adjustStanding(c, guilda, 22, "provou valor num assalto à caravana")
    const q = w.addQuest(c, { title: "Teste de lealdade", summary: "Roube o selo do prefeito" })
    c.commit("t", [{ op: "put", table: "factions", row: { id: guilda, join_rule: { min_standing: 20, quest: q } } }])
    assert.throws(() => fc.join(c, guilda), /exige antes cumprir a missão/)
    w.updateQuest(c, q, "concluida")
    assert.match(fc.join(c, guilda), /ingressa em Guilda das Sombras como Aprendiz/)
    assert.equal(fc.standing(c, guilda).status, "membro")
    assert.throws(() => fc.join(c, guilda), /já é membro/)
    // rival: culto tem laço -80 com a guilda
    c.commit("t", [{ op: "put", table: "standing", row: { faction_id: culto, value: 40, status: "nenhum", rank: 0, since_turn: 0 } }])
    assert.throws(() => fc.join(c, culto), /conflito de lealdade/)
    // reputação 32 ≥ 20: promove a Ladrão; Mestre-ladrão exigiria 40
    assert.match(fc.promote(c, guilda, "serviço exemplar na última missão"), /Promovido a Ladrão/)
    assert.throws(() => fc.promote(c, guilda, "outra promoção seguida demais"), /exige 40/)
    c.close()
  })

  it("traição: reputação -100, recompensa, vingança como agenda, hook, rumor, antigos companheiros e reflexos", () => {
    const { c, guilda, culto, vila } = mundo("f3")
    const mira = w.createNpc(c, { name: "Mira", summary: "Contrabandista", place: vila })
    fc.addMember(c, mira, guilda, "Ladrão")
    fc.adjustStanding(c, guilda, 25, "serviços valiosos à guilda das sombras")
    fc.join(c, guilda)
    assert.throws(() => fc.betray(c, culto, "entregou o ninho do culto"), /só trai quem recebeu confiança/)
    assert.throws(() => fc.betray(c, guilda, "curto"), /descreva a traição/)
    const out = fc.betray(c, guilda, "entregou o esconderijo à guarda real")
    assert.ok(out.some((l) => /Recompensa por sua cabeça: 500 PO/.test(l)))
    assert.equal(fc.standing(c, guilda).value, -100); assert.equal(fc.standing(c, guilda).status, "traidor")
    assert.ok(fc.standing(c, culto).value > 0) // rival da guilda comemora
    assert.ok(mx.character(c, mira).attitude <= -60)
    assert.ok(c.db.prepare("SELECT 1 FROM hooks WHERE kind = 'ameaca' AND text LIKE '%vingança%'").get())
    assert.equal(c.db.prepare("SELECT every_min m FROM clocks WHERE name LIKE 'Vingança%'").get()!.m, 2880)
    assert.throws(() => fc.join(c, guilda), /nunca aceitará um traidor/)
    // o rumor corre: na origem na hora; na vila (1 salto) só depois de 8 h
    assert.equal(lv.rumorsAt(c, "l0").length, 1)
    assert.equal(lv.rumorsAt(c, vila).length, 0)
    w.advanceTime(c, 9 * 60)
    assert.equal(lv.rumorsAt(c, vila).length, 1)
    c.close()
  })

  it("a vingança avança com o tempo, dispara e vira pendência até o Mestre resolver", () => {
    const { c, guilda } = mundo("f4")
    fc.adjustStanding(c, guilda, 25, "serviços valiosos à guilda das sombras")
    fc.join(c, guilda)
    fc.betray(c, guilda, "vendeu a localização do chefe da guilda")
    const k = c.db.prepare("SELECT id FROM clocks").get()!.id as string
    w.advanceTime(c, 24 * 60) // 1 dia = meia etapa → ainda 0
    assert.equal(c.db.prepare("SELECT filled FROM clocks WHERE id = ?").get(k)!.filled, 0)
    w.advanceTime(c, 24 * 60) // 2 dias → 1
    assert.equal(c.db.prepare("SELECT filled FROM clocks WHERE id = ?").get(k)!.filled, 1)
    for (let i = 0; i < 10; i++) w.advanceTime(c, 24 * 60)
    assert.equal(c.db.prepare("SELECT status FROM clocks WHERE id = ?").get(k)!.status, "disparado")
    assert.match(context(c, { full: true }), /DISPAROU/)
    lv.resolveClock(c, k, "assassinos atacaram a estalagem e fugiram")
    assert.doesNotMatch(context(c, { full: true }), /DISPAROU/)
    c.close()
  })

  it("crime com testemunha gera recompensa; pagar limpa e devolve um pouco de reputação", () => {
    const { c, reino } = mundo("f5")
    const l = fc.crime(c, reino, 3, true, "roubou o cofre do coletor de impostos")
    assert.ok(l.some((x) => /recompensa.*sobe para 225 PO/i.test(x)), l.join("|")) // 3² × 25 PO
    assert.equal(fc.crime(c, reino, 1, false, "pequeno furto na feira").at(-1), "Sem testemunhas: nenhuma recompensa (por enquanto).")
    assert.throws(() => fc.payBounty(c, reino), /insuficiente/) // PC começa com pouco ouro
    c.commit("t", [{ op: "put", table: "characters", row: { id: "pc", cp: 50_000 } }])
    assert.match(fc.payBounty(c, reino), /Você paga 225 PO/)
    assert.equal(c.db.prepare("SELECT amount_cp a FROM bounties").get()!.a, 0)
    c.close()
  })

  it("reino do lugar: a autoridade sobe da taberna → vila → reino", () => {
    const { c, reino, taberna, vila } = mundo("f6")
    const a = fc.authorityOf(c, taberna)
    assert.equal(a.faction?.id, reino); assert.equal(a.realm?.id, reino)
    const guilda = fc.createFaction(c, { name: "Guarda da Taberna", kind: "bando", summary: "Seguranças", parent: reino })
    fc.setControl(c, taberna, guilda)
    assert.equal(fc.authorityOf(c, taberna).faction?.id, guilda); assert.equal(fc.authorityOf(c, taberna).realm?.id, reino)
    assert.equal(fc.authorityOf(c, vila).faction?.id, reino)
    c.close()
  })
})

describe("mundo vivo: rotina, agenda e eventos", () => {
  it("NPC segue a rotina quando o tempo passa; companheiro e quem luta ficam", () => {
    const { c, vila, taberna } = mundo("v1")
    const bram = w.createNpc(c, { name: "Bram", summary: "Ferreiro", place: vila })
    const amigo = w.createNpc(c, { name: "Lia", summary: "Arqueira", place: vila, companion: true })
    lv.setSchedule(c, bram, [{ from: "08:00", to: "18:00", place: vila }, { from: "18:00", to: "02:00", place: taberna }])
    lv.setSchedule(c, amigo, [{ from: "00:00", to: "23:59", place: taberna }])
    assert.throws(() => lv.setSchedule(c, bram, [{ from: "8h", to: "18:00", place: vila }]), /horário inválido/)
    assert.throws(() => lv.setSchedule(c, bram, [{ from: "08:00", to: "18:00", place: "l99" }]), /não existe/)
    assert.equal(c.time % 1440, 480) // 08:00
    w.advanceTime(c, 11 * 60) // 19:00
    assert.equal(mx.character(c, bram).place_id, taberna)
    assert.equal(mx.character(c, amigo).place_id, vila) // companheiro não segue rotina
    w.advanceTime(c, 8 * 60) // 03:00 → sem trecho: fica onde está
    assert.equal(mx.character(c, bram).place_id, taberna)
    w.advanceTime(c, 6 * 60) // 09:00 → volta à vila
    assert.equal(mx.character(c, bram).place_id, vila)
    c.close()
  })

  it("viajar também faz o mundo seguir (o tempo da viagem dispara rotinas e eventos)", () => {
    const { c, vila } = mundo("v2")
    const ev = lv.createEvent(c, { in_minutes: 20, text: "Os sinos da vila tocam: chegou o recrutador", place: vila })
    w.move(c, "pc", vila) // 30 min
    assert.equal(c.db.prepare("SELECT status FROM events WHERE id = ?").get(ev)!.status, "vencido")
    assert.match(context(c, { full: true }), /evento #1 venceu/)
    lv.resolveEvent(c, ev, "o recrutador montou banca na praça")
    assert.doesNotMatch(context(c, { full: true }), /venceu/)
    c.close()
  })

  it("undo desfaz também o que o tempo causou", () => {
    const { c, vila } = mundo("v3")
    const bram = w.createNpc(c, { name: "Bram", summary: "Ferreiro", place: "l0" })
    lv.setSchedule(c, bram, [{ from: "00:00", to: "23:59", place: vila }])
    w.advanceTime(c, 60)
    assert.equal(mx.character(c, bram).place_id, vila)
    c.undo()
    assert.equal(mx.character(c, bram).place_id, "l0")
    c.close()
  })
})

describe("expansão do mundo", () => {
  it("lugar novo exige ligação; o contexto aponta o que falta e some quando o Mestre preenche", () => {
    const { c, vila } = mundo("x1")
    assert.throws(() => w.createPlace(c, { name: "Ilha Solta", kind: "ilha", summary: "Sem caminho" }), /ao menos uma ligação/)
    w.move(c, "pc", vila)
    const a = context(c, { full: true })
    assert.match(a, /expansao/); assert.match(a, /ainda não tem detalhes/); assert.match(a, /ninguém mora/); assert.doesNotMatch(a, /poucas saídas/)
    const dead = w.createPlace(c, { name: "Beco", kind: "beco", summary: "Sem saída", links: [{ to: vila, minutes: 1 }] })
    w.move(c, "pc", dead)
    assert.match(context(c, { full: true }), /poucas saídas/)
    w.move(c, "pc", vila)
    c.commit("t", [{ op: "put", table: "places", row: { id: vila, details: "Casas de pedra cinza e fumaça de forja" } }])
    w.createNpc(c, { name: "Bram", summary: "Ferreiro", place: vila })
    w.createPlace(c, { name: "Mina Velha", kind: "mina", summary: "Escura", links: [{ to: vila, minutes: 40 }] })
    const b = context(c, { full: true })
    assert.doesNotMatch(b, /ainda não tem detalhes|ninguém mora/)
    c.close()
  })

  it("filtro de monstros por ND e tipo ajuda a montar encontros", async () => {
    const { srdLookup } = await import("../src/mestre/context.ts")
    const { c } = mundo("x2")
    const r = srdLookup(c, "monsters", "cr<=0.25 type=beast")
    assert.match(r, /monstros\[/); assert.match(r, /beast/i)
    assert.match(srdLookup(c, "monsters", "cr>=20"), /dragon/i)
    c.close()
  })
})

describe("o Mestre usa tudo isso pelo beat", () => {
  it("cria reino, guilda, NPC membro, rotina, rumor e agenda; narra citando as facções", () => {
    const { c } = mundo("b1")
    openTurn(c, "Chego à vila.")
    const r = submit(c, { ops: [
      { op: "create.faction", as: "cabal", name: "Cabala de Ébano", kind: "ordem", summary: "Magos reclusos", power: 7, secret: "Controla o conselho", ties: [{ with: "g3", stance: -60 }] },
      { op: "create.npc", as: "ilen", name: "Ilen", summary: "Maga da cabala", place: "l1", faction: "$cabal", rank: "Adepta" },
      { op: "npc.schedule", npc: "$ilen", entries: [{ from: "06:00", to: "22:00", place: "l1" }] },
      { op: "clock.create", name: "Ritual da Cabala", owner: "$cabal", segments: 6, every_hours: 48, on_complete: "o ritual rasga o véu sobre a vila" },
      { op: "rumor", text: "Dizem que a cabala procura um herói", truth: "verdade", place: "l1" },
      { op: "faction.standing", faction: "g2", delta: 10, reason: "ajudou um membro da guilda na estrada" },
    ], narration: "Você chega e ouve falar da {g4} entre os mineiros. {n1} observa de longe.", summary: "Brann chegou à vila e soube da Cabala de Ébano." })
    assert.equal(r.closed, true); assert.match(r.narration!, /Cabala de Ébano/)
    assert.match(showEntity(c, "g4"), /🔒 Controla o conselho/)
    assert.match(showEntity(c, "n1"), /Ilen/)
    assert.ok(recall(c, "cabala").length > 0)
    assert.throws(() => submit(c, { ops: [{ op: "faction.standing", faction: "g2", delta: 30, reason: "um favor enorme" }] }))
    assert.throws(() => submit(c, { ops: [{ op: "faction.join", faction: "g99" }] }), /não existe/)
    assert.throws(() => submit(c, { narration: "Você vê a Ordem do Falcão Prateado ao longe.", summary: "Cena com ordem inventada." }), /não é uma entidade/)
    assert.equal(c.invariants().length, 0)
    void pcView
    c.close()
  })
})

describe("consequências sociais", () => {
  it("matar NPC diante de testemunhas: elas lembram e a facção da vítima perde a confiança", () => {
    const { c, guilda, vila } = mundo("s1")
    const alvo = w.createNpc(c, { name: "Dorn", summary: "Ladrão da guilda", place: vila })
    fc.addMember(c, alvo, guilda, "Ladrão")
    const povo = w.createNpc(c, { name: "Edda", summary: "Padeira", place: vila })
    mx.damage(c, alvo, 999, "slashing")
    assert.ok(fc.standing(c, guilda).value <= -10)
    const mem = c.db.prepare("SELECT text FROM memories WHERE npc_id = ?").all(povo) as { text: string }[]
    assert.ok(mem.some((m) => /matou Dorn/.test(m.text)))
    assert.ok(c.db.prepare("SELECT 1 FROM facts WHERE text LIKE '%Reputação com Guilda%'").get())
    c.close()
  })

  it("fato testemunhado entra na memória de quem estava lá; crime testemunhado também", () => {
    const { c, vila, reino } = mundo("s2")
    w.move(c, "pc", vila)
    const edda = w.createNpc(c, { name: "Edda", summary: "Padeira", place: vila })
    w.addFact(c, { text: "O herói salvou uma criança do poço", witnessed: true })
    fc.crime(c, reino, 2, true, "agrediu um guarda na praça")
    const mem = (c.db.prepare("SELECT text FROM memories WHERE npc_id = ?").all(edda) as { text: string }[]).map((m) => m.text).join("|")
    assert.match(mem, /salvou uma criança/); assert.match(mem, /crime contra Reino de Valdren/)
    c.close()
  })
})
