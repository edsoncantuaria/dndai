import { ApiError, type MesaApi } from "../api/client"
import type { ChatMessage, GameView, RollOutcome, RollRequest } from "../api/types"
import { fixture } from "./fixture"
import { applyItemAction, deriveItems } from "./items"

// Mock local do `dnd serve`: guarda um GameView em memória, aplica as mesmas regras de rolagem
// descritas no API.md e emite "change" como o SSE faria. Só existe para desenvolver sem o motor.

let state: GameView = structuredClone(fixture)
deriveItems(state)
let nextRollId = 100
const listeners = new Set<() => void>()

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))

function commit(mutate: (s: GameView) => void) {
  const next = structuredClone(state)
  mutate(next)
  deriveItems(next)
  next.version = state.version + 1
  state = next
  setTimeout(() => listeners.forEach((fn) => fn()), 120)
}

const D20_KINDS: RollRequest["kind"][] = ["pericia", "atributo", "resistencia", "ataque"]

/** CA que o motor manteria oculta; o mock usa um valor fixo para julgar ataques. */
const MOCK_HIDDEN_AC = 13

/**
 * Mesmas regras do motor (API.md): testes de d20 mantêm o maior/menor d20 com vantagem/desvantagem;
 * em ataques, `dice` traz o(s) d20 e depois o dano. Crítico só no d20.
 */
export function resolveRoll(req: RollRequest, dice: number[], source: RollOutcome["source"]): RollOutcome {
  const d20Count = D20_KINDS.includes(req.kind) ? (req.mode === "normal" ? 1 : 2) : 0
  const d20s = dice.slice(0, d20Count)
  const rest = dice.slice(d20Count)
  const keptD20 = d20s.length > 1 ? [req.mode === "vantagem" ? Math.max(...d20s) : Math.min(...d20s)] : d20s
  const kept = [...keptD20, ...rest]
  const total = (d20Count ? keptD20[0] : rest.reduce((a, b) => a + b, 0)) + req.modifier
  const target = req.kind === "ataque" ? MOCK_HIDDEN_AC : req.dc
  let outcome: RollOutcome["outcome"] = null
  if (d20Count) {
    if (keptD20[0] === 20) outcome = "critico"
    else if (keptD20[0] === 1) outcome = "falha_critica"
    else if (target !== null) outcome = total >= target ? "sucesso" : "falha"
  }
  return {
    id: req.id,
    label: req.label,
    whoName: req.whoName,
    dice,
    kept,
    modifier: req.modifier,
    total,
    dc: target,
    outcome,
    source,
    at: new Date().toISOString(),
  }
}

export const mockApi: MesaApi = {
  mode: "mock",
  async listCampaigns() {
    return [{ slug: state.campaign.slug, name: state.campaign.name, current: true }]
  },
  async getState() {
    await delay(150)
    return structuredClone(state)
  },
  subscribe(onChange, onStatus) {
    onStatus("conectando")
    const t = setTimeout(() => onStatus("online"), 300)
    listeners.add(onChange)
    return () => {
      clearTimeout(t)
      listeners.delete(onChange)
    }
  },
  async submitRoll(id, dice) {
    await delay(400)
    const req = state.pendingRolls.find((r) => r.id === id)
    if (!req) throw new ApiError(409, "Essa rolagem já foi resolvida.")
    const valid = dice.length === req.dice.length && dice.every((v, i) => Number.isInteger(v) && v >= 1 && v <= req.dice[i].sides)
    if (!valid) throw new ApiError(400, "Quantidade ou valores de dados inválidos.")
    const outcome = resolveRoll(req, dice, "mesa")
    commit((s) => {
      s.pendingRolls = s.pendingRolls.filter((r) => r.id !== id)
      s.lastRolls = [...s.lastRolls, outcome].slice(-10)
    })
    // Como o servidor real: avisa o Mestre sozinho (mensagem `sistema`) e ele continua a cena.
    const result = outcome.outcome ? ` — ${outcome.outcome.replace("_", " ")}` : ""
    const msgId = pushChat("sistema", `Rolagem resolvida na mesa: ${outcome.label} = ${outcome.total}${result}.`, "entregue")
    void masterReply(msgId)
    return outcome
  },
  async itemAction(action, item) {
    await delay(300)
    let result = { text: "", narration: "" }
    commit((s) => (result = applyItemAction(s, action, item))) // erro de regra lança antes de gravar
    const msgId = pushChat("sistema", `Ação na mesa: ${result.text}`, "entregue")
    void masterReply(msgId, result.narration)
    return { text: result.text }
  },
  async useResource(resource, amount) {
    await delay(300)
    if (state.pendingRolls.length) throw new ApiError(409, "Role os dados primeiro.")
    const r = state.pc?.resources.find((r) => r.id === resource)
    if (!r || !r.available || amount !== 1 || r.used >= r.max) throw new ApiError(409, "Recurso indisponível.")
    commit((s) => {
      const current = s.pc!.resources.find((r) => r.id === resource)!
      current.used += amount
      current.available = current.used < current.max
    })
    const text = `${r.name} usado. ${r.effect}`
    const msgId = pushChat("sistema", text, "entregue")
    void masterReply(msgId)
    return { text }
  },
  async postMessage(text) {
    await delay()
    if (masterOffline) throw new ApiError(503, "O Mestre está offline. Abra o ChatGPT com o conector dndai-mestre.")
    const id = pushChat("jogador", text, "fila")
    void masterReply(id)
    return { id }
  },
}

