// Semeia campanhas de teste (12 classes × níveis 1/5/11/20) para o teste de telas do cliente.
//   DNDAI_HOME=/tmp/x node --no-warnings scripts/seed-test.ts
import { Campaign } from "../src/core/campaign.ts"
import { createCharacter, pcView } from "../src/core/pc.ts"
import { XP_TABLE } from "../src/core/sheet.ts"
import { autoChoices, autoLevelUp } from "../test/helpers.ts"

const classes = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"]
const stops = new Set([1, 5, 11, 20])
for (const cls of classes) {
  const c = Campaign.create(`${cls}-1`, { name: `${cls} (teste)` })
  createCharacter(c, autoChoices(cls))
  c.close()
}
for (const cls of classes) {
  const c = Campaign.create(`${cls}-all`, { name: `${cls} nível 20` })
  createCharacter(c, autoChoices(cls))
  for (let l = 2; l <= 20; l++) { autoLevelUp(c); if (stops.has(l) && l < 20) pcView(c) }
  c.close()
}
// Prontos para subir: nível 2 (→3: subclasse) e nível 3 (→4: aumento de atributo, maestria), com o XP já concedido.
for (const cls of classes) {
  for (const lvl of [2, 3]) {
    const c = Campaign.create(`${cls}-up${lvl}`, { name: `${cls} pronto para o nível ${lvl + 1}` })
    createCharacter(c, autoChoices(cls))
    for (let l = 2; l <= lvl; l++) autoLevelUp(c)
    c.commit("xp", [{ op: "put", table: "characters", row: { id: "pc", xp: XP_TABLE[lvl]! } }])
    c.close()
  }
}
console.log(`semeadas ${classes.length * 4} campanhas`)
