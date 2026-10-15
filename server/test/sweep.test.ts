import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Campaign } from "../src/core/campaign.ts"
import { type CreationChoices, creationNeeds } from "../src/core/creation.ts"
import { createCharacter, pcView } from "../src/core/pc.ts"
import { srd as getSrd } from "../src/srd/index.ts"

let home: string
before(() => { home = mkdtempSync(join(tmpdir(), "dnd-")) })
after(() => rmSync(home, { recursive: true }))

describe("varredura da criação: toda classe × toda espécie × todo antecedente", () => {
  it("cria um personagem válido para cada combinação sugerida pelo próprio SRD", () => {
    const s = getSrd()
    const classes = s.list("classes", "en"), species = s.list("species", "en"), backgrounds = s.list("backgrounds", "en")
    let n = 0
    for (const [i, cls] of classes.entries()) {
      for (const [j, sp] of species.entries()) {
        const bg = backgrounds[(i + j) % backgrounds.length]!
        const base = { class: cls.index, background: bg.index, species: sp.index }
        const need = creationNeeds(s, base)
        const sub = need.speciesChoices.subspecies[0]?.index
        const skillsAvoid = new Set<string>(bg.proficiencies.filter((p: any) => p.index.startsWith("skill-")).map((p: any) => p.index.slice(6)))
        const sc: NonNullable<CreationChoices["speciesChoices"]> = {}
        if (need.speciesChoices.size) sc.size = "Medium"
        if (need.speciesChoices.feat) sc.feat = (need.speciesChoices.feat as { index: string }[])[0]!.index
        const taken = new Set<string>(skillsAvoid)
        const classSkills = need.skills.from.filter((k: string) => !taken.has(k)).slice(0, need.skills.choose)
        classSkills.forEach((k: string) => taken.add(k))
        if (need.speciesChoices.skill) sc.skill = (need.speciesChoices.skill as string[]).find((k) => !taken.has(k))
        const choices: CreationChoices = {
          name: `${cls.name} ${sp.name}`, ...base, subspecies: sub, method: "standard",
          scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
          bonus: { plus1x3: true }, classSkills, classEquipment: 0, backgroundEquipment: 0,
          classTools: need.tools ? need.tools.from.slice(0, need.tools.choose).map((t: { index: string }) => t.index) : undefined,
          mastery: need.mastery ? need.mastery.from.slice(0, need.mastery.count).map((m) => m.index) : undefined,
          equipmentPicks: need.equipmentPicks.map((p) => p.from[0]!),
          languages: need.languages.from.slice(0, 2).map((l) => l.index), speciesChoices: Object.keys(sc).length ? sc : undefined,
          spells: need.spells ? { cantrips: need.spells.cantripList.slice(0, need.spells.cantrips).map((x) => x.index), prepared: need.spells.levelOneList.slice(0, need.spells.prepared).map((x) => x.index), spellbook: need.spells.spellbook ? need.spells.levelOneList.slice(0, need.spells.spellbook).map((x) => x.index) : undefined } : undefined,
        }
        const c = Campaign.create(`sw${n++}`, { name: "s" }, { home })
        try {
          createCharacter(c, choices)
          const v = pcView(c)
          assert.ok(v.row.max_hp >= 1 && v.derived.ac >= 10, `${cls.index}/${sp.index}`)
        } catch (e) {
          assert.fail(`${cls.index} × ${sp.index} × ${bg.index}: ${(e as Error).message}`)
        } finally { c.close() }
      }
    }
    assert.equal(n, 12 * 9)
  })
})
