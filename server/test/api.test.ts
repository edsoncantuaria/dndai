import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Server } from "node:http"
import { WebSocket } from "ws"

let home: string, http: Server, base: string, port: number
const api = async (method: string, path: string, body?: unknown) => {
  const r = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json", authorization: "Bearer segredo" }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, json: (await r.json()) as any }
}

before(async () => {
  home = mkdtempSync(join(tmpdir(), "dnd-")); process.env.DNDAI_HOME = home
  const { startApi } = await import("../src/api.ts")
  const { createMaster } = await import("../src/mestre/queue.ts")
  const { campaign } = await import("../src/store.ts")
  const { submit } = await import("../src/mestre/submit.ts")
  const transport = {
    async submit() { return "t" },
    async poll() {
      submit(campaign("aventura"), { ops: [{ op: "check", who: "pc", what: "perception", dc: 10 }] })
      submit(campaign("aventura"), { narration: "Você escuta o vento e nada além.", summary: "Brann escutou o vento.", options: ["Seguir pela estrada", "Voltar"] })
      return { status: "completed" as const, response: "✓" }
    },
  }
  http = startApi({ host: "127.0.0.1", port: 0, token: "segredo", master: createMaster(transport, { pollWaitMs: 1 }) })
  await new Promise((r) => http.once("listening", r))
  port = (http.address() as { port: number }).port
  base = `http://127.0.0.1:${port}`
})
after(() => { http.close(); rmSync(home, { recursive: true }) })

describe("API do cliente", () => {
  it("exige token", async () => {
    assert.equal((await fetch(`${base}/api/campaigns`)).status, 401)
    assert.equal((await fetch(`${base}/api/health`)).status, 200)
  })

  it("fluxo completo: campanha → criação → ação → Mestre narra → view e WebSocket", async () => {
    assert.equal((await api("POST", "/api/campaigns", { slug: "aventura", name: "Aventura", premise: "teste" })).status, 201)
    const opts = await api("GET", "/api/creation/options")
    assert.equal(opts.json.classes.length, 12); assert.equal(opts.json.species.length, 9)
    assert.equal((await api("GET", "/api/c/aventura/view")).json.creation_needed, true)
    const bad = await api("POST", "/api/c/aventura/character", { name: "X", class: "fighter" })
    assert.ok(bad.status >= 400 && bad.status < 500)
    const made = await api("POST", "/api/c/aventura/character", {
      name: "Brann", class: "fighter", species: "human", background: "soldier", method: "standard",
      scores: { str: 15, dex: 13, con: 14, int: 8, wis: 10, cha: 12 }, bonus: { plus2: "str", plus1: "con" },
      classSkills: ["acrobatics", "history"], classEquipment: 0, backgroundEquipment: 0, equipmentPicks: ["dice"],
      languages: ["dwarvish", "elvish"], speciesChoices: { skill: "perception", feat: "alert" }, mastery: ["greatsword", "flail", "javelin"],
    })
    assert.equal(made.status, 201); assert.equal(made.json.pc.class, "Fighter")

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?campaign=aventura&token=segredo`)
    const seen: number[] = []
    ws.on("message", (d) => seen.push(JSON.parse(String(d)).version))
    await new Promise((r) => ws.once("open", r))

    assert.equal((await api("POST", "/api/c/aventura/act", { text: "Escuto com atenção." })).status, 202)
    let view: any
    for (let i = 0; i < 50; i++) { view = (await api("GET", "/api/c/aventura/view")).json; if (view.journal.length && view.master.status === "ocioso") break; await new Promise((r) => setTimeout(r, 40)) }
    assert.match(view.journal.at(-1).text, /escuta o vento/)
    assert.equal(view.journal.at(-1).action, "Escuto com atenção.")
    assert.deepEqual(view.options, ["Seguir pela estrada", "Voltar"])
    assert.ok(view.rolls.some((r: any) => r.faces.length >= 1 && r.natural >= 1))
    assert.ok(seen.length >= 2, "o WebSocket deve avisar as mudanças")
    ws.close()

    assert.equal((await api("POST", "/api/c/aventura/rest", { kind: "long" })).status, 200)
    assert.equal((await api("GET", "/api/srd/spells/fireball")).json.index, "fireball")
  })
})
