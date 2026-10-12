import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, it } from "node:test"
import { createCampaign } from "../src/campaign.ts"
import { transaction } from "../src/db.ts"
import { levelUp, longRest, requestRoll, selectFeature, shortRest, useResource } from "../src/mechanics.ts"
import { applyOps, parseOps } from "../src/ops.ts"
import { createPc } from "../src/pc.ts"
import { applyLevelChoices, pendingFeatureChoices, syncProgression, validateRacialAbilities } from "../src/progression.ts"
import { XP_THRESHOLDS } from "../src/rules.ts"
import { buildView } from "../src/view.ts"
import { defaultSheet, getCharacter, pcId } from "../src/world.ts"

let db: ReturnType<typeof createCampaign>
const scores = { for: 16, des: 12, con: 14, int: 10, sab: 12, car: 14 }
const pc = () => getCharacter(db, pcId(db)!)
const create = (cls = "guerreiro", level = 1, subclass = "", abilities = scores) => transaction(db, () => createPc(db, { name: "Kael", race: "Humano", class: cls, level, subclass, abilities, ac: 16 }))
const use = (id: string, amount = 1) => transaction(db, () => useResource(db, pcId(db)!, id, amount, undefined, () => 5))
const up = (options = {}) => {
  db.prepare("UPDATE characters SET xp = ? WHERE id = ?").run(XP_THRESHOLDS[pc().level], pc().id)
  return transaction(db, () => levelUp(db, pc().id, "media", () => 5, options))
}
beforeEach(() => {
  process.env.DNDAI_HOME = mkdtempSync(join(tmpdir(), "dndai-progression-"))
  db = createCampaign("progressao", { name: "Progressão", premise: "p", tone: "", sandbox: true })
})
afterEach(() => db.close())

describe("recursos e compatibilidade", () => {
  it("aplica cura rolada, registra o dado e impede uso esgotado", () => {
    create()
    db.prepare("UPDATE characters SET hp = 1").run()
    assert.match(use("segundo-folego"), /Segundo Fôlego/)
    assert.equal(pc().hp, 7)
    assert.equal(pc().sheet.resources["segundo-folego"].used, 1)
    assert.equal(buildView(db, "progressao").lastRolls.length, 1)
    assert.equal(buildView(db, "progressao").lastRolls[0].source, "motor")
    assert.throws(() => use("segundo-folego"), /não pode usar/)
    transaction(db, () => shortRest(db, pc().id, 0))
    assert.equal(pc().sheet.resources["segundo-folego"].used, 0)
  })
  it("recarga curta preserva recursos longos; longa restaura ambos", () => {
    create("guerreiro", 9, "champion")
    use("surto-de-acao")
    use("indomavel")
    transaction(db, () => shortRest(db, pc().id, 0))
    assert.equal(pc().sheet.resources["surto-de-acao"].used, 0)
    assert.equal(pc().sheet.resources.indomavel.used, 1)
    transaction(db, () => longRest(db, pc().id))
    assert.equal(pc().sheet.resources.indomavel.used, 0)
  })
  it("rejeita quantidades inválidas, inconsciência e dados pendentes", () => {
    create()
    for (const n of [0, -1, 1.5, 2]) assert.throws(() => use("segundo-folego", n), /Quantidade|carga/)
    assert.throws(() => use("inexistente"), /não existe/)
    db.prepare("UPDATE characters SET status = 'inconsciente', hp = 0").run()
    assert.throws(() => use("segundo-folego"), /não pode usar/)
    db.prepare("UPDATE characters SET status = 'vivo', hp = 1").run()
    transaction(db, () => requestRoll(db, { kind: "livre", who: pc().id, expr: "1d20", reason: "teste" }))
    assert.throws(() => use("segundo-folego"), /Role os dados/)
    assert.equal(pc().sheet.resources["segundo-folego"].used, 0)
  })
  it("pool Cura pelas Mãos cura apenas os pontos gastos", () => {
    create("paladino")
    db.prepare("UPDATE characters SET hp = 1").run()
    use("cura-pelas-maos", 3)
    assert.equal(pc().hp, 4)
    assert.equal(pc().sheet.resources["cura-pelas-maos"].used, 3)
    assert.throws(() => use("cura-pelas-maos", 3), /insuficiente/)
  })
  it("rollback do lote desfaz uso e cura; escala sem recarregar ao subir", () => {
    create("barbaro", 2)
    use("furia")
    up({ subclass: "berserker" })
    assert.equal(pc().sheet.resources.furia.max, 3)
    assert.equal(pc().sheet.resources.furia.used, 1)
    assert.throws(() => transaction(db, () => applyOps(db, parseOps([{ op: "resource.use", who: "pc", resource: "furia" }, { op: "resource.use", who: "pc", resource: "inexistente" }]))), /não existe/)
    assert.equal(pc().sheet.resources.furia.used, 1)
  })
  it("fichas antigas ganham campos em memória sem reescrita ou perda de texto", () => {
    create()
    const stored = { ...pc().sheet } as Record<string, unknown>
    for (const key of ["featureDetails", "featureChoices", "feats", "resources"]) delete stored[key]
    stored.features = ["Habilidade caseira"]
    const json = JSON.stringify(stored)
    db.prepare("UPDATE characters SET sheet = ?").run(json)
    assert.ok(pc().sheet.features.includes("Habilidade caseira"))
    assert.ok(pc().sheet.resources["segundo-folego"])
    assert.equal((db.prepare("SELECT sheet FROM characters").get() as { sheet: string }).sheet, json)
  })
})

