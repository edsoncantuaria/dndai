import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

let home: string
before(() => { home = mkdtempSync(join(tmpdir(), "dnd-")); process.env.DNDAI_HOME = home })
after(() => rmSync(home, { recursive: true }))

describe("fila do Mestre (Shellby falso)", () => {
  it("entrega a mensagem, o Mestre grava a narração e a mesa a recebe", async () => {
    const { createCampaign, campaign } = await import("../src/store.ts")
    const { createCharacter } = await import("../src/core/pc.ts")
    const { openTurn, submit } = await import("../src/mestre/submit.ts")
    const { createMaster } = await import("../src/mestre/queue.ts")
    const q = await import("../src/mestre/queue.ts")

    const c = createCampaign("fila", { name: "Fila", premise: "teste" })
    createCharacter(c, {
      name: "Brann", class: "fighter", species: "human", background: "soldier", method: "standard",
      scores: { str: 15, dex: 13, con: 14, int: 8, wis: 10, cha: 12 }, bonus: { plus2: "str", plus1: "con" },
      classSkills: ["acrobatics", "history"], classEquipment: 0, backgroundEquipment: 0, equipmentPicks: ["dice"],
      languages: ["dwarvish", "elvish"], speciesChoices: { skill: "perception", feat: "alert" }, mastery: ["greatsword", "flail", "javelin"],
    })
    const prompts: string[] = []
    const transport = {
      async submit(_s: string, _a: string, prompt: string) { prompts.push(prompt); return "t1" },
      async poll() {
        submit(campaign("fila"), { narration: "Você respira fundo e o vento frio sopra na estrada.", summary: "Brann respirou fundo na estrada." })
        return { status: "completed" as const, response: "✓" }
      },
    }
    const master = createMaster(transport, { pollWaitMs: 1 })
    openTurn(c, "respiro fundo")
    q.enqueue("fila", "jogador", "respiro fundo")
    await master.drain("fila")
    const view = q.chatView("fila")
    assert.equal(view.master.status, "ocioso")
    assert.match(view.messages.at(-1)!.text, /vento frio/)
    assert.match(prompts[0]!, /Memória da campanha/)
    assert.match(prompts[0]!, /Jogador: «respiro fundo»/)
    assert.match(prompts[0]!, /dnd_ler \{o:"skill"\}/)
  })
})
