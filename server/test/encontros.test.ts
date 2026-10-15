import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { buildEncounter, DIFFICULTIES, partyBudget, THEME_TYPES } from "../src/core/encounters.ts"
import { seeded } from "../src/core/rng.ts"
import { srd as getSrd } from "../src/srd/index.ts"

describe("encontros por orçamento de XP", () => {
  it("nenhum grupo passa do orçamento, em todos os níveis, dificuldades, temas e tamanhos de grupo", () => {
    const s = getSrd()
    let n = 0
    for (let level = 1; level <= 20; level++) for (const d of DIFFICULTIES) for (const theme of Object.keys(THEME_TYPES)) for (const party of [1, 3]) {
      const e = buildEncounter(s, seeded(level * 1000 + n++), { level, party, difficulty: d, types: THEME_TYPES[theme] })
      assert.ok(e.group.length >= 1, `${theme} nv${level}`)
      assert.ok(e.total <= e.budget, `${theme} nv${level} ${d}: ${e.total} > ${e.budget}`)
      assert.equal(e.group.reduce((a, m) => a + m.xp * m.count, 0), e.total)
      assert.ok(e.total >= e.budget * 0.3 || e.budget < 60, `${theme} nv${level} ${d}: usou só ${e.total}/${e.budget}`)
    }
    assert.ok(n > 1500)
  })

  it("é reproduzível pela semente e respeita o tema quando há criaturas dele", () => {
    const s = getSrd()
    const a = buildEncounter(s, seeded(7), { level: 5, difficulty: "moderada", types: THEME_TYPES.cripta })
    const b = buildEncounter(s, seeded(7), { level: 5, difficulty: "moderada", types: THEME_TYPES.cripta })
    assert.deepEqual(a, b)
    for (const m of a.group) assert.match(String(s.get("monsters", m.srd, "en")!.type), /undead/i)
    assert.equal(partyBudget(5, "alta", 2), 2200)
  })
})
