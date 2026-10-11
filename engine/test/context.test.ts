// Campanha longa sintética: o contexto fica dentro do orçamento e nenhum fio aberto some da vista.
import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { before, describe, it } from "node:test"

process.env.DNDAI_HOME = mkdtempSync(join(tmpdir(), "dndai-context-"))

const { createCampaign } = await import("../src/campaign.ts")
const { buildContext, resume } = await import("../src/context.ts")
const db = await import("../src/db.ts")
const { applyOps, parseOps } = await import("../src/ops.ts")
const { createPc } = await import("../src/pc.ts")
const { beginTurn, endTurn } = await import("../src/turns.ts")
const { countTokens } = await import("../src/toon.ts")

const slug = "longa"
const w = createCampaign(slug, { name: "Longa", premise: "uma campanha de cem turnos", tone: "sombrio" })
const apply = (ops: unknown) => db.transaction(w, () => applyOps(w, parseOps(ops)))
const code = (entity: string) => (w.prepare("SELECT code FROM codes WHERE entity = ?").get(entity) as { code: string }).code
const PLACES = 30

function openThreadCodes(): string[] {
  const q = (sql: string) => (w.prepare(sql).all() as { e: string }[]).map((r) => code(r.e))
  return [
    ...q("SELECT id AS e FROM quests WHERE status = 'ativa'"),
    ...q("SELECT 'hook:' || id AS e FROM hooks WHERE status = 'aberto'"),
    ...q("SELECT id AS e FROM clocks WHERE status IN ('ativo','disparado')"),
  ]
}

describe("campanha de 100 turnos", () => {
  let small = 0

  before(() => {
    apply(Array.from({ length: PLACES }, (_, i) => ({
      op: "create.place", as: `p${i}`, name: `Lugar ${i}`, kind: "ermo", summary: `Ermo número ${i}.`,
      ...(i ? { links: [{ to: `$p${i - 1}`, minutes: 30 }] } : {}),
    })))
    apply([{ op: "link", from: "Lugar 0", to: `Lugar ${PLACES - 1}`, minutes: 30 }])
    apply(Array.from({ length: 40 }, (_, i) => ({
      op: "create.npc", name: `Habitante ${i}`, place: `Lugar ${i % PLACES}`, summary: `morador ${i}`, persona: { secret: `segredo ${i}` },
    })))
    db.transaction(w, () => createPc(w, {
      name: "Kael", race: "Humano", class: "guerreiro", ac: 16, place: "Lugar 0", money: "10po",
      abilities: { for: 16, des: 12, con: 14, int: 10, sab: 12, car: 10 },
    }))
    small = countTokens(buildContext(w, slug, { cena: true }))
    for (let t = 1; t <= 100; t++) {
      beginTurn(w, slug, `segue viagem ${t}`)
      const npc = `Habitante ${t % 40}`
      const ops: unknown[] = [
        { op: "move", who: "pc", to: `Lugar ${t % PLACES}` },
        { op: "memory", npcs: [npc], text: `Kael passou no turno ${t}`, importance: (t % 3) + 1 },
        { op: "fact", text: `No turno ${t} o vento mudou de direção.` },
      ]
      if (t % 5 === 0) ops.push({ op: "create.quest", title: `Tarefa ${t}`, summary: `algo para resolver ${t}`, giver: npc, objectives: ["começar", "terminar"] })
      if (t % 3 === 0) ops.push({ op: "hook", kind: "misterio", text: `sombra vista no turno ${t}`, about: `Lugar ${t % PLACES}` })
      if (t % 10 === 0) ops.push({ op: "create.clock", name: `Ameaça ${t}`, segments: 6, on_complete: `cai a ponte ${t}` })
      if (t % 7 === 0) ops.push({ op: "hook.update", hook: t / 7, status: "resolvido" })
      apply(ops)
      endTurn(w, `Kael seguiu viagem no turno ${t} sem incidentes graves.`, `O caminho segue no turno ${t}.`)
    }
  })

  it("todo fio aberto aparece no contexto, inteiro ou pelo id", () => {
    const ctx = buildContext(w, slug, { cena: true })
    const codes = openThreadCodes()
    assert.ok(codes.length > 40, `esperava muitos fios abertos, veio ${codes.length}`)
    const missing = codes.filter((c) => !new RegExp(`(^|[\\s,])${c}\\*?([\\s,]|$)`, "m").test(ctx))
    assert.deepEqual(missing, [])
    assert.match(ctx, /dormentes: .*\w\d+\*/)
    assert.match(ctx, /esfriando: /)
    assert.match(ctx, /fatos_mais: \+\d+ mais antigos/)
    assert.doesNotMatch(ctx, /Capítulo \d+ \(turnos/, "capítulo não disputa espaço com os fatos da cena")
  })

  it("o contexto não cresce com a campanha", () => {
    const tokens = countTokens(buildContext(w, slug, { cena: true }))
    console.log(`TOKENS contexto turno0=${small} turno100=${tokens} fios=${openThreadCodes().length}`)
    assert.ok(tokens < 1200, `contexto de ${tokens} tokens`)
  })

  it("resume continua de tamanho limitado", () => {
    const r = resume(w, slug)
    console.log(`TOKENS resume turno100=${countTokens(r)}`)
    assert.match(r, /ÚLTIMA NARRAÇÃO \(T100\)/)
  })
})
