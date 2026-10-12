// Avaliação do Mestre com o ChatGPT de verdade: roteiro fixo, campanha sandbox num DNDAI_HOME isolado,
// relatório com chamadas, erros, narração e tamanho do que foi para o LLM. Uso:
//   npm run eval:mestre [-- eval/mina.json]
// Pré-requisitos: Shellby no ar (:3333) e a porta do conector (8794, a do túnel público) livre:
//   systemctl --user stop dndai-conector   (e start de novo no fim)
import { spawn, spawnSync, type ChildProcess } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { randomInt } from "node:crypto"
import { encode } from "gpt-tokenizer/encoding/o200k_base"
import { shellbyTransport } from "../src/master/shellby.ts"

interface Scenario {
  name: string
  premise: string
  tone: string
  world: unknown[]
  pc: Record<string, unknown>
  /** Instruções extras para o jogador automático. */
  player?: string
  steps: ({ fala: string } | { rola: number } | { cli: string[] } | { jogador: number })[]
}

const ENGINE = resolve(import.meta.dirname, "..")
const CONECTOR_PORT = Number(process.env.DNDAI_EVAL_CONECTOR_PORT ?? 8794)
const SERVE_PORT = 8890
const MESTRE_PORT = 8891
const SHELLBY = process.env.DNDAI_SHELLBY_URL ?? "http://127.0.0.1:3333/mcp"
const STEP_TIMEOUT_MS = 10 * 60_000
/** Espera quando o ChatGPT acusa limite de uso. */
const RATE_WAIT_MS = 10 * 60_000
/** Limite de uso do ChatGPT (não o AGENT_LIMIT_REACHED do Shellby, que não passa esperando). */
const RATE = /SUBAGENT_RATE_LIMITED|RATE_LIMIT(?!_)|rate limit|limite de uso/i
/** Falhas seguidas do Mestre (sem nenhuma chamada ao motor) antes de abortar a rodada. */
const MAX_DEAD = 3
const SLUG = "avaliacao"

const realHome = join(ENGINE, "campaigns")
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
const runDir = join(ENGINE, "eval", "runs", stamp)
const home = join(runDir, "home")

const tokens = (text: string) => encode(text).length
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function up(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok
  } catch {
    return false
  }
}

function dnd(args: string[], input?: string): string {
  const r = spawnSync(join(ENGINE, "bin", "dnd"), args, { env: { ...process.env, DNDAI_HOME: home }, input, encoding: "utf8" })
  if (r.status !== 0) throw new Error(`dnd ${args.join(" ")}: ${r.stderr || r.stdout}`)
  return r.stdout
}

const children: ChildProcess[] = []
function start(name: string, args: string[], env: Record<string, string> = {}): void {
  const log = join(runDir, `${name}.log`)
  const child = spawn(join(ENGINE, "bin", "dnd"), args, { env: { ...process.env, DNDAI_HOME: home, ...env }, stdio: ["ignore", "pipe", "pipe"] })
  const chunks: Buffer[] = []
  child.stdout?.on("data", (d) => chunks.push(d))
  child.stderr?.on("data", (d) => chunks.push(d))
  child.on("exit", () => writeFileSync(log, Buffer.concat(chunks)))
  // Grava aos poucos também, para dar para ler o log durante a execução.
  const timer = setInterval(() => writeFileSync(log, Buffer.concat(chunks)), 2000)
  child.on("exit", () => clearInterval(timer))
  children.push(child)
}

function stopAll(): void {
  for (const c of children) c.kill()
}

