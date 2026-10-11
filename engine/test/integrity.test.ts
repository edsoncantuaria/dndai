import assert from "node:assert/strict"
import { mkdtempSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, it } from "node:test"

process.env.DNDAI_HOME = mkdtempSync(join(tmpdir(), "dndai-integrity-"))

const { createCampaign, campaignDir, openCampaign } = await import("../src/campaign.ts")
const { buildContext, buildContextProse, recall } = await import("../src/context.ts")
const db = await import("../src/db.ts")
const { ngramEmbedder, setEmbedder } = await import("../src/embed.ts")
const { runCli } = await import("../src/cli.ts")
const { formatRollJournal } = await import("../src/journal.ts")
const { rollNow } = await import("../src/mechanics.ts")
const { applyOps, parseOps } = await import("../src/ops.ts")
const { createPc } = await import("../src/pc.ts")
const { memoriesFor } = await import("../src/scene.ts")
const { advanceTime } = await import("../src/simulation.ts")
const { beginTurn, endTurn, narrate, undoTurn } = await import("../src/turns.ts")
const { countTokens } = await import("../src/toon.ts")
const { buildView } = await import("../src/view.ts")
const { strictRefs } = await import("../src/world.ts")
const { parseReplay, replaySteps } = await import("../src/replay.ts")
const { skillText } = await import("../src/skill.ts")
const { narrationProblems } = await import("../src/narration.ts")
const { changesOf } = await import("../src/chapters.ts")

let slug = ""
let w: ReturnType<typeof openCampaign>
let n = 0

const apply = (ops: unknown) => db.transaction(w, () => applyOps(w, parseOps(ops)))

beforeEach(() => {
  process.env.DNDAI_HOME = mkdtempSync(join(tmpdir(), "dndai-integrity-"))
  setEmbedder(ngramEmbedder)
  slug = `i${++n}`
  w = createCampaign(slug, { name: "Integridade", premise: "um mundo que não inventa", tone: "seco" })
  apply([
    { op: "create.place", as: "vila", name: "Vila", kind: "vila", summary: "Uma vila." },
    { op: "create.place", as: "mina", name: "Mina", kind: "masmorra", summary: "Mina escura.", links: [{ to: "$vila", minutes: 10 }] },
    { op: "create.npc", as: "mara", name: "Mara", place: "$vila", summary: "ferreira da forja", persona: { secret: "trai a vila" } },
  ])
  db.transaction(w, () =>
    createPc(w, {
      name: "Kael", race: "Humano", class: "guerreiro", ac: 16, place: "Vila", money: "10po",
      abilities: { for: 16, des: 12, con: 14, int: 10, sab: 12, car: 10 },
    })
  )
})

describe("tetos do mestre", () => {
  it("recusa bônus, cura sem fonte, morte por status, max_hp, dinheiro e xp fora da regra", () => {
    assert.throws(() => db.transaction(w, () => rollNow(w, { kind: "pericia", who: "pc:kael", key: "percepcao", dc: 10, mode: "normal", bonus: 50, reason: "" })), /±10/)
    assert.throws(() => apply([{ op: "hp", who: "pc", heal: 5 }]), /source/)
    assert.throws(() => apply([{ op: "update", id: "pc", max_hp: 9999 }]), /levelup/)
    assert.throws(() => apply([{ op: "update", id: "Mara", status: "morto" }]), /morte só ocorre por dano/)
    assert.throws(() => apply([{ op: "money", who: "pc", amount: "100000po" }]), /teto/)
    assert.throws(() => apply([{ op: "xp", who: "pc", amount: 355000 }]), /pular nível|próximo/)
    const kill = db.transaction(w, () => rollNow(w, { kind: "ataque", who: "pc:kael", target: "npc:mara", with: null, spell: false, damage: null, mode: "normal", bonus: 0, reason: "" }, [15]))
    assert.equal(kill.outcome, "sucesso")
    assert.throws(() => db.transaction(w, () => rollNow(w, { kind: "ataque", who: "pc:kael", target: "npc:mara", with: null, spell: false, damage: null, mode: "normal", bonus: 0, reason: "" }, [15, 6])), /já está morto/)
  })

  it("a ficha inicial não aceita PV nem dinheiro absurdos", () => {
    const other = `i${++n}b`
    const db2 = createCampaign(other, { name: "B", premise: "p", tone: "" })
    assert.throws(
      () => db.transaction(db2, () => createPc(db2, { name: "Zumbi", race: "Humano", class: "guerreiro", ac: 12, hp: 999, abilities: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 } })),
      /máximo rolável/,
    )
    assert.throws(
      () => db.transaction(db2, () => createPc(db2, { name: "Rico", race: "Humano", class: "guerreiro", ac: 12, money: "999999po", abilities: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 } })),
      /Dinheiro inicial/,
    )
    db2.close()
  })

  it("fecha a preparação: a CLI não muta o turno 0 depois do PC", () => {
    assert.throws(() => runCli(["-c", slug, "apply"], JSON.stringify([{ op: "fact", text: "isso não entra" }])), /turno aberto/)
  })
})

