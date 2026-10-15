import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Rng } from "../src/core/dice.ts"
import * as mx from "../src/core/mechanics.ts"
import { pcView } from "../src/core/pc.ts"
import { cast, healingOf } from "../src/core/spells.ts"
import { srd as getSrd } from "../src/srd/index.ts"
import { novoPc } from "./helpers.ts"

let home: string
before(() => { home = mkdtempSync(join(tmpdir(), "dnd-")) })
after(() => rmSync(home, { recursive: true }))
const seq = (...v: number[]): Rng => { const q = [...v]; return (s) => q.shift() ?? s }

/** Mago/clérigo de nível 20 com a magia dada preparada (a ficha é montada direto: o foco é a conjuração). */
function conjurador(slug: string, spell: string, cls = "wizard") {
  const c = novoPc(slug, home, cls)
  const s = pcView(c).sheet
  const slots: Record<string, { max: number; used: number }> = {}
  for (let i = 1; i <= 9; i++) slots[String(i)] = { max: 4, used: 0 }
  const lvl = getSrd().require("spells", spell, "en").level
  c.commit("t", [{ op: "put", table: "characters", row: { id: "pc", level: 20, hp: 200, max_hp: 200, sheet: { ...s, level: 20, slots, spell: { ...s.spell!, ability: "int", cantrips: lvl === 0 ? [spell] : [], prepared: lvl === 0 ? [] : [spell] } } } }])
  return c
}

describe("conjuração: todas as magias do SRD", () => {
  it("toda magia conjurável roda; as de dano acertam o alvo; as de cura curam", () => {
    const s = getSrd()
    let auto = 0, healed = 0, manual = 0
    for (const sp of s.list("spells", "en")) {
      const c = conjurador(`sp-${sp.index}`, sp.index)
      const g = mx.spawnMonster(c, "ancient-red-dragon", "l0")
      mx.damage(c, "pc", 10, "fire") // para a cura ter o que curar
      const r = cast(c, "pc", sp.index, { slot: Math.max(1, sp.level), targets: sp.damage ? [g] : [] }, seq(15, 15, 15, 15, 15))
      assert.ok(r.lines.length >= 1, sp.index)
      if (sp.damage?.damage_at_slot_level) {
        assert.equal(r.manual, false, `${sp.index} deveria ser automática`)
        assert.ok(r.lines.some((l) => /de dano|sem dano|erra/.test(l)), `${sp.index}: ${r.lines.join(" | ")}`)
        auto++
      } else if (healingOf(sp, sp.level, 3)) healed++
      else manual++
      if (sp.level > 0) assert.equal(pcView(c).sheet.slots[String(Math.max(1, sp.level))]!.used, 1, `${sp.index} deve gastar espaço`)
      c.close()
    }
    assert.ok(auto >= 80, `automáticas: ${auto}`)
    assert.ok(healed >= 5, `curas: ${healed}`)
    console.log(`  magias: ${auto} de dano automático, ${healed} de cura, ${manual} manuais`)
  })

  it("truque escala com o nível; magia de espaço superior ganha dados", () => {
    const c = conjurador("sc1", "fire-bolt")
    const g = mx.spawnMonster(c, "ancient-blue-dragon", "l0")
    // nível 20: 4d10 (cada dado = 10); 20 natural = crítico, dobra os dados: 8d10
    const r = cast(c, "pc", "fire-bolt", { targets: [g] }, seq(20, 10, 10, 10, 10, 10, 10, 10, 10))
    assert.ok(r.lines.some((l) => /CRÍTICO/.test(l)) && r.lines.some((l) => /80 de dano/.test(l)), r.lines.join("|"))
    c.close()
    const d = conjurador("sc2", "burning-hands")
    const g2 = mx.spawnMonster(d, "ancient-blue-dragon", "l0") // não é imune a fogo
    const base = cast(d, "pc", "burning-hands", { slot: 1, targets: [g2] }, seq(1, 1, 1, 1, 1)) // salvaguarda 1 (falha) + 3d6
    const up = cast(d, "pc", "burning-hands", { slot: 3, targets: [g2] }, seq(1, 1, 1, 1, 1, 1))
    assert.ok(base.lines.some((l) => /3 de dano/.test(l)), base.lines.join("|"))
    assert.ok(up.lines.some((l) => /5 de dano/.test(l)), up.lines.join("|")) // 5d6 de 1
    d.close()
  })

  it("exige magia preparada/conhecida, espaço e nível mínimo; não conjura inconsciente", () => {
    const c = conjurador("v1", "fireball")
    assert.throws(() => cast(c, "pc", "magic-missile", {}), /não tem preparada/)
    assert.throws(() => cast(c, "pc", "fireball", { slot: 2 }), /exige espaço de nível 3/)
    assert.throws(() => cast(c, "pc", "bola-de-fogo-suprema", {}), /não existe no SRD/)
    for (let i = 0; i < 4; i++) cast(c, "pc", "fireball", { slot: 3 })
    assert.throws(() => cast(c, "pc", "fireball", { slot: 3 }), /esgotados/)
    c.close()
  })

  it("salvaguarda de metade do dano: sucesso reduz, falha leva tudo", () => {
    const c = conjurador("h1", "fireball")
    const g = mx.spawnMonster(c, "ancient-blue-dragon", "l0")
    // 1º sorteio = salvaguarda de DES do dragão (1 falha, 20 passa); depois 8d6 de 6 = 48
    const falha = cast(c, "pc", "fireball", { slot: 3, targets: [g] }, seq(1, 6, 6, 6, 6, 6, 6, 6, 6))
    assert.ok(falha.lines.some((l) => /falha/.test(l)) && falha.lines.some((l) => /48 de dano/.test(l)), falha.lines.join("|"))
    c.close()
    const d = conjurador("h2", "fireball")
    const g2 = mx.spawnMonster(d, "ancient-blue-dragon", "l0")
    const ok = cast(d, "pc", "fireball", { slot: 3, targets: [g2] }, seq(20, 6, 6, 6, 6, 6, 6, 6, 6))
    assert.ok(ok.lines.some((l) => /sucesso/.test(l)) && ok.lines.some((l) => /24 de dano/.test(l)), ok.lines.join("|"))
    d.close()
  })
})
