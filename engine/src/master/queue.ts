// Fila de conversa jogador ⇄ Mestre (ChatGPT via Shellby), uma por campanha.
// Fica em chat.db, separado do world.db: `dnd undo` volta o mundo, mas não apaga a conversa
// (o ChatGPT também não esquece). Um único processo (o MCP dndai-mestre) drena a fila.
import { randomUUID } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import { join } from "node:path"
import { campaignDir, campaignExists, openCampaign } from "../campaign.ts"
import { all, getMeta } from "../db.ts"
import type { MasterTransport } from "./shellby.ts"

export type ChatRole = "jogador" | "sistema" | "mestre"

export interface ChatMessage {
  id: number
  role: ChatRole
  text: string
  status: "fila" | "enviando" | "aguardando" | "entregue" | "erro"
  error: string
  at: string
}

export interface MasterState {
  status: "ocioso" | "na_fila" | "pensando" | "erro"
  activity: string | null
  error: string | null
}

const CHAT_SCHEMA = `
CREATE TABLE IF NOT EXISTS chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK (role IN ('jogador','sistema','mestre')),
  text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('fila','enviando','aguardando','entregue','erro')),
  turn_id TEXT,
  claim TEXT,
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  retry_at TEXT
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`

function openChat(slug: string): DatabaseSync {
  if (!campaignExists(slug)) throw new Error(`Campanha "${slug}" não existe.`)
  const db = new DatabaseSync(join(campaignDir(slug), "chat.db"))
  db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = DELETE;")
  db.exec(CHAT_SCHEMA)
  const cols = db.prepare("PRAGMA table_info(chat)").all() as { name: string }[]
  if (!cols.some((c) => c.name === "attempts")) db.exec("ALTER TABLE chat ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0")
  if (!cols.some((c) => c.name === "retry_at")) db.exec("ALTER TABLE chat ADD COLUMN retry_at TEXT")
  return db
}