describe("dados fora do undo", () => {
  it("a rolagem desfeita continua no diário e o terceiro undo seguido para", () => {
    beginTurn(w, slug, "Kael observa")
    db.transaction(w, () => rollNow(w, { kind: "pericia", who: "pc:kael", key: "percepcao", dc: 10, mode: "normal", bonus: 0, reason: "" }, [12]))
    endTurn(w, "Kael olhou a praça com atenção.", "")
    w.close()
    undoTurn(slug)
    assert.match(formatRollJournal(slug), /desfeita/)
    w = openCampaign(slug)
    beginTurn(w, slug, "de novo")
    w.close()
    undoTurn(slug)
    w = openCampaign(slug)
    beginTurn(w, slug, "outra")
    w.close()
    assert.throws(() => undoTurn(slug), /undos seguidos/)
  })
})

describe("mundo que não alucina", () => {
  it("rejeita narração de morto, nome novo e id inexistente; aceita a perícia", () => {
    beginTurn(w, slug, "Kael ataca")
    db.transaction(w, () => rollNow(w, { kind: "ataque", who: "pc:kael", target: "npc:mara", with: null, spell: false, damage: null, mode: "normal", bonus: 0, reason: "" }, [15]))
    assert.throws(() => narrate(w, "Mara saca a espada e ataca."), /morto/)
    assert.throws(() => narrate(w, "Você vê Borin na porta."), /Borin/)
    assert.throws(() => narrate(w, "O símbolo n99 brilha na parede."), /n99/)
    // Início de frase ou de fala é maiúsculo por ortografia; nome no meio da frase, não.
    assert.deepEqual(narrationProblems(w, "— {m} Forasteiros, hein? — resmunga Kael. — Paguem adiantado.\nChuva fina cai. Ela sussurra: “{f}Não confie nele.”"), [])
    assert.deepEqual(narrationProblems(w, "Lá fora, Zorvak espera. Silêncio."), ['"Zorvak" não é uma entidade do motor. Nomes novos só nascem via apply; cite quem já existe pelo nome que está no contexto.'])
    assert.match(narrationProblems(w, "Zorvak ergue a espada. Zorvak ri.").join(), /Zorvak/)
    narrate(w, "Parágrafo um.\n\nFaça um teste de Furtividade.")
    endTurn(w, "Kael derrubou Mara e ficou atento.", "")
  })

  it("no conector o nome solto não resolve; o id curto resolve", () => {
    assert.throws(() => strictRefs(() => apply([{ op: "move", who: "pc", to: "Mina" }])), /não é um id/)
    strictRefs(() => apply([{ op: "move", who: "pc", to: "l2" }]))
  })

  it("gancho, boato e memória trivial entram no lugar certo", () => {
    apply([
      { op: "hook", kind: "promessa", text: "Kael prometeu voltar antes do anoitecer" },
      { op: "fact", text: "o dragão é um boi", truth: "boato", source: "npc", source_ref: "n1" },
      { op: "memory", npcs: ["n1"], text: "piada sem graça na fila", importance: 1 },
    ])
    const ctx = buildContext(w, slug)
    assert.match(ctx, /prometeu/)
    assert.match(ctx, /boato|dragão é um boi/)
    const view = JSON.stringify(buildView(w, slug))
    assert.doesNotMatch(view, /dragão é um boi|trai a vila/)
    db.transaction(w, () => advanceTime(w, 2 * 1440))
    assert.equal(memoriesFor(w, "npc:mara").some((m) => m.text.includes("piada")), false)
  })

  it("facção fora de cena vira fato secreto", () => {
    apply([{ op: "create.faction", name: "O Culto", summary: "seita", goal: "abrir a mina" }])
    const out = db.transaction(w, () => advanceTime(w, 12 * 60))
    assert.ok(out.some((l) => l.includes("Fora de cena")))
    assert.match(buildContext(w, slug), /FORA DE CENA/)
    assert.doesNotMatch(JSON.stringify(buildView(w, slug)), /FORA DE CENA/)
  })

  it("busca semântica local acha o ofício e o FTS sozinho não", () => {
    apply([{ op: "fact", text: "Borin trabalha na taverna da vila" }])
    assert.match(recall(w, "estalajadeiro"), /Borin|taverna/)
    setEmbedder(null)
    assert.match(recall(w, "estalajadeiro"), /Nada encontrado/)
    setEmbedder(ngramEmbedder)
  })
})

