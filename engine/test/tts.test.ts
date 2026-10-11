import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, before, describe, it } from "node:test"

process.env.DNDAI_HOME = mkdtempSync(join(tmpdir(), "dndai-tts-"))

const { createCampaign } = await import("../src/campaign.ts")
const { startServer } = await import("../src/server.ts")
const { beginTurn, narrate } = await import("../src/turns.ts")

const listen = (server: Server) =>
  new Promise<number>((ok) => server.listen(0, "127.0.0.1", () => ok((server.address() as AddressInfo).port)))

describe("GET /api/tts", () => {
  const texts: string[] = []
  // TTS falso: devolve o texto recebido como se fosse o MP3.
  const fakeTts = createServer((req, res) => {
    let body = ""
    req.on("data", (c) => (body += c))
    req.on("end", () => {
      const { text } = JSON.parse(body) as { text: string }
      texts.push(text)
      res.writeHead(200, { "content-type": "audio/mpeg" })
      res.end(`MP3:${text}`)
    })
  })
  const mesa = startServer({ host: "127.0.0.1", port: 0, corsOrigins: [] })
  let base = ""

  before(async () => {
    process.env.DNDAI_TTS_URL = `http://127.0.0.1:${await listen(fakeTts)}`
    if (!mesa.listening) await new Promise((r) => mesa.once("listening", r))
    base = `http://127.0.0.1:${(mesa.address() as AddressInfo).port}/api/tts?campaign=voz`
    const db = createCampaign("voz", { name: "Voz", premise: "p", tone: "" })
    beginTurn(db, "voz", "entra na taverna")
    narrate(db, "O taverneiro ergue os olhos.\n\n— {m} Forasteiros, hein?")
    db.close()
  })

  after(() => {
    mesa.close()
    fakeTts.close()
  })

  it("envia a narração do turno, com as marcas de voz, ao TTS e devolve o áudio", async () => {
    const r = await fetch(`${base}&key=turn-1`)
    assert.equal(r.status, 200)
    assert.equal(r.headers.get("content-type"), "audio/mpeg")
    assert.equal(await r.text(), "MP3:O taverneiro ergue os olhos.\n\n— {m} Forasteiros, hein?")
    assert.equal(texts.length, 1)
  })

  it("valida a chave e a narração", async () => {
    assert.equal((await fetch(`${base}&key=turn-x`)).status, 400)
    assert.equal((await fetch(`${base}&key=turn-99`)).status, 404)
    assert.equal((await fetch(`${base}&key=chat-1`)).status, 404)
  })

  it("responde 503 com o TTS desligado", async () => {
    process.env.DNDAI_TTS_URL = "http://127.0.0.1:9"
    const r = await fetch(`${base}&key=turn-1`)
    assert.equal(r.status, 503)
    assert.match(((await r.json()) as { error: string }).error, /Voz indisponível/)
  })
})