describe("subida com escolhas", () => {
  it("exige subclasse no marco e recusa classe errada ou troca", () => {
    create("guerreiro", 2)
    assert.throws(() => up(), /Escolha uma subclasse/)
    assert.equal(pc().level, 2)
    assert.throws(() => up({ subclass: "evocation" }), /inválida/)
    up({ subclass: "Campeão" })
    assert.equal(pc().sheet.subclass, "champion")
    assert.ok(pc().sheet.features.includes("Improved Critical"))
  })
  it("exige ASI ou talento e aplica Constituição retroativa", () => {
    create("guerreiro", 3, "champion")
    const before = pc().max_hp
    assert.throws(() => up(), /escolha --asi/)
    assert.equal(pc().max_hp, before)
    up({ asi: "con+2" })
    assert.equal(pc().sheet.abilities.con, 16)
    assert.equal(pc().max_hp, before + 12) // média 6 + Con 3 + 3 níveis retroativos
  })
  it("recusa ASI fora do marco, pontos incorretos e atributo acima de 20", () => {
    create("guerreiro", 3, "champion", { ...scores, for: 20 })
    for (const asi of ["for+2", "des+3", "des+1", "des+2,con+1", "foo+2"]) assert.throws(() => up({ asi }), /ASI/)
    assert.throws(() => up({ asi: "des+2", feat: "grappler" }), /apenas/)
    up({ asi: "des+1,con+1" })
    assert.equal(pc().sheet.abilities.des, 13)
    assert.throws(() => up({ asi: "des+2" }), /não concede/)
  })
  it("valida pré-requisito, catálogo e repetição do talento", () => {
    create("guerreiro", 3, "champion", { ...scores, for: 12 })
    assert.throws(() => up({ feat: "grappler" }), /exige for 13/)
    assert.throws(() => up({ feat: "inventado" }), /não encontrado/)
    db.prepare("UPDATE characters SET sheet = ?").run(JSON.stringify({ ...pc().sheet, abilities: scores }))
    up({ feat: "grappler" })
    assert.deepEqual(pc().sheet.feats, ["grappler"])
    up()
    assert.throws(() => up({ feat: "grappler" }), /já adquirido/)
  })
  it("usa marcos extras do Guerreiro e Ladino", () => {
    for (const [cls, subclass, level] of [["guerreiro", "champion", 6], ["guerreiro", "champion", 14], ["ladino", "thief", 10]] as const) {
      const sheet = defaultSheet({ class: cls, subclass, abilities: { ...scores } })
      assert.throws(() => applyLevelChoices(sheet, level, {}), /escolha --asi/)
      applyLevelChoices(sheet, level, { asi: "for+2" })
      assert.equal(sheet.abilities.for, 18)
    }
  })
  it("nova característica com opções exige escolha; opções alheias não entram", () => {
    create("patrulheiro", 2)
    assert.throws(() => up({ subclass: "hunter" }), /hunters-prey/)
    assert.equal(pc().level, 2)
    assert.throws(() => up({ subclass: "hunter", choices: { "hunters-prey": ["improved-critical"] } }), /inválida/)
    up({ subclass: "hunter", choices: { "hunters-prey": ["hunters-prey-colossus-slayer"] } })
    assert.ok(pc().sheet.features.includes("Hunter's Prey: Colossus Slayer"))
    assert.ok(!pc().sheet.features.includes("Hunter's Prey: Horde Breaker"))
  })
  it("estilo inicial tem escolha pendente e não permite reaplicar", () => {
    create()
    assert.ok(pendingFeatureChoices(pc().sheet, 1).some((c) => c.id === "fighter-fighting-style"))
    transaction(db, () => selectFeature(db, pc().id, "fighter-fighting-style", ["fighter-fighting-style-defense"]))
    assert.equal(pendingFeatureChoices(pc().sheet, 1).length, 0)
    assert.throws(() => transaction(db, () => selectFeature(db, pc().id, "fighter-fighting-style", ["fighter-fighting-style-archery"])), /já foi feita/)
  })
  it("valida nível e magia exigidos pelas invocações", () => {
    create("bruxo", 1, "fiend")
    assert.throws(() => up({ choices: { "eldritch-invocations": ["eldritch-invocation-agonizing-blast", "eldritch-invocation-ascendant-step"] } }), /inválida/)
    up({ choices: { "eldritch-invocations": ["eldritch-invocation-armor-of-shadows", "eldritch-invocation-beast-speech"] } })
    assert.equal(pc().sheet.featureChoices["eldritch-invocations"].length, 2)
  })
  it("subclasse escolhida tardiamente também exige suas opções iniciais", () => {
    create("feiticeiro")
    assert.throws(() => up({ subclass: "draconic" }), /dragon-ancestor/)
    assert.equal(pc().level, 1)
    up({ subclass: "draconic", choices: { "dragon-ancestor": ["dragon-ancestor-red---fire-damage"] } })
    assert.deepEqual(pc().sheet.featureChoices["dragon-ancestor"], ["dragon-ancestor-red---fire-damage"])
  })
})

