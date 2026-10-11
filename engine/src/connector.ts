// Conector MCP "dndai" para o ChatGPT (Developer Mode): dá ao Mestre SÓ as ferramentas do jogo, sem shell.
// Duas ferramentas sobre a mesma CLI `dnd`: `dnd_ler` (somente leitura, sem pedido de aprovação) e
// `dnd_agir` (muda o jogo, por lista fechada de comandos). Nada aqui executa processos ou lê arquivos.
import { timingSafeEqual } from "node:crypto"
import { createServer } from "node:http"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { z } from "zod"
import { runCli } from "./cli.ts"

const READ = new Set(["skill", "context", "resume", "show", "recall", "rolls", "log", "validate", "srd", "help", "atlas"])
const WRITE = new Set([
  "campaign", "pc", "turn", "narrate", "undo", "apply", "time", "check", "save", "attack", "damage", "roll", "deathsave",
  "item", "rest", "levelup", "combat", "roll-cancel", "atlas",
])
// Flags que leriam arquivos do servidor ou trocariam a campanha por fora do parâmetro explícito.
const FORBIDDEN_FLAG = /^--(file|static|token|host|port)(=|$)|^-c$/

function validate(kind: "ler" | "agir", comando: string, args: string[]): void {
  const allowed = kind === "ler" ? READ : WRITE
  if (!allowed.has(comando)) {
    const hint = kind === "ler" && WRITE.has(comando) ? " (esse comando muda o jogo: use dnd_agir)" : kind === "agir" && READ.has(comando) ? " (é leitura: use dnd_ler)" : ""
    throw new Error(`Comando "${comando}" não permitido em dnd_${kind}${hint}. Permitidos: ${[...allowed].join(", ")}.`)
  }
  if (kind === "ler" && comando === "atlas" && args[0] === "sync") throw new Error('"atlas sync" muda o jogo: use dnd_agir.')
  // Administração do multiverso (ex.: atlas forget) é só do dono do servidor, nunca do Mestre.
  if (comando === "atlas" && args.length && args[0] !== "sync") throw new Error(`"atlas ${args[0]}" não é permitido pelo conector.`)
  if (kind === "ler" && comando === "campaign" ) throw new Error("Use dnd_agir para campanhas.")
  const bad = args.find((a) => FORBIDDEN_FLAG.test(a))
  if (bad) throw new Error(`Opção "${bad}" não é permitida pelo conector (use o campo "entrada" para JSON/narração e "campanha" para a campanha).`)
}

function execute(kind: "ler" | "agir", campanha: string | undefined, comando: string, args: string[], entrada: string | undefined) {
  try {
    validate(kind, comando, args)
    const argv = campanha ? ["-c", campanha, comando, ...args] : [comando, ...args]
    const out = runCli(argv, entrada)
    return { content: [{ type: "text" as const, text: out || "ok" }] }
  } catch (error) {
    return { isError: true, content: [{ type: "text" as const, text: `ERRO: ${(error as Error).message}` }] }
  }
}

const shape = {
  campanha: z.string().min(1).optional().describe("slug da campanha (obrigatório em tudo, exceto help/campaign list/campaign new)"),
  comando: z.string().min(1).describe("subcomando do motor, ex.: context, apply, check, turn"),
  args: z.array(z.string()).default([]).describe('argumentos como na CLI, ex.: ["pc","percepcao","--dc","13","--mesa"] ou ["begin","--action","texto"]'),
  entrada: z.string().optional().describe("o que iria pela entrada padrão: JSON do apply/pc create ou texto do narrate/turn end --narration -"),
}

export function buildConnector(): McpServer {
  const server = new McpServer(
    { name: "dndai", version: "0.1.0" },
    { instructions: "Motor de mundo do RPG dndai (fonte única de verdade). Siga a skill mestre-dndai. Leia com dnd_ler e altere o jogo só com dnd_agir." }
  )
  server.registerTool(
    "dnd_ler",
    {
      description: "Lê sem alterar nada: skill (instruções do Mestre — leia primeiro), context, resume, show <ref>, recall <termos>, rolls, log, validate, atlas, srd monster|spell <busca>, help.",
      inputSchema: shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ campanha, comando, args, entrada }) => execute("ler", campanha, comando, args, entrada)
  )
  server.registerTool(
    "dnd_agir",
    {
      description:
        "Altera o jogo pelo motor (atômico e validado): turn begin|end, narrate, apply (ops JSON em entrada), check/save/attack/damage/roll/deathsave (com --mesa para o jogador rolar), item, time, rest, levelup, combat, undo, pc create, campaign new, atlas sync.",
      inputSchema: shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ campanha, comando, args, entrada }) => execute("agir", campanha, comando, args, entrada)
  )
  return server
}

export interface ConnectorOptions {
  host: string
  port: number
  /** Segredo na URL (/mcp/<segredo>), como o Shellby: o ChatGPT usa "No Auth" com a URL privada. */
  secret: string
}

export function startConnector(opts: ConnectorOptions) {
  const route = `/mcp/${opts.secret}`
  const http = createServer(async (req, res) => {
    const path = (req.url ?? "/").split("?")[0]
    if (path === "/healthz") return void res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}')
    const given = Buffer.from(path)
    const want = Buffer.from(route)
    if (given.length !== want.length || !timingSafeEqual(given, want)) return void res.writeHead(404).end()
    const server = buildConnector()
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on("close", () => {
      void transport.close()
      void server.close()
    })
    try {
      await server.connect(transport)
      await transport.handleRequest(req, res)
    } catch (error) {
      console.error("[conector] erro MCP:", error)
      if (!res.headersSent) res.writeHead(500).end()
    }
  })
  http.listen(opts.port, opts.host)
  return http
}