describe("TOON", () => {
  it("a cena compacta gasta menos tokens que a prosa", () => {
    apply([
      { op: "create.npc", name: "Borin", place: "l1", summary: "taverneiro", persona: { secret: "dilui a cerveja" } },
      { op: "create.item", owner: "pc", name: "Corda", qty: 1 },
      { op: "create.quest", title: "A mina", summary: "descobrir o que brilha", giver: "n1" },
      { op: "hook", kind: "misterio", text: "luz azul na mina" },
      { op: "fact", text: "a mina foi selada há dez anos" },
      { op: "memory", npcs: ["n1"], text: "Kael salvou o irmão dela numa enchente", importance: 3 },
    ])
    const prose = buildContextProse(w, slug)
    const toon = buildContext(w, slug)
    const json = buildContext(w, slug, { json: true })
    const tp = countTokens(prose)
    const tt = countTokens(toon)
    const tj = countTokens(json)
    console.log(`TOKENS prosa=${tp} toon=${tt} json=${tj} economia=${Math.round((1 - tt / tp) * 100)}%`)
    assert.ok(tt < tp * 0.75, `TOON ${tt} deveria ser bem menor que a prosa ${tp}`)
    assert.match(toon, /trai a vila/)
    assert.match(toon, /n1|Borin/)
  })
})

