// CLI `dnd`: interface do Mestre (ChatGPT via Shellby) com o motor.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { join } from "node:path"
import { atlasStats, publish, sync } from "./atlas.ts"
import { campaignsHome, createCampaign, listCampaigns, openCampaign, resolveCampaign } from "./campaign.ts"
import { startConnector } from "./connector.ts"
import { buildContext, recall, resume, showEntity } from "./context.ts"
import { all, type DB, transaction } from "./db.ts"
import { roll } from "./dice.ts"
import {
  cancelRequest, deathSave, levelUp, longRest, parseCheckKey, parseMode, pendingRequests, requestRoll, resolveCharRef,
  type RollSpec, rollNow, shortRest,
} from "./mechanics.ts"
import { applyItemAction, ITEM_ACTIONS } from "./items.ts"
import { applyOps, parseOps } from "./ops.ts"
import { createPc } from "./pc.ts"
import { parseAbility } from "./rules.ts"
import { startMasterServer } from "./master/mcp.ts"
import { startServer } from "./server.ts"
import { advanceTime, endCombat, getCombat, nextTurn, startCombat } from "./simulation.ts"
import { searchSrd } from "./srd.ts"
import { beginTurn, endTurn, narrate, pcStateLine, requireOpenTurn, undoTurn } from "./turns.ts"
import { getCharacter, parseDuration, pcId, resolveRef } from "./world.ts"

const BOOL_FLAGS = new Set(["adv", "dis", "mesa", "spell", "roll", "help"])

interface Args {
  pos: string[]
  flags: Record<string, string | true>
  /** Entrada padrão já lida (chamadas pelo conector MCP, sem processo/stdin). */
  input?: string
}

function parseArgs(argv: string[]): Args {
  const pos: string[] = []
  const flags: Record<string, string | true> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "-c") {
      flags.c = argv[++i] ?? ""
    } else if (a.startsWith("--")) {
      const [k, inline] = a.slice(2).split(/=(.*)/s, 2)
      if (inline !== undefined) flags[k] = inline
      else if (BOOL_FLAGS.has(k) || i + 1 >= argv.length || argv[i + 1].startsWith("--")) flags[k] = true
      else flags[k] = argv[++i]
    } else pos.push(a)
  }
  return { pos, flags }
}

function str(args: Args, key: string): string | undefined {
  const v = args.flags[key]
  return typeof v === "string" ? v : undefined
}

function num(args: Args, key: string): number | undefined {
  const v = str(args, key)
  if (v === undefined) return undefined
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error(`--${key} precisa ser número.`)
  return n
}

function readInput(args: Args): string {
  if (args.input !== undefined) return args.input
  const inline = str(args, "json")
  if (inline) return inline
  const file = str(args, "file")
  if (file) return readFileSync(file, "utf8")
  if (process.stdin.isTTY) throw new Error("Envie o JSON pela entrada padrão (heredoc <<'EOF' ... EOF), --json ou --file.")
  return readFileSync(0, "utf8")
}

function readJson(args: Args): unknown {
  const raw = readInput(args)
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new Error(`JSON inválido: ${(error as Error).message}`)
  }
}

const HELP = `dnd — motor de mundo do dndai (fonte única de verdade). Campanha: export DND_CAMPAIGN=<slug> ou -c <slug>.

Campanha:   campaign new <slug> --name N --premise P [--tone T] · campaign list
Leitura:    context · resume · show <ref> · recall <termos> · rolls · log [n] · validate · atlas [sync]
PC:         pc create  (JSON via stdin)
Turno:      turn begin --action "..." · narrate (stdin) · turn end --summary "..." [--narration "..."|--narration -] · undo
Mundo:      apply  (lote JSON via stdin; ver skill) · time <30m|2h|1d>
Testes:     check <quem> <perícia|atributo> [--dc N] [--adv|--dis] [--bonus N] [--reason R] [--mesa] [--values 14]
            save <quem> <atributo> [--dc N] ... · deathsave <quem> [--mesa]
Combate:    attack <atacante> <alvo> [--with arma|ataque] [--spell --damage 1d10] [--adv|--dis] [--bonus N] [--mesa]
            damage <alvo> <expr> [--by quem] [--mesa] · roll <expr> [--reason R] [--mesa]
            combat start <ids...> · combat next · combat end · combat status
Recursos:   rest short|long [quem] [--dice N] · levelup <quem> [--roll] · roll-cancel <id>
Itens:      item usar|equipar|guardar|empunhar|embainhar|largar <item>   (mesma regra da mesa)
SRD:        srd monster|spell <busca>
Mesa:       serve [--port 8790] [--host 127.0.0.1] [--static ../mesa/dist] [--token T]
Mestre:     mestre [--port 8791] [--host 127.0.0.1] [--token T]   (MCP dndai-mestre: mesa → Shellby → ChatGPT)
Conector:   conector [--port 8794]   (MCP "dndai" para o ChatGPT: ferramentas do jogo sem shell)
--mesa envia o pedido de rolagem para o jogador rolar os dados 3D na mesa; o resultado aparece em "dnd rolls"/"dnd context".`

