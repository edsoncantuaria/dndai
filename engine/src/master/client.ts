// Cliente do MCP dndai-mestre (usado pelo `dnd serve` para entregar mensagens da mesa).
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

export async function sendToMaster(campanha: string, mensagem: string, papel: "jogador" | "sistema"): Promise<{ mensagem_id: number }> {
  const url = process.env.DNDAI_MESTRE_URL ?? "http://127.0.0.1:8791/mcp"
  const token = process.env.DNDAI_MESTRE_TOKEN
  const client = new Client({ name: "dndai-mesa", version: "0.1.0" })
  const transport = new StreamableHTTPClientTransport(new URL(url), token ? { requestInit: { headers: { authorization: `Bearer ${token}` } } } : undefined)
  try {
    await client.connect(transport)
    const r = (await client.callTool({ name: "mestre_enviar", arguments: { campanha, mensagem, papel, aguardar: false } })) as {
      isError?: boolean
      content?: { text?: string }[]
    }
    const body = r.content?.map((c) => c.text ?? "").join("") ?? ""
    if (r.isError) throw new Error(body || "O Mestre recusou a mensagem.")
    return JSON.parse(body) as { mensagem_id: number }
  } catch (error) {
    if ((error as Error).message?.includes("fetch failed")) throw new Error(`Mestre offline: o MCP dndai-mestre não responde em ${url} (rode: dnd mestre).`)
    throw error
  } finally {
    await client.close().catch(() => undefined)
  }
}