function withChat<T>(slug: string, fn: (db: DatabaseSync) => T): T {
  const db = openChat(slug)
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

function meta(db: DatabaseSync, key: string, fallback = ""): string {
  return (db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? fallback
}

function setMeta(db: DatabaseSync, key: string, value: string | number): void {
  db.prepare("INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(value))
}

function bump(db: DatabaseSync): void {
  setMeta(db, "version", Number(meta(db, "version", "0")) + 1)
}

function tx<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE")
  try {
    const r = fn()
    bump(db)
    db.exec("COMMIT")
    return r
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

export function chatVersion(slug: string): number {
  if (!campaignExists(slug)) return 0
  return withChat(slug, (db) => Number(meta(db, "version", "0")))
}

export function chatView(slug: string, limit = 100): { messages: ChatMessage[]; master: MasterState } {
  return withChat(slug, (db) => {
    const messages = (db.prepare("SELECT * FROM (SELECT * FROM chat ORDER BY id DESC LIMIT ?) ORDER BY id").all(limit) as unknown as (ChatMessage & { created_at: string })[])
      .map(({ id, role, text, status, error, created_at }) => ({ id, role, text, status, error, at: created_at }))
    const counts = db.prepare("SELECT status, COUNT(*) AS n FROM chat GROUP BY status").all() as { status: string; n: number }[]
    const has = (s: string) => counts.some((c) => c.status === s && c.n > 0)
    const lastError = messages.filter((m) => m.role !== "mestre").at(-1)
    const status: MasterState["status"] = has("enviando") || has("aguardando") ? "pensando" : has("fila") ? "na_fila" : lastError?.status === "erro" ? "erro" : "ocioso"
    return {
      messages,
      master: { status, activity: status === "pensando" ? meta(db, "activity") || null : null, error: status === "erro" ? lastError?.error ?? null : null },
    }
  })
}

export function enqueue(slug: string, role: "jogador" | "sistema", text: string): number {
  const clean = text.trim()
  if (!clean) throw new Error("Mensagem vazia.")
  if (clean.length > 4000) throw new Error("Mensagem longa demais (máx. 4000 caracteres).")
  return withChat(slug, (db) =>
    tx(db, () => Number(db.prepare("INSERT INTO chat(role, text, status, created_at) VALUES(?, ?, 'fila', ?)").run(role, clean, new Date().toISOString()).lastInsertRowid))
  )
}

/** Situação de uma mensagem enviada e, se houver, a resposta do Mestre que a respondeu. */
export function messageOutcome(slug: string, id: number): { status: ChatMessage["status"]; error: string; reply: string | null } {
  return withChat(slug, (db) => {
    const row = db.prepare("SELECT status, error FROM chat WHERE id = ?").get(id) as { status: ChatMessage["status"]; error: string } | undefined
    if (!row) throw new Error(`Mensagem #${id} não existe.`)
    const reply = row.status === "entregue"
      ? (db.prepare("SELECT text FROM chat WHERE role = 'mestre' AND id > ? ORDER BY id LIMIT 1").get(id) as { text: string } | undefined)?.text ?? null
      : null
    return { ...row, reply }
  })
}

function agentId(db: DatabaseSync): string {
  return `mestre-${meta(db, "generation", "1")}`
}

export function scopeFor(slug: string): string {
  return `dndai-${slug}`
}

function bootstrapPrompt(slug: string, name: string): string {
  return [
    `[dndai · campanha ${slug} · configuração]`,
    `Você será o Mestre da campanha "${name}" (slug ${slug}) do motor dndai.`,
    "As próximas mensagens desta conversa chegam da mesa do jogador por um servidor. O jogador não vê este chat: ele vê só a sua resposta final, exibida na mesa como narração.",
    `Agora: 1) leia as instruções com a ferramenta dnd_ler do conector dndai, comando "skill", e siga-as à risca (incluindo a seção "Modo mesa"); 2) rode dnd_ler comando "resume" com campanha "${slug}" para conhecer o estado atual; se ainda não houver personagem, leia também dnd_ler "skill" com args ["preparacao"].`,
    "Jogue só pelas ferramentas dnd_ler/dnd_agir do conector dndai (sem shell).",
    "Não narre nada ainda. Responda apenas: PRONTO.",
  ].join("\n")
}

function messagePrompt(slug: string, rows: { role: string; text: string }[]): string {
  const body = rows.map((r) => (r.role === "jogador" ? `Jogador: «${r.text}»` : `Mesa: ${r.text}`))
  return [
    `[mesa dndai · campanha ${slug}]`,
    ...body,
    "",
    `Siga a skill (Modo mesa) usando dnd_ler/dnd_agir com campanha "${slug}". A mesa exibe a narração que você gravar no motor (narrate ou turn end --narration). Não a repita no chat: sua resposta final é só ${DONE}.`,
  ].join("\n")
}

/** Resposta final do Mestre no Modo mesa: a narração já está no motor, o chat só confirma. */
const DONE = "✓"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function lastNarrationId(slug: string): number {
  const world = openCampaign(slug)
  try {
    return all<{ id: number | null }>(world, "SELECT MAX(id) AS id FROM narrations")[0]?.id ?? 0
  } finally {
    world.close()
  }
}

/**
 * Texto a exibir: a narração gravada pelo Mestre no motor durante esta resposta (`narrate`/`turn end`,
 * formatação exata); senão, a resposta lida da página do ChatGPT, sem os avisos internos do Shellby.
 * Só o marcador sem nada gravado é `null`: o jogador não teria o que ler.
 */
function narrationFor(slug: string, sinceId: number, response: string): string | null {
  const world = openCampaign(slug)
  try {
    const recorded = all<{ text: string }>(world, "SELECT text FROM narrations WHERE id > ? ORDER BY id", sinceId)
    if (recorded.length) return recorded.map((t) => t.text).join("\n\n")
  } finally {
    world.close()
  }
  const text = response.replace(/\n*\*\*Notice:\*\*[^\n]*/g, "").trim()
  return !text || text === DONE ? null : text
}

/**
 * Conversa nova a cada capítulo fechado: o histórico do ChatGPT (saídas de ferramenta de todos os turnos)
 * deixa de ser relido a cada mensagem. O motor é a verdade e o bootstrap relê skill + resume.
 * Só entre turnos, sem rolagem pendente.
 */
function chapterCount(slug: string): { chapters: number; idle: boolean } {
  const world = openCampaign(slug)
  try {
    const chapters = all<{ n: number }>(world, "SELECT COUNT(*) AS n FROM chapters")[0]?.n ?? 0
    const pending = all<{ n: number }>(world, "SELECT COUNT(*) AS n FROM roll_requests WHERE status = 'pendente'")[0]?.n ?? 0
    return { chapters, idle: getMeta(world, "turn_open") !== "1" && pending === 0 }
  } finally {
    world.close()
  }
}

export interface MasterOptions {
  pollWaitMs?: number
  retryDelayMs?: number
  /** Tentativas de reenvio quando o Shellby cai. Erro de cota não entra aqui. */
  maxSendAttempts?: number
  retryBaseMs?: number
  log?: (msg: string) => void
}

const TRANSIENT = /Sem resposta do Shellby|fetch failed|indisponível|indisponivel|ECONNREFUSED|ETIMEDOUT|ECONNRESET|socket|AGENT_TARGET_LOST|AGENT_IDLE_EXPIRED|network/i

/** Cria o "drenador" de filas. Use um único processo por servidor (o MCP dndai-mestre). */
export function createMaster(transport: MasterTransport, opts: MasterOptions = {}) {
  const pollWaitMs = opts.pollWaitMs ?? 60_000
  const retryDelayMs = opts.retryDelayMs ?? 5_000
  const maxSendAttempts = opts.maxSendAttempts ?? 5
  const retryBaseMs = opts.retryBaseMs ?? 1000
  const log = opts.log ?? ((m: string) => console.error(`[mestre] ${m}`))
  let drainRef: (slug: string) => Promise<void> = async () => undefined
  const running = new Map<string, Promise<void>>()
  const owner = `${process.pid}-${randomUUID()}`

  const pollUntilDone = async (slug: string, scope: string, turnId: string): Promise<{ ok: true; response: string } | { ok: false; error: string }> => {
    let failures = 0
    let lastActivity = ""
    for (;;) {
      try {
        const r = await transport.poll(scope, turnId, pollWaitMs)
        failures = 0
        if (r.status === "completed") return { ok: true, response: r.response ?? "" }
        if (r.status === "failed") return { ok: false, error: r.error ?? "O Mestre falhou sem detalhes." }
        // Sem progresso visível por muito tempo costuma ser o ChatGPT esperando um clique humano
        // (ex.: "Allow ChatGPT to use Shellby MCP?") no Chrome do Shellby.
        // O Shellby desiste após 3 min parado (AGENT_IDLE_EXPIRED); avisamos antes.
        const stalled = (r.activityAgeMs ?? 0) > 45_000
        const activity = stalled
          ? `Parado há ${Math.round((r.activityAgeMs ?? 0) / 1000)}s: o ChatGPT pode estar pedindo aprovação ("Allow ChatGPT to use Shellby MCP?") no Chrome do Shellby — clique em "Always allow".`
          : (r.activity ?? "Working")
        if (activity !== lastActivity) {
          lastActivity = activity
          withChat(slug, (db) => tx(db, () => setMeta(db, "activity", activity)))
        }
      } catch (error) {
        if (++failures >= 6) return { ok: false, error: `Sem resposta do Shellby: ${(error as Error).message}` }
        log(`${slug}: falha ao consultar turno ${turnId} (${failures}/6): ${(error as Error).message}`)
        await sleep(retryDelayMs)
      }
    }
  }

  const finish = (slug: string, claim: string, outcome: { ok: true; response: string } | { ok: false; error: string }, sinceTurn: number) => {
    let result = outcome
    withChat(slug, (db) =>
      tx(db, () => {
        setMeta(db, "activity", "")
        db.prepare("DELETE FROM meta WHERE key = ?").run(`since:${claim}`)
        if (result.ok) log(`${slug}: resposta no chat (${result.response.length} caracteres): ${JSON.stringify(result.response.slice(0, 80))}`)
        const text = result.ok ? narrationFor(slug, sinceTurn, result.response) : null
        if (result.ok && text === null) result = { ok: false, error: "O Mestre respondeu sem gravar a narração no motor. Envie de novo." }
        if (result.ok) {
          db.prepare("UPDATE chat SET status = 'entregue' WHERE claim = ?").run(claim)
          db.prepare("INSERT INTO chat(role, text, status, created_at) VALUES('mestre', ?, 'entregue', ?)").run(text, new Date().toISOString())
          const { chapters, idle } = chapterCount(slug)
          if (idle && chapters > Number(meta(db, "chapters_at_boot", "0"))) {
            log(`${slug}: capítulo ${chapters} fechado, a próxima mensagem abre conversa nova do Mestre`)
            setMeta(db, "generation", Number(meta(db, "generation", "1")) + 1)
            setMeta(db, "ready", 0)
          }
        } else {
          const lost = /AGENT_TARGET_LOST|AGENT_IDLE_EXPIRED/.test(result.error)
          if (lost) {
            setMeta(db, "generation", Number(meta(db, "generation", "1")) + 1)
            setMeta(db, "ready", 0)
          }
          const row = db.prepare("SELECT attempts FROM chat WHERE claim = ?").get(claim) as { attempts: number } | undefined
          const attempts = (row?.attempts ?? 0) + 1
          if (TRANSIENT.test(result.error) && attempts < maxSendAttempts) {
            const wait = Math.min(60_000, retryBaseMs * 2 ** (attempts - 1))
            const retryAt = new Date(Date.now() + wait).toISOString()
            db.prepare("UPDATE chat SET status = 'fila', attempts = ?, retry_at = ?, error = ?, claim = NULL, turn_id = NULL WHERE claim = ?").run(attempts, retryAt, result.error, claim)
            setTimeout(() => void drainRef(slug), wait).unref()
          } else {
            db.prepare("UPDATE chat SET status = 'erro', error = ?, attempts = ? WHERE claim = ?").run(result.error, attempts, claim)
          }
        }
      })
    )
  }

  const ensureReady = async (slug: string, scope: string): Promise<void> => {
    const { ready, agent } = withChat(slug, (db) => ({ ready: meta(db, "ready") === "1", agent: agentId(db) }))
    if (ready) return
    const world = openCampaign(slug)
    const name = getMeta(world, "name", slug)
    world.close()
    log(`${slug}: abrindo conversa do Mestre (${agent})`)
    const turnId = await transport.submit(scope, agent, bootstrapPrompt(slug, name))
    const result = await pollUntilDone(slug, scope, turnId)
    if (!result.ok) throw new Error(`Falha ao preparar o Mestre: ${result.error}`)
    const { chapters } = chapterCount(slug)
    withChat(slug, (db) => tx(db, () => {
      setMeta(db, "ready", 1)
      setMeta(db, "chapters_at_boot", chapters)
    }))
  }

  const drainOnce = async (slug: string): Promise<boolean> => {
    const scope = scopeFor(slug)
    const claim = `${owner}-${randomUUID()}`
    const rows = withChat(slug, (db) =>
      tx(db, () => {
        // Um turno por vez na conversa (o Shellby recusaria com AGENT_BUSY).
        const busy = db.prepare("SELECT 1 FROM chat WHERE status IN ('enviando','aguardando') LIMIT 1").get()
        if (busy) return []
        db.prepare("UPDATE chat SET status = 'enviando', claim = ? WHERE status = 'fila' AND (retry_at IS NULL OR retry_at <= ?)").run(claim, new Date().toISOString())
        return db.prepare("SELECT role, text FROM chat WHERE claim = ? ORDER BY id").all(claim) as { role: string; text: string }[]
      })
    )
    if (!rows.length) return false
    const sinceTurn = lastNarrationId(slug)
    withChat(slug, (db) => tx(db, () => setMeta(db, `since:${claim}`, sinceTurn)))
    try {
      await ensureReady(slug, scope)
      const agent = withChat(slug, (db) => agentId(db))
      const turnId = await transport.submit(scope, agent, messagePrompt(slug, rows))
      withChat(slug, (db) => tx(db, () => db.prepare("UPDATE chat SET status = 'aguardando', turn_id = ? WHERE claim = ?").run(turnId, claim)))
      finish(slug, claim, await pollUntilDone(slug, scope, turnId), sinceTurn)
    } catch (error) {
      finish(slug, claim, { ok: false, error: (error as Error).message }, sinceTurn)
    }
    return true
  }

  /** Drena a fila da campanha (uma execução por vez por campanha neste processo). */
  const drain = (slug: string): Promise<void> => {
    const current = running.get(slug)
    if (current) return current
    const p = (async () => {
      try {
        while (await drainOnce(slug)) { /* continua enquanto houver mensagens */ }
      } finally {
        running.delete(slug)
      }
    })()
    running.set(slug, p)
    return p
  }

  /** Ao iniciar: reenfileira envios interrompidos e retoma os que já têm turno no Shellby. */
  const recover = (slugs: string[]): void => {
    for (const slug of slugs) {
      const pending = withChat(slug, (db) =>
        tx(db, () => {
          db.prepare("UPDATE chat SET status = 'fila', claim = NULL, error = '' WHERE status = 'enviando'").run()
          return db.prepare("SELECT DISTINCT turn_id, claim FROM chat WHERE status = 'aguardando'").all() as { turn_id: string; claim: string }[]
        })
      )
      for (const p of pending) {
        const claim = p.claim
        const job = (async () => {
          const sinceTurn = Number(withChat(slug, (db) => meta(db, `since:${claim}`, "0")))
          finish(slug, claim, await pollUntilDone(slug, scopeFor(slug), p.turn_id), sinceTurn)
          await drainOnceLoop(slug)
        })()
        running.set(slug, job.finally(() => running.delete(slug)))
      }
      if (!pending.length) void drain(slug)
    }
  }

  const drainOnceLoop = async (slug: string) => {
    while (await drainOnce(slug)) { /* continua */ }
  }

  /** Abre uma conversa nova no ChatGPT para a campanha (a anterior fica no histórico do ChatGPT). */
  const reset = (slug: string): void => {
    withChat(slug, (db) =>
      tx(db, () => {
        if (db.prepare("SELECT 1 FROM chat WHERE status IN ('enviando','aguardando')").get()) throw new Error("O Mestre está respondendo; aguarde para reiniciar.")
        setMeta(db, "generation", Number(meta(db, "generation", "1")) + 1)
        setMeta(db, "ready", 0)
      })
    )
  }

  drainRef = drain
  return { drain, recover, reset }
}
