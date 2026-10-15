import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Server } from "node:http"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

let home: string, http: Server, port: number, secretA: string
const call = async (secret: string, name: string, args: Record<string, unknown>) => {
  const client = new Client({ name: "t", version: "1" })
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp/${secret}`)))
  try {
    const r = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] }
    return { error: !!r.isError, text: r.content.map((c) => c.text).join("") }
  } finally { await client.close() }
}

before(async () => {
  home = mkdtempSync(join(tmpdir(), "dnd-")); process.env.DNDAI_HOME = home
  const { createCampaign } = await import("../src/store.ts")
  const { createCharacter } = await import("../src/core/pc.ts")
  const { campaignSecret } = await import("../src/mestre/secrets.ts")
  const { startConnector } = await import("../src/mestre/connector.ts")
  for (const slug of ["alfa", "beta"]) {
    const c = createCampaign(slug, { name: slug.toUpperCase(), premise: "p" })
    createCharacter(c, {
      name: "Brann", class: "fighter", species: "human", background: "soldier", method: "standard",
      scores: { str: 15, dex: 13, con: 14, int: 8, wis: 10, cha: 12 }, bonus: { plus2: "str", plus1: "con" },
      classSkills: ["acrobatics", "history"], classEquipment: 0, backgroundEquipment: 0, equipmentPicks: ["dice"],
      languages: ["dwarvish", "elvish"], speciesChoices: { skill: "perception", feat: "alert" }, mastery: ["greatsword", "flail", "javelin"],
    })
  }
  secretA = campaignSecret("alfa"); campaignSecret("beta")
  http = startConnector({ host: "127.0.0.1", port: 0 })
  await new Promise((r) => http.once("listening", r))
  port = (http.address() as { port: number }).port
})
after(() => { http.close(); rmSync(home, { recursive: true }) })

describe("conector MCP", () => {
  it("lê e age só na própria campanha", async () => {
    assert.match((await call(secretA, "dnd_ler", { o: "skill" })).text, /Mestre dndai/)
    const ctx = await call(secretA, "dnd_ler", { o: "contexto" })
    assert.match(ctx.text, /ALFA/)
    const beat = await call(secretA, "dnd_agir", { beat: { ops: [{ op: "check", who: "pc", what: "perception", dc: 5 }] } })
    assert.equal(beat.error, false, beat.text)
    assert.match(beat.text, /Percepção|Perception|perception/i)
    const closed = await call(secretA, "dnd_agir", { beat: { narration: "Você olha em volta, atento.", summary: "Brann olhou em volta." } })
    assert.match(closed.text, /fechado/)
    assert.match((await call(secretA, "dnd_ler", { o: "srd", q: "monsters goblin-warrior" })).text, /Goblin Warrior/)
  })

  it("recusa outra campanha, segredo errado e beat inválido", async () => {
    const other = await call(secretA, "dnd_ler", { campanha: "beta", o: "contexto" })
    assert.equal(other.error, true); assert.match(other.text, /fora do escopo/i)
    await assert.rejects(call("segredo-errado", "dnd_ler", { o: "skill" }))
    const bad = await call(secretA, "dnd_agir", { beat: { ops: [{ op: "rm -rf" }] } })
    assert.equal(bad.error, true)
    const nope = await call(secretA, "dnd_agir", { beat: { ops: [{ op: "spawn", srd: "balrog", place: "l0" }] } })
    assert.match(nope.text, /não invente/)
  })
})
