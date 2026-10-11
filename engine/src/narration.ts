// A narração só é publicada se não contradizer o estado. O Mestre corrige e reenvia.
import { entityOfCode, isShortCode } from "./codes.ts"
import { all, type DB } from "./db.ts"
import { ABILITY_NAMES, CLASSES, SKILLS } from "./rules.ts"
import { getCharacter, pcId } from "./world.ts"

function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()
}

function mentions(phrase: string, name: string): boolean {
  const n = fold(name)
  if (n.length < 3) return false
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(^|\\s)${esc}(\\s|$)`).test(fold(phrase))
}

function sentencesOf(name: string, text: string): string[] {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp(`\\b${esc}\\b`, "i")
  return text.split(/[.!?\n]/).filter((s) => re.test(s))
}

const DEAD_OK = /corpo|cadáver|cadaver|morto|morta|jaz|jaze|restos|túmulo|tumulo|lembrança|lembra|memória|memoria|foi |era /i

export function narrationProblems(db: DB, text: string): string[] {
  const problems: string[] = []
  const clean = text.trim()
  if (clean.length < 2) return problems

  for (const row of all<{ id: string; name: string }>(db, "SELECT id, name FROM characters WHERE status = 'morto'")) {
    if (row.name.trim().length < 3) continue
    const hits = sentencesOf(row.name, clean)
    if (hits.some((s) => !DEAD_OK.test(s))) {
      problems.push(`${row.name} está morto e a narração o trata como se agisse. Fale do corpo, ou não o faça agir.`)
    }
  }

  const pid = pcId(db)
  if (!pid) return problems
  const pc = getCharacter(db, pid)
  const here = /você está (?:na|no|em) ([^.,;\n]+)/i.exec(clean)
  if (here && pc.place_id) {
    const places = all<{ id: string; name: string }>(db, "SELECT id, name FROM places")
    const hit = places.find((p) => mentions(here[1], p.name))
    if (hit && hit.id !== pc.place_id) {
      const current = places.find((p) => p.id === pc.place_id)
      problems.push(`A narração coloca o PC em ${hit.name}, mas o motor o tem em ${current?.name ?? pc.place_id}. Use move ou corrija o texto.`)
    }
  }

  const used = /você (?:saca|empunha|bebe|usa|veste|come|calça) (?:a |o |sua |seu |um |uma )?([^.,;\n]+)/i.exec(clean)
  if (used) {
    const items = all<{ name: string; owner_char: string | null }>(db, "SELECT name, owner_char FROM items")
    const hit = items.find((i) => mentions(used[1], i.name))
    if (hit && hit.owner_char !== pid) {
      problems.push(`A narração usa ${hit.name}, mas esse item não está com o PC.`)
    }
  }

  problems.push(...citedProblems(db, clean))
  return problems
}

const STARTERS = new Set(
  "voce tu ele ela eles elas o a os as um uma uns umas no na nos nas de do da dos das e mas entao depois quando se por para com sem dia noite manha tarde faca paragrafo enquanto antes agora ali aqui isso isto tudo nada alguem ninguem ha houve era foi sao esta estao seu sua seus suas ao aos em ou nem logo ainda ja tambem porem contudo todavia assim teste rolagem ataque dano cura magia".split(" "),
)

function allowedToken(token: string): boolean {
  const f = fold(token)
  if (STARTERS.has(f)) return true
  if (["cd", "ca", "pv", "xp", "pc", "npc", "mestre", "jogador"].includes(f)) return true
  for (const skill of Object.values(SKILLS)) {
    if (skill.label.split(/\s+/).some((w) => fold(w) === f)) return true
  }
  for (const cls of Object.values(CLASSES)) if (fold(cls.label) === f) return true
  for (const name of Object.values(ABILITY_NAMES)) if (fold(name) === f) return true
  return false
}

function knownTokens(db: DB): Set<string> {
  const known = new Set<string>()
  const add = (name: string) => {
    for (const part of name.split(/\s+/)) {
      const f = fold(part.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""))
      if (f.length >= 3) known.add(f)
    }
  }
  for (const row of all<{ name: string }>(db, "SELECT name FROM characters UNION ALL SELECT name FROM places UNION ALL SELECT name FROM factions UNION ALL SELECT name FROM items UNION ALL SELECT title AS name FROM quests")) {
    add(row.name)
  }
  return known
}

/**
 * Nome próprio no meio da frase precisa existir no motor. A primeira palavra de uma frase ou de uma fala
 * (depois de travessão, aspas de abertura ou marca de voz) é maiúscula por ortografia e passa.
 */
function citedProblems(db: DB, raw: string): string[] {
  const problems: string[] = []
  const known = knownTokens(db)
  const text = raw.replace(/\{[mf]\}/g, " ")
  let start = true
  let cursor = 0
  const unknown = new Set<string>()
  const openers = new Map<string, [string, number]>()
  for (const match of text.matchAll(/\S+/g)) {
    const token = match[0]
    const at = match.index ?? 0
    if (text.slice(cursor, at).includes("\n")) start = true
    cursor = at + token.length
    const core = token.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "")
    if (!core) {
      if (/^[—–“«"]/.test(token)) start = true
      continue
    }
    const opensSpeech = /^[—–“«"]/.test(token)
    if (isShortCode(core) && !entityOfCode(db, core)) {
      problems.push(`A narração cita ${core}, que não existe. Consulte com show ou crie com apply.`)
    }
    const word = core.replace(/[^\p{L}]/gu, "")
    if (/^\p{Lu}/u.test(core) && word.length >= 3 && !known.has(fold(word)) && !allowedToken(word)) {
      if (!start && !opensSpeech) unknown.add(word)
      else openers.set(fold(word), [word, (openers.get(fold(word))?.[1] ?? 0) + 1])
    }
    start = /[.!?:…][”»"')\]]*$/.test(token)
  }
  // Abertura repetida em mais de uma frase costuma ser nome (“Zorvak ergue… Zorvak ri.”), não ortografia.
  for (const [word, n] of openers.values()) if (n >= 2) unknown.add(word)
  for (const word of unknown) {
    problems.push(`"${word}" não é uma entidade do motor. Nomes novos só nascem via apply; cite quem já existe pelo nome que está no contexto.`)
  }
  return problems
}

const NAME_SQL: Record<string, string> = {
  pc: "SELECT name FROM characters WHERE id = ?",
  npc: "SELECT name FROM characters WHERE id = ?",
  place: "SELECT name FROM places WHERE id = ?",
  item: "SELECT name FROM items WHERE id = ?",
  faction: "SELECT name FROM factions WHERE id = ?",
  quest: "SELECT title AS name FROM quests WHERE id = ?",
  clock: "SELECT name FROM clocks WHERE id = ?",
}

/**
 * `{n1}` na narração vira o nome que está no motor ("Bram"). O Mestre escreve o id curto e a mesa
 * recebe o nome exato. As marcas de voz `{m}`/`{f}` não são ids e ficam como estão.
 */
export function expandRefs(db: DB, text: string): string {
  return text.replace(/\{(pc|[nlifqhkg]\d+)\}/g, (_, code: string) => {
    const entity = entityOfCode(db, code)
    if (!entity) throw new Error(`A narração cita {${code}}, que não existe. Consulte com show ou crie com apply. Nada foi gravado.`)
    const sql = NAME_SQL[entity.split(":")[0]]
    const name = sql ? (all<{ name: string }>(db, sql, entity)[0]?.name) : undefined
    if (!name) throw new Error(`{${code}} não tem nome para exibir (fatos e ganchos não entram na narração por id). Nada foi gravado.`)
    return name
  })
}

/** Nomes próprios que o motor não conhece e ids curtos inexistentes (sem as regras de cena). */
export function unknownNames(db: DB, text: string): string[] {
  return citedProblems(db, text)
}

export function assertNarration(db: DB, text: string): void {
  const problems = narrationProblems(db, text)
  if (!problems.length) return
  throw new Error(`Narração não publicada — contradiz o motor:\n${problems.map((p) => `- ${p}`).join("\n")}\nCorrija o texto e envie de novo. Nada foi gravado.`)
}
