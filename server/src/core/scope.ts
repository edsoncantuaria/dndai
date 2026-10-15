// Escopo jogável: o que o Mestre (IA) pode e não pode fazer. Mundo fechado: tudo que tem efeito
// mecânico precisa existir no SRD 2024 ou no estado da campanha. O resto é só texto, sem consequência.
import type { Campaign } from "./campaign.ts"
import { getMeta, one } from "./db.ts"
import { meta, type Op, put } from "./ledger.ts"
import { RuleError, character, giveItem, money, spawnMonster } from "./mechanics.ts"
import { alloc, pcView } from "./pc.ts"
import { XP_TABLE } from "./sheet.ts"

const fail = (m: string): never => { throw new RuleError(m) }

/** Poderes do Mestre. `motor` = só o motor decide; `gate` = o Mestre pede e o motor limita; `livre` = narrativa sem efeito mecânico. */
export const SCOPE = {
  motor: ["dados e resultados", "PV, CA, condições, mortes", "XP, nível, proficiência", "espaços de magia e recursos de classe", "preços e moedas", "posição e tempo de viagem", "ordem de iniciativa"],
  gate: [
    "monstros: só blocos de estatísticas do SRD, ND limitado pelo nível",
    "itens: só equipamentos e itens mágicos do SRD; raridade limitada pelo nível; itens mágicos únicos",
    "dinheiro: teto por turno conforme o nível, sempre com a fonte",
    "XP: vem de monstros derrotados; marco só com teto",
    "magias: só do SRD, conhecidas/preparadas e com espaço",
    "locais, NPCs, missões, ganchos, fatos, memórias: criados por id (nome novo só no create)",
  ],
  livre: ["descrição, tom, diálogo, clima, atmosfera", "intenções, planos e emoções de NPCs", "boatos e mentiras de NPCs (registrados como boato, não fato)"],
  proibido: [
    "inventar monstro, magia, item, classe ou regra fora do SRD",
    "alterar PV, inventário, dinheiro ou posição só por texto",
    "decidir o que o personagem do jogador faz, pensa ou sente",
    "rolar ou escolher resultado de dado",
    "fazer morto agir, citar local/item/NPC inexistente",
    "revelar segredo antes de reveal",
  ],
  foraDoEscopo: ["multiclasse", "criação de itens (ofício) e downtime", "montarias e veículos", "grade tática (alcance é narrado por zonas)", "regras fora do SRD 5.2 (outros livros, homebrew)", "multijogador"],
} as const

export function scopeText(): string {
  const sec = (t: string, l: readonly string[]) => `${t}:\n${l.map((x) => `- ${x}`).join("\n")}`
  return [sec("Só o motor decide", SCOPE.motor), sec("Você pede, o motor limita", SCOPE.gate), sec("Livre (sem efeito mecânico)", SCOPE.livre), sec("Proibido", SCOPE.proibido), sec("Fora do jogo", SCOPE.foraDoEscopo)].join("\n\n")
}

// Tetos da casa (o SRD não traz tabelas de tesouro): por faixa de nível do PC.
const BAND = (level: number) => (level <= 4 ? 0 : level <= 10 ? 1 : level <= 16 ? 2 : 3)
export const GOLD_PER_TURN_GP = [100, 1_000, 5_000, 25_000] as const
const RARITY_MIN_LEVEL: Record<string, number> = { common: 1, uncommon: 3, rare: 5, "very rare": 11, legendary: 17, artifact: 99 }
/** ND máximo sem confirmação: encontro solo de um herói deste nível. */
export const maxCr = (level: number): number => (level <= 1 ? 1 : level + 2)

/** Menor raridade de uma descrição como "Uncommon (+1), Rare (+2), or Very Rare (+3)". */
export function minRarity(label: string): string {
  const l = label.toLowerCase()
  const found = Object.keys(RARITY_MIN_LEVEL).filter((r) => new RegExp(`\\b${r}\\b`).test(l)).sort((a, b) => RARITY_MIN_LEVEL[a]! - RARITY_MIN_LEVEL[b]!)
  return found[0] ?? "rare"
}

export function pcLevel(c: Campaign): number { return pcView(c).sheet.level }