describe("raças e fonte SRD", () => {
  it("injeta traços de raça e sub-raça sem duplicar nem somar atributos finais", () => {
    create()
    const sheet = defaultSheet({ race: "High Elf", class: "guerreiro", abilities: { ...scores } })
    syncProgression(sheet, 1)
    syncProgression(sheet, 1)
    assert.ok(sheet.features.includes("Darkvision"))
    assert.ok(sheet.features.includes("Elf Weapon Training"))
    assert.equal(sheet.features.filter((f) => f === "Darkvision").length, 1)
    assert.deepEqual(sheet.abilities, scores)
    validateRacialAbilities("high-elf", { ...scores, des: 14, int: 11 }, scores)
    assert.throws(() => validateRacialAbilities("high-elf", scores, scores), /bônus raciais/)
  })
  it("valida bônus livres do meio-elfo e preserva raças caseiras", () => {
    validateRacialAbilities("Meio-elfo", { ...scores, car: 16, des: 13, con: 15 }, scores)
    assert.throws(() => validateRacialAbilities("Meio-elfo", { ...scores, car: 16, des: 14 }, scores), /dois outros/)
    const sheet = defaultSheet({ race: "Raça própria", class: "guerreiro" })
    syncProgression(sheet, 1)
    assert.equal(sheet.featureDetails.filter((f) => f.source === "race").length, 0)
  })
})
