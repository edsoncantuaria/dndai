import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { runCli } from "../src/cli.ts"
import { getFeaturesForLevel, searchSrd, SRD_RESOURCES } from "../src/srd.ts"

describe("catálogo SRD e progressão oficial", () => {
  it("consulta todos os recursos pela CLI sem campanha", () => {
    const queries = {
      monster: "goblin", spell: "fireball", feature: "second-wind", subclass: "champion",
      race: "elf", subrace: "high-elf", feat: "grappler", trait: "darkvision",
    }
    for (const kind of Object.keys(SRD_RESOURCES) as (keyof typeof SRD_RESOURCES)[]) {
      const result = JSON.parse(runCli(["srd", kind, queries[kind]]))
      assert.equal(result.index, queries[kind])
    }
  })

  it("prioriza correspondência exata e mantém busca parcial limitada", () => {
    assert.equal(searchSrd("features", "Second Wind")[0].index, "second-wind")
    assert.ok(searchSrd("features", "action-surge").length > 1)
    assert.ok(searchSrd("features", "").length <= 10)
    assert.equal(runCli(["srd", "feat", "inexistente"]), "Nada encontrado.")
    assert.throws(() => runCli(["srd", "desconhecido", "elf"]), /Uso: dnd srd/)
  })

  it("encontra subclasses por classe em português ou inglês", () => {
    for (const cls of ["guerreiro", "fighter", "Guerreiro"]) {
      assert.equal(searchSrd("subclasses", cls)[0].index, "champion")
      assert.equal(JSON.parse(runCli(["srd", "subclass", cls])).index, "champion")
    }
    assert.equal(searchSrd("subclasses", "cleric")[0].index, "life")
  })

  it("concede as referências de nível, sem escolher estilos de luta", () => {
    assert.deepEqual(getFeaturesForLevel("guerreiro", null, 1).map((f) => f.index), ["fighter-fighting-style", "second-wind"])
    assert.deepEqual(getFeaturesForLevel("fighter", null, 2).map((f) => f.index), ["action-surge-1-use"])
    assert.deepEqual(getFeaturesForLevel("fighter", "champion", 3).map((f) => f.index), ["martial-archetype", "improved-critical"])
    assert.deepEqual(getFeaturesForLevel("fighter", "champion", 2).map((f) => f.index), ["action-surge-1-use"])
  })

  it("rejeita nível inválido e arquétipo de outra classe", () => {
    for (const level of [0, 21, 1.5, NaN]) assert.throws(() => getFeaturesForLevel("fighter", null, level), /Nível SRD/)
    assert.throws(() => getFeaturesForLevel("inventada", null, 1), /Classe/)
    assert.throws(() => getFeaturesForLevel("wizard", "champion", 3), /não pertence/)
    assert.throws(() => getFeaturesForLevel("fighter", "inexistente", 3), /Subclasse/)
  })
})
