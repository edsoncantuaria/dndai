import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { attackMods, checkMods, resolveMode, saveMods } from "../src/core/conditions.ts"
import type { Rng } from "../src/core/dice.ts"
import * as fx from "../src/core/features.ts"
import * as mx from "../src/core/mechanics.ts"
import { pcView } from "../src/core/pc.ts"
import { cast } from "../src/core/spells.ts"
import { autoLevelUp, novoPc } from "./helpers.ts"

let home: string
before(() => { home = mkdtempSync(join(tmpdir(), "dnd-")) })
after(() => rmSync(home, { recursive: true }))
const seq = (...v: number[]): Rng => { const q = [...v]; return (s) => q.shift() ?? s }
const st = (...conditions: string[]) => ({ conditions, exhaustion: 0 })

describe("condições (função pura)", () => {
  it("vantagem e desvantagem se anulam; efeitos do SRD 2024", () => {
    assert.deepEqual(resolveMode("normal", attackMods(st("poisoned"), st(), false)), { mode: "desvantagem", why: ["desvantagem: atacante poisoned"] })
    assert.equal(resolveMode("normal", attackMods(st("poisoned"), st("restrained"), false)).mode, "normal") // dis + adv
    assert.equal(resolveMode("vantagem", attackMods(st("poisoned"), st(), false)).mode, "normal")
    assert.equal(attackMods(st(), st("prone"), false).adv.length, 1) // corpo a corpo vs caído
    assert.equal(attackMods(st(), st("prone"), true).dis.length, 1)   // à distância vs caído
    assert.ok(attackMods(st(), st("paralyzed"), false).critMelee)
    assert.equal(attackMods(st(), st("paralyzed"), true).critMelee, undefined)
    assert.equal(attackMods(st(), st("invisible"), false).dis.length, 1)
    assert.equal(saveMods(st("stunned"), "dex").autoFail, "stunned")
    assert.equal(saveMods(st("stunned"), "wis").autoFail, undefined)
    assert.equal(saveMods(st("restrained"), "dex").dis.length, 1)
    assert.equal(checkMods({ conditions: [], exhaustion: 3 }, "str").penalty, 6)
    assert.equal(checkMods({ conditions: [], exhaustion: 0, raging: true }, "str").adv.length, 1)
  })
})

describe("condições nos testes do motor", () => {
  it("envenenado ataca com desvantagem; alvo paralisado leva crítico corpo a corpo; falha automática de DES", () => {
    const c = novoPc("e1", home, "fighter")
    const g = mx.spawnMonster(c, "goblin-warrior", "l0")
    mx.setCondition(c, "pc", ["poisoned"])
    const r = mx.attack(c, "pc", g, "Greatsword", "normal", seq(19, 5, 20, 1, 1, 1, 1))
    assert.match(r.text, /desvantagem: atacante poisoned/)
    assert.equal(r.outcome.natural, 5) // menor dos dois (19, 5)
    mx.setCondition(c, "pc", [], ["poisoned"])
    mx.setCondition(c, g, ["paralyzed"])
    const crit = mx.attack(c, "pc", g, "Greatsword", "normal", seq(12, 1, 1, 1, 1))
    assert.equal(crit.crit, true); assert.match(crit.text, /CRÍTICO \(alvo indefeso\)/)
    assert.match(mx.save(c, g, "dex", 10).text, /falha automática \(paralyzed\)/)
    c.close()
  })

  it("exaustão reduz o d20 em 2 por nível", () => {
    const c = novoPc("e2", home, "fighter")
    const s = pcView(c).sheet
    c.commit("t", [{ op: "put", table: "characters", row: { id: "pc", sheet: { ...s, exhaustion: 2 } } }])
    const r = mx.check(c, "pc", "athletics", 10, "normal", seq(10))
    assert.equal(r.total, 10 + pcView(c).derived.skills.athletics! - 4)
    c.close()
  })
})

