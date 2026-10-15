// API HTTP + WebSocket para o cliente (Godot). O cliente só apresenta; toda regra está no motor.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { spawn } from "node:child_process"
import { existsSync, readFileSync, statSync } from "node:fs"
import { gzipSync } from "node:zlib"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { WebSocketServer } from "ws"
import { z } from "zod"
import { CampaignError } from "./core/campaign.ts"
import { CreationError, creationNeeds, creationOptions } from "./core/creation.ts"
import { one } from "./core/db.ts"
import * as mx from "./core/mechanics.ts"
import { createCharacter, rollAbilities } from "./core/pc.ts"
import { levelUp, levelUpNeeds } from "./core/progression.ts"
import { emit, onChange } from "./events.ts"
import { srd } from "./srd/index.ts"
import { campaign, campaignExists, createCampaign, listCampaigns } from "./store.ts"
import { chatView, enqueue, type createMaster } from "./mestre/queue.ts"
import { addSlugToScope, campaignSecret } from "./mestre/secrets.ts"
import { openTurn } from "./mestre/submit.ts"
import { gameView } from "./view.ts"
import { seedWorld, WORLDS } from "./world/seed.ts"

class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

const TTS = (process.env.DNDAI_TTS_URL ?? "http://127.0.0.1:8795").replace(/\/+$/, "")
const TTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "tts")

export interface ApiOptions { host: string; port: number; token?: string; master: ReturnType<typeof createMaster>; staticDir?: string }

const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".wasm": "application/wasm", ".pck": "application/octet-stream", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".css": "text/css" }
const gz = new Map<string, { mtime: number; data: Uint8Array }>()

/** Serve o cliente web (build do Godot) na mesma origem da API. */
function serveStatic(dir: string, req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
  const rel = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "")
  const file = resolve(dir, rel)
  if (!file.startsWith(resolve(dir)) || !existsSync(file) || !statSync(file).isFile()) return false
  const ext = file.slice(file.lastIndexOf("."))
  const type = MIME[ext] ?? "application/octet-stream"
  const st = statSync(file)
  let data: Uint8Array = readFileSync(file)
  const headers: Record<string, string | number> = { "content-type": type, "cache-control": "no-cache" }
  if (data.length > 1024 && /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? "")) && [".js", ".wasm", ".pck", ".html"].includes(ext)) {
    const hit = gz.get(file)
    if (hit?.mtime === st.mtimeMs) data = hit.data
    else { data = gzipSync(data); gz.set(file, { mtime: st.mtimeMs, data }) }
    headers["content-encoding"] = "gzip"
  }
  headers["content-length"] = data.length
  res.writeHead(200, headers).end(data)
  return true
}

const slugOf = (s: string | undefined): string => {
  if (!s || !campaignExists(s)) throw new HttpError(404, "Campanha não existe.")
  return s
}

const NewCampaign = z.object({ slug: z.string().optional(), name: z.string().trim().min(1).max(80), premise: z.string().max(600).default(""), tone: z.string().max(200).default(""), world: z.string().max(40).optional() }).strict()
const Act = z.object({ text: z.string().trim().min(1).max(600) }).strict()
const Item = z.object({ action: z.enum(["equipar", "desequipar", "largar"]), item: z.string() }).strict()
const Rest = z.object({ kind: z.enum(["short", "long"]), dice: z.number().int().min(0).max(20).default(0) }).strict()
const Level = z.object({ hp: z.enum(["average", "roll"]).default("average"), subclass: z.string().optional(), asi: z.unknown().optional(), spells: z.unknown().optional(), mastery: z.array(z.string()).optional() }).passthrough()

function slugify(name: string): string {
  const base = name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "campanha"
  let slug = base, n = 2
  while (campaignExists(slug)) slug = `${base}-${n++}`
  return slug
}

async function body(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const ch of req) { size += (ch as Buffer).length; if (size > 200_000) throw new HttpError(413, "Corpo grande demais."); chunks.push(ch as Buffer) }
  const raw = Buffer.concat(chunks).toString("utf8")
  try { return raw ? JSON.parse(raw) : {} } catch { throw new HttpError(400, "JSON inválido.") }
}

