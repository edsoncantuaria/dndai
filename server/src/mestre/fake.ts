// Mestre de mentira para desenvolvimento do cliente e testes ponta a ponta (DNDAI_FAKE_MESTRE=1).
// Não é IA: roda uma rolagem de Percepção e narra algo fixo, para exercitar mesa, dados e voz sem ChatGPT.
import { campaign } from "../store.ts"
import type { MasterTransport } from "./shellby.ts"
import { submit } from "./submit.ts"

export function fakeTransport(): MasterTransport {
  const pending = new Map<string, string>()
  return {
    async submit(scope, _agent, prompt) {
      const slug = /campanha ([a-z0-9-]+)\]/.exec(prompt)?.[1] ?? scope.replace(/^dndai-/, "").replace(/-\d+$/, "")
      const id = `fake-${Date.now()}`
      pending.set(id, slug)
      return id
    },
    async poll(_scope, turnId) {
      const slug = pending.get(turnId)!
      pending.delete(turnId)
      await new Promise((r) => setTimeout(r, 900))
      const c = campaign(slug)
      const r = submit(c, { ops: [{ op: "check", who: "pc", what: "perception", dc: 12 }] })
      const ok = /sucesso/.test(r.lines.join(" "))
      submit(c, {
        narration: ok
          ? "Você para e escuta. Sob o vento frio, ouve passos leves que se afastam entre as árvores.\n\n{m}— Quem está aí? — grita uma voz rouca ao longe, e logo se cala."
          : "Você aguça os ouvidos, mas o vento carrega tudo para longe. Há apenas o estalar da madeira velha.",
        summary: ok ? "Brann escutou passos e uma voz ao longe." : "Brann não percebeu nada além do vento.",
        options: ["Seguir os passos", "Chamar em voz alta", "Esperar em silêncio"],
      })
      return { status: "completed" as const, response: "✓" }
    },
  }
}