export function spawnChecked(c: Campaign, srdIndex: string, place: string, opts: { name?: string; confirm?: boolean } = {}): string {
  const m = c.srd.get("monsters", srdIndex, "en") ?? fail(`monstro "${srdIndex}" não existe no SRD (não invente criaturas)`)
  const lvl = pcLevel(c)
  if (m.challenge_rating > maxCr(lvl) && !opts.confirm) fail(`${m.name} (ND ${m.challenge_rating}) passa do limite ND ${maxCr(lvl)} para nível ${lvl}. Só com confirm:true e se a história justificar (o herói pode fugir, negociar ou morrer).`)
  return spawnMonster(c, srdIndex, place, opts.name)
}

/** Concede item mágico do SRD ao PC/NPC, respeitando raridade por nível e unicidade. */
export function grantMagicItem(c: Campaign, to: string, index: string, qty = 1): string {
  character(c, to)
  const mi = c.srd.get("magic-items", index, "en") ?? fail(`item mágico "${index}" não existe no SRD`)
  const rarity = minRarity(String(mi.rarity?.name ?? ""))
  const lvl = pcLevel(c)
  if (lvl < RARITY_MIN_LEVEL[rarity]!) fail(`${mi.name} é ${rarity}: só a partir do nível ${RARITY_MIN_LEVEL[rarity]} (herói nível ${lvl})`)
  if (rarity !== "common" && one(c.db, "SELECT 1 FROM items WHERE srd = ?", index)) fail(`${mi.name} já existe nesta campanha (itens mágicos são únicos)`)
  const ops: Op[] = []
  const id = alloc(c, "i", ops)
  ops.push(put("items", { id, owner_char: to, name: mi.name, srd: index, qty, kind: "magico", props: { rarity, attunement: !!mi.attunement }, equipped: 0 }))
  c.commit("item-magico", ops)
  return id
}

export const grantItem = giveItem

/** Dinheiro ganho: teto por turno por faixa de nível, sempre com a fonte. */
export function grantMoney(c: Campaign, to: string, cp: number, source: string): number {
  if (!Number.isInteger(cp) || cp <= 0) fail("valor inválido")
  if (source.trim().length < 8) fail("informe a fonte do dinheiro (mín. 8 letras): tesouro de quem/onde")
  const key = `gold:${c.turn}`
  const spent = Number(getMeta(c.db, key, "0")) + cp
  const cap = GOLD_PER_TURN_GP[BAND(pcLevel(c))]! * 100
  if (spent > cap) fail(`ganho de ${spent / 100} PO neste turno passa do teto de ${cap / 100} PO para o nível ${pcLevel(c)}`)
  c.commit("tesouro", [meta(key, spent)])
  return money(c, to, cp)
}

/** XP dos monstros derrotados que ainda não foram contados. Único caminho de XP por combate. */
export function claimKillXp(c: Campaign): { xp: number; from: string[] } {
  const dead = c.db.prepare("SELECT id, name, xp FROM characters WHERE kind = 'monster' AND status = 'morto'").all() as { id: string; name: string; xp: number }[]
  const fresh = dead.filter((d) => !getMeta(c.db, `xp:${d.id}`))
  if (!fresh.length) return { xp: 0, from: [] }
  const xp = fresh.reduce((a, d) => a + d.xp, 0)
  const pc = pcView(c)
  c.commit("xp-combate", [put("characters", { id: "pc", xp: pc.row.xp + xp }), ...fresh.map((d) => meta(`xp:${d.id}`, 1))])
  return { xp, from: fresh.map((d) => d.name) }
}

/** XP de marco (objetivo cumprido): no máximo 1/4 do caminho até o próximo nível, uma vez a cada 4 turnos. */
export function grantMilestoneXp(c: Campaign, reason: string): number {
  if (reason.trim().length < 12) fail("marco exige motivo (mín. 12 letras) ligado a um objetivo cumprido")
  const pc = pcView(c)
  if (pc.sheet.level >= 20) fail("nível máximo")
  const last = Number(getMeta(c.db, "milestone_turn", "-99"))
  if (c.turn - last < 4) fail(`marco já concedido no turno ${last}; espere ${4 - (c.turn - last)} turno(s)`)
  const gap = XP_TABLE[pc.sheet.level]! - XP_TABLE[pc.sheet.level - 1]!
  const xp = Math.floor(gap / 4)
  c.commit("xp-marco", [put("characters", { id: "pc", xp: pc.row.xp + xp }), meta("milestone_turn", c.turn)])
  return xp
}