async function ttsFetch(text: string): Promise<Response> {
  const go = () => fetch(`${TTS}/speak`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) })
  try { return await go() } catch {
    // Serviço de voz parado: tenta subir o do repositório (uv) e repete uma vez.
    if (existsSync(join(TTS_DIR, "server.py"))) {
      spawn("uv", ["run", "--project", TTS_DIR, "python", join(TTS_DIR, "server.py")], { cwd: TTS_DIR, detached: true, stdio: "ignore" }).unref()
      for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 1000)); try { if ((await fetch(`${TTS}/health`)).ok) return await go() } catch { /* ainda subindo */ } }
    }
    throw new HttpError(503, "Voz indisponível: o serviço de TTS não respondeu.")
  }
}

export function startApi(opts: ApiOptions) {
  const loopback = ["127.0.0.1", "::1", "localhost"].includes(opts.host)
  if (!loopback && !opts.token) throw new Error("Fora do loopback o servidor exige DNDAI_TOKEN.")

  const authed = (req: IncomingMessage, url: URL): boolean => {
    if (!opts.token) return true
    const given = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "") || url.searchParams.get("token") || ""
    return given.length === opts.token.length && given === opts.token
  }

  const send = (res: ServerResponse, status: number, data: unknown) => {
    const text = JSON.stringify(data)
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(text), "cache-control": "no-store", "access-control-allow-origin": "*" }).end(text)
  }

  const handle = async (req: IncomingMessage, res: ServerResponse, url: URL) => {
    const m = req.method ?? "GET"
    const p = url.pathname
    if (opts.staticDir && (m === "GET" || m === "HEAD") && !p.startsWith("/api/") && p !== "/ws" && serveStatic(opts.staticDir, req, res, p)) return
    if (m === "OPTIONS") return void res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,OPTIONS" }).end()
    if (p === "/api/health") return send(res, 200, { ok: true, edition: "2024" })
    if (!authed(req, url)) throw new HttpError(401, "Token inválido.")

    if (m === "GET" && p === "/api/campaigns") return send(res, 200, listCampaigns())
    if (m === "GET" && p === "/api/worlds") return send(res, 200, WORLDS)
    if (m === "POST" && p === "/api/campaigns") {
      const b = NewCampaign.parse(await body(req))
      const slug = b.slug ?? slugify(b.name)
      const created = createCampaign(slug, b)
      if (b.world) {
        try { seedWorld(created, b.world) } catch (e) { created.close(); throw new HttpError(422, (e as Error).message) }
      }
      campaignSecret(slug)
      addSlugToScope(slug)
      return send(res, 201, { slug })
    }
    if (m === "GET" && p === "/api/creation/options") return send(res, 200, creationOptions(srd()))

    if (m === "POST" && p === "/api/creation/needs") return send(res, 200, creationNeeds(srd(), (await body(req)) as never))

    const srdm = /^\/api\/srd\/([a-z-]+)(?:\/([^/]+))?$/.exec(p)
    if (m === "GET" && srdm) {
      const s = srd()
      if (srdm[2]) return send(res, 200, s.get(srdm[1] as never, srdm[2], "pt-BR") ?? (() => { throw new HttpError(404, "Não existe no SRD.") })())
      const q = url.searchParams.get("q")
      return send(res, 200, q ? s.search(q, srdm[1] as never, 20) : s.list(srdm[1] as never))
    }

    const cm = /^\/api\/c\/([a-z0-9-]+)\/([a-z-]+)$/.exec(p)
    if (cm) {
      const slug = slugOf(cm[1]); const c = campaign(slug); const what = cm[2]
      if (m === "POST") res.once("finish", () => emit(slug))
      if (m === "GET" && what === "view") return send(res, 200, gameView(c, slug))
      if (m === "GET" && what === "chat") return send(res, 200, chatView(slug))
      if (m === "GET" && what === "connector") return send(res, 200, { path: `/mcp/${campaignSecret(slug)}` })
      if (m === "POST" && what === "roll-abilities") return send(res, 200, rollAbilities(c))
      if (m === "POST" && what === "character") { createCharacter(c, (await body(req)) as never)
        // A mesa pede a abertura: o Mestre narra a cena inicial sem o jogador precisar agir.
        openTurn(c, "(abertura da campanha)")
        enqueue(slug, "sistema", "O personagem foi criado. Abra a campanha: narre a cena inicial (crie o local e quem estiver nele) e ofereça opções ao jogador.")
        void opts.master.drain(slug)
        return send(res, 201, gameView(c, slug)) }
      if (m === "POST" && what === "act") {
        const { text } = Act.parse(await body(req))
        if (!one(c.db, "SELECT 1 FROM characters WHERE kind='pc'")) throw new HttpError(409, "Crie o personagem primeiro.")
        if (chatView(slug, 1).master.status !== "ocioso") throw new HttpError(409, "O Mestre ainda está respondendo.")
        const turn = openTurn(c, text)
        enqueue(slug, "jogador", text)
        void opts.master.drain(slug)
        return send(res, 202, { turn })
      }
      if (m === "POST" && what === "item") {
        const b = Item.parse(await body(req))
        if (b.action === "largar") mx.itemQty(c, b.item, -(one<{ qty: number }>(c.db, "SELECT qty FROM items WHERE id = ?", b.item)?.qty ?? 0))
        else mx.equip(c, b.item, b.action === "equipar")
        return send(res, 200, gameView(c, slug))
      }
      if (m === "POST" && what === "rest") { const b = Rest.parse(await body(req)); const t = b.kind === "short" ? mx.shortRest(c, "pc", b.dice) : mx.longRest(c); return send(res, 200, { text: t, view: gameView(c, slug) }) }
      if (m === "POST" && what === "death-save") return send(res, 200, { text: mx.deathSave(c), view: gameView(c, slug) })
      if (m === "GET" && what === "level-up") return send(res, 200, levelUpNeeds(c))
      if (m === "POST" && what === "level-up") { levelUp(c, Level.parse(await body(req)) as never); return send(res, 200, gameView(c, slug)) }
      if (m === "POST" && what === "undo") { const l = c.undo(); return send(res, 200, { undone: l ?? null, view: gameView(c, slug) }) }
      if (m === "GET" && what === "tts") {
        const key = /^turn-(\d+)$/.exec(url.searchParams.get("key") ?? "")
        if (!key) throw new HttpError(400, "Envie key=turn-<n>.")
        const text = one<{ text: string }>(c.db, "SELECT text FROM narrations WHERE turn = ? ORDER BY id DESC LIMIT 1", Number(key[1]))?.text
        if (!text) throw new HttpError(404, "Narração não encontrada.")
        const up = await ttsFetch(text)
        if (!up.ok) throw new HttpError(up.status === 422 ? 422 : 502, `Voz indisponível (${up.status}).`)
        const audio = Buffer.from(await up.arrayBuffer())
        return void res.writeHead(200, { "content-type": "audio/mpeg", "content-length": audio.length, "cache-control": "no-store", "access-control-allow-origin": "*" }).end(audio)
      }
    }
    throw new HttpError(404, "Rota inexistente.")
  }

  const http = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x")
    handle(req, res, url).catch((e: unknown) => {
      const err = e as Error
      const status = err instanceof HttpError ? err.status : err instanceof z.ZodError ? 400 : err instanceof CreationError || err instanceof mx.RuleError || err instanceof CampaignError ? 422 : 500
      if (status === 500) console.error("[api]", err)
      const msg = err instanceof z.ZodError ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : err.message
      if (!res.headersSent) send(res, status, { error: msg })
    })
  })

  // WebSocket: só avisa "mudou"; o cliente busca /view (fonte única, sem estado duplicado).
  const wss = new WebSocketServer({ noServer: true })
  const subs = new Map<string, Set<import("ws").WebSocket>>()
  http.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://x")
    const slug = url.searchParams.get("campaign") ?? ""
    if (url.pathname !== "/ws" || !authed(req, url) || !campaignExists(slug)) return void socket.destroy()
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (!subs.has(slug)) subs.set(slug, new Set())
      subs.get(slug)!.add(ws)
      ws.on("close", () => subs.get(slug)?.delete(ws))
      ws.send(JSON.stringify({ type: "changed", version: campaign(slug).version }))
    })
  })
  const off = onChange((slug) => { for (const ws of subs.get(slug) ?? []) ws.readyState === 1 && ws.send(JSON.stringify({ type: "changed", version: campaign(slug).version })) })
  const ping = setInterval(() => { for (const set of subs.values()) for (const ws of set) ws.readyState === 1 && ws.ping() }, 25_000)
  http.on("close", () => { off(); clearInterval(ping); wss.close() })

  http.listen(opts.port, opts.host)
  return http
}
