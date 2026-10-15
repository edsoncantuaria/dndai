// dndai-server: API do cliente + WebSocket + fila do Mestre (Shellby) + conector MCP, num processo só.
//   node src/main.ts serve [--port 8790] [--host 127.0.0.1] [--connector-port 8794]
import { campaignsHome, listCampaigns } from "./store.ts"
import { startApi } from "./api.ts"
import { startConnector } from "./mestre/connector.ts"
import { createMaster } from "./mestre/queue.ts"
import { fakeTransport } from "./mestre/fake.ts"
import { shellbyTransport } from "./mestre/shellby.ts"

const argv = process.argv.slice(2)
const flag = (name: string, def: string): string => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1]! : def }

if (argv[0] !== "serve") {
  console.log("uso: node src/main.ts serve [--host 127.0.0.1] [--port 8790] [--connector-port 8794]\nvariáveis: DNDAI_HOME, DNDAI_TOKEN, DNDAI_SHELLBY_URL, DNDAI_TTS_URL")
  process.exit(argv.length ? 1 : 0)
}

const host = flag("host", "127.0.0.1")
const port = Number(flag("port", "8790"))
const master = createMaster(process.env.DNDAI_FAKE_MESTRE === "1" ? fakeTransport() : shellbyTransport())
startApi({ host, port, token: process.env.DNDAI_TOKEN, master })
startConnector({ host: "127.0.0.1", port: Number(flag("connector-port", "8794")) })
master.recover(listCampaigns().map((c) => c.slug))
console.log(`[dndai] API http://${host}:${port} · conector http://127.0.0.1:${flag("connector-port", "8794")}/mcp/<segredo> · campanhas em ${campaignsHome()}`)
