// A narração só é publicada se não contradisser o estado. O Mestre corrige e reenvia; nada é gravado.
import type { Campaign } from "../core/campaign.ts"
import { all } from "../core/db.ts"

const fold = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const mentions = (phrase: string, name: string): boolean => fold(name).length >= 3 && new RegExp(`(^|\\s)${esc(fold(name))}(\\s|$)`).test(fold(phrase))
const sentencesOf = (name: string, text: string): string[] => text.split(/[.!?\n]/).filter((s) => new RegExp(`\\b${esc(name)}\\b`, "i").test(s))

const DEAD_OK = /corpo|cadáver|cadaver|morto|morta|jaz|jaze|restos|túmulo|tumulo|lembrança|lembra|memória|memoria|foi |era /i
const REF_RE = /\{(pc|[nmliq]\d+)\}/g
const CODE_RE = /^(pc|[nmliq]\d+)$/

const NAME_SQL: Record<string, string> = {
  p: "SELECT name FROM characters WHERE id = ?", n: "SELECT name FROM characters WHERE id = ?", m: "SELECT name FROM characters WHERE id = ?",
  l: "SELECT name FROM places WHERE id = ?", i: "SELECT name FROM items WHERE id = ?", q: "SELECT title AS name FROM quests WHERE id = ?",
}
const nameOf = (c: Campaign, code: string): string | undefined => (c.db.prepare(NAME_SQL[code[0]!]!).get(code) as { name: string } | undefined)?.name

/** `{n1}` vira o nome exato do motor. As marcas de voz `{m}`/`{f}` não são ids e ficam. */
export function expandRefs(c: Campaign, text: string): string {
  return text.replace(REF_RE, (_, code: string) => nameOf(c, code) ?? ((): never => { throw new Error(`A narração cita {${code}}, que não existe. Crie antes (create.*) ou consulte o contexto. Nada foi gravado.`) })())
}

const STARTERS = new Set("voce tu ele ela eles elas o a os as um uma uns umas no na nos nas de do da dos das e mas nao entao depois quando se por para com sem dia noite manha tarde faca paragrafo enquanto antes agora ali aqui isso isto tudo nada alguem ninguem ha houve era foi sao esta estao seu sua seus suas ao aos em ou nem logo ainda ja tambem porem contudo todavia assim teste rolagem ataque dano cura magia sul norte leste oeste deus deuses rei rainha senhor senhora lorde lady".split(" "))

