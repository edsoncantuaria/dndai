import { z } from "zod"
import { type DB, index, metaNum, setMeta } from "./db.ts"
import { CLASSES, mod, parseClass, parseSkill, STARTING_GP, spellSlots } from "./rules.ts"
import { chooseFeature, pendingFeatureChoices, racialInfo, resolveSubclass, subclassRequiredLevel, syncProgression, validateRacialAbilities } from "./progression.ts"
import { defaultSheet, newId, parseMoney, pcId, resolveRef } from "./world.ts"

const PcSchema = z
  .object({
    name: z.string().trim().min(1),
    race: z.string().trim().min(1),
    class: z.string().trim().min(1),
    subclass: z.string().default(""),
    background: z.string().default(""),
    summary: z.string().default(""),
    level: z.number().int().min(1).max(20).default(1),
    abilities: z.object({
      for: z.number().int().min(1).max(20), des: z.number().int().min(1).max(20), con: z.number().int().min(1).max(20),
      int: z.number().int().min(1).max(20), sab: z.number().int().min(1).max(20), car: z.number().int().min(1).max(20),
    }).strict(),
    base_abilities: z.object({
      for: z.number().int().min(1).max(20), des: z.number().int().min(1).max(20), con: z.number().int().min(1).max(20),
      int: z.number().int().min(1).max(20), sab: z.number().int().min(1).max(20), car: z.number().int().min(1).max(20),
    }).strict().optional(),
    choices: z.record(z.array(z.string().min(1))).default({}),
    skills: z.array(z.string()).default([]),
    expertise: z.array(z.string()).default([]),
    ac: z.number().int().min(1),
    hp: z.number().int().positive().optional(),
    speed: z.number().positive().optional(),
    money: z.union([z.number().int(), z.string()]).default(0),
    place: z.string().optional(),
    items: z.array(z.object({
      name: z.string().min(1), qty: z.number().int().positive().default(1), kind: z.string().default("equipamento"),
      props: z.record(z.unknown()).default({}), equipped: z.boolean().default(false), notes: z.string().default(""),
    }).strict()).default([]),
    spells: z.array(z.string()).default([]),
    features: z.array(z.string()).default([]),
    portrait: z.string().optional(),
  })
  .strict()

export function createPc(db: DB, input: unknown): string[] {
  if (pcId(db)) throw new Error("Esta campanha já tem um personagem do jogador.")
  const parsed = PcSchema.safeParse(input)
  if (!parsed.success) throw new Error(`Ficha inválida: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`)
  const p = parsed.data
  const cls = parseClass(p.class)
  if (!cls) throw new Error(`Classe "${p.class}" desconhecida. Use: ${Object.keys(CLASSES).join(", ")}.`)
  const def = CLASSES[cls]
  validateRacialAbilities(p.race, p.abilities, p.base_abilities)
  const subclass = p.subclass ? resolveSubclass(cls, p.subclass).index : ""
  if (subclass && p.level < subclassRequiredLevel(cls)) throw new Error("A escolha de subclasse ainda não está disponível.")
  const toSkill = (s: string) => {
    const k = parseSkill(s)
    if (!k) throw new Error(`Perícia "${s}" desconhecida.`)
    return k
  }
  const skills = p.skills.map(toSkill)
  const expertise = p.expertise.map(toSkill)
  const con = mod(p.abilities.con)
  const avg = Math.floor(def.hitDie / 2) + 1
  const computedHp = def.hitDie + con + (p.level - 1) * Math.max(1, avg + con)
  const perLevel = Math.max(1, def.hitDie + con)
  const hpCeiling = perLevel * p.level
  if (p.hp !== undefined && p.hp > hpCeiling) {
    throw new Error(`PV iniciais ${p.hp} acima do máximo rolável da classe (${hpCeiling}). O motor usa ${Math.max(1, computedHp)} se você omitir hp.`)
  }
  const hp = Math.max(1, p.hp ?? computedHp)
  if (p.ac < 8 || p.ac > 25) throw new Error(`CA ${p.ac} fora do intervalo inicial 8–25.`)
  const wealth = STARTING_GP[cls]
  const askedCp = Math.max(0, parseMoney(p.money))
  const startingCp = askedCp === 0 ? wealth.avg * 100 : askedCp
  if (startingCp > wealth.max * 100) {
    throw new Error(`Dinheiro inicial acima do máximo da classe ${def.label} (${wealth.max} po). Omita money para usar a média (${wealth.avg} po).`)
  }
  const slots: Record<string, { max: number; used: number }> = {}
  for (const [lvl, max] of Object.entries(spellSlots(cls, p.level))) slots[lvl] = { max, used: 0 }
  const sheet = defaultSheet({
    race: p.race, class: cls, subclass, background: p.background, abilities: p.abilities,
    skills, expertise, saves: def.saves, slots, spells: p.spells, features: p.features,
    hitDice: { die: def.hitDie, max: p.level, used: 0 }, speed: p.speed ?? racialInfo(p.race)?.speed ?? 9, portrait: p.portrait,
  })
  syncProgression(sheet, p.level)
  for (const [id, selected] of Object.entries(p.choices)) chooseFeature(sheet, p.level, id, selected)
  const place = p.place ? resolveRef(db, p.place, ["place"]) : null
  const id = newId(db, "pc", p.name)
  const turn = metaNum(db, "turn")
  db.prepare(
    "INSERT INTO characters(id, kind, name, summary, place_id, hp, max_hp, ac, level, cp, sheet, attitude, created_turn) VALUES(?, 'pc', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)"
  ).run(id, p.name, p.summary, place, hp, hp, p.ac, p.level, startingCp, JSON.stringify(sheet), turn)
  setMeta(db, "prep_sealed", 1)
  if (place) db.prepare("UPDATE places SET visited = 1 WHERE id = ?").run(place)
  for (const it of p.items) {
    db.prepare("INSERT INTO items(id, owner_char, name, qty, kind, props, equipped, notes) VALUES(?,?,?,?,?,?,?,?)").run(
      newId(db, "item", it.name), id, it.name, it.qty, it.kind, JSON.stringify(it.props), it.equipped ? 1 : 0, it.notes
    )
  }
  index(db, id, "entidade", `${p.name} — ${p.race} ${def.label} — ${p.summary}`)
  const pending = pendingFeatureChoices(sheet, p.level)
  return [`+ personagem do jogador ${p.name} [${id}]: ${p.race} ${def.label} nível ${p.level}, ${hp} PV, CA ${p.ac}${place ? `, em ${place}` : " (sem local: use move ou recrie com place)"}.`,
    ...pending.map((c) => `Escolha pendente: ${c.name} (${c.id}), ${c.choose} opção(ões). Use feature choose pc ${c.id} <opções>.`),
    ...(!subclass && p.level >= subclassRequiredLevel(cls) ? ["Subclasse pendente: escolha com o jogador; será exigida na próxima subida de nível."] : []),
  ]
}
