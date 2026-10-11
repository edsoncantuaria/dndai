import { publish, retract, sync } from "./atlas.ts"
import { backupBeforeTurn, openCampaign, restoreBeforeTurn } from "./campaign.ts"
import { all, type DB, getMeta, index, log, metaNum, setMeta, transaction } from "./db.ts"
import { fmtMoney, getPlace, now, pcId, getCharacter } from "./world.ts"

export function requireOpenTurn(db: DB): void {
  if (metaNum(db, "turn") === 0) return // preparação da campanha (antes do 1º turno)
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
    throw new Error(`Há rolagem pendente na mesa (${pending.map((r) => `#${r.id} ${r.label}`).join(", ")}). O jogador precisa rolar antes de seguir; se a rolagem não fizer mais sentido, cancele com roll-cancel <id>.`)
  }
  const n = metaNum(db, "turn") + 1
  backupBeforeTurn(db, slug, n)
  const news = transaction(db, () => {
    db.prepare("INSERT INTO turns(n, started_min, action) VALUES(?,?,?)").run(n, now(db), action.trim())
    setMeta(db, "turn", n)
    setMeta(db, "turn_open", 1)
    db.prepare("UPDATE intents SET status = 'lida' WHERE status = 'pendente'").run()
    log(db, "turno", `Turno ${n} aberto: ${action.trim()}`)
    publish(db) // inclui o que foi criado na preparação (turno 0)
    return sync(db)
  })
  return [`Turno ${n} aberto. Backup salvo (dnd undo volta para antes deste turno).`, ...news]
}

/** Narração exibida na mesa. Pode ser gravada em partes durante o turno (ex.: antes de pedir uma rolagem). */
export function narrate(db: DB, text: string): string[] {
  if (getMeta(db, "turn_open") !== "1") throw new Error("Não há turno aberto.")
  if (!text.trim()) throw new Error("Narração vazia.")
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

export function endTurn(db: DB, summary: string, narration: string): string[] {
  if (getMeta(db, "turn_open") !== "1") throw new Error("Não há turno aberto.")
  if (summary.trim().length < 10) throw new Error("O resumo do turno precisa descrever o que aconteceu (mín. 10 caracteres). Ele é a memória de longo prazo.")
  const n = metaNum(db, "turn")
  const warnings: string[] = []
  transaction(db, () => {
    db.prepare("UPDATE turns SET summary = ?, ended = 1 WHERE n = ?").run(summary.trim(), n)
    if (narration.trim()) addNarration(db, n, narration)
    setMeta(db, "turn_open", 0)
    index(db, `turn:${n}`, "turno", summary.trim())
    log(db, "turno", `Turno ${n} fechado: ${summary.trim()}`)
    publish(db)
  })
  const pendingRolls = all<{ id: number }>(db, "SELECT id FROM roll_requests WHERE status = 'pendente'")
  if (pendingRolls.length) warnings.push(`Atenção: rolagens pendentes na mesa: ${pendingRolls.map((r) => `#${r.id}`).join(", ")}.`)
  const due = all<{ id: number }>(db, "SELECT id FROM events WHERE status = 'vencido'")
  if (due.length) warnings.push(`Atenção: eventos vencidos não resolvidos: ${due.map((e) => `#${e.id}`).join(", ")}.`)
  const fired = all<{ id: string }>(db, "SELECT id FROM clocks WHERE status = 'disparado'")
  if (fired.length) warnings.push(`Atenção: agendas disparadas não resolvidas: ${fired.map((c) => c.id).join(", ")}.`)
  const state = pcStateLine(db)
  return [`Turno ${n} fechado e registrado na crônica.`, ...(state ? [state] : []), ...warnings]
}

/** Desfaz o turno atual (aberto) ou o último fechado, restaurando o backup feito no turn begin. */
export function undoTurn(slug: string): string[] {
  const db = openCampaign(slug)
  const n = metaNum(db, "turn")
  const version = metaNum(db, "version")
  db.close()
  if (n === 0) throw new Error("Nada a desfazer.")
  restoreBeforeTurn(slug, n)
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
