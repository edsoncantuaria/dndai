// XP e subida de nível 2024, lidos de Levels/Classes/Subclasses do SRD.
import type { Campaign } from "./campaign.ts"
import { CreationError } from "./creation.ts"
import { cryptoRng, roll, type Rng } from "./dice.ts"
import { type Op, put } from "./ledger.ts"
import { pcView } from "./pc.ts"
import { ABILITIES, type Ability, derivePc, mod, type PcSheet, XP_TABLE } from "./sheet.ts"

const fail = (m: string): never => { throw new CreationError(m) }

export interface LevelUpChoices {
  hp: "average" | "roll"
  subclass?: string
  /** Aumento de atributo (+2 em um ou +1 em dois) ou talento geral, nos níveis de ASI. */
  asi?: { plus: Partial<Record<Ability, number>> } | { feat: string }
  /** Truques e magias preparadas completos após a subida (substitui a lista). */
  spells?: { cantrips: string[]; prepared: string[]; spellbook?: string[] }
  mastery?: string[]
}

export function xpToNext(level: number): number | null { return level >= 20 ? null : XP_TABLE[level]! }
export function canLevelUp(level: number, xp: number): boolean { return level < 20 && xp >= XP_TABLE[level]! }

export function awardXp(c: Campaign, amount: number, who = "pc"): void {
  if (!Number.isInteger(amount) || amount <= 0) fail("XP deve ser inteiro positivo")
  const v = pcView(c, who)
  c.commit("xp", [put("characters", { id: who, xp: v.row.xp + amount })])
}

export function levelUp(c: Campaign, ch: LevelUpChoices, who = "pc", rng: Rng = cryptoRng): PcSheet {
  const v = pcView(c, who)
  const s: PcSheet = structuredClone(v.sheet)
  if (v.row.status === "morto") fail("personagem morto não sobe de nível")
  if (!canLevelUp(s.level, v.row.xp)) fail(`faltam ${XP_TABLE[s.level]! - v.row.xp} XP para o nível ${s.level + 1}`)
  const srd = c.srd
  const next = s.level + 1
  const cls = srd.require("classes", s.class, "en")
  const rec = srd.get("levels", `${s.class}-${next}`, "en") ?? fail(`nível ${next} ausente no SRD`)

  // Subclasse (nível em que a classe concede a característica "<classe>-subclass")
  const recFeatures: string[] = rec.features.map((f: any) => f.index)
  if (recFeatures.includes(`${s.class}-subclass`)) {
    const sub = ch.subclass ?? fail(`escolha a subclasse: ${cls.subclasses.map((x: any) => x.index).join(", ")}`)
    if (!cls.subclasses.some((x: any) => x.index === sub)) fail(`subclasse "${sub}" inválida para ${cls.name}`)
    s.subclass = sub
  }
  if (s.subclass) {
    const subRec = srd.list("levels", "en").find((l) => l.subclass?.index === s.subclass && l.level === next)
    if (subRec) recFeatures.push(...subRec.features.map((f: any) => f.index as string))
  }

  // Aumento de atributo / talento
  if (recFeatures.includes(`${s.class}-ability-score-improvement`)) {
    const asi = ch.asi ?? fail("este nível dá Aumento de Atributo: informe asi {plus} ou {feat}")
    if ("feat" in asi) {
      const f = srd.get("feats", asi.feat, "en") ?? fail(`talento "${asi.feat}" não existe`)
      if (!["general"].includes(f.type) || s.feats.includes(f.index) && f.index !== "ability-score-improvement") fail(`talento ${f.name} indisponível`)
      if (f.index !== "ability-score-improvement") s.feats.push(f.index)
    } else {
      const entries = Object.entries(asi.plus) as [Ability, number][]
      const total = entries.reduce((a, [, n]) => a + n, 0)
      const okShape = total === 2 && entries.every(([a, n]) => ABILITIES.includes(a) && (n === 1 || n === 2))
      if (!okShape) fail("asi.plus: +2 em um atributo ou +1 em dois")
      for (const [a, n] of entries) { if (s.abilities[a] + n > 20) fail(`${a} passaria de 20`); s.abilities[a] += n }
    }
  }
  if (recFeatures.includes(`${s.class}-epic-boon`)) {
    const asi = ch.asi
    if (!asi || !("feat" in asi)) fail("nível 19: escolha uma Dádiva Épica em asi.feat")
    else {
      const f = srd.get("feats", asi.feat, "en")
      if (!f || f.type !== "epic-boon") fail("asi.feat deve ser uma Dádiva Épica")
      else s.feats.push(f.index)
    }
  }

  // PV (média fixa ou rolagem; sempre pelo motor)
  const gain = ch.hp === "average" ? s.hitDie / 2 + 1 : roll(`1d${s.hitDie}`, rng).total
  const conMod = mod(s.abilities.con)
  const hpGain = Math.max(1, gain + conMod)

  // Características, recursos e conjuração do novo nível
  s.level = next
  s.features.push(...recFeatures.filter((f) => !s.features.includes(f)))
  s.classSpecific = { ...s.classSpecific, ...(rec.class_specific ?? {}) }
  s.hitDiceLeft = Math.min(s.level, s.hitDiceLeft + 1)
  if (rec.spellcasting && s.spell) {
    const sp = rec.spellcasting
    const chosen = ch.spells ?? fail("conjurador: informe spells (listas completas de truques e magias preparadas)")
    if (chosen.cantrips.length !== (sp.cantrips_known ?? 0)) fail(`truques: exatamente ${sp.cantrips_known ?? 0}`)
    if (chosen.prepared.length !== (sp.prepared_spells ?? 0)) fail(`magias preparadas: exatamente ${sp.prepared_spells ?? 0}`)
    let maxLvl = 0
    for (let i = 1; i <= 9; i++) if (sp[`spell_slots_level_${i}`]) maxLvl = i
    const book = s.class === "wizard" ? (chosen.spellbook ?? s.spell.spellbook ?? []) : undefined
    const pool = book ?? chosen.prepared
    for (const sid of [...chosen.cantrips, ...chosen.prepared, ...(book ?? [])]) {
      const spell = srd.get("spells", sid, "en") ?? fail(`magia "${sid}" não existe`)
      if (!spell.classes.some((x: any) => x.index === s.class)) fail(`${spell.name} não é de ${cls.name}`)
      if (spell.level > maxLvl) fail(`${spell.name} (nível ${spell.level}) acima dos seus espaços (${maxLvl})`)
    }
    if (book && !chosen.prepared.every((p) => pool.includes(p))) fail("preparadas devem estar no grimório")
    s.spell = { ...s.spell, cantrips: chosen.cantrips, prepared: chosen.prepared, ...(book ? { spellbook: book } : {}) }
    s.slots = {}
    for (let i = 1; i <= 9; i++) { const n = sp[`spell_slots_level_${i}`] ?? 0; if (n) s.slots[String(i)] = { max: n, used: s.slots[String(i)]?.used ?? 0 } }
  }
  const masteryN = (rec.class_specific as any)?.weapon_mastery
  if (masteryN !== undefined && masteryN !== (v.sheet.classSpecific as any).weapon_mastery) {
    const m = ch.mastery ?? fail(`Maestria com Armas: informe mastery com ${masteryN} armas`)
    if (m.length !== masteryN) fail(`mastery: exatamente ${masteryN}`)
    for (const w of m) if (!srd.get("equipment", w, "en")?.mastery) fail(`${w} não tem maestria`)
    s.mastery = m
  }

  const ops: Op[] = [put("characters", {
    id: who, level: next, max_hp: v.row.max_hp + hpGain, hp: v.row.hp + hpGain, sheet: s,
    ac: derivePc(srd, s, v.items).ac,
  })]
  c.commit("subir-nivel", ops)
  return s
}