// ——— Mestre simulado: fila → pensando → narração (ou erro) ———

let masterOffline = false
let failNextReply = false

function pushChat(role: ChatMessage["role"], text: string, status: ChatMessage["status"]): number {
  const id = Math.max(0, ...state.chat.map((m) => m.id)) + 1
  commit((s) => {
    s.chat = [...s.chat, { id, role, text, status, error: "", at: new Date().toISOString() }].slice(-100)
  })
  return id
}

function setMessage(id: number, patch: Partial<ChatMessage>) {
  commit((s) => {
    s.chat = s.chat.map((m) => (m.id === id ? { ...m, ...patch } : m))
  })
}

async function masterReply(triggerId: number | null, narration?: string) {
  commit((s) => (s.master = { status: "na_fila", activity: null, error: null }))
  await delay(700)
  if (triggerId) setMessage(triggerId, { status: "aguardando" })
  commit((s) => (s.master = { status: "pensando", activity: "Consultando o mundo…", error: null }))
  await delay(1400)
  if (failNextReply) {
    failNextReply = false
    if (triggerId) setMessage(triggerId, { status: "erro", error: "Sem resposta do ChatGPT." })
    commit((s) => (s.master = { status: "erro", activity: null, error: "O ChatGPT não respondeu a tempo. Tente reenviar." }))
    return
  }
  commit((s) => (s.master = { status: "pensando", activity: "Registrando o turno na crônica…", error: null }))
  await delay(1000)
  if (triggerId) setMessage(triggerId, { status: "entregue" })
  const action = state.chat.find((m) => m.id === triggerId && m.role === "jogador")?.text
  mockControls.advanceTurn(action, narration)
}

// ——— Controles do modo mock (simulam o Mestre agindo pelo ChatGPT) ———

const SCENES: { action: string; summary: string; narration: string }[] = [
  {
    action: "Me aproximo da figura encapuzada e mostro o diário de Oswin.",
    summary: "A figura se revela: Lina, a irmã de Tomás.",
    narration:
      "Você pousa o diário sobre a mesa dela. A figura congela — e então, devagar, baixa o capuz. Cabelos cor de palha, olhos fundos de quem não dorme há dias. Tomás derruba a caneca. “Lina?” Ela olha para o irmão como quem olha para um estranho. “Eu… conheço você?”",
  },
  {
    action: "Seguro as mãos de Lina e invoco a luz da Aurora.",
    summary: "Uma lembrança volta a Lina: a mina, e uma voz lá embaixo.",
    narration:
      "Uma claridade morna escorre das suas palmas. Lina arqueja; as pupilas tremem como chamas ao vento. “A mina… havia uma voz cantando lá embaixo. Oswin desceu primeiro. Depois a névoa subiu pelos poços.” Lá fora, os sinos mudos do templo vibram uma única vez, sem que ninguém os toque.",
  },
  {
    action: "Desço ao porão pelo alçapão.",
    summary: "No porão, barris escondem um poço antigo que exala névoa.",
    narration:
      "Os degraus rangem sob o peso da cota de escamas. O porão cheira a cerveja azeda e a algo mais velho — pedra molhada, ferrugem. Atrás de uma fileira de barris, uma tampa de madeira cobre um poço estreito, e por suas frestas escorre, lenta como respiração, a névoa.",
  },
]
let sceneIndex = 0

