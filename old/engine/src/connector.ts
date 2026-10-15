// Conector MCP "dndai" para o ChatGPT (Developer Mode): dá ao Mestre SÓ as ferramentas do jogo, sem shell.
// Duas ferramentas sobre a mesma CLI `dnd`: `dnd_ler` (somente leitura, sem pedido de aprovação) e
// `dnd_agir` (muda o jogo, por lista fechada de comandos). Nada aqui executa processos ou lê arquivos.
import { createServer } from "node:http"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { z } from "zod"
import { campaignsHome, listCampaigns } from "./campaign.ts"
import { runCli } from "./cli.ts"
import { addSlugToScope, assertInScope, auditCall, campaignOfSecret, resolveScope, secretsEqual } from "./scope.ts"
import { strictRefs } from "./world.ts"

const READ = new Set(["skill", "context", "resume", "show", "recall", "rolls", "log", "validate", "srd", "help", "atlas", "chapter", "fact"])
const WRITE = new Set([
  "campaign", "pc", "turn", "narrate", "undo", "apply", "time", "check", "save", "attack", "damage", "roll", "deathsave",
  "item", "rest", "levelup", "resource", "feature", "combat", "atlas", "chapter",
])

/** Flags permitidas por comando. O que não está aqui é recusado (allowlist, não denylist). */
const ALLOW: Record<string, Set<string>> = {
  campaign: new Set(["name", "premise", "tone"]),
  turn: new Set(["action", "summary", "narration"]),
  check: new Set(["dc", "adv", "dis", "bonus", "reason", "mesa"]),
  save: new Set(["dc", "adv", "dis", "bonus", "reason", "mesa"]),
  attack: new Set(["with", "spell", "damage", "adv", "dis", "bonus", "reason", "mesa"]),
  damage: new Set(["by", "reason", "mesa"]),
  roll: new Set(["by", "reason", "mesa"]),
  deathsave: new Set(["reason", "mesa"]),
  rest: new Set(["dice"]),
  levelup: new Set(["roll", "subclass", "asi", "feat", "choices"]),
  resource: new Set(["amount", "target"]),
  narrate: new Set(["text"]),
  context: new Set(["full", "json", "cena"]),
  resume: new Set(["page", "limit", "chapter"]),
  recall: new Set(["limit"]),
}

/** Ops do apply que o modelo às vezes chama como se fossem comandos (ex.: "move"). */
const APPLY_OPS = new Set(["move", "link", "update", "hp", "condition", "money", "attitude", "memory", "fact", "hook", "reveal", "xp"])

const hits = new Map<string, number[]>()

function rateOk(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}

function checkFlags(comando: string, args: string[]): void {
  const allow = ALLOW[comando] ?? new Set<string>()
  for (const arg of args) {
    if (arg === "-") continue
    const denied = arg === "-c" || arg === "--c" || arg.startsWith("--c=") || arg.startsWith("--")
    if (!denied) continue
    const name = arg.startsWith("--") ? arg.slice(2).split("=")[0] : arg
    if (arg.startsWith("--") && allow.has(name)) continue
    const shown = arg.includes("=") ? arg.slice(0, arg.indexOf("=")) : arg
    throw new Error(`Opção "${shown}" não é permitida pelo conector (use o campo "entrada" para JSON/narração e "campanha" para a campanha).`)
  }
}

function validate(kind: "ler" | "agir", comando: string, args: string[]): void {
  const allowed = kind === "ler" ? READ : WRITE
  if (!allowed.has(comando) && APPLY_OPS.has(comando)) {
    throw new Error(`"${comando}" é operação do apply, não comando: use dnd_agir comando "apply" com entrada [{"op":"${comando}", ...}].`)
  }
  if (!allowed.has(comando)) {
    const hint = kind === "ler" && WRITE.has(comando) ? " (esse comando muda o jogo: use dnd_agir)" : kind === "agir" && READ.has(comando) ? " (é leitura: use dnd_ler)" : ""
    throw new Error(`Comando "${comando}" não permitido em dnd_${kind}${hint}. Permitidos: ${[...allowed].join(", ")}.`)
  }
  if (kind === "ler" && comando === "atlas" && args[0] === "sync") throw new Error('"atlas sync" muda o jogo: use dnd_agir.')
  if (kind === "ler" && comando === "chapter" && args[0] === "close") throw new Error('"chapter close" muda o jogo: use dnd_agir.')
  if (comando === "atlas" && args.length && args[0] !== "sync") throw new Error(`"atlas ${args[0]}" não é permitido pelo conector.`)
  if (kind === "ler" && comando === "campaign") throw new Error("Use dnd_agir para campanhas.")
  checkFlags(comando, args)
}

