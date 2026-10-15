import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Campaign } from "../src/core/campaign.ts"
import { all } from "../src/core/db.ts"
import type { Rng } from "../src/core/dice.ts"
import * as mx from "../src/core/mechanics.ts"
import { pcView } from "../src/core/pc.ts"
import { claimKillXp } from "../src/core/scope.ts"
import { srd as getSrd } from "../src/srd/index.ts"
import { autoLevelUp, novoPc } from "./helpers.ts"

let home: string
before(() => { home = mkdtempSync(join(tmpdir(), "dnd-")) })
after(() => rmSync(home, { recursive: true }))

function prng(seed: number): Rng {
  let a = seed >>> 0
  return (sides) => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return 1 + Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * sides)
  }
}

/** Joga um combate inteiro como um Mestre mecânico: PC ataca o inimigo mais fraco; monstros atacam o PC. */
function lutar(c: Campaign, monsters: string[], rng: Rng, maxRounds = 60): { rounds: number; winner: "pc" | "monstros" } {
  const st = mx.startCombat(c, ["pc", ...monsters], rng)
  let guard = 0
  for (;;) {
    if (++guard > maxRounds * (monsters.length + 1) * 3) assert.fail("combate sem fim")
    const cur = st.order.length ? mx.combatState(c)! : st
    const id = cur.order[cur.turn]!.id
    const me = mx.character(c, id)
    if (me.status === "vivo") {
      if (id === "pc") {
        const alvo = monsters.map((m) => mx.character(c, m)).filter((m) => m.status !== "morto").sort((a, b) => a.hp - b.hp)[0]
        if (!alvo) return { rounds: cur.round, winner: "pc" }
        const weapon = pcView(c).derived.attacks.find((a) => a.item) ?? pcView(c).derived.attacks[0]!
        mx.attack(c, "pc", alvo.id, weapon.item || weapon.name, "normal", rng)
      } else {
        const sheet = JSON.parse(me.sheet)
        const m = c.srd.require("monsters", sheet.srd, "en")
        const acts = (m.actions ?? []).filter((x: any) => x.attack_bonus !== undefined)
        if (acts.length && mx.character(c, "pc").status !== "morto") {
          const times = /Multiattack/i.test(JSON.stringify(m.actions)) ? 2 : 1
          for (let i = 0; i < times && mx.character(c, "pc").status !== "morto"; i++) mx.attack(c, id, "pc", acts[0].name, "normal", rng)
        }
      }
    }
    const pc = mx.character(c, "pc")
    const left = monsters.filter((m) => mx.character(c, m).status !== "morto")
    if (!left.length) return { rounds: mx.combatState(c)!.round, winner: "pc" }
    if (pc.status === "morto") return { rounds: mx.combatState(c)!.round, winner: "monstros" }
    // PC caído: rola salvaguarda contra a morte no próprio turno; senão segue.
    if (pc.status === "inconsciente" && id === "pc") mx.deathSave(c, "pc", rng)
    mx.nextTurn(c)
  }
}

describe("combate completo", () => {
  it("Guerreiro vs bando de goblins: termina, XP dos mortos conta uma vez, invariantes valem", () => {
    const c = novoPc("cb1", home, "fighter", "human", "soldier", { mastery: ["greatsword", "flail", "javelin"] })
    const gs = [1, 2, 3].map(() => mx.spawnMonster(c, "goblin-warrior", "l0"))
    const r = lutar(c, gs, prng(42))
    assert.ok(r.rounds >= 1)
    assert.equal(c.invariants().length, 0)
    if (r.winner === "pc") {
      mx.endCombat(c)
      const xp = claimKillXp(c)
      assert.equal(xp.xp, 150)
      assert.equal(claimKillXp(c).xp, 0)
      assert.equal(pcView(c).row.xp, 150)
    }
    c.close()
  })

  it("50 combates com sementes diferentes (classes e monstros variados) sempre terminam sem quebrar regras", () => {
    const classes = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"]
    const mons = ["goblin-warrior", "bandit", "wolf", "skeleton", "zombie", "ogre", "owlbear", "giant-spider", "gnoll-warrior", "orc-warrior"]
    let wins = 0
    for (let i = 0; i < 50; i++) {
      const cls = classes[i % classes.length]!
      const c = novoPc(`fz${i}`, home, cls)
      const m = [mons[i % mons.length]!, mons[(i * 3 + 1) % mons.length]!].map((idx) => c.srd.get("monsters", idx, "en") ? mx.spawnMonster(c, idx, "l0") : "")
      const real = m.filter(Boolean)
      const res = lutar(c, real, prng(1000 + i))
      assert.equal(c.invariants().length, 0, `${cls} ${i}`)
      if (res.winner === "pc") wins++
      c.close()
    }
    assert.ok(wins >= 1, `vitórias do PC: ${wins}`) // nível 1 contra ogros e ursos-coruja perde muito: o que importa é terminar sem quebrar regras
  })
})

describe("todas as ações de ataque de todos os monstros do SRD", () => {
  it("cada monstro ataca um alvo sólido sem erro (dano, tipos, resistências)", () => {
    const s = getSrd()
    const c = novoPc("alvo", home, "fighter")
    c.commit("t", [{ op: "put", table: "characters", row: { id: "pc", level: 20, hp: 100000, max_hp: 100000 } }])
    let ataques = 0
    for (const m of s.list("monsters", "en")) {
      const id = mx.spawnMonster(c, m.index, "l0")
      for (const act of (m.actions ?? []).filter((x: any) => x.attack_bonus !== undefined)) {
        if (!act.damage?.length) continue
        const r = mx.attack(c, id, "pc", act.name, "normal", prng(ataques + 1))
        assert.ok(r.text.length > 0, `${m.index}/${act.name}`)
        ataques++
      }
      // O PC contra o monstro: ele recebe dano de todos os tipos sem quebrar.
      for (const t of ["fire", "cold", "poison", "psychic", "bludgeoning", "radiant"]) {
        if (mx.character(c, id).status !== "morto") mx.damage(c, id, 1, t)
      }
    }
    assert.ok(ataques > 400, `ataques exercitados: ${ataques}`)
    assert.equal(c.invariants().length, 0)
    console.log(`  ações de monstros exercitadas: ${ataques} (${s.count("monsters")} monstros)`)
    c.close()
  })
})
