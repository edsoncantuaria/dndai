// Avaliação do Mestre com o ChatGPT de verdade: roteiro fixo, campanha sandbox num DNDAI_HOME isolado,
// relatório com chamadas, erros, narração e tamanho do que foi para o LLM. Uso:
//   npm run eval:mestre [-- eval/mina.json]
// Pré-requisitos: Shellby no ar (:3333) e a porta do conector (8794, a do túnel público) livre:
//   systemctl --user stop dndai-conector   (e start de novo no fim)
import { spawn, spawnSync, type ChildProcess } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { encode } from "gpt-tokenizer/encoding/o200k_base"

interface Scenario {
  name: string
  premise: string
  tone: string
  world: unknown[]
  pc: Record<string, unknown>
  steps: ({ fala: string } | { rola: number } | { cli: string[] })[]
}

const ENGINE = resolve(import.meta.dirname, "..")
const CONECTOR_PORT = Number(process.env.DNDAI_EVAL_CONECTOR_PORT ?? 8794)
const SERVE_PORT = 8890
const MESTRE_PORT = 8891
const SHELLBY = process.env.DNDAI_SHELLBY_URL ?? "http://127.0.0.1:3333/mcp"
const STEP_TIMEOUT_MS = 10 * 60_000
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
  let audit = 0
  let narrations = 0
  let chats = 0
  for (const [i, step] of sc.steps.entries()) {
    let label = ""
    let status = "-"
    if ("fala" in step) {
      label = `fala: ${step.fala.slice(0, 50)}…`
      await api("messages", { text: step.fala })
      status = await waitMaster()
    } else if ("rola" in step) {
      const pending = ((await api("state")).pendingRolls ?? []) as { id: number; label: string }[]
      if (!pending.length) {
        rows.push(`| ${i + 1} | rola ${step.rola} | (nada pendente) | | | | |`)
        continue
      }
      label = `rola ${step.rola} (#${pending[0].id} ${pending[0].label})`
      await api(`rolls/${pending[0].id}`, { dice: [step.rola] })
      status = await waitMaster()
    } else {
      label = `dnd ${step.cli.join(" ")}`
      dnd(["-c", SLUG, ...step.cli])
      rows.push(`| ${i + 1} | ${label} | | | | | |`)
      continue
    }
    const { calls, total } = auditSince(audit)
    audit = total
    const chars = calls.reduce((n, c) => n + (Number(/^(\d+)c$/.exec(c.info)?.[1]) || 0), 0)
    const errs = calls.filter((c) => !c.ok)
    for (const e of errs) problems.push(`passo ${i + 1}: ${e.comando} → ${e.info}`)
    const w = world()
    const narr = (w.prepare("SELECT COUNT(*) AS n FROM narrations").get() as { n: number }).n
    const open = (w.prepare("SELECT value FROM meta WHERE key = 'turn_open'").get() as { value: string } | undefined)?.value === "1"
    const pend = (w.prepare("SELECT COUNT(*) AS n FROM roll_requests WHERE status = 'pendente'").get() as { n: number }).n
    w.close()
    if (open && !pend) problems.push(`passo ${i + 1}: turno ficou aberto sem rolagem pendente`)
    if (narr === narrations) problems.push(`passo ${i + 1}: nenhuma narração nova para o jogador`)
    narrations = narr
    const log = existsSync(join(runDir, "mestre.log")) ? readFileSync(join(runDir, "mestre.log"), "utf8") : ""
    const replies = [...log.matchAll(/resposta no chat \(\d+ caracteres\): "(.*)"/g)].map((m) => m[1])
    const reply = replies.length > chats ? replies.at(-1)! : ""
    chats = replies.length
    const checkmark = reply.startsWith("✓") ? "✓" : reply ? `texto (${reply.slice(0, 20)}…)` : "?"
    rows.push(`| ${i + 1} | ${label} | ${status} | ${calls.length} | ${errs.length} | ${chars} | ${checkmark} |`)
  }

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
    "## Problemas",
    ...(problems.length ? problems.map((p) => `- ${p}`) : ["- nenhum"]),
    "",
    "## Narrações",
    ...narrText.map((n) => `- **T${n.turn}:** ${n.text.replace(/\n+/g, " ")}`),
  ].join("\n")
  writeFileSync(join(runDir, "relatorio.md"), report)
  console.log(report)
  console.log(`\nRelatório e logs em ${runDir}`)
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
