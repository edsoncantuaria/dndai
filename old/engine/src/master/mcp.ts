// MCP "dndai-mestre": ponte servidor → ChatGPT. Recebe mensagens do jogador (da mesa ou de qualquer
// cliente MCP), entrega ao ChatGPT pelo Shellby (uma conversa por campanha) e guarda as respostas.
import { timingSafeEqual } from "node:crypto"
import { createServer } from "node:http"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { z } from "zod"
import { campaignExists, listCampaigns } from "../campaign.ts"
import { chatView, createMaster, enqueue, messageOutcome } from "./queue.ts"
import { type MasterTransport, shellbyTransport } from "./shellby.ts"

export interface MasterServerOptions {
  host: string
  port: number
  token?: string
  transport?: MasterTransport
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 1) }] }
}

export function startMasterServer(opts: MasterServerOptions) {
  const master = createMaster(opts.transport ?? shellbyTransport())
  master.recover(listCampaigns().map((c) => c.slug))

  const requireCampaign = (slug: string) => {
    if (!campaignExists(slug)) throw new Error(`Campanha "${slug}" não existe. Existentes: ${listCampaigns().map((c) => c.slug).join(", ") || "nenhuma"}.`)
  }

  const build = () => {
    const server = new McpServer({ name: "dndai-mestre", version: "0.1.0" })

    server.registerTool(
      "mestre_enviar",
      {
        description:
          "Envia uma mensagem do jogador (ou um aviso da mesa) ao Mestre da campanha (ChatGPT via Shellby). Com aguardar=true devolve a narração; senão devolve o id e o Mestre responde em segundo plano.",
        inputSchema: {
          campanha: z.string().min(1).describe("slug da campanha"),
          mensagem: z.string().min(1).max(4000),
          papel: z.enum(["jogador", "sistema"]).default("jogador").describe("sistema = aviso automático da mesa (ex.: rolagem resolvida)"),
          aguardar: z.boolean().default(true),
          timeout_s: z.number().int().min(5).max(1800).default(280),
        },
      },
      async ({ campanha, mensagem, papel, aguardar, timeout_s }) => {
        requireCampaign(campanha)
        const id = enqueue(campanha, papel, mensagem)
        void master.drain(campanha)
        if (!aguardar) return text({ mensagem_id: id, status: "fila" })
        const deadline = Date.now() + timeout_s * 1000
        for (;;) {
          const o = messageOutcome(campanha, id)
          if (o.status === "entregue") return text({ mensagem_id: id, status: o.status, resposta: o.reply })
          if (o.status === "erro") return { ...text({ mensagem_id: id, status: o.status, erro: o.error }), isError: true }
          if (Date.now() > deadline) return text({ mensagem_id: id, status: o.status, aviso: "O Mestre ainda está respondendo; consulte mestre_conversa." })
          await sleep(1000)
        }
      }
    )

    server.registerTool(
      "mestre_conversa",
      {
        description: "Últimas mensagens da conversa jogador ⇄ Mestre e o estado do Mestre (ocioso, na_fila, pensando, erro).",
        inputSchema: { campanha: z.string().min(1), limite: z.number().int().min(1).max(200).default(30) },
      },
      async ({ campanha, limite }) => {
        requireCampaign(campanha)
        return text(chatView(campanha, limite))
      }
    )

    server.registerTool(
      "mestre_reiniciar",
      {
        description: "Abre uma conversa nova no ChatGPT para a campanha (use se a atual degradar). O mundo não muda: o Mestre retoma pelo motor.",
        inputSchema: { campanha: z.string().min(1) },
      },
      async ({ campanha }) => {
        requireCampaign(campanha)
        master.reset(campanha)
        return text("Conversa reiniciada; a próxima mensagem abre um chat novo e o Mestre se reorienta com `dnd resume`.")
      }
    )

    server.registerTool(
      "campanhas",
      { description: "Lista as campanhas do motor dndai.", inputSchema: {} },
      async () => text(listCampaigns())
    )
    return server
  }

  const authorized = (header: string | undefined): boolean => {
    if (!opts.token) return true
    const given = Buffer.from(header?.replace(/^Bearer\s+/i, "") ?? "")
    const want = Buffer.from(opts.token)
    return given.length === want.length && timingSafeEqual(given, want)
  }

  const http = createServer(async (req, res) => {
    const path = (req.url ?? "/").split("?")[0]
    if (path === "/healthz") return void res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}')
    if (path !== "/mcp") return void res.writeHead(404).end()
    if (!authorized(req.headers.authorization)) return void res.writeHead(401).end()
    // Stateless: um servidor/transporte por requisição.
    const server = build()
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on("close", () => {
      void transport.close()
      void server.close()
    })
    try {
      await server.connect(transport)
      await transport.handleRequest(req, res)
    } catch (error) {
      console.error("[mestre] erro MCP:", error)
      if (!res.headersSent) res.writeHead(500).end()
    }
  })
  http.listen(opts.port, opts.host)
  return http
}
