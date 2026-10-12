import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { once } from "node:events"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, it } from "node:test"
import { createCampaign } from "../src/campaign.ts"
import { transaction } from "../src/db.ts"
import { requestRoll } from "../src/mechanics.ts"
import { createPc } from "../src/pc.ts"
import { startServer } from "../src/server.ts"
import { getCharacter, pcId } from "../src/world.ts"

let db: ReturnType<typeof createCampaign>
let server: ReturnType<typeof startServer>
let url: string
beforeEach(async () => {
  process.env.DNDAI_HOME = mkdtempSync(join(tmpdir(), "dndai-resource-api-"))
  db = createCampaign("recursos", { name: "Recursos", premise: "p", tone: "", sandbox: true })
  transaction(db, () => createPc(db, { name: "Kael", race: "Humano", class: "guerreiro", ac: 12, abilities: { for: 16, des: 12, con: 14, int: 10, sab: 10, car: 10 } }))
  server = startServer({ host: "127.0.0.1", port: 0, token: "teste", corsOrigins: [] })
  if (!server.listening) await once(server, "listening")
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/resources?campaign=recursos`
})
afterEach(async () => {
  db.close()
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})
const post = (body: unknown, token = "teste") => fetch(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) })

it("autentica, valida o corpo e consome apenas recursos do PC", async () => {
  assert.equal((await post({ resource: "segundo-folego" }, "errado")).status, 401)
  assert.equal((await post({ resource: "segundo-folego", amount: -1 })).status, 400)
  assert.equal((await post({ resource: "segundo-folego", amount: "1" })).status, 400)
  assert.equal((await post({ resource: "inexistente" })).status, 404)
  const response = await post({ resource: "segundo-folego", amount: 1 })
  assert.equal(response.status, 200)
  assert.match((await response.json() as { text: string }).text, /Segundo Fôlego/)
  assert.equal(getCharacter(db, pcId(db)!).sheet.resources["segundo-folego"].used, 1)
})

it("serializa dois clientes e impede gastar a mesma carga duas vezes", async () => {
  const responses = await Promise.all([post({ resource: "segundo-folego" }), post({ resource: "segundo-folego" })])
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409])
  assert.equal(getCharacter(db, pcId(db)!).sheet.resources["segundo-folego"].used, 1)
})

it("dados pendentes bloqueiam ações de recursos sem consumi-los", async () => {
  transaction(db, () => requestRoll(db, { kind: "livre", who: pcId(db)!, expr: "1d20", reason: "teste" }))
  assert.equal((await post({ resource: "segundo-folego" })).status, 409)
  assert.equal(getCharacter(db, pcId(db)!).sheet.resources["segundo-folego"].used, 0)
})