const ROLL_TEMPLATES: Omit<RollRequest, "id" | "createdTurn">[] = [
  {
    who: "pc-aelin",
    whoName: "Aelin Corvo-de-Prata",
    kind: "pericia",
    label: "Percepção (Sab)",
    dice: [{ sides: 20 }],
    mode: "normal",
    modifier: 3,
    dc: 14,
    reason: "Algo se move entre os barris do porão.",
  },
  {
    who: "pc-aelin",
    whoName: "Aelin Corvo-de-Prata",
    kind: "resistencia",
    label: "Salvaguarda de Sabedoria",
    dice: [{ sides: 20 }, { sides: 20 }],
    mode: "vantagem",
    modifier: 5,
    dc: 13,
    reason: "A névoa tenta apagar suas lembranças — a bênção da Aurora te protege.",
  },
  {
    who: "pc-aelin",
    whoName: "Aelin Corvo-de-Prata",
    kind: "ataque",
    label: "Ataque com Maça",
    dice: [{ sides: 20 }, { sides: 20 }, { sides: 6 }],
    mode: "desvantagem",
    modifier: 4,
    dc: null,
    reason: "Golpe às cegas dentro da névoa.",
  },
  {
    who: "pc-aelin",
    whoName: "Aelin Corvo-de-Prata",
    kind: "dano",
    label: "Dano da Arma Espiritual",
    dice: [{ sides: 8 }, { sides: 6 }],
    mode: "normal",
    modifier: 3,
    dc: null,
    reason: "A maça espectral desce sobre o ghoul.",
  },
]
let rollTemplateIndex = 0