async function api(path: string, body?: unknown): Promise<Record<string, unknown>> {
  const r = await fetch(`http://127.0.0.1:${SERVE_PORT}/api/${path}${path.includes("?") ? "&" : "?"}campaign=${SLUG}`, body === undefined
    ? undefined
    : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status} ${await r.text()}`)
  return (await r.json()) as Record<string, unknown>
}

async function waitMaster(): Promise<string> {
  const end = Date.now() + STEP_TIMEOUT_MS
  await sleep(4000)
  while (Date.now() < end) {
    const st = (await api("state")).master as { status: string }
    if (st.status === "ocioso" || st.status === "erro") return st.status
    await sleep(4000)
  }
  return "timeout"
}

interface Call { comando: string; ok: boolean; info: string }

function auditSince(lines: number): { calls: Call[]; total: number } {
  const path = join(home, "connector-audit.log")
  const all = existsSync(path) ? readFileSync(path, "utf8").trim().split("\n").filter(Boolean) : []
  const calls = all.slice(lines).map((l) => {
    // "<iso> <hash> <comando...> ok 123c" ou "... erro <motivo>"
    const m = /^\S+ \S+ (.+?) (ok|erro)(?: (.*))?$/.exec(l)
    return { comando: m?.[1] ?? l, ok: m?.[2] === "ok", info: m?.[3] ?? "" }
  })
  return { calls, total: all.length }
}

function world(): DatabaseSync {
  return new DatabaseSync(join(home, SLUG, "world.db"), { readOnly: true })
}

function narrationIds(): number[] {
  const w = world()
  try {
    return (w.prepare("SELECT id FROM narrations ORDER BY id").all() as { id: number }[]).map((r) => r.id)
  } finally {
    w.close()
  }
}

/** Texto como o jogador o lê na mesa (sem as marcas de voz). */
function narrationsById(ids: number[]): string {
  const w = world()
  try {
    return ids.map((id) => (w.prepare("SELECT text FROM narrations WHERE id = ?").get(id) as { text: string }).text.replace(/\{[mf]\}\s?/g, "")).join("\n\n")
  } finally {
    w.close()
  }
}

function lastNarrations(k: number): string {
  const ids = narrationIds().slice(-k)
  return ids.length ? narrationsById(ids) : "(a história ainda não começou: você está no local inicial)"
}

/** Médias por bloco de 10 passos, a partir do turnos.jsonl. */
function blocks(path: string): string[] {
  if (!existsSync(path)) return []
  const all = readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as { calls: number; errors: string[]; chars: number; reply: string })
  const out: string[] = []
  for (let i = 0; i < all.length; i += 10) {
    const b = all.slice(i, i + 10)
    const avg = (f: (e: (typeof b)[0]) => number) => Math.round(b.reduce((s, e) => s + f(e), 0) / b.length)
    out.push(`| ${i + 1}–${i + b.length} | ${avg((e) => e.calls)} | ${b.reduce((s, e) => s + e.errors.length, 0)} | ${avg((e) => e.chars)} | ${b.filter((e) => e.reply !== "✓").length} |`)
  }
  return out
}

async function main(): Promise<void> {
  const scenarioPath = resolve(process.argv[2] ?? join(ENGINE, "eval", "mina.json"))
  const sc = JSON.parse(readFileSync(scenarioPath, "utf8")) as Scenario

  if (!(await up(SHELLBY.replace(/\/mcp$/, "/healthz")))) throw new Error(`Shellby fora do ar (${SHELLBY}). Suba com npm start em shellby-mcp.`)
  if (await up(`http://127.0.0.1:${CONECTOR_PORT}/healthz`)) {
    throw new Error(`Porta ${CONECTOR_PORT} ocupada pelo conector real. Pare com: systemctl --user stop dndai-conector (e start de novo no fim).`)
  }
  const secret = join(realHome, "conector-secret")
  if (!existsSync(secret)) throw new Error(`Falta ${secret}: é o segredo da URL que o ChatGPT chama.`)

  mkdirSync(home, { recursive: true, mode: 0o700 })
  copyFileSync(secret, join(home, "conector-secret"))
  writeFileSync(join(home, "conector-scope"), `${SLUG}\n`, { mode: 0o600 })
  dnd(["campaign", "new", SLUG, "--name", sc.name, "--premise", sc.premise, "--tone", sc.tone, "--sandbox"])
  dnd(["-c", SLUG, "apply"], JSON.stringify(sc.world))
  dnd(["-c", SLUG, "pc", "create"], JSON.stringify(sc.pc))

  start("conector", ["conector", "--port", String(CONECTOR_PORT)])
  start("mestre", ["mestre", "--port", String(MESTRE_PORT)])
  start("serve", ["serve", "--port", String(SERVE_PORT)], { DNDAI_MESTRE_URL: `http://127.0.0.1:${MESTRE_PORT}/mcp` })
  const health: [string, string][] = [
    ["conector", `http://127.0.0.1:${CONECTOR_PORT}/healthz`],
    ["mestre", `http://127.0.0.1:${MESTRE_PORT}/healthz`],
    ["serve", `http://127.0.0.1:${SERVE_PORT}/api/state?campaign=${SLUG}`],
  ]
  for (const [name, url] of health) {
    let ok = false
    for (let i = 0; i < 60 && !(ok = await up(url)); i++) await sleep(500)
    if (!ok) {
      const log = join(runDir, `${name}.log`)
      throw new Error(`${name} não subiu em 30 s.${existsSync(log) ? `\n${readFileSync(log, "utf8").slice(-1500)}` : ""}`)
    }
  }

  const rows: string[] = []
  const problems: string[] = []
  const growth: string[] = []
  const journal = join(runDir, "turnos.jsonl")
  let audit = 0
  let narrations = 0
  let chats = 0
  let n = 0

  /** Mede o que aconteceu desde a última medição e registra uma linha. */
  const measure = (label: string, status: string): void => {
    n++
    const { calls, total } = auditSince(audit)
    audit = total
    const chars = calls.reduce((sum, c) => sum + (Number(/^(\d+)c$/.exec(c.info)?.[1]) || 0), 0)
    const errs = calls.filter((c) => !c.ok)
    for (const e of errs) problems.push(`passo ${n}: ${e.comando} → ${e.info}`)
    const w = world()
    const narr = (w.prepare("SELECT COUNT(*) AS n FROM narrations").get() as { n: number }).n
    const open = (w.prepare("SELECT value FROM meta WHERE key = 'turn_open'").get() as { value: string } | undefined)?.value === "1"
    const pend = (w.prepare("SELECT COUNT(*) AS n FROM roll_requests WHERE status = 'pendente'").get() as { n: number }).n
    const turn = Number((w.prepare("SELECT value FROM meta WHERE key = 'turn'").get() as { value: string }).value)
    w.close()
    if (open && !pend) problems.push(`passo ${n}: turno ficou aberto sem rolagem pendente`)
    if (narr === narrations) problems.push(`passo ${n}: nenhuma narração nova para o jogador`)
    narrations = narr
    const log = existsSync(join(runDir, "mestre.log")) ? readFileSync(join(runDir, "mestre.log"), "utf8") : ""
    const replies = [...log.matchAll(/resposta no chat \(\d+ caracteres\): "(.*)"/g)].map((m) => m[1])
    const reply = replies.length > chats ? replies.at(-1)! : ""
    chats = replies.length
    const checkmark = reply.startsWith("✓") ? "✓" : reply ? `texto (${reply.slice(0, 20)}…)` : "?"
    rows.push(`| ${n} | ${label.replaceAll("|", "/")} | ${status} | ${calls.length} | ${errs.length} | ${chars} | ${checkmark} |`)
    const entry = { n, turn, label, status, calls: calls.length, errors: errs.map((e) => `${e.comando} → ${e.info}`), chars, reply: checkmark, open, pend, at: new Date().toISOString() }
    writeFileSync(journal, `${JSON.stringify(entry)}\n`, { flag: "a" })
    console.log(`[${entry.at.slice(11, 19)}] #${n} T${turn} ${status} ${calls.length} chamadas ${errs.length} erros ${chars}c · ${label.slice(0, 70)}`)
  }

  /** Manda uma fala; se o ChatGPT acusar limite de uso, espera e reenvia. */
  const say = async (text: string): Promise<string> => {
    for (let attempt = 1; ; attempt++) {
      await api("messages", { text })
      const status = await waitMaster()
      const error = String(((await api("state")).master as { error: string | null }).error ?? "")
      if (status !== "erro" || !RATE.test(error) || attempt >= 4) return status
      console.log(`  limite do ChatGPT; esperando ${RATE_WAIT_MS / 60_000} min (tentativa ${attempt})`)
      await sleep(RATE_WAIT_MS)
    }
  }

  /** Resolve as rolagens pendentes na mesa: com `fixed`, o primeiro dado; senão, aleatório. */
  const rollPending = async (fixed?: number): Promise<void> => {
    for (let guard = 0; guard < 6; guard++) {
      const pending = ((await api("state")).pendingRolls ?? []) as { id: number; label: string; dice: { sides: number }[] }[]
      if (!pending.length) return
      const r = pending[0]
      const dice = r.dice.map((d, i) => (fixed !== undefined && i === 0 ? fixed : randomInt(1, d.sides + 1)))
      await api(`rolls/${r.id}`, { dice })
      measure(`rola #${r.id} ${r.label} = ${dice.join("+")}`, await waitMaster())
      fixed = undefined
    }
  }

  const snapshotGrowth = (): void => {
    const w = world()
    const turn = Number((w.prepare("SELECT value FROM meta WHERE key = 'turn'").get() as { value: string }).value)
    const chapters = (w.prepare("SELECT COUNT(*) AS n FROM chapters").get() as { n: number }).n
    w.close()
    growth.push(`| T${turn} | ${chapters} | ${tokens(dnd(["-c", SLUG, "context", "--cena"]))} | ${tokens(dnd(["-c", SLUG, "resume"]))} |`)
  }

  let aborted = ""
  try {
  for (const step of sc.steps) {
    if ("fala" in step) {
      measure(`fala: ${step.fala.slice(0, 60)}…`, await say(step.fala))
    } else if ("rola" in step) {
      await rollPending(step.rola)
    } else if ("cli" in step) {
      dnd(["-c", SLUG, ...step.cli])
      rows.push(`| | dnd ${step.cli.join(" ")} | | | | | |`)
    } else {
      // Jogador automático: outra conversa do ChatGPT lê a narração e decide a próxima ação do PC.
      const player = shellbyTransport(SHELLBY)
      let playerScope = 0
      const ask = async (prompt: string): Promise<string> => {
        for (let attempt = 1; ; attempt++) {
          try {
            const id = await player.submit(`dndai-eval-jogador-${stamp}-${playerScope}`, "jogador", prompt)
            for (const end = Date.now() + STEP_TIMEOUT_MS; Date.now() < end;) {
              const r = await player.poll(`dndai-eval-jogador-${stamp}-${playerScope}`, id, 60_000)
              if (r.status === "completed") return (r.response ?? "").replace(/\n*\*\*Notice:\*\*[^\n]*/g, "").trim()
              if (r.status === "failed") throw new Error(r.error ?? "jogador falhou")
            }
            throw new Error("jogador demorou demais")
          } catch (error) {
            if (attempt >= 4) throw error
            const msg = (error as Error).message
            // Conversa do jogador travada no Shellby: segue numa sessão nova (perde só o histórico do jogador).
            if (/AGENT_BUSY|uncertain|AGENT_IDLE_EXPIRED|AGENT_TARGET_LOST/.test(msg)) playerScope++
            const wait = RATE.test(msg) ? RATE_WAIT_MS : 30_000
            console.log(`  jogador: ${(error as Error).message.slice(0, 120)}; nova tentativa em ${wait / 1000}s`)
            await sleep(wait)
          }
        }
      }
      let seen = narrationIds()
      let prompt = [
        `Você é o JOGADOR (não o Mestre) de um RPG de mesa em PT-BR. Seu personagem: ${String(sc.pc.name)}, ${String(sc.pc.race)} ${String(sc.pc.class)}.`,
        `Premissa: ${sc.premise}`,
        sc.player ?? "",
        "A cada mensagem eu te mostro a narração do Mestre. Responda SÓ com a próxima ação ou fala do seu personagem, em 1 a 3 frases, em 3ª pessoa como um jogador escreve (ex.: \"Kael pergunta ao guarda...\"). Nada de dados, regras ou comandos. Varie: converse, explore, viaje, investigue, negocie, lute quando fizer sentido, descanse, use itens. Persiga a missão, mas siga também os ganchos que aparecerem.",
        "",
        `Narração até agora:\n${lastNarrations(3)}`,
        "",
        `O que ${String(sc.pc.name)} faz?`,
      ].join("\n")
      let dead = 0
      for (let k = 0; k < step.jogador; k++) {
        const action = (await ask(prompt)).split("\n").filter(Boolean).join(" ").slice(0, 900)
        const before = audit
        const status = await say(action)
        measure(`jogador: ${action}`, status)
        dead = status === "erro" && audit === before ? dead + 1 : 0
        if (dead >= MAX_DEAD) {
          const error = String(((await api("state")).master as { error: string | null }).error ?? "")
          throw new Error(`Mestre falhou ${dead} vezes seguidas sem chegar ao motor: ${error.slice(0, 300)}`)
        }
        await rollPending()
        if ((k + 1) % 10 === 0) snapshotGrowth()
        const fresh = narrationIds().filter((id) => !seen.includes(id))
        seen = narrationIds()
        prompt = `Narração do Mestre:\n${fresh.length ? narrationsById(fresh) : "(o Mestre não respondeu desta vez; siga em frente ou tente outra coisa)"}\n\nO que ${String(sc.pc.name)} faz?`
      }
    }
  }
  } catch (error) {
    aborted = (error as Error).message
    problems.unshift(`RODADA ABORTADA: ${aborted}`)
  }
  if (!growth.length) snapshotGrowth()

  const w = world()
  const narrText = (w.prepare("SELECT turn, text FROM narrations ORDER BY id").all() as { turn: number; text: string }[])
  const mem = w.prepare("SELECT SUM(consolidated) AS cons, SUM(merged_into IS NOT NULL) AS arq FROM memories").get() as { cons: number; arq: number }
  w.close()
  const sizes = {
    skill: tokens(dnd(["skill"])),
    resume: tokens(dnd(["-c", SLUG, "resume"])),
    context: tokens(dnd(["-c", SLUG, "context", "--cena"])),
  }
  const pcName = String(sc.pc.name)
  for (const n of narrText) {
    if (new RegExp(`(^|[.!?]\\s+)${pcName}\\s+\\p{Ll}`, "mu").test(n.text.replace(/^[—“"].*$/gmu, ""))) problems.push(`T${n.turn}: narração em 3ª pessoa ("${pcName} …")`)
  }
  const mestreLog = existsSync(join(runDir, "mestre.log")) ? readFileSync(join(runDir, "mestre.log"), "utf8") : ""
  const report = [
    `# Avaliação do Mestre — ${sc.name}`,
    "",
    `Rodada ${stamp} · campanha sandbox em \`${home}\``,
    "",
    "| # | passo | mestre | chamadas | erros | chars p/ LLM | resposta |",
    "|---|---|---|---|---|---|---|",
    ...rows,
    "",
    `- Conversas abertas: ${(mestreLog.match(/abrindo conversa/g) ?? []).length} · memórias consolidadas: ${mem.cons ?? 0} (arquivadas ${mem.arq ?? 0})`,
    `- Tokens reais (o200k) no fim: skill ${sizes.skill} · resume ${sizes.resume} · cena ${sizes.context}`,
    "",
    "## Crescimento do contexto",
    "",
    "| turno | capítulos | cena (tokens) | resume (tokens) |",
    "|---|---|---|---|",
    ...growth,
    "",
    "## Problemas",
    ...(problems.length ? problems.map((p) => `- ${p}`) : ["- nenhum"]),
    "",
    "## Por bloco de 10 passos",
    "",
    "| passos | chamadas/passo | erros | chars p/ LLM/passo | sem ✓ |",
    "|---|---|---|---|---|",
    ...blocks(join(runDir, "turnos.jsonl")),
    "",
    `## Últimas narrações (todas em narracoes.md: ${narrText.length})`,
    ...narrText.slice(-5).map((n) => `- **T${n.turn}:** ${n.text.replace(/\n+/g, " ")}`),
  ].join("\n")
  writeFileSync(join(runDir, "narracoes.md"), narrText.map((n) => `## T${n.turn}\n\n${n.text}\n`).join("\n"))
  writeFileSync(join(runDir, "relatorio.md"), report)
  console.log(report)
  console.log(`\nRelatório e logs em ${runDir}`)
  if (aborted) throw new Error(aborted)
}

process.on("SIGINT", () => {
  stopAll()
  process.exit(130)
})

main()
  .catch((error) => {
    console.error(`ERRO: ${(error as Error).message}`)
    process.exitCode = 1
  })
  .finally(stopAll)
