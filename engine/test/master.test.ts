import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, before, describe, it } from "node:test"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { z } from "zod"

process.env.DNDAI_HOME = mkdtempSync(join(tmpdir(), "dndai-master-"))

const { createCampaign } = await import("../src/campaign.ts")
const { chatView, enqueue, createMaster } = await import("../src/master/queue.ts")
const { firstTurn, shellbyTransport } = await import("../src/master/shellby.ts")
const { startMasterServer } = await import("../src/master/mcp.ts")
const { startServer } = await import("../src/server.ts")
const { openCampaign } = await import("../src/campaign.ts")
const { beginTurn, endTurn, narrate } = await import("../src/turns.ts")

/** Shellby falso: exige start_here por escopo e responde ecoando o prompt. */
function fakeShellby() {
  const initialized = new Set<string>()
  const turns = new Map<string, { prompt: string; scope: string; agent: string; polls: number }>()
  const prompts: { scope: string; agent: string; prompt: string }[] = []
  let n = 0
  const server = createServer(async (req, res) => {
    const scope = String(req.headers["x-openai-session"] ?? "")
    const mcp = new McpServer({ name: "fake-shellby", version: "0" })
    const gate = () => (!initialized.has(scope) ? { isError: true, content: [{ type: "text" as const, text: "Shellby has not been initialized for this conversation. Call `start_here` first" }] } : undefined)
    mcp.registerTool("start_here", { inputSchema: { mode: z.string(), task_id: z.string() } }, async () => {
      initialized.add(scope)
      return { content: [{ type: "text", text: "ok" }] }
    })
    mcp.registerTool("subagent_run", { inputSchema: { agents: z.array(z.object({ agent_id: z.string(), prompt: z.string(), memory: z.boolean() })) } }, async ({ agents }) => {
      const blocked = gate()
      if (blocked) return blocked
      const id = `turn-${++n}`
      turns.set(id, { prompt: agents[0].prompt, scope, agent: agents[0].agent_id, polls: 0 })
      prompts.push({ scope, agent: agents[0].agent_id, prompt: agents[0].prompt })
      return { structuredContent: { turns: [{ agent_id: agents[0].agent_id, turn_id: id, status: "running" }] }, content: [] }
    })
    mcp.registerTool("subagent_result", { inputSchema: { turn_ids: z.array(z.string()), wait_ms: z.number() } }, async ({ turn_ids }) => {
      const blocked = gate()
      if (blocked) return blocked
      const t = turns.get(turn_ids[0])!
      t.polls++
      const done = t.polls >= 2
      const response = `Narração para: ${t.prompt.match(/Jogador: «(.*)»/)?.[1] ?? "aviso da mesa"}`
      return { structuredContent: { turns: [{ turn_id: turn_ids[0], status: done ? "completed" : "running", activity: "Using tools", ...(done ? { response } : {}) }] }, content: [] }
    })
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on("close", () => void transport.close())
    await mcp.connect(transport)
    await transport.handleRequest(req, res)
  })
  return { server, prompts }
}

const listen = (s: Server) => new Promise<number>((ok) => s.listen(0, "127.0.0.1", () => ok((s.address() as AddressInfo).port)))
const waitFor = async (fn: () => boolean, ms = 8000) => {
  const end = Date.now() + ms
  while (!fn()) {
    if (Date.now() > end) throw new Error("timeout")
    await new Promise((r) => setTimeout(r, 50))
  }
}

describe("formato compacto do Shellby", () => {
  const t = (text: string) => firstTurn({ content: [{ type: "text", text }] })
  it("lê subagent_run", () => {
    assert.deepEqual(t("turns:\n\n- agent_id=mestre-1 turn_id=mestre-1_turn_1 status=running"), { agent_id: "mestre-1", turn_id: "mestre-1_turn_1", status: "running" })
  })
  it("lê subagent_result em andamento, concluído e com falha", () => {
    assert.deepEqual(t('---- turn_id=x status=running activity="Using tools" activity_age_ms=120 ----'), { turn_id: "x", status: "running", activity: "Using tools", activity_age_ms: "120" })
    assert.equal(t("---- turn_id=x status=completed ----\n\nA chuva bate na janela.\n\nBrom resmunga.")?.response, "A chuva bate na janela.\n\nBrom resmunga.")
    assert.equal(t("---- turn_id=x status=failed ----\n\nAGENT_BUSY: ocupado")?.error, "AGENT_BUSY: ocupado")
  })
})

