// Cliente do Shellby MCP local. Cada campanha usa seu próprio escopo (x-openai-session),
// então cada campanha tem a sua conversa persistente no ChatGPT Web (subagent "mestre").
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

export interface SubagentPoll {
  status: "running" | "completed" | "failed"
  activity?: string
  activityAgeMs?: number
  response?: string
  error?: string
}

/** Interface mínima usada pela fila (permite testar sem Shellby). */
export interface MasterTransport {
  submit(scope: string, agentId: string, prompt: string): Promise<string>
  poll(scope: string, turnId: string, waitMs: number): Promise<SubagentPoll>
}

interface ToolResult {
  isError?: boolean
  structuredContent?: { turns?: Array<Record<string, unknown>> }
  content?: Array<{ type: string; text?: string }>
}

const CALL_TIMEOUT_MS = 330_000

/** Pares chave=valor do modo compacto do Shellby (valores com espaço vêm entre aspas JSON). */
function kv(line: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of line.matchAll(/(\w+)=("(?:[^"\\]|\\.)*"|\S+)/g)) {
    out[m[1]!] = m[2]!.startsWith('"') ? (JSON.parse(m[2]) as string) : m[2]
  }
  return out
}

function textOf(result: ToolResult): string {
  return result.content?.map((c) => c.text ?? "").join("\n") ?? ""
}

/** Primeiro turno do resultado, aceitando `tool_output = "full"` (estruturado) ou `"compact"` (texto). */
export function firstTurn(result: ToolResult): Record<string, unknown> | undefined {
  const structured = result.structuredContent?.turns?.[0]
  if (structured) return structured
  const text = textOf(result)
  const block = /^---- (.*?) ----(?:\n\n([\s\S]*))?$/m.exec(text)
  if (block) {
    const turn: Record<string, unknown> = kv(block[1])
    const body = (block[2] ?? "").trim()
    if (body) turn[turn.status === "failed" ? "error" : "response"] = body
    return turn
  }
  const line = text.split("\n").find((l) => /turn_id=|status=/.test(l))
  if (!line) return undefined
  const turn: Record<string, unknown> = kv(line)
  if (turn.status === "failed" && !turn.error) turn.error = text
  return turn
}

export function shellbyTransport(url = process.env.DNDAI_SHELLBY_URL ?? "http://127.0.0.1:3333/mcp"): MasterTransport {
  const call = async (scope: string, name: string, args: Record<string, unknown>, retryInit = true): Promise<ToolResult> => {
    const client = new Client({ name: "dndai-mestre", version: "0.1.0" })
    const transport = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { "x-openai-session": scope } } })
    try {
      await client.connect(transport)
      const result = (await client.callTool({ name, arguments: args }, undefined, { timeout: CALL_TIMEOUT_MS })) as ToolResult
      const text = result.content?.map((c) => c.text ?? "").join(" ") ?? ""
      // O Shellby exige start_here uma vez por escopo (estado em memória: volta após reiniciar o Shellby).
      if (result.isError && retryInit && /start_here/.test(text)) {
        const init = (await client.callTool({ name: "start_here", arguments: { mode: "general", task_id: scope } }, undefined, { timeout: CALL_TIMEOUT_MS })) as ToolResult
        if (init.isError) throw new Error(`Shellby recusou start_here: ${init.content?.map((c) => c.text).join(" ")}`)
        return call(scope, name, args, false)
      }
      return result
    } catch (error) {
      if ((error as Error).message?.includes("fetch failed")) throw new Error(`Shellby indisponível em ${url} (está rodando? npm run status no shellby-mcp).`)
      throw error
    } finally {
      await client.close().catch(() => undefined)
    }
  }

  return {
    async submit(scope, agentId, prompt) {
      // memory: true = conversa normal salva no ChatGPT (false abre chat temporário, que se perde).
      const result = await call(scope, "subagent_run", { agents: [{ agent_id: agentId, prompt, memory: true }] })
      const turn = firstTurn(result)
      if (!turn || turn.status === "failed" || typeof turn.turn_id !== "string") {
        throw new Error(String(turn?.error ?? (textOf(result) || "subagent_run falhou sem detalhes")))
      }
      return turn.turn_id
    },
    async poll(scope, turnId, waitMs) {
      const result = await call(scope, "subagent_result", { turn_ids: [turnId], wait_ms: waitMs })
      const turn = firstTurn(result)
      if (!turn) throw new Error(`subagent_result sem dados: ${textOf(result)}`)
      return {
        status: turn.status as SubagentPoll["status"],
        activity: turn.activity as string | undefined,
        activityAgeMs: turn.activity_age_ms === undefined ? undefined : Number(turn.activity_age_ms),
        response: turn.response as string | undefined,
        error: turn.error as string | undefined,
      }
    },
  }
}
