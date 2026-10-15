// Conector MCP "dndai" para o ChatGPT: só as ferramentas do jogo, sem shell nem arquivos.
// `dnd_ler` (somente leitura) e `dnd_agir` (um beat validado, atômico). O resto do servidor é inacessível.
import { createServer } from "node:http"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { z } from "zod"
import { scopeText } from "../core/scope.ts"
import { campaign, campaignExists } from "../store.ts"
import { allSecrets, assertInScope, auditCall, scopeOf, secretsEqual } from "./secrets.ts"
import { context, recall, resume, showEntity, srdLookup } from "./context.ts"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { submit } from "./submit.ts"
import { emit } from "../events.ts"

const hits = new Map<string, number[]>()
function rateOk(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) { hits.set(key, recent); return false }
  recent.push(now); hits.set(key, recent)
  return true
}

const SKILL = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "skill", "SKILL.md")
const err = (text: string) => ({ isError: true, content: [{ type: "text" as const, text: `ERRO: ${text}` }] })
const ok = (text: string) => ({ content: [{ type: "text" as const, text: text || "ok" }] })

export const LER = ["skill", "escopo", "contexto", "cena", "resume", "capitulo", "recall", "srd", "mostrar"] as const

export function ler(slugs: string[], a: { campanha?: string; o: (typeof LER)[number]; q?: string; n?: number }): string {
  if (a.o === "skill") return readFileSync(SKILL, "utf8")
  if (a.o === "escopo") return scopeText()
  const slug = assertInScope(slugs, a.campanha)
  if (!campaignExists(slug)) throw new Error("campanha não existe")
  const c = campaign(slug)
  switch (a.o) {
    case "contexto": return context(c)
    case "cena": return context(c, { full: true })
    case "resume": return resume(c)
    case "capitulo": return resume(c, { chapter: a.n ?? Number(a.q) })
    case "recall": return JSON.stringify(recall(c, a.q ?? "", a.n ?? 8))
    case "mostrar": return showEntity(c, a.q ?? "")
    case "srd": { const [coll, ...rest] = (a.q ?? "").trim().split(/\s+/); return srdLookup(c, coll ?? "", rest.join(" ")) }
  }
}

export function agir(slugs: string[], a: { campanha?: string; beat?: unknown; undo?: boolean }): string {
  const slug = assertInScope(slugs, a.campanha)
  const c = campaign(slug)
  if (a.undo) {
    const label = c.undo()
    emit(slug)
    return label ? `desfeito: ${label}` : "nada para desfazer"
  }
  const r = submit(c, a.beat ?? {})
  emit(slug)
  return [...r.lines, r.closed ? `turno ${r.turn} fechado` : "turno aberto (narre com narration+summary)"].join("\n")
}

const readShape = {
  campanha: z.string().optional().describe("slug da campanha (obrigatório se o conector enxerga mais de uma)"),
  o: z.enum(LER).describe("skill=instruções · escopo=o que é jogável · contexto=delta da cena · cena=cena inteira · resume=memória longa · capitulo(n) · recall(q) · srd(q='monsters goblin' ou 'spells fireball') · mostrar(q=id)"),
  q: z.string().optional(), n: z.number().int().optional(),
}
const actShape = {
  campanha: z.string().optional(),
  beat: z.object({}).passthrough().optional().describe("{ops:[...], narration?, summary?, options?}. Veja a skill. Sem narration = só mecânica (leia as rolagens antes de narrar)."),
  undo: z.boolean().optional().describe("desfaz o último beat"),
}

export function buildConnector(slugs: string[], secret: string): McpServer {
  const server = new McpServer({ name: "dndai", version: "2.0.0" }, { instructions: "Motor do RPG dndai (D&D 2024). Leia dnd_ler o=skill uma vez, depois joga por dnd_ler/dnd_agir. O motor é a verdade: nomes novos só nascem em create.*; dados são do motor." })
  const wrap = (kind: string, fn: () => string) => {
    if (!rateOk(`tool:${secret.slice(0, 8)}`, 120, 60_000)) return err("limite de chamadas do conector. Espere um instante.")
    try { const out = fn(); auditCall(secret, kind, true); return ok(out) } catch (e) { const m = (e as Error).message; auditCall(secret, kind, false, m); return err(m) }
  }
  server.registerTool("dnd_ler", { description: "Lê sem alterar nada. Saída em TOON com ids curtos (pc, n1, m1, l1, i1, q1, f1, h1).", inputSchema: readShape, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
    async (a) => wrap(`ler ${a.o}`, () => ler(slugs, a)))
  server.registerTool("dnd_agir", { description: "Executa um beat (ops validadas, atômico) e/ou fecha o turno com a narração. Tudo ou nada: erro = nada gravado.", inputSchema: actShape, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } },
    async (a) => wrap(a.undo ? "agir undo" : "agir beat", () => agir(slugs, a)))
  return server
}

export function startConnector(opts: { host: string; port: number }) {
  const http = createServer(async (req, res) => {
    const path = (req.url ?? "/").split("?")[0]!
    if (path === "/healthz") return void res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}')
    const match = /^\/mcp\/([^/]+)$/.exec(path)
    const given = match ? decodeURIComponent(match[1]!) : ""
    const found = allSecrets().find((s) => secretsEqual(s.secret, given))
    if (!found) {
      if (!rateOk("http-404", 40, 60_000)) return void res.writeHead(429).end()
      return void res.writeHead(404).end()
    }
    const server = buildConnector(scopeOf(found), found.secret)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on("close", () => { void transport.close(); void server.close() })
    try { await server.connect(transport); await transport.handleRequest(req, res) } catch (e) {
      console.error("[conector] erro MCP:", (e as Error).message)
      if (!res.headersSent) res.writeHead(500).end()
    }
  })
  http.listen(opts.port, opts.host)
  return http
}
