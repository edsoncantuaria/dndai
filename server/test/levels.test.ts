import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pcView } from "../src/core/pc.ts"
import { cantripsKnown } from "../src/core/progression.ts"
import { mod } from "../src/core/sheet.ts"
import { srd as getSrd } from "../src/srd/index.ts"
import { autoLevelUp, novoPc } from "./helpers.ts"

let home: string
before(() => { home = mkdtempSync(join(tmpdir(), "dnd-")) })
after(() => rmSync(home, { recursive: true }))

describe("subida de nível 1→20 de todas as classes", () => {
  for (const cls of ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"]) {
    it(`${cls}: 19 subidas conferem com a tabela do SRD`, () => {
      const c = novoPc(`lv-${cls}`, home, cls)
      const s = getSrd()
      let expectHp = pcView(c).row.max_hp
      for (let lvl = 2; lvl <= 20; lvl++) {
        autoLevelUp(c)
        const v = pcView(c)
        const rec = s.require("levels", `${cls}-${lvl}`, "en")
        assert.equal(v.sheet.level, lvl)
        expectHp += Math.max(1, v.sheet.hitDie / 2 + 1 + mod(v.sheet.abilities.con))
        assert.equal(v.row.max_hp, expectHp, `PV no nível ${lvl}`)
        assert.equal(v.derived.prof, rec.prof_bonus, `proficiência no nível ${lvl}`)
        for (const f of rec.features) assert.ok(v.sheet.features.includes(f.index), `${f.index} no nível ${lvl}`)
        if (rec.spellcasting) {
          for (let i = 1; i <= 9; i++) assert.equal(v.sheet.slots[String(i)]?.max ?? 0, rec.spellcasting[`spell_slots_level_${i}`] ?? 0, `espaços ${i} no nível ${lvl}`)
          assert.equal(v.sheet.spell!.cantrips.length, cantripsKnown(c, cls, lvl))
          assert.equal(v.sheet.spell!.prepared.length, rec.spellcasting.prepared_spells ?? 0)
        }
        for (const [k, val] of Object.entries(rec.class_specific ?? {})) assert.deepEqual(v.sheet.classSpecific[k], val, `${k} no nível ${lvl}`)
        for (const a of Object.values(v.sheet.abilities)) assert.ok(a <= 20)
        assert.equal(c.invariants().length, 0)
      }
      assert.equal(pcView(c).sheet.level, 20)
      c.close()
    })
  }
})
