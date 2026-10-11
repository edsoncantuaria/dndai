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

function citedProblems(db: DB, text: string): string[] {
  const problems: string[] = []
  const known = knownTokens(db)
  let sentenceStart = true
  let cursor = 0
  for (const raw of text.matchAll(/\S+/g)) {
    const at = raw.index ?? 0
    if (/[.!?\n]/.test(text.slice(cursor, at))) sentenceStart = true
    cursor = at + raw[0].length
    const core = raw[0].replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "")
    if (!core) continue
    if (isShortCode(core) && !entityOfCode(db, core)) {
      problems.push(`A narração cita ${core}, que não existe. Consulte com show ou crie com apply.`)
    }
    if (/^\p{Lu}/u.test(core)) {
      const word = core.replace(/[^\p{L}]/gu, "")
      if (word.length >= 3) {
        const f = fold(word)
        const ok = known.has(f) || allowedToken(word) || (sentenceStart && STARTERS.has(f))
        if (!ok) problems.push(`"${word}" não é uma entidade do motor. Nomes novos só nascem via apply; cite quem já existe pelo nome que está no contexto.`)
      }
    }
    sentenceStart = false
  }
  return problems
}

export function assertNarration(db: DB, text: string): void {
  const problems = narrationProblems(db, text)
  if (!problems.length) return
  throw new Error(`Narração não publicada — contradiz o motor:\n${problems.map((p) => `- ${p}`).join("\n")}\nCorrija o texto e envie de novo. Nada foi gravado.`)
}