function withCampaign<T>(args: Args, fn: (db: DB, slug: string) => T): T {
  const slug = resolveCampaign(str(args, "c"))
  const db = openCampaign(slug)
  try {
    return fn(db, slug)
  } finally {
    db.close()
  }
}

/** Mutação: exige turno aberto (ou fase de preparação) e roda atomicamente. */
function mutate(args: Args, fn: (db: DB, slug: string) => string | string[]): string {
  return withCampaign(args, (db, slug) => {
    requireOpenTurn(db)
    const out = transaction(db, () => {
      const r = fn(db, slug)
      publish(db) // o que o universo criou entra no multiverso na mesma transação
      return r
    })
    return Array.isArray(out) ? out.join("\n") : out
  })
}

function rollOrRequest(args: Args, spec: RollSpec): string {
  return mutate(args, (db) => {
    if (args.flags.mesa) return requestRoll(db, spec).text
    const values = str(args, "values")?.split(",").map((v) => Number(v.trim()))
    return rollNow(db, spec, values).text
  })
}

/** Executa um comando `dnd` e devolve a saída (lança erro com mensagem PT-BR). */
export function runCli(argv: string[], input?: string): string {
  const args = parseArgs(argv)
  args.input = input
  const [cmd, sub, ...rest] = args.pos
  if (!cmd || cmd === "help" || args.flags.help) return HELP
  const mode = () => parseMode(!!args.flags.adv, !!args.flags.dis)
  const reason = () => str(args, "reason") ?? ""

  switch (cmd) {
    case "campaign": {
      if (sub === "list") {
        const list = listCampaigns()
        return list.length ? list.map((c) => `${c.slug} — ${c.name}`).join("\n") : "Nenhuma campanha."
      }
      if (sub === "new") {
        const slug = rest[0]
        const name = str(args, "name")
        const premise = str(args, "premise")
        if (!slug || !name || !premise) throw new Error('Uso: dnd campaign new <slug> --name "Nome" --premise "Premissa" [--tone "Tom"]')
        createCampaign(slug, { name, premise, tone: str(args, "tone") ?? "" }).close()
        const db = openCampaign(slug)
        const s = atlasStats(db)!
        db.close()
        return `Campanha "${name}" criada [${slug}] com o multiverso atual: ${s.places} locais, ${s.npcs} NPCs, ${s.factions} facções, ${s.lore} fatos de lore. Escolha (ou crie) o local inicial e crie o PC (pc create).`
      }
      throw new Error("Uso: dnd campaign new|list")
    }
    case "atlas": {
      // Sincronizar/publicar não muda a narrativa: permitido também entre turnos.
      if (sub === "sync")
        return withCampaign(args, (db) => transaction(db, () => [...publish(db), ...sync(db)].join("\n") || "Multiverso: nada novo."))
      return withCampaign(args, (db) => {
        const s = atlasStats(db)!
        return `Multiverso compartilhado: ${s.places} locais, ${s.npcs} NPCs (inclui heróis de outros jogadores), ${s.factions} facções, ${s.lore} fatos de lore, criados por ${s.campaigns} crônica(s). Novidades entram sozinhas a cada turn begin (ou: dnd atlas sync).`
      })
    }
    case "skill":
      return readFileSync(join(import.meta.dirname, "..", "skill", "SKILL.md"), "utf8")
    case "context":
      return withCampaign(args, (db, slug) => buildContext(db, slug))
    case "resume":
      return withCampaign(args, (db, slug) => resume(db, slug))
    case "show":
      if (!sub) throw new Error("Uso: dnd show <id|nome>")
      return withCampaign(args, (db) => {
        const id = sub.includes(":") ? sub : (() => {
          for (const kinds of [["npc", "pc"], ["place"], ["faction"], ["quest"], ["item"], ["clock"]]) {
            try {
              return resolveRef(db, [sub, ...rest].join(" "), kinds)
            } catch { /* tenta o próximo tipo */ }
          }
          throw new Error(`"${[sub, ...rest].join(" ")}" não encontrado. Use dnd recall para buscar.`)
        })()
        return showEntity(db, id)
      })
    case "recall":
      if (!sub) throw new Error("Uso: dnd recall <termos>")
      return withCampaign(args, (db) => recall(db, [sub, ...rest].join(" ")))
    case "rolls":
      return withCampaign(args, (db) => {
        const pending = pendingRequests(db).map((r) => `⏳ #${r.id} ${r.label} — aguardando o jogador na mesa`)
        const done = all<{ id: number; result: string }>(db, "SELECT id, result FROM roll_requests WHERE status = 'resolvida' ORDER BY id DESC LIMIT 8")
          .reverse()
          .map((r) => {
            const o = JSON.parse(r.result) as { text: string; source: string }
            return `✔ #${r.id} [${o.source}] ${o.text.replaceAll("\n", " · ")}`
          })
        return [...done, ...pending].join("\n") || "Nenhuma rolagem."
      })
    case "log":
      return withCampaign(args, (db) =>
        all<{ turn: number; kind: string; text: string }>(db, "SELECT * FROM (SELECT * FROM log ORDER BY id DESC LIMIT ?) ORDER BY id", Number(sub ?? 30))
          .map((l) => `T${l.turn} [${l.kind}] ${l.text}`).join("\n")
      )
    case "validate":
      return withCampaign(args, (db) => {
        const problems: string[] = []
        const integrity = all<{ integrity_check: string }>(db, "PRAGMA integrity_check")
        if (integrity[0]?.integrity_check !== "ok") problems.push(`integridade: ${JSON.stringify(integrity)}`)
        for (const fk of all<Record<string, unknown>>(db, "PRAGMA foreign_key_check")) problems.push(`chave estrangeira: ${JSON.stringify(fk)}`)
        for (const c of all<{ id: string }>(db, "SELECT id FROM characters WHERE status = 'vivo' AND hp = 0")) problems.push(`${c.id} vivo com 0 PV`)
        for (const c of all<{ id: string }>(db, "SELECT id FROM characters WHERE hp > max_hp")) problems.push(`${c.id} com PV acima do máximo`)
        return problems.length ? problems.join("\n") : "Mundo íntegro."
      })
    case "pc":
      if (sub !== "create") throw new Error("Uso: dnd pc create (JSON via stdin)")
      return mutate(args, (db) => createPc(db, readJson(args)))
    case "turn":
      if (sub === "begin") {
        const action = str(args, "action")
        if (!action) throw new Error('Uso: dnd turn begin --action "o que o jogador fez/disse"')
        return withCampaign(args, (db, slug) => beginTurn(db, slug, action).join("\n"))
      }
      if (sub === "end") {
        const summary = str(args, "summary")
        if (!summary) throw new Error('Uso: dnd turn end --summary "resumo factual do que aconteceu" [--narration "texto"|-]')
        let narration = str(args, "narration") ?? ""
        if (narration === "-") narration = args.input ?? readFileSync(0, "utf8")
        return withCampaign(args, (db) => endTurn(db, summary, narration).join("\n"))
      }
      throw new Error("Uso: dnd turn begin|end")
    case "narrate": {
      const text = str(args, "text") ?? readInput(args)
      return withCampaign(args, (db) => narrate(db, text).join("\n"))
    }
    case "undo":
      return undoTurn(resolveCampaign(str(args, "c"))).join("\n")
    case "apply":
      return mutate(args, (db) => {
        const out = applyOps(db, parseOps(readJson(args)))
        const state = pcStateLine(db)
        return state ? [...out, `${state} Confira com a narração antes do turn end.`] : out
      })
    case "time":
      if (!sub) throw new Error("Uso: dnd time <30m|2h|1d>")
      return mutate(args, (db) => advanceTime(db, parseDuration(sub)))
    case "check":
    case "save": {
      const [who, key] = [sub, rest[0]]
      if (!who || !key) throw new Error(`Uso: dnd ${cmd} <quem> <${cmd === "check" ? "perícia|atributo" : "atributo"}> [--dc N]`)
      return withCampaignResolve(args, who, (id) => {
        let kind: "pericia" | "atributo" | "resistencia"
        let k: string
        if (cmd === "save") {
          const a = parseAbility(key)
          if (!a) throw new Error(`Atributo inválido: ${key}`)
          kind = "resistencia"
          k = a
        } else ({ kind, key: k } = parseCheckKey(key))
        return rollOrRequest(args, { kind, who: id, key: k, dc: num(args, "dc") ?? null, mode: mode(), bonus: num(args, "bonus") ?? 0, reason: reason() })
      })
    }
    case "attack": {
      const [attacker, target] = [sub, rest[0]]
      if (!attacker || !target) throw new Error("Uso: dnd attack <atacante> <alvo> [--with arma] [--adv|--dis]")
      const ids = withCampaign(args, (db) => [resolveCharRef(db, attacker), resolveCharRef(db, target)])
      return rollOrRequest(args, {
        kind: "ataque", who: ids[0], target: ids[1], with: str(args, "with") ?? null, spell: !!args.flags.spell,
        damage: str(args, "damage") ?? null, mode: mode(), bonus: num(args, "bonus") ?? 0, reason: reason(),
      })
    }
    case "damage": {
      const [target, expr] = [sub, rest[0]]
      if (!target || !expr) throw new Error("Uso: dnd damage <alvo> <expr> [--by quem]")
      const ids = withCampaign(args, (db) => [resolveCharRef(db, str(args, "by") ?? "pc"), resolveCharRef(db, target)])
      return rollOrRequest(args, { kind: "dano", who: ids[0], target: ids[1], expr, reason: reason() })
    }
    case "roll": {
      if (!sub) throw new Error("Uso: dnd roll <expr>")
      if (!args.flags.mesa) {
        roll(sub) // valida a expressão
      }
      const who = withCampaign(args, (db) => resolveCharRef(db, str(args, "by") ?? "pc"))
      return rollOrRequest(args, { kind: "livre", who, expr: sub, reason: reason() })
    }
    case "item": {
      if (!sub || !rest.length) throw new Error(`Uso: dnd item <${ITEM_ACTIONS.join("|")}> <item>`)
      return mutate(args, (db) => applyItemAction(db, sub, rest.join(" ")))
    }
    case "roll-cancel":
      return mutate(args, (db) => cancelRequest(db, Number(sub)))
    case "deathsave": {
      const who = withCampaign(args, (db) => resolveCharRef(db, sub ?? "pc"))
      if (args.flags.mesa) return mutate(args, (db) => requestRoll(db, { kind: "morte", who, reason: reason() }).text)
      return mutate(args, (db) => deathSave(db, who, undefined, num(args, "value")))
    }
    case "rest": {
      if (sub !== "short" && sub !== "long") throw new Error("Uso: dnd rest short|long [quem] [--dice N]")
      return mutate(args, (db) => {
        const ids = rest[0]
          ? [resolveCharRef(db, rest[0])]
          : [pcId(db)!, ...all<{ id: string }>(db, "SELECT id FROM characters WHERE companion = 1 AND status <> 'morto'").map((c) => c.id)]
        if (getCombat(db)) throw new Error("Não é possível descansar em combate.")
        const out = ids.map((id) => (sub === "long" ? longRest(db, id) : shortRest(db, id, num(args, "dice") ?? 0)))
        out.push(...advanceTime(db, sub === "long" ? 480 : 60))
        return out
      })
    }
    case "levelup":
      return mutate(args, (db) => levelUp(db, resolveCharRef(db, sub ?? "pc"), args.flags.roll ? "rolar" : "media"))
    case "combat":
      if (sub === "status")
        return withCampaign(args, (db) => {
          const c = getCombat(db)
          if (!c) return "Sem combate."
          return [`Rodada ${c.round}`, ...c.order.map((o, i) => {
            const ch = getCharacter(db, o.id)
            return `${i === c.index ? "▶" : " "} ${o.init} ${ch.name} [${ch.id}] ${ch.hp}/${ch.max_hp} PV CA ${ch.ac} ${ch.status}`
          })].join("\n")
        })
      if (sub === "start") return mutate(args, (db) => startCombat(db, rest.map((r) => resolveCharRef(db, r))))
      if (sub === "next") return mutate(args, (db) => nextTurn(db))
      if (sub === "end") return mutate(args, (db) => endCombat(db))
      throw new Error("Uso: dnd combat start|next|end|status")
    case "srd": {
      if ((sub !== "monster" && sub !== "spell") || !rest.length) throw new Error("Uso: dnd srd monster|spell <busca>")
      const found = searchSrd(sub === "monster" ? "monsters" : "spells", rest.join(" "))
      if (!found.length) return "Nada encontrado."
      if (found.length > 1) return found.map((f) => `${f.index} — ${f.name}`).join("\n")
      return JSON.stringify(found[0], null, 1).slice(0, 6000)
    }
    case "serve": {
      const port = num(args, "port") ?? 8790
      const host = str(args, "host") ?? "127.0.0.1"
      const token = str(args, "token") ?? process.env.DNDAI_TOKEN
      if (host !== "127.0.0.1" && host !== "localhost" && !token) throw new Error("Expor fora do loopback exige --token ou DNDAI_TOKEN.")
      startServer({ host, port, staticDir: str(args, "static"), token, corsOrigins: (process.env.DNDAI_CORS_ORIGINS ?? "").split(",").filter(Boolean) })
      return `Mesa: http://${host}:${port} (API em /api)${token ? " — protegida por token" : ""}`
    }
    case "conector": {
      const port = num(args, "port") ?? 8794
      const host = str(args, "host") ?? "127.0.0.1"
      const file = join(campaignsHome(), "conector-secret")
      if (!existsSync(file)) {
        mkdirSync(campaignsHome(), { recursive: true })
        writeFileSync(file, randomBytes(32).toString("hex"), { mode: 0o600 })
      }
      const secret = readFileSync(file, "utf8").trim()
      startConnector({ host, port, secret })
      return `Conector MCP dndai (ChatGPT) em http://${host}:${port}/mcp/<segredo> — o segredo fica em ${file} (não compartilhe). Publique por um túnel HTTPS e cadastre no Developer Mode do ChatGPT com "No Auth".`
    }
    case "mestre": {
      const port = num(args, "port") ?? 8791
      const host = str(args, "host") ?? "127.0.0.1"
      const token = str(args, "token") ?? process.env.DNDAI_MESTRE_TOKEN
      if (host !== "127.0.0.1" && host !== "localhost" && !token) throw new Error("Expor fora do loopback exige --token ou DNDAI_MESTRE_TOKEN.")
      startMasterServer({ host, port, token })
      return `MCP dndai-mestre: http://${host}:${port}/mcp → Shellby ${process.env.DNDAI_SHELLBY_URL ?? "http://127.0.0.1:3333/mcp"}`
    }
    default:
      throw new Error(`Comando desconhecido: ${cmd}. Veja: dnd help`)
  }
}

function withCampaignResolve(args: Args, who: string, fn: (id: string) => string): string {
  const id = withCampaign(args, (db) => resolveCharRef(db, who))
  return fn(id)
}

if (import.meta.main) {
  try {
    const out = runCli(process.argv.slice(2))
    if (out) process.stdout.write(`${out}\n`)
  } catch (error) {
    process.stderr.write(`ERRO: ${(error as Error).message}\n`)
    process.exitCode = 1
  }
}