function execute(secret: string, kind: "ler" | "agir", campanha: string | undefined, raw: string, rawArgs: string[], entrada: string | undefined) {
  // O modelo às vezes manda "turn begin" no campo comando: vale o mesmo que comando "turn" + args ["begin", ...].
  const [comando, ...lead] = raw.trim().split(/\s+/)
  const args = [...lead, ...rawArgs]
  if (!rateOk(`tool:${secret.slice(0, 8)}`, 120, 60_000)) {
    return { isError: true, content: [{ type: "text" as const, text: "ERRO: limite de chamadas do conector. Espere um instante." }] }
  }
  let ok = false
  let failure = ""
  let chars = 0
  try {
    validate(kind, comando, args)
    const legacyFile = join(campaignsHome(), "conector-secret")
    const legacy = [secret]
    if (existsSync(legacyFile)) {
      const disk = readFileSync(legacyFile, "utf8").trim()
      if (!legacy.some((s) => secretsEqual(s, disk))) legacy.push(disk)
    }
    const owned = campaignOfSecret(secret)
    const scope = owned
      ? { kind: "campaign" as const, owner: owned, slugs: [owned], canCreate: false, ambiguous: false }
      : resolveScope(secret, legacy)
    if (comando === "campaign" && args[0] === "new" && !scope.canCreate) {
      throw new Error("Este conector é de uma campanha só e não cria outras.")
    }
    const slug = assertInScope(scope, campanha, comando, args[0])
    if (comando === "campaign" && args[0] === "list") {
      const list = listCampaigns().filter((c) => scope.slugs.includes(c.slug))
      ok = true
      return { content: [{ type: "text" as const, text: list.length ? list.map((c) => `${c.slug} — ${c.name}`).join("\n") : "Nenhuma campanha." }] }
    }
    const argv = slug ? ["-c", slug, comando, ...args] : [comando, ...args]
    const out = strictRefs(() => runCli(argv, entrada))
    if (comando === "campaign" && args[0] === "new" && args[1]) addSlugToScope(args[1])
    ok = true
    chars = (out || "ok").length
    return { content: [{ type: "text" as const, text: out || "ok" }] }
  } catch (error) {
    const message = (error as Error).message.replace(/Existentes:.*$/, "Fora do escopo deste conector.")
    failure = message
    return { isError: true, content: [{ type: "text" as const, text: `ERRO: ${message}` }] }
  } finally {
    auditCall(secret, `${comando}${args[0] && !args[0].startsWith("-") ? ` ${args[0]}` : ""}`, ok, failure, chars)
  }
}

const shape = {
  campanha: z.string().min(1).optional().describe("slug da campanha no escopo deste conector (obrigatório se houver mais de uma)"),
  comando: z.string().min(1).describe("subcomando do motor, ex.: context, apply, check, turn"),
  args: z.array(z.string()).default([]).describe('argumentos como na CLI, ex.: ["pc","percepcao","--dc","13","--mesa"] ou ["begin","--action","texto"]. Ids curtos (n1, l2) são aceitos.'),
  entrada: z.string().optional().describe("o que iria pela entrada padrão: JSON do apply/pc create ou texto do narrate/turn end --narration -"),
}

export function buildConnector(secret: string): McpServer {
  const server = new McpServer(
    { name: "dndai", version: "0.2.0" },
    { instructions: "Motor de mundo do RPG dndai (fonte única de verdade). Leia a cena com dnd_ler context, consulte por id (show), proponha apply e só então narre. Não invente nomes: eles só nascem no apply." }
  )
  server.registerTool(
    "dnd_ler",
    {
      description: "Lê sem alterar nada. Saída em TOON com ids curtos (n1, l2, i3, f4, q5, h5). context (delta desde o último turno), context --cena (cena inteira), context --full, context --json, resume, show <id>, fact <id>, chapter, recall <termos>, rolls, log, validate, atlas, srd monster|spell|feature|subclass|race|subrace|feat|trait <busca>, skill, help.",
      inputSchema: shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ campanha, comando, args, entrada }) => execute(secret, "ler", campanha, comando, args, entrada)
  )
  server.registerTool(
    "dnd_agir",
    {
      description:
        "Altera o jogo pelo motor (atômico e validado). Aceita ids curtos. turn begin|end, narrate, apply (ops JSON em entrada), check/save/attack/damage/roll/deathsave (com --mesa para o jogador rolar), item, time, rest, levelup (--subclass/--asi/--feat/--choices), resource use, feature choose, combat, undo, pc create, campaign new, chapter close, atlas sync. Sem --values e sem cancelar rolagem do jogador.",
      inputSchema: shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ campanha, comando, args, entrada }) => execute(secret, "agir", campanha, comando, args, entrada)
  )
  return server
}

function diskSecrets(): string[] {
  const found: string[] = []
  const home = campaignsHome()
  if (!existsSync(home)) return found
  const legacy = join(home, "conector-secret")
  if (existsSync(legacy)) found.push(readFileSync(legacy, "utf8").trim())
  for (const entry of readdirSync(home, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = join(home, entry.name, "connector.secret")
    if (existsSync(file)) found.push(readFileSync(file, "utf8").trim())
  }
  return found.filter(Boolean)
}

export interface ConnectorOptions {
  host: string
  port: number
  /** Segredo legado na URL (/mcp/<segredo>). Cada campanha também tem o seu em campaigns/<slug>/connector.secret. */
  secret: string
}

export function startConnector(opts: ConnectorOptions) {
  const http = createServer(async (req, res) => {
    const path = (req.url ?? "/").split("?")[0]
    if (path === "/healthz") return void res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}')
    const match = /^\/mcp\/([^/]+)$/.exec(path)
    const given = match ? decodeURIComponent(match[1]) : ""
    const known = [opts.secret, ...diskSecrets()]
    const secret = known.find((s) => secretsEqual(s, given))
    if (!secret) {
      if (!rateOk("http-404", 40, 60_000)) return void res.writeHead(429).end()
      return void res.writeHead(404).end()
    }
    const server = buildConnector(secret)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on("close", () => {
      void transport.close()
      void server.close()
    })
    try {
      await server.connect(transport)
      await transport.handleRequest(req, res)
    } catch (error) {
      console.error("[conector] erro MCP:", (error as Error).message)
      if (!res.headersSent) res.writeHead(500).end()
    }
  })
  http.listen(opts.port, opts.host)
  return http
}