describe("economia de tokens na conversa", () => {
  it("{id} na narração vira o nome do motor; voz {f} fica; id inexistente recusa", () => {
    beginTurn(w, slug, "conversa com a ferreira")
    narrate(w, "— {f} Volte amanhã — diz {n1}, na forja de {l1}.")
    const text = (w.prepare("SELECT text FROM narrations ORDER BY id DESC LIMIT 1").get() as { text: string }).text
    assert.equal(text, "— {f} Volte amanhã — diz Mara, na forja de Vila.")
    assert.throws(() => narrate(w, "{n99} aparece."), /\{n99\}, que não existe/)
  })

  it("estado do PC só reaparece quando muda", () => {
    runCli(["-c", slug, "turn", "begin", "--action", "anda pela vila"])
    const first = runCli(["-c", slug, "apply"], JSON.stringify([{ op: "memory", npcs: ["n1"], text: "Kael passou pela forja" }]))
    const same = runCli(["-c", slug, "apply"], JSON.stringify([{ op: "memory", npcs: ["n1"], text: "Kael olhou as lâminas" }]))
    const moved = runCli(["-c", slug, "apply"], JSON.stringify([{ op: "move", who: "pc", to: "l2" }]))
    assert.match(first, /Estado do PC no motor: Kael em Vila/)
    assert.match(same, /sem mudança/)
    assert.match(moved, /Kael em Mina/)
  })

  it("resume traz a cena inteira e a última narração mesmo depois do turn end", () => {
    beginTurn(w, slug, "olha a vila")
    endTurn(w, "Kael olhou a vila e não viu nada estranho.", "A vila dorme sob a chuva.")
    assert.match(buildContext(w, slug), /modo: delta/)
    const r = runCli(["-c", slug, "resume"])
    assert.match(r, /modo: cena/)
    assert.match(r, /ÚLTIMA NARRAÇÃO \(T1\)\nA vila dorme sob a chuva\./)
  })

  it("mudanças do capítulo: marcos do log e atitude líquida, sem memória nem fato comum", () => {
    beginTurn(w, slug, "ajuda na forja")
    apply([
      { op: "attitude", npc: "n1", delta: 15, reason: "ajudou na forja o dia todo" },
      { op: "attitude", npc: "n1", delta: 10, reason: "pagou bem pelo serviço" },
      { op: "memory", npcs: ["n1"], text: "Kael ajudou na forja" },
      { op: "fact", text: "a forja tem fole novo" },
      { op: "hook", kind: "promessa", text: "Mara prometeu uma lâmina" },
    ])
    assert.deepEqual(changesOf(w, 1, 1), ["+ gancho h1 (promessa): Mara prometeu uma lâmina", "~ atitude de Mara: 0 → 25"])
  })

  it("consolidação: o Mestre resume, o motor guarda as originais e mostra a relação", () => {
    beginTurn(w, slug, "passa a semana ajudando na forja")
    apply(Array.from({ length: 6 }, (_, i) => ({ op: "memory", npcs: ["n1"], text: `Kael ajudou na forja no dia ${i + 1}` })))
    assert.match(buildContext(w, slug, { cena: true }), /Consolide as memórias de Mara \(n1, 6 soltas\)/)
    const ids = (w.prepare("SELECT id FROM memories WHERE npc_id = 'npc:mara' ORDER BY id").all() as { id: number }[]).map((m) => m.id)
    assert.match(runCli(["-c", slug, "show", "n1"]), new RegExp(`#${ids[0]} \\[dia`))
    assert.throws(() => apply([{ op: "memory.consolidate", npc: "n1", ids, text: "Kael contou a Zorvak que é bom ferreiro." }]), /Zorvak/)
    apply([{ op: "memory.consolidate", npc: "n1", ids, text: "Mara confia em {pc}: ele trabalhou seis dias na forja sem pedir nada." }])
    assert.throws(() => apply([{ op: "memory.consolidate", npc: "n1", ids: ids.slice(0, 2), text: "de novo, outra vez resumindo" }]), /já foi resumida/)
    apply([{ op: "time", advance: "10d" }])
    const ctx = buildContext(w, slug, { cena: true })
    assert.match(ctx, /Mara confia em Kael: ele trabalhou seis dias/)
    assert.doesNotMatch(ctx, /Consolide as memórias/)
    const show = runCli(["-c", slug, "show", "n1"])
    assert.match(show, /RELAÇÃO \[dia \d+\] Mara confia em Kael/)
    assert.match(show, /Kael ajudou na forja no dia 1 \(resumida em #\d+\)/)
  })

  it("campanha anterior aos ids curtos ganha códigos ao abrir", () => {
    w.exec("DELETE FROM codes")
    w.close()
    w = openCampaign(slug)
    const ctx = buildContext(w, slug, { cena: true })
    assert.doesNotMatch(ctx, /npc:mara|place:vila/)
    assert.match(ctx, /\bn\d+,Mara,/)
  })

  it("skill: núcleo sem as seções sob demanda", () => {
    const full = skillText("tudo")
    const core = skillText()
    assert.doesNotMatch(core, /## Preparação/)
    assert.match(core, /## Modo mesa/)
    assert.match(core, /skill preparacao/)
    assert.match(skillText("preparacao"), /^## Preparação/)
    assert.throws(() => skillText("xyz"), /não existe/)
    console.log(`TOKENS skill tudo=${countTokens(full)} nucleo=${countTokens(core)}`)
    assert.ok(countTokens(core) < countTokens(full))
  })
})

describe("replay", () => {
  it("reexecuta um roteiro e acusa divergência", () => {
    const file = join(tmpdir(), `replay-${n}.jsonl`)
    writeFileSync(file, JSON.stringify({ argv: ["-c", slug, "context"], expect: "Integridade" }) + "\n")
    const steps = parseReplay(`${JSON.stringify({ argv: ["-c", slug, "validate"], expect: "íntegro" })}\n`)
    const result = replaySteps((argv, input) => runCli(argv, input), steps)
    assert.equal(result.ok, true)
    const bad = replaySteps((argv, input) => runCli(argv, input), parseReplay(JSON.stringify([{ argv: ["-c", slug, "validate"], expect: "DRAGÃO" }])))
    assert.equal(bad.ok, false)
    assert.match(bad.lines.join("\n"), /diverg|não contém/)
  })
})

describe("arquivos", () => {
  it("world.db fica no modo 600", () => {
    const mode = statSync(join(campaignDir(slug), "world.db")).mode & 0o777
    assert.equal(mode, 0o600)
  })
})