/** O que o jogador precisa escolher para subir o próximo nível (o cliente monta o formulário). */
export function levelUpNeeds(c: Campaign, who = "pc") {
  const v = pcView(c, who)
  const s = v.sheet
  if (!canLevelUp(s.level, v.row.xp)) fail("ainda não há XP para subir de nível")
  const srd = c.srd
  const next = s.level + 1
  const cls = srd.require("classes", s.class, "en")
  const rec = srd.get("levels", `${s.class}-${next}`, "en") ?? fail(`nível ${next} ausente no SRD`)
  const feats: string[] = rec.features.map((f: any) => f.index)
  const subRec = s.subclass ? srd.list("levels", "en").find((l) => l.subclass?.index === s.subclass && l.level === next) : undefined
  const gained = [...feats, ...(subRec?.features ?? []).map((f: any) => f.index as string)]
  const sp = rec.spellcasting
  let maxLvl = 0
  if (sp) for (let i = 1; i <= 9; i++) if (sp[`spell_slots_level_${i}`]) maxLvl = i
  const list = (level: number) => srd.list("spells").filter((x) => x.level === level && x.classes.some((k: any) => k.index === s.class)).map((x) => ({ index: x.index, name: x.name }))
  const masteryN = (rec.class_specific as any)?.weapon_mastery
  return {
    level: next, hit_die: s.hitDie, con_mod: mod(s.abilities.con), hp_average: s.hitDie / 2 + 1,
    new_features: gained.map((i) => ({ index: i, name: srd.get("features", i)?.name ?? i })),
    subclass: feats.includes(`${s.class}-subclass`) ? cls.subclasses.map((x: any) => ({ index: x.index, name: srd.get("subclasses", x.index)?.name ?? x.name })) : null,
    asi: feats.includes(`${s.class}-ability-score-improvement`) ? { feats: srd.list("feats").filter((f) => f.type === "general" && !s.feats.includes(f.index) && f.index !== "ability-score-improvement").map((f) => ({ index: f.index, name: f.name })), abilities: ABILITIES.filter((a) => s.abilities[a] < 20) } : null,
    epic_boon: feats.includes(`${s.class}-epic-boon`) ? srd.list("feats").filter((f) => f.type === "epic-boon").map((f) => ({ index: f.index, name: f.name })) : null,
    spells: sp && s.spell ? {
      cantrips: sp.cantrips_known ?? 0, prepared: sp.prepared_spells ?? 0, max_level: maxLvl, wizard: s.class === "wizard",
      cantrip_list: list(0), spell_list: Array.from({ length: maxLvl }, (_, i) => list(i + 1)).flat(),
      current: { cantrips: s.spell.cantrips, prepared: s.spell.prepared, spellbook: s.spell.spellbook ?? null },
    } : null,
    mastery: masteryN !== undefined && masteryN !== (s.classSpecific as any).weapon_mastery ? { count: masteryN } : null,
  }
}
