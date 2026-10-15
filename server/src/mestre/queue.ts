// Fila de conversa jogador ⇄ Mestre (ChatGPT via Shellby), uma por campanha.
// Fica em chat.db, separado do world.db: `dnd undo` volta o mundo, mas não apaga a conversa
// (o ChatGPT também não esquece). Um único processo (o MCP dndai-mestre) drena a fila.
import { randomUUID } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import { join } from "node:path"
import { HOME } from "../core/campaign.ts"
import { all, one } from "../core/db.ts"
import { campaign, campaignExists } from "../store.ts"
import { emit } from "../events.ts"
import { context, resume } from "./context.ts"
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
  const db = new DatabaseSync(join(HOME, slug, "chat.db"))
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

/** Um agente por sessão do Shellby: o limite de agentes delegados é por sessão. */
const AGENT = "mestre"

function agentId(_db: DatabaseSync): string {
  return AGENT
}

/**
 * Sessão do Shellby (x-openai-session) da conversa atual. Cada conversa nova do Mestre (troca de capítulo,
 * conversa perdida, reinício) usa uma sessão nova com o mesmo agente. Girar o nome do agente na mesma
 * sessão esgotava o limite de agentes delegados do Shellby (AGENT_LIMIT_REACHED) depois de 4 conversas.
 */
export function scopeFor(slug: string, generation = 1): string {
  return `dndai-${slug}-${generation}`
}

function currentScope(slug: string): string {
  return scopeFor(slug, Number(withChat(slug, (db) => meta(db, "generation", "1"))))
}

/** Configuração de uma conversa nova do Mestre. Vai junto com a primeira mensagem (sem turno extra de "PRONTO"). */
function bootstrapLines(slug: string, name: string): string[] {
  return [
    `[dndai · campanha ${slug} · configuração]`,
    `Você é o Mestre da campanha "${name}" (slug ${slug}) do motor dndai (D&D 2024). As mensagens desta conversa chegam da mesa do jogador por um servidor; o jogador não vê este chat, só a narração que você grava no motor.`,
    `Antes de responder, leia as instruções com dnd_ler {o:"skill"} e siga-as à risca. Jogue só por dnd_ler/dnd_agir (sem shell), sempre com campanha "${slug}". Se a campanha tem livro de mundo, consulte dnd_ler {o:"mundo"} (e {o:"lore",q:...} para segredos) antes de inventar cenário. A memória da campanha e a cena atual vêm abaixo.`,
    "",
  ]
}

function messagePrompt(slug: string, rows: { role: string; text: string }[], opts: { setup?: string[]; scene: string; resume?: string }): string {
  const body = rows.map((r) => (r.role === "jogador" ? `Jogador: «${r.text}»` : `Mesa: ${r.text}`))
  return [
    ...(opts.setup ?? []),
    `[mesa dndai · campanha ${slug}]`,
    ...body,
    ...(opts.resume ? ["", "Memória da campanha (resume):", opts.resume] : []),
    "",
    "Cena (mesmo conteúdo de dnd_ler contexto; não precisa chamar de novo):",
    opts.scene,
    "",
    `Siga a skill: mecânica primeiro se houver incerteza, depois um dnd_agir com narration+summary que fecha o turno. A mesa exibe a narração gravada; não a repita no chat: sua resposta final é só ${DONE}.`,
  ].join("\n")
}

/** Resposta final do Mestre no Modo mesa: a narração já está no motor, o chat só confirma. */
const DONE = "✓"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function lastNarrationId(slug: string): number {
  return all<{ id: number | null }>(campaign(slug).db, "SELECT MAX(id) AS id FROM narrations")[0]?.id ?? 0
}

/** Texto a exibir: a narração gravada no motor durante esta resposta; senão a resposta do chat (sem avisos do Shellby). */
function narrationFor(slug: string, sinceId: number, response: string): string | null {
  const recorded = all<{ text: string }>(campaign(slug).db, "SELECT text FROM narrations WHERE id > ? ORDER BY id", sinceId)
  if (recorded.length) return recorded.map((t) => t.text).join("\n\n")
  const text = response.replace(/\n*\*\*Notice:\*\*[^\n]*/g, "").trim()
  return text && text !== DONE ? text : null
}

/** Conversa nova a cada capítulo fechado (o histórico do ChatGPT deixa de ser relido). Só entre turnos. */
function chapterCount(slug: string): { chapters: number; idle: boolean } {
  const db = campaign(slug).db
  return { chapters: all<{ n: number }>(db, "SELECT COUNT(*) AS n FROM chapters")[0]?.n ?? 0, idle: !one(db, "SELECT 1 FROM turns WHERE ended = 0") }
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
        emit(slug)
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

  /** Conversa nova? Devolve as linhas de configuração para irem junto com a mensagem. */
  const setupFor = (slug: string): string[] | undefined => {
    if (withChat(slug, (db) => meta(db, "ready") === "1")) return undefined
    log(`${slug}: abrindo conversa do Mestre (sessão ${currentScope(slug)})`)
    return bootstrapLines(slug, campaign(slug).info().name || slug)
  }

  /** `chapters`: quantos capítulos existiam quando a conversa abriu (um capítulo fechado na 1ª resposta já conta). */
  const markReady = (slug: string, chapters = chapterCount(slug).chapters): void => {
    withChat(slug, (db) => tx(db, () => {
      setMeta(db, "ready", 1)
      setMeta(db, "chapters_at_boot", chapters)
    }))
  }

  const drainOnce = async (slug: string): Promise<boolean> => {
    const scope = currentScope(slug)
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
      const setup = setupFor(slug)
      const chaptersAtSetup = chapterCount(slug).chapters
      const agent = withChat(slug, (db) => agentId(db))
      const w = campaign(slug)
      const retried = withChat(slug, (db) => (db.prepare("SELECT MAX(attempts) a FROM chat WHERE claim = ?").get(claim) as { a: number }).a > 0)
      const scene = context(w, { full: !!setup || retried })
      const turnId = await transport.submit(scope, agent, messagePrompt(slug, rows, { setup, scene, resume: setup ? resume(w) : undefined }))
      withChat(slug, (db) => tx(db, () => db.prepare("UPDATE chat SET status = 'aguardando', turn_id = ? WHERE claim = ?").run(turnId, claim)))
      const result = await pollUntilDone(slug, scope, turnId)
      if (setup && result.ok) markReady(slug, chaptersAtSetup)
      finish(slug, claim, result, sinceTurn)
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
          const result = await pollUntilDone(slug, currentScope(slug), p.turn_id)
          // A mensagem interrompida pode ter levado a configuração: a conversa já existe.
          if (result.ok) markReady(slug)
          finish(slug, claim, result, sinceTurn)
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
