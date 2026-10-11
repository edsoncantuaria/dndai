import { publish, retract, sync } from "./atlas.ts"
import { backupBeforeTurn, openCampaign, restoreBeforeTurn, snapshotCampaign, withCampaignLock } from "./campaign.ts"
import { closeIfNeeded } from "./chapters.ts"
import { all, type DB, getMeta, index, log, metaNum, setMeta, transaction } from "./db.ts"
import { assertWorld } from "./invariants.ts"
import { assertCanUndo, recordTurnClosed, recordUndo } from "./journal.ts"
import { assertNarration, expandRefs } from "./narration.ts"
import { captureSceneSnap, consolidationDue } from "./scene.ts"
import { markSeen } from "./threads.ts"
import { fmtMoney, getPlace, now, pcId, getCharacter } from "./world.ts"

function prepSealed(db: DB): boolean {
  return getMeta(db, "prep_sealed") === "1" || !!pcId(db)
}

export function requireOpenTurn(db: DB): void {
  // Preparação só existe antes do PC. Depois disso, turno 0 não aceita mutação
  // (inclusive se um undo voltar ao backup da preparação já com personagem).
  if (metaNum(db, "turn") === 0 && !prepSealed(db)) return
  if (getMeta(db, "turn_open") !== "1") {
    throw new Error('Nenhum turno aberto. Comece com: dnd turn begin --action "<o que o jogador fez/disse>"')
  }
}

