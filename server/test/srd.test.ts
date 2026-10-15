import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { COLLECTIONS, importSrd, SRD_SOURCE } from "../src/srd/import.ts"
import { Srd } from "../src/srd/index.ts"

describe("SRD 2024 (5e-database)", () => {
  let dir: string, db: Srd
  before(() => { dir = mkdtempSync(join(tmpdir(), "srd-")); importSrd(join(dir, "srd.db")); db = new Srd(join(dir, "srd.db")) })
  after(() => { db.close(); rmSync(dir, { recursive: true }) })

  it("importa 100% dos registros: contagem por coleção = JSON do upstream", () => {
    const files = readdirSync(join(SRD_SOURCE, "en")).filter((f) => f.endsWith(".json"))
    assert.equal(files.length, COLLECTIONS.length)
    for (const f of files) {
      const coll = f.replace(/^5e-SRD-/, "").replace(/\.json$/, "").toLowerCase()
      const n = (JSON.parse(readFileSync(join(SRD_SOURCE, "en", f), "utf8")) as unknown[]).length
      assert.equal(db.count(coll as never), n, coll)
    }
  })

  it("não deixa referência órfã", () => {
    const orphans = db.db.prepare("SELECT COUNT(*) n FROM refs WHERE dst NOT IN (SELECT url FROM srd)").get() as { n: number }
    assert.equal(orphans.n, 0)
  })

  it("get, search e refs funcionam", () => {
    assert.equal(db.require("monsters", "aboleth").name, "Aboleth")
    assert.ok(db.search("fireball", "spells").some((h) => h.url === "/api/2024/spells/fireball"))
    assert.ok(db.refsFrom("/api/2024/classes/wizard/levels/1").includes("/api/2024/classes/wizard"))
    assert.ok(db.refsTo("/api/2024/classes/wizard").length > 10)
  })

  it("overlay pt-BR substitui o texto oficial traduzido", () => {
    const en = db.require("ability-scores", "str", "en"), pt = db.require("ability-scores", "str", "pt-BR")
    assert.notEqual(en.full_name, pt.full_name)
    assert.equal(pt.url, en.url)
  })
})