function srdTokens(c: Campaign): Set<string> {
  const out = new Set<string>()
  const rows = c.srd.db.prepare("SELECT name FROM srd WHERE coll IN ('monsters','spells','equipment','magic-items','classes','species','subspecies','conditions','skills','ability-scores','damage-types','backgrounds','feats','languages','magic-schools','alignments','subclasses','features','traits')").all() as { name: string }[]
  for (const r of rows) for (const w of r.name.split(/[\s:'’-]+/)) { const f = fold(w.replace(/[^\p{L}]/gu, "")); if (f.length >= 3) out.add(f) }
  return out
}
let srdCache: { c: Campaign; set: Set<string> } | undefined

function knownTokens(c: Campaign): Set<string> {
  if (srdCache?.c !== c) srdCache = { c, set: srdTokens(c) }
  const known = new Set(srdCache.set)
  const rows = all<{ name: string }>(c.db, "SELECT name FROM characters UNION ALL SELECT name FROM places UNION ALL SELECT name FROM items UNION ALL SELECT title AS name FROM quests")
  for (const r of rows) for (const part of r.name.split(/\s+/)) { const f = fold(part.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "")); if (f.length >= 3) known.add(f) }
  return known
}

/** Nome próprio no meio da frase precisa existir no motor ou no SRD. Início de frase/fala passa (ortografia). */
function citedProblems(c: Campaign, raw: string): string[] {
  const problems: string[] = []
  const known = knownTokens(c)
  const text = raw.replace(/\{[mf]\}/g, " ")
  let start = true, cursor = 0
  const unknown = new Set<string>()
  const openers = new Map<string, [string, number]>()
  for (const match of text.matchAll(/\S+/g)) {
    const token = match[0]; const at = match.index ?? 0
    if (text.slice(cursor, at).includes("\n")) start = true
    cursor = at + token.length
    const core = token.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "")
    if (!core) { if (/^[—–“«"]/.test(token)) start = true; continue }
    const opensSpeech = /^[—–“«"]/.test(token)
    const word = core.replace(/[^\p{L}]/gu, "")
    if (/^\p{Lu}/u.test(core) && word.length >= 3 && !known.has(fold(word)) && !STARTERS.has(fold(word)) && !["cd", "ca", "pv", "xp", "pc", "npc"].includes(fold(word))) {
      if (!start && !opensSpeech) unknown.add(word); else openers.set(fold(word), [word, (openers.get(fold(word))?.[1] ?? 0) + 1])
    }
    start = /[.!?:…][”»"')\]]*$/.test(token)
  }
  for (const [w, n] of openers.values()) if (n >= 2) unknown.add(w)
  for (const w of unknown) problems.push(`"${w}" não é uma entidade do motor nem do SRD. Nomes novos só nascem em create.*; cite quem já existe.`)
  return problems
}

/** Segredo ainda fechado não pode aparecer na narração (frase com a maior parte das palavras-chave dele). */
function secretProblems(c: Campaign, text: string): string[] {
  const out: string[] = []
  const sentences = text.split(/[.!?\n]/).map((s) => new Set(fold(s).split(/[^\p{L}\d]+/u).filter((w) => w.length >= 4)))
  for (const f of all<{ id: number; text: string }>(c.db, "SELECT id, text FROM facts WHERE secret = 1")) {
    const keys = [...new Set(fold(f.text).split(/[^\p{L}\d]+/u).filter((w) => w.length >= 4))]
    if (keys.length < 3) continue
    if (sentences.some((s) => keys.filter((k) => s.has(k)).length >= Math.ceil(keys.length * 0.6))) out.push(`A narração revela o segredo #${f.id} antes de reveal.`)
  }
  return out
}

export function narrationProblems(c: Campaign, text: string): string[] {
  const clean = text.trim()
  const problems: string[] = []
  if (clean.length < 2) return ["narração vazia"]
  for (const row of all<{ name: string }>(c.db, "SELECT name FROM characters WHERE status = 'morto'")) {
    if (row.name.trim().length < 3) continue
    if (sentencesOf(row.name, clean).some((s) => !DEAD_OK.test(s))) problems.push(`${row.name} está morto e a narração o trata como se agisse. Fale do corpo, ou não o faça agir.`)
  }
  const pc = all<{ name: string; place_id: string | null }>(c.db, "SELECT name, place_id FROM characters WHERE kind = 'pc'")[0]
  if (pc) {
    const here = /você está (?:na|no|em) ([^.,;\n]+)/i.exec(clean)
    if (here && pc.place_id) {
      const places = all<{ id: string; name: string }>(c.db, "SELECT id, name FROM places")
      const hit = places.find((p) => mentions(here[1]!, p.name))
      if (hit && hit.id !== pc.place_id) problems.push(`A narração coloca o PC em ${hit.name}, mas o motor o tem em ${places.find((p) => p.id === pc.place_id)?.name ?? pc.place_id}. Use move ou corrija o texto.`)
    }
    const used = /você (?:saca|empunha|bebe|usa|veste|come|calça) (?:a |o |sua |seu |um |uma )?([^.,;\n]+)/i.exec(clean)
    if (used) {
      const hit = all<{ name: string; owner_char: string | null }>(c.db, "SELECT name, owner_char FROM items").find((i) => mentions(used[1]!, i.name))
      if (hit && hit.owner_char !== "pc") problems.push(`A narração usa ${hit.name}, mas esse item não está com o PC.`)
    }
    const first = pc.name.trim().split(/\s+/)[0]!
    if (first.length >= 3) {
      const prose = clean.split("\n").filter((l) => !/^\s*[—–“"«]/.test(l)).join("\n").replace(/“[^”]*”|«[^»]*»|"[^"]*"/g, "")
      if (new RegExp(`(^|[.!?…]\\s+|\\n)${esc(first)}\\s+\\p{Ll}`, "u").test(prose)) problems.push(`A narração trata o PC na 3ª pessoa ("${first} …"). Narre em 2ª pessoa: "você".`)
    }
  }
  problems.push(...citedProblems(c, clean), ...secretProblems(c, clean))
  return problems
}

export function assertNarration(c: Campaign, text: string): void {
  const problems = narrationProblems(c, text)
  if (problems.length) throw new Error(`Narração não publicada — contradiz o motor:\n${problems.map((p) => `- ${p}`).join("\n")}\nCorrija o texto e envie de novo. Nada foi gravado.`)
}

export { CODE_RE }