export function beginTurn(db: DB, slug: string, action: string): string[] {
  if (!action.trim()) throw new Error("turn begin exige --action com a ação do jogador.")
  if (getMeta(db, "turn_open") === "1") {
    throw new Error(`O turno ${metaNum(db, "turn")} ainda está aberto. Feche com dnd turn end --summary "..." ou desfaça com dnd undo.`)
  }
  const pending = all<{ id: number; label: string }>(db, "SELECT id, label FROM roll_requests WHERE status = 'pendente'")
  if (pending.length) {
    throw new Error(`Há rolagem pendente na mesa (${pending.map((r) => `#${r.id} ${r.label}`).join(", ")}). O jogador precisa rolar antes de seguir.`)
  }
  const n = metaNum(db, "turn") + 1
  backupBeforeTurn(db, slug, n)
  const news = transaction(db, () => {
    if (getMeta(db, "turn_open") === "1") {
      throw new Error(`O turno ${metaNum(db, "turn")} ainda está aberto. Feche com dnd turn end --summary "..." ou desfaça com dnd undo.`)
    }
    const pendingNow = all<{ id: number; label: string }>(db, "SELECT id, label FROM roll_requests WHERE status = 'pendente'")
    if (pendingNow.length) {
      throw new Error(`Há rolagem pendente na mesa (${pendingNow.map((r) => `#${r.id} ${r.label}`).join(", ")}). O jogador precisa rolar antes de seguir.`)
    }
    db.prepare("INSERT INTO turns(n, started_min, action) VALUES(?,?,?)").run(n, now(db), action.trim())
    setMeta(db, "turn", n)
    setMeta(db, "turn_open", 1)
    db.prepare("UPDATE intents SET status = 'lida' WHERE status = 'pendente'").run()
    log(db, "turno", `Turno ${n} aberto: ${action.trim()}`)
    publish(db) // inclui o que foi criado na preparação (turno 0)
    return sync(db)
  })
  try {
    snapshotCampaign(slug, `turno-${n}`, db)
  } catch (error) {
    console.error(`[backup] ${slug}: ${(error as Error).message}`)
  }
  return [`Turno ${n} aberto. Backup salvo (dnd undo volta para antes deste turno).`, ...news]
}

/** Narração exibida na mesa. Pode ser gravada em partes durante o turno (ex.: antes de pedir uma rolagem). */
export function narrate(db: DB, raw: string): string[] {
  if (getMeta(db, "turn_open") !== "1") throw new Error("Não há turno aberto.")
  if (!raw.trim()) throw new Error("Narração vazia.")
  const text = expandRefs(db, raw)
  assertNarration(db, text)
  transaction(db, () => addNarration(db, metaNum(db, "turn"), text))
  return ["Narração registrada para a mesa."]
}

function addNarration(db: DB, turn: number, text: string): void {
  // O Mestre costuma reenviar no turn end o mesmo texto já gravado com narrate: não duplica na mesa.
  if (db.prepare("SELECT 1 FROM narrations WHERE turn = ? AND text = ?").get(turn, text.trim())) return
  db.prepare("INSERT INTO narrations(turn, text, at) VALUES(?, ?, ?)").run(turn, text.trim(), new Date().toISOString())
  const all = db.prepare("SELECT text FROM narrations WHERE turn = ? ORDER BY id").all(turn) as { text: string }[]
  db.prepare("UPDATE turns SET narration = ? WHERE n = ?").run(all.map((r) => r.text).join("\n\n"), turn)
}

export function endTurn(db: DB, summary: string, raw: string): string[] {
  if (getMeta(db, "turn_open") !== "1") throw new Error("Não há turno aberto.")
  const narration = expandRefs(db, raw)
  if (!narration.trim()) assertPlayerHasRead(db, metaNum(db, "turn"))
  if (summary.trim().length < 10) throw new Error("O resumo do turno precisa descrever o que aconteceu (mín. 10 caracteres). Ele é a memória de longo prazo.")
  if (narration.trim()) assertNarration(db, narration)
  const n = metaNum(db, "turn")
  const warnings: string[] = []
  const closed = transaction(db, () => {
    db.prepare("UPDATE turns SET summary = ?, ended = 1 WHERE n = ?").run(summary.trim(), n)
    if (narration.trim()) addNarration(db, n, narration)
    setMeta(db, "turn_open", 0)
    index(db, `turn:${n}`, "turno", summary.trim())
    log(db, "turno", `Turno ${n} fechado: ${summary.trim()}`)
    publish(db)
    markSeen(db)
    const chapter = closeIfNeeded(db)
    const soft = assertWorld(db)
    captureSceneSnap(db)
    return { chapter, soft }
  })
  recordTurnClosed(getMeta(db, "slug"), n)
  if (closed.chapter) warnings.push(closed.chapter)
  for (const soft of closed.soft) warnings.push(`Aviso: ${soft}`)
  const pendingRolls = all<{ id: number }>(db, "SELECT id FROM roll_requests WHERE status = 'pendente'")
  if (pendingRolls.length) warnings.push(`Atenção: rolagens pendentes na mesa: ${pendingRolls.map((r) => `#${r.id}`).join(", ")}.`)
  const due = all<{ id: number }>(db, "SELECT id FROM events WHERE status = 'vencido'")
  if (due.length) warnings.push(`Atenção: eventos vencidos não resolvidos: ${due.map((e) => `#${e.id}`).join(", ")}.`)
  const fired = all<{ id: string }>(db, "SELECT id FROM clocks WHERE status = 'disparado'")
  if (fired.length) warnings.push(`Atenção: agendas disparadas não resolvidas: ${fired.map((c) => c.id).join(", ")}.`)
  for (const due of consolidationDue(db, true)) warnings.push(`Pendente: consolide as memórias de ${due.name} (${due.code}, ${due.n} soltas) no próximo apply (memory.consolidate).`)
  const state = transaction(db, () => pcStateChange(db))
  return [`Turno ${n} fechado e registrado na crônica.`, ...(state ? [state] : []), ...warnings]
}

/**
 * O jogador só vê o que foi narrado. Fechar o turno depois de uma rolagem da mesa que ainda não foi
 * narrada deixaria o resultado só no resumo, que ele nunca lê. (Sem rolagem de mesa, a narração no
 * motor é opcional: no jogo direto no chat ela vai na própria conversa.)
 */
function assertPlayerHasRead(db: DB, turn: number): void {
  const last = all<{ at: string }>(db, "SELECT at FROM narrations WHERE turn = ? ORDER BY id DESC LIMIT 1", turn)[0]
  const rolls = all<{ id: number; result: string }>(db, "SELECT id, result FROM roll_requests WHERE created_turn = ? AND status = 'resolvida'", turn)
  const unread = rolls.filter((r) => {
    const out = JSON.parse(r.result) as { at: string; source?: string }
    return out.source === "mesa" && (!last || out.at >= last.at)
  })
  if (unread.length) {
    throw new Error(`A rolagem #${unread.map((r) => r.id).join(", #")} foi resolvida depois da última narração: o jogador ainda não viu o resultado. Feche com turn end --narration - narrando a consequência (com a linha 🎲).`)
  }
}

/** Desfaz o turno atual (aberto) ou o último fechado, restaurando o backup feito no turn begin. */
export function undoTurn(slug: string): string[] {
  return withCampaignLock(slug, () => undoTurnLocked(slug))
}

function undoTurnLocked(slug: string): string[] {
  const db = openCampaign(slug)
  const n = metaNum(db, "turn")
  const version = metaNum(db, "version")
  db.close()
  if (n === 0) throw new Error("Nada a desfazer.")
  assertCanUndo(slug)
  restoreBeforeTurn(slug, n)
  recordUndo(slug, n)
  const restored = openCampaign(slug)
  try {
    const retracted = transaction(restored, () => {
      setMeta(restored, "version", version + 1)
      log(restored, "turno", `Turno ${n} desfeito.`)
      return retract(restored, slug, n)
    })
    if (retracted) log(restored, "turno", `Atlas: ${retracted} publicação(ões) do turno ${n} retiradas.`)
    return [`Turno ${n} desfeito. Mundo restaurado ao estado anterior (turno atual: ${metaNum(restored, "turn")}).`]
  } finally {
    restored.close()
  }
}

/** Linha de conferência: onde o PC está e com o quê, segundo o motor (para comparar com a narração). */
export function pcStateLine(db: DB): string | undefined {
  const pid = pcId(db)
  if (!pid) return undefined
  const pc = getCharacter(db, pid)
  const place = pc.place_id ? getPlace(db, pc.place_id).name : "nenhum local"
  const present = all<{ name: string }>(db, "SELECT name FROM characters WHERE kind = 'npc' AND status <> 'morto' AND place_id = ?", pc.place_id ?? "").map((c) => c.name)
  return `Estado do PC no motor: ${pc.name} em ${place} · PV ${pc.hp}/${pc.max_hp} · ${fmtMoney(pc.cp)} · com ${present.join(", ") || "ninguém"}.`
}

/**
 * A linha de conferência só quando mudou desde a última que o Mestre viu: repetir a mesma linha a cada
 * apply só engorda a conversa. Chame dentro de transação.
 */
export function pcStateChange(db: DB): string | undefined {
  const line = pcStateLine(db)
  if (!line) return undefined
  if (getMeta(db, "pc_state_shown") === line) return "Estado do PC no motor: sem mudança."
  setMeta(db, "pc_state_shown", line)
  return line
}
