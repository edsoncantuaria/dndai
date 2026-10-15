// Ajudantes de teste: cria e sobe personagens automaticamente a partir do que o próprio SRD pede.
import { Campaign } from "../src/core/campaign.ts"
import { type CreationChoices, creationNeeds } from "../src/core/creation.ts"
import { createCharacter, pcView } from "../src/core/pc.ts"
import { canLevelUp, levelUp, levelUpNeeds, type LevelUpChoices } from "../src/core/progression.ts"
import { XP_TABLE } from "../src/core/sheet.ts"
import { srd as getSrd } from "../src/srd/index.ts"

export function autoChoices(cls: string, species = "human", background = "soldier", name = "Teste"): CreationChoices {
  const s = getSrd()
  const need = creationNeeds(s, { class: cls, background, species })
  const bg = s.require("backgrounds", background, "en")
  const taken = new Set<string>(bg.proficiencies.filter((p: any) => p.index.startsWith("skill-")).map((p: any) => p.index.slice(6)))
  const classSkills = need.skills.from.filter((k: string) => !taken.has(k)).slice(0, need.skills.choose)
  classSkills.forEach((k: string) => taken.add(k))
  const sc: NonNullable<CreationChoices["speciesChoices"]> = {}
  if (need.speciesChoices.size) sc.size = "Medium"
  if (need.speciesChoices.feat) sc.feat = (need.speciesChoices.feat as { index: string }[])[0]!.index
  if (need.speciesChoices.skill) sc.skill = (need.speciesChoices.skill as string[]).find((k) => !taken.has(k))
  // Atributos: o principal da classe recebe o maior valor.
  const prim: Record<string, string> = { barbarian: "str", bard: "cha", cleric: "wis", druid: "wis", fighter: "str", monk: "dex", paladin: "str", ranger: "dex", rogue: "dex", sorcerer: "cha", warlock: "cha", wizard: "int" }
  const order = ["str", "dex", "con", "int", "wis", "cha"].filter((a) => a !== prim[cls])
  const vals = [14, 13, 12, 10, 8]
  const scores: Record<string, number> = { [prim[cls]!]: 15 }
  order.forEach((a, i) => { scores[a] = vals[i]! })
  return {
    name, class: cls, species, subspecies: need.speciesChoices.subspecies[0]?.index, background, method: "standard",
    scores: scores as CreationChoices["scores"], bonus: { plus1x3: true }, classSkills,
    classTools: need.tools ? need.tools.from.slice(0, need.tools.choose).map((t: { index: string }) => t.index) : undefined,
    mastery: need.mastery ? need.mastery.from.slice(0, need.mastery.count).map((m: { index: string }) => m.index) : undefined,
    classEquipment: 0, backgroundEquipment: 0, equipmentPicks: need.equipmentPicks.map((p: { from: string[] }) => p.from[0]!),
    languages: need.languages.from.slice(0, 2).map((l: { index: string }) => l.index), speciesChoices: Object.keys(sc).length ? sc : undefined,
    spells: need.spells ? { cantrips: need.spells.cantripList.slice(0, need.spells.cantrips).map((x: { index: string }) => x.index), prepared: need.spells.levelOneList.slice(0, need.spells.prepared).map((x: { index: string }) => x.index), spellbook: need.spells.spellbook ? need.spells.levelOneList.slice(0, need.spells.spellbook).map((x: { index: string }) => x.index) : undefined } : undefined,
  }
}

export function novoPc(slug: string, home: string, cls = "fighter", species = "human", background = "soldier"): Campaign {
  const c = Campaign.create(slug, { name: "t" }, { home })
  createCharacter(c, autoChoices(cls, species, background))
  return c
}

/** Responde ao que o servidor pede e sobe um nível (dá o XP necessário antes). */
export function autoLevelUp(c: Campaign): void {
  const v = pcView(c)
  if (!canLevelUp(v.sheet.level, v.row.xp)) c.commit("xp-teste", [{ op: "put", table: "characters", row: { id: "pc", xp: XP_TABLE[v.sheet.level]! } }])
  const n = levelUpNeeds(c)
  const ch: LevelUpChoices = { hp: "average" }
  if (n.subclass) ch.subclass = n.subclass[0]!.index
  if (n.asi) {
    const ab = (n.asi.abilities as string[])
    ch.asi = ab.length >= 2 ? { plus: { [ab[0]!]: 1, [ab[1]!]: 1 } as never } : { plus: { [ab[0]!]: 2 } as never }
  }
  if (n.epic_boon) ch.asi = { feat: n.epic_boon[0]!.index }
  if (n.spells) {
    const sp = n.spells
    const cur = sp.current
    const cantrips = [...cur.cantrips]
    for (const x of sp.cantrip_list) if (cantrips.length < sp.cantrips && !cantrips.includes(x.index)) cantrips.push(x.index)
    const book = sp.wizard ? [...(cur.spellbook ?? [])] : undefined
    if (book) { for (const x of sp.spell_list) if (book.length < (cur.spellbook?.length ?? 0) + 2 && !book.includes(x.index)) book.push(x.index) }
    const pool = book ?? sp.spell_list.map((x: { index: string }) => x.index)
    const prepared = cur.prepared.filter((x: string) => pool.includes(x)).slice(0, sp.prepared)
    for (const x of pool) if (prepared.length < sp.prepared && !prepared.includes(x)) prepared.push(x)
    ch.spells = { cantrips, prepared, ...(book ? { spellbook: book } : {}) }
  }
  if (n.mastery) {
    const need = creationNeeds(getSrd(), { class: pcView(c).sheet.class, background: "soldier", species: "human" })
    ch.mastery = need.mastery!.from.slice(0, n.mastery.count).map((m: { index: string }) => m.index)
  }
  levelUp(c, ch)
}