describe("ponte mesa → Mestre (Shellby falso)", () => {
  const fake = fakeShellby()
  let mesaPort = 0
  const servers: Server[] = []

  before(async () => {
    const shellbyPort = await listen(fake.server)
    servers.push(fake.server)
    const mestre = startMasterServer({ host: "127.0.0.1", port: 0, transport: shellbyTransport(`http://127.0.0.1:${shellbyPort}/mcp`) })
    await new Promise((r) => mestre.once("listening", r))
    servers.push(mestre)
    process.env.DNDAI_MESTRE_URL = `http://127.0.0.1:${(mestre.address() as AddressInfo).port}/mcp`
    const mesa = startServer({ host: "127.0.0.1", port: 0, corsOrigins: [] })
    await new Promise((r) => mesa.once("listening", r))
    servers.push(mesa)
    mesaPort = (mesa.address() as AddressInfo).port
    createCampaign("ponte", { name: "Ponte", premise: "p", tone: "" }).close()
  })

  after(() => servers.forEach((s) => s.close()))

  it("mensagem da mesa chega ao ChatGPT com bootstrap e a narração volta para a mesa", async () => {
    const r = await fetch(`http://127.0.0.1:${mesaPort}/api/messages?campaign=ponte`, { method: "POST", body: JSON.stringify({ text: "Abro a porta da taverna" }) })
    assert.equal(r.status, 202)
    await waitFor(() => chatView("ponte").messages.some((m) => m.role === "mestre"))
    const state = (await (await fetch(`http://127.0.0.1:${mesaPort}/api/state?campaign=ponte`)).json()) as { chat: { role: string; text: string }[]; master: { status: string } }
    assert.deepEqual(state.chat.map((m) => m.role), ["jogador", "mestre"])
    assert.equal(state.chat[1].text, "Narração para: Abro a porta da taverna")
    assert.equal(state.master.status, "ocioso")
    // Configuração e primeira mensagem vão juntas: um turno no ChatGPT, sem "PRONTO".
    assert.equal(fake.prompts.length, 1)
    assert.match(fake.prompts[0].prompt, /dnd_ler comando "skill"[\s\S]*Jogador: «Abro a porta da taverna»/)
    assert.equal(fake.prompts[0].scope, "dndai-ponte")
    assert.match(fake.prompts[0].prompt, /campanha "ponte"/)
  })

  it("mensagens enfileiradas durante uma resposta vão juntas no próximo turno", async () => {
    const before = fake.prompts.length
    enqueue("ponte", "jogador", "Peço uma cerveja")
    enqueue("ponte", "sistema", "Rolagem #1 resolvida na mesa")
    await fetch(`http://127.0.0.1:${mesaPort}/api/messages?campaign=ponte`, { method: "POST", body: JSON.stringify({ text: "E olho em volta" }) })
    await waitFor(() => chatView("ponte").messages.filter((m) => m.role === "mestre").length === 2)
    assert.equal(fake.prompts.length, before + 1)
    assert.match(fake.prompts.at(-1)!.prompt, /Peço uma cerveja[\s\S]*Mesa: Rolagem #1[\s\S]*E olho em volta/)
  })

  it("a mesa recebe a narração gravada no motor (formatação exata), não o texto lido da página", async () => {
    createCampaign("narr", { name: "N", premise: "p", tone: "" }).close()
    let lastPrompt = ""
    const transport = {
      submit: async (_scope: string, _agent: string, prompt: string) => {
        lastPrompt = prompt
        return "t"
      },
      poll: async () => {
        const db = openCampaign("narr")
        if (db.prepare("SELECT value FROM meta WHERE key = 'turn_open'").get()?.value !== "1") beginTurn(db, "narr", "ouve a conversa")
        narrate(db, "Parágrafo um.\n\nFaça um teste de Furtividade.")
        db.close()
        return { status: "completed" as const, response: "Parágrafo um.Faça um teste de Furtividade.\n\n**Notice:** agent_finished" }
      },
    }
    const m = createMaster(transport, { log: () => undefined })
    enqueue("narr", "jogador", "ouço")
    await m.drain("narr")
    const last = chatView("narr").messages.at(-1)!
    assert.equal(last.role, "mestre")
    assert.equal(last.text, "Parágrafo um.\n\nFaça um teste de Furtividade.")
  })

  it("resposta ✓ sem narração gravada vira erro visível, não um ✓ na mesa", async () => {
    createCampaign("seco", { name: "S", premise: "p", tone: "" }).close()
    let lastPrompt = ""
    const m = createMaster({
      submit: async (_s: string, _a: string, prompt: string) => {
        lastPrompt = prompt
        return "t"
      },
      poll: async () => ({ status: "completed" as const, response: "✓" }),
    }, { log: () => undefined })
    enqueue("seco", "jogador", "oi")
    await m.drain("seco")
    assert.match(lastPrompt, /só ✓/)
    const v = chatView("seco")
    assert.equal(v.master.status, "erro")
    assert.match(v.master.error ?? "", /sem gravar a narração/)
    assert.ok(!v.messages.some((x) => x.role === "mestre"))
  })

  it("capítulo fechado abre conversa nova do Mestre na próxima mensagem", async () => {
    createCampaign("cap", { name: "C", premise: "p", tone: "" }).close()
    const sent: { agent: string; prompt: string }[] = []
    const m = createMaster({
      submit: async (_s: string, agent: string, prompt: string) => {
        sent.push({ agent, prompt })
        return `t${sent.length}`
      },
      poll: async () => {
        const last = sent.at(-1)!
        const db = openCampaign("cap")
        beginTurn(db, "cap", "segue")
        endTurn(db, "Kael seguiu pela estrada sem incidentes.", "A estrada segue.")
        if (sent.length === 2) {
          db.prepare("INSERT INTO chapters(n, from_turn, to_turn, summary) VALUES(1, 1, 2, 'c1')").run()
        }
        db.close()
        return { status: "completed" as const, response: "✓" }
      },
    }, { log: () => undefined })
    for (const text of ["um", "dois", "três"]) {
      enqueue("cap", "jogador", text)
      await m.drain("cap")
    }
    assert.deepEqual(sent.map((x) => (x.prompt.includes("configuração") ? `boot:${x.agent}` : x.agent)), ["boot:mestre-1", "mestre-1", "boot:mestre-2"])
    assert.equal(chatView("cap").messages.filter((x) => x.role === "mestre").at(-1)!.text, "A estrada segue.")
  })

  it("com o turno aberto, a mensagem seguinte já leva a cena (sem context extra)", async () => {
    createCampaign("aberto", { name: "A", premise: "p", tone: "" }).close()
    const sent: string[] = []
    const m = createMaster({
      submit: async (_s: string, _a: string, prompt: string) => {
        sent.push(prompt)
        return `t${sent.length}`
      },
      poll: async () => {
        const db = openCampaign("aberto")
        if (sent.length === 1) beginTurn(db, "aberto", "observa")
        narrate(db, `Narração ${sent.length}.`)
        db.close()
        return { status: "completed" as const, response: "✓" }
      },
    }, { log: () => undefined })
    enqueue("aberto", "jogador", "observo")
    await m.drain("aberto")
    enqueue("aberto", "sistema", "Rolagem #1 resolvida na mesa")
    await m.drain("aberto")
    assert.doesNotMatch(sent[0], /Cena atual/)
    assert.match(sent[1], /Cena atual \(o mesmo que dnd_ler context[\s\S]*campanha: aberto[\s\S]*aberto: true/)
    assert.doesNotMatch(sent[1], /configuração/)
  })

  it("conversa nova esquece a linha de estado do PC já mostrada", async () => {
    createCampaign("estado", { name: "E", premise: "p", tone: "" }).close()
    const db = openCampaign("estado")
    db.prepare("INSERT INTO meta(key, value) VALUES('pc_state_shown', 'linha velha')").run()
    db.close()
    const m = createMaster({ submit: async () => "t", poll: async () => ({ status: "completed" as const, response: "Texto." }) }, { log: () => undefined })
    enqueue("estado", "jogador", "oi")
    await m.drain("estado")
    const after = openCampaign("estado")
    assert.equal(after.prepare("SELECT value FROM meta WHERE key = 'pc_state_shown'").get(), undefined)
    after.close()
  })

  it("erro do Mestre fica visível e não trava a fila", async () => {
    const failing = createMaster({ submit: async () => { throw new Error("SUBAGENT_RATE_LIMITED: limite") }, poll: async () => ({ status: "running" as const }) }, { log: () => undefined })
    createCampaign("falha", { name: "F", premise: "p", tone: "" }).close()
    enqueue("falha", "jogador", "oi")
    await failing.drain("falha")
    const v = chatView("falha")
    assert.equal(v.master.status, "erro")
    assert.match(v.master.error ?? "", /RATE_LIMITED/)
  })

  it("reenvia sozinho quando o Shellby cai de rede", async () => {
    let n = 0
    const flaky = createMaster({
      submit: async () => {
        n++
        if (n === 1) throw new Error("fetch failed")
        return "turno-1"
      },
      poll: async () => ({ status: "completed" as const, response: "voltei" }),
    }, { log: () => undefined, retryBaseMs: 15, maxSendAttempts: 3 })
    createCampaign("retry", { name: "R", premise: "p", tone: "" }).close()
    enqueue("retry", "jogador", "oi")
    await flaky.drain("retry")
    await new Promise((r) => setTimeout(r, 250))
    const v = chatView("retry")
    assert.notEqual(v.master.status, "erro")
    assert.match(v.messages.map((m) => m.text).join("\n"), /voltei/)
  })
})