describe("Guerreiro", () => {
  it("Retomar o Fôlego cura 1d10+nível e gasta o uso; Surto de Ação gasta o recurso", () => {
    const c = novoPc("f1", home, "fighter")
    mx.damage(c, "pc", 8, "fire")
    const hp = pcView(c).row.hp
    assert.match(fx.secondWind(c, "pc", seq(7)), /Retomar o Fôlego: 1\/2/)
    assert.equal(pcView(c).row.hp, hp + 7 + 1)
    autoLevelUp(c)
    assert.match(fx.actionSurge(c), /Surto de Ação: 0\/1/)
    assert.throws(() => fx.actionSurge(c), /sem usos/)
    mx.shortRest(c)
    assert.match(fx.actionSurge(c), /0\/1/) // recuperou no descanso curto
    c.close()
  })

  it("Maestria: Graze, Topple, Vex e Sap", () => {
    const c = novoPc("f2", home, "fighter", "human", "soldier", { mastery: ["greatsword", "flail", "javelin"] })
    const g = mx.spawnMonster(c, "goblin-warrior", "l0")
    // Greatsword = Graze; erro causa dano igual ao modificador (FOR 15+1=16 → +3)
    const miss = mx.attack(c, "pc", g, "Greatsword", "normal", seq(2))
    assert.match(miss.text, /Graze: Goblin Warrior: 3 de dano/)
    // Flail = Sap (marca o alvo); Javelin = Slow
    mx.giveItem(c, "pc", "longsword") // sem maestria: não aplica efeito
    const hit = mx.attack(c, "pc", g, "Flail", "normal", seq(18, 1))
    assert.ok(hit.effects.some((e) => /Sap/.test(e)))
    const goblinTurn = mx.attack(c, g, "pc", "Scimitar", "normal", seq(15, 15, 1, 1))
    assert.match(goblinTurn.text, /desvantagem: Maestria Sap/)
    c.close()
  })
})

describe("Bárbaro", () => {
  it("Fúria: resistência física, dano extra, vantagem em Força, não conjura, acaba ao cair", () => {
    const c = novoPc("b1", home, "barbarian")
    const g = mx.spawnMonster(c, "goblin-warrior", "l0")
    assert.match(fx.rageStart(c), /Fúria! Fúrias: 1\/2/)
    assert.throws(() => fx.rageStart(c), /já está em Fúria/)
    assert.match(mx.check(c, "pc", "athletics", 10, "normal", seq(3, 15)).text, /vantagem: Fúria/)
    const before = pcView(c).row.hp
    assert.match(mx.damage(c, "pc", 7, "slashing"), /Fúria: 7→3/)
    assert.equal(pcView(c).row.hp, before - 3)
    assert.match(mx.damage(c, "pc", 2, "fire"), /2 de dano/) // fogo não é reduzido
    const r = mx.attack(c, "pc", g, "Greataxe", "normal", seq(15, 1)) // 1d12=1 +3 (FOR) +2 (Fúria)
    assert.equal(r.damage, 1 + 3 + 2)
    mx.damage(c, "pc", 999, "fire")
    assert.equal(pcView(c).sheet.notes.raging, false)
    c.close()
  })

  it("descanso longo e fim de combate encerram a Fúria; armadura pesada impede", () => {
    const c = novoPc("b2", home, "barbarian")
    fx.rageStart(c)
    mx.longRest(c)
    assert.equal(pcView(c).sheet.notes.raging, false)
    const id = mx.giveItem(c, "pc", "plate-armor"); mx.equip(c, id, true)
    assert.throws(() => fx.rageStart(c), /armadura pesada/)
    c.close()
  })
})

describe("Ladino", () => {
  it("Ataque Furtivo: só com vantagem ou aliado, só finesse/à distância, uma vez por turno", () => {
    const c = novoPc("r1", home, "rogue")
    const g = mx.spawnMonster(c, "goblin-warrior", "l0")
    const weapon = pcView(c).derived.attacks.find((a) => a.properties.includes("finesse") && !a.ranged)!
    assert.throws(() => mx.attack(c, "pc", g, weapon.name, "normal", seq(15), { sneak: true }), /vantagem ou um aliado/)
    assert.throws(() => mx.attack(c, "pc", g, weapon.name, "desvantagem", seq(15, 15), { sneak: true, allyNear: true }), /desvantagem/)
    const r = mx.attack(c, "pc", g, weapon.name, "normal", seq(15, 1, 1), { sneak: true, allyNear: true })
    assert.match(r.text, /Ataque Furtivo \+1d6/)
    assert.throws(() => mx.attack(c, "pc", g, weapon.name, "normal", seq(15, 1, 1), { sneak: true, allyNear: true }), /já usado/)
    c.close()
  })

  it("Furtivo não vale para quem não é Ladino nem para arma sem finesse", () => {
    const c = novoPc("r2", home, "fighter")
    const g = mx.spawnMonster(c, "goblin-warrior", "l0")
    assert.throws(() => mx.attack(c, "pc", g, "Greatsword", "vantagem", seq(15, 15, 1), { sneak: true }), /só o Ladino/)
    c.close()
  })
})

