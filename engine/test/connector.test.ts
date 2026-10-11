import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, before, describe, it } from "node:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

process.env.DNDAI_HOME = mkdtempSync(join(tmpdir(), "dndai-conector-"))
const { startConnector } = await import("../src/connector.ts")

describe("conector MCP dndai (ChatGPT, sem shell)", () => {
  const server = startConnector({ host: "127.0.0.1", port: 0, secret: "s3gredo" })
  let base = ""
  before(async () => {
    await new Promise((r) => server.listening ? r(null) : server.once("listening", r))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  after(() => server.close())

  const call = async (name: string, args: Record<string, unknown>) => {
    const c = new Client({ name: "t", version: "0" })
    await c.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp/s3gredo`)))
    try {
      const r = (await c.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] }
      return { error: !!r.isError, text: r.content.map((x) => x.text).join("") }
    } finally {
      await c.close()
    }
  }

  it("só responde na URL secreta", async () => {
    assert.equal((await fetch(`${base}/mcp`, { method: "POST" })).status, 404)
    assert.equal((await fetch(`${base}/mcp/errado`, { method: "POST" })).status, 404)
  })

  it("expõe leitura como somente leitura e ação separada", async () => {
    const c = new Client({ name: "t", version: "0" })
    await c.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp/s3gredo`)))
    const { tools } = await c.listTools()
    await c.close()
    assert.deepEqual(tools.map((t) => [t.name, t.annotations?.readOnlyHint]), [["dnd_ler", true], ["dnd_agir", false]])
  })

  it("joga um turno inteiro só pelas ferramentas", async () => {
    assert.match((await call("dnd_agir", { comando: "campaign", args: ["new", "conec", "--name", "C", "--premise", "p"] })).text, /criada/)
    const world = [{ op: "create.place", name: "Praça", kind: "praça", summary: "Praça central." }]
    assert.match((await call("dnd_agir", { campanha: "conec", comando: "apply", entrada: JSON.stringify(world) })).text, /\+ local Praça/)
    const pc = { name: "Ana", race: "Humana", class: "bardo", ac: 12, place: "Praça", abilities: { for: 8, des: 14, con: 12, int: 10, sab: 10, car: 16 } }
    assert.match((await call("dnd_agir", { campanha: "conec", comando: "pc", args: ["create"], entrada: JSON.stringify(pc) })).text, /Ana/)
    await call("dnd_agir", { campanha: "conec", comando: "turn", args: ["begin", "--action", "Ana canta"] })
    assert.match((await call("dnd_agir", { campanha: "conec", comando: "check", args: ["pc", "atuacao", "--dc", "12", "--mesa"] })).text, /Pedido de rolagem/)
    assert.match((await call("dnd_agir", { campanha: "conec", comando: "narrate", entrada: "Você sobe no banco da praça." })).text, /registrada/)
    assert.match((await call("dnd_ler", { campanha: "conec", comando: "context" })).text, /Rolagem #1 aguardando/)
  })

  it("bloqueia o que não é do jogo", async () => {
    const tries: [string, Record<string, unknown>, RegExp][] = [
      ["dnd_ler", { campanha: "conec", comando: "apply", entrada: "[]" }, /use dnd_agir/],
      ["dnd_agir", { comando: "serve" }, /não permitido/],
      ["dnd_agir", { comando: "conector" }, /não permitido/],
      ["dnd_agir", { comando: "mestre" }, /não permitido/],
      ["dnd_agir", { campanha: "conec", comando: "apply", args: ["--file", "/etc/passwd"] }, /não é permitida/],
      ["dnd_agir", { campanha: "conec", comando: "apply", args: ["--file=/etc/passwd"] }, /não é permitida/],
      ["dnd_ler", { campanha: "conec", comando: "atlas", args: ["sync"] }, /use dnd_agir/],
      ["dnd_ler", { campanha: "conec", comando: "show", args: ["-c", "outra"] }, /não é permitida/],
      ["dnd_agir", { campanha: "conec", comando: "atlas", args: ["forget", "outra"] }, /não é permitido/],
    ]
    for (const [tool, args, re] of tries) {
      const r = await call(tool, args)
      assert.ok(r.error, `${tool} ${JSON.stringify(args)} deveria falhar`)
      assert.match(r.text, re)
    }
  })
})