export const mockControls = {
  /** O Mestre narra a cena seguinte: fecha o turno no journal e responde no chat. */
  advanceTurn(playerAction?: string, narrationOverride?: string) {
    const scene = narrationOverride
      ? { action: playerAction ?? "", summary: narrationOverride.split(". ")[0], narration: narrationOverride }
      : SCENES[sceneIndex++ % SCENES.length]
    const narration = scene.narration
    commit((s) => {
      const [h, m] = s.clock.time.split(":").map(Number)
      const minutes = h * 60 + m + 15
      s.clock.time = `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
      s.clock.minutes += 15
      const n = s.turn.n + 1
      s.turn = { n, open: false, action: null }
      s.journal = [...s.journal, { n, day: s.clock.day, time: s.clock.time, ...scene, action: playerAction ?? scene.action }].slice(-50)
      const id = Math.max(0, ...s.chat.map((c) => c.id)) + 1
      s.chat = [...s.chat, { id, role: "mestre" as const, text: narration, status: "entregue" as const, error: "", at: new Date().toISOString() }].slice(-100)
      s.master = { status: "ocioso", activity: null, error: null }
    })
  },
  /** Simula o Mestre respondendo sem mensagem nova do jogador (passa pela fila e pelo "pensando"). */
  masterNarrates() {
    void masterReply(null)
  },
  /** Simula o Mestre aplicando loot: moedas, item novo, XP e uma descoberta. */
  giveLoot() {
    commit((s) => {
      if (!s.pc) return
      s.pc.money.po += 12
      s.pc.xp += 50
      s.pc.inventory.push({ id: `it-anel-${Date.now()}`, name: "Anel de Prata do Rato", qty: 1, kind: "tesouro", equipped: false, notes: "Gravado com a picareta da Mina Velha", props: {}, actions: [], drawn: false, effect: null })
      s.facts.push({ id: Math.max(0, ...s.facts.map((f) => f.id)) + 1, text: "O anel do rato traz o mesmo símbolo da tatuagem da figura encapuzada.", about: "Mina Velha", day: s.clock.day })
    })
  },
  toggleOffline() {
    masterOffline = !masterOffline
    return masterOffline
  },
  failNextReply() {
    failNextReply = true
  },
  requestRoll() {
    const template = ROLL_TEMPLATES[rollTemplateIndex++ % ROLL_TEMPLATES.length]
    commit((s) => s.pendingRolls.push({ ...template, id: nextRollId++, createdTurn: s.turn.n }))
  },
  toggleCombat() {
    commit((s) => {
      if (s.combat) {
        s.combat = null
        s.present = s.present.filter((n) => !n.id.startsWith("npc-ghoul"))
        return
      }
      s.present = [
        ...s.present,
        { id: "npc-ghoul-1", name: "Ghoul da Névoa", summary: "Mineiro sem memória, unhas negras.", status: "vivo", attitude: -100, attitudeLabel: "hostil", companion: false, hp: 22, maxHp: 22, portrait: null, reaction: null },
        { id: "npc-ghoul-2", name: "Ghoul Faminto", summary: "Arrasta uma picareta enferrujada.", status: "ferido", attitude: -100, attitudeLabel: "hostil", companion: false, hp: 9, maxHp: 22, portrait: null, reaction: null },
      ]
      const pc = s.pc!
      s.combat = {
        round: 2,
        order: [
          { id: "npc-ghoul-1", name: "Ghoul da Névoa", initiative: 17, hp: 22, maxHp: 22, status: "vivo", current: false, isPc: false },
          { id: pc.id, name: pc.name, initiative: 15, hp: pc.hp, maxHp: pc.maxHp, status: pc.status, current: true, isPc: true },
          { id: "npc-tomas", name: "Tomás, o Lanterneiro", initiative: 11, hp: 9, maxHp: 11, status: "vivo", current: false, isPc: false },
          { id: "npc-ghoul-2", name: "Ghoul Faminto", initiative: 6, hp: 9, maxHp: 22, status: "ferido", current: false, isPc: false },
        ],
      }
    })
  },
  nextCombatant() {
    commit((s) => {
      if (!s.combat) return
      const i = s.combat.order.findIndex((c) => c.current)
      const next = (i + 1) % s.combat.order.length
      if (next === 0) s.combat.round++
      s.combat.order.forEach((c, idx) => (c.current = idx === next))
    })
  },
  damagePc(amount: number) {
    commit((s) => {
      if (!s.pc) return
      const pc = s.pc
      let dmg = amount
      if (dmg > 0 && pc.tempHp > 0) {
        const absorbed = Math.min(pc.tempHp, dmg)
        pc.tempHp -= absorbed
        dmg -= absorbed
      }
      pc.hp = Math.max(0, Math.min(pc.maxHp, pc.hp - dmg))
      pc.status = pc.hp === 0 ? "inconsciente" : "vivo"
      pc.conditions = pc.hp === 0 ? [...new Set([...pc.conditions, "Inconsciente"])] : pc.conditions.filter((c) => c !== "Inconsciente")
      pc.death = pc.hp === 0 ? { success: 1, fail: 1 } : { success: 0, fail: 0 }
      const row = s.combat?.order.find((c) => c.isPc)
      if (row) Object.assign(row, { hp: pc.hp, status: pc.status })
    })
  },
  resolveByEngine() {
    const req = state.pendingRolls[0]
    if (!req) return
    const dice = req.dice.map((d) => 1 + Math.floor(Math.random() * d.sides))
    commit((s) => {
      s.pendingRolls = s.pendingRolls.filter((r) => r.id !== req.id)
      s.lastRolls = [...s.lastRolls, resolveRoll(req, dice, "motor")].slice(-10)
    })
  },
  reset() {
    const version = state.version
    commit((s) => Object.assign(s, structuredClone(fixture), { version }))
  },
}