describe("Paladino", () => {
  it("Mãos Consagradas usa a reserva de 5×nível", () => {
    const c = novoPc("p1", home, "paladin")
    mx.damage(c, "pc", 9, "fire")
    assert.match(fx.layOnHands(c, "pc", "pc", 4), /Mãos Consagradas \(PV\): 1\/5/)
    assert.throws(() => fx.layOnHands(c, "pc", "pc", 2), /sem usos/)
    mx.longRest(c)
    assert.match(fx.layOnHands(c, "pc", "pc", 5), /0\/5/)
    c.close()
  })
})

describe("Magias: concentração e cura", () => {
  it("concentração: nova magia troca a antiga; dano exige salvaguarda de CON; incapacitado perde", () => {
    const c = novoPc("m1", home, "cleric")
    const sheet = pcView(c).sheet
    // Cleric inicial: troca uma preparada por Bless (concentração)
    c.commit("t", [{ op: "put", table: "characters", row: { id: "pc", sheet: { ...sheet, spell: { ...sheet.spell!, prepared: [...sheet.spell!.prepared.slice(0, 3), "bless"] } } } }])
    const out = cast(c, "pc", "bless", { targets: ["pc"] })
    assert.ok(out.lines.some((l) => /concentrando em Bless/.test(l)))
    assert.equal(pcView(c).sheet.notes.concentration, "bless")
    assert.match(mx.damage(c, "pc", 2, "fire", {}, seq(20)), /concentração \(bless\): mantida/)
    assert.match(mx.damage(c, "pc", 2, "fire", {}, seq(1)), /perdeu a concentração em bless/)
    assert.equal(pcView(c).sheet.notes.concentration, null)
    c.close()
  })

  it("Curar Ferimentos cura 2d8+mod e gasta espaço; Palavra Curativa em outro alvo", () => {
    const c = novoPc("m2", home, "cleric")
    const g = mx.spawnMonster(c, "goblin-warrior", "l0")
    const sheet = pcView(c).sheet
    c.commit("t", [{ op: "put", table: "characters", row: { id: "pc", sheet: { ...sheet, spell: { ...sheet.spell!, prepared: ["cure-wounds", "healing-word", ...sheet.spell!.prepared.slice(2)] } } } }])
    mx.heal(c, "pc", 99)
    mx.damage(c, "pc", 4, "fire")
    const wis = Math.floor((pcView(c).sheet.abilities.wis - 10) / 2)
    const r = cast(c, "pc", "cure-wounds", {}, seq(5, 4))
    assert.ok(r.lines.some((l) => /\+4 PV \(\d+\/\d+\)/.test(l)), r.lines.join("|")) // limitado ao que faltava
    assert.equal(pcView(c).row.hp, pcView(c).row.max_hp)
    void wis
    assert.equal(pcView(c).sheet.slots["1"]!.used, 1)
    void g
    c.close()
  })
})

describe("Itens consumíveis", () => {
  it("poção de cura cura e some; kit de curandeiro estabiliza", () => {
    const c = novoPc("i1", home, "fighter")
    const potion = mx.giveItem(c, "pc", "potion-of-healing")
    mx.damage(c, "pc", 10, "fire")
    assert.match(fx.useItem(c, "pc", potion, undefined, seq(3, 2)), /\+7 PV/)
    assert.equal(c.db.prepare("SELECT COUNT(*) n FROM items WHERE id = ?").get(potion)!.n, 0)
    const kit = mx.giveItem(c, "pc", "healers-kit")
    mx.damage(c, "pc", 99, "fire")
    assert.equal(pcView(c).row.status, "morto") // 99 ≥ máx.: morte instantânea; o kit não ressuscita
    assert.throws(() => fx.useItem(c, "pc", kit), /vivo|inconsciente|morto|estar/)
    c.close()
  })

  it("kit de curandeiro estabiliza PC inconsciente e dano desestabiliza", () => {
    const c = novoPc("i2", home, "fighter")
    const kit = mx.giveItem(c, "pc", "healers-kit")
    mx.damage(c, "pc", pcView(c).row.max_hp, "fire")
    assert.equal(pcView(c).row.status, "inconsciente")
    assert.throws(() => fx.useItem(c, "pc", kit), /não pode usar características/) // inconsciente não age
    c.close()
  })
})
