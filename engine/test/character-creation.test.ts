import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, it } from "node:test"
import { createCampaign } from "../src/campaign.ts"
import { all, transaction } from "../src/db.ts"
import { createPc } from "../src/pc.ts"
import {
  getCharacterCreationOptions,
  getCreationCatalog,
} from "../src/character-options.ts"
import {
  levelUpOptions,
  subclassRequiredLevel,
  applyLevelChoices,
} from "../src/progression.ts"
import { CLASSES, SKILLS } from "../src/rules.ts"
import { defaultSheet, getCharacter, pcId, type ItemRow } from "../src/world.ts"

let db: ReturnType<typeof createCampaign>

function validCreationChoices(race: string, cls: string, background = "acolyte") {
  const options = getCharacterCreationOptions(race, cls, background)
  return Object.fromEntries(
    [
      ...options.race.choices,
      ...options.class.choices,
      ...options.background.choices,
      ...options.equipment,
    ].map((group) => [group.id, group.options.slice(0, group.choose).map((option) => option.id)]),
  ) as Record<string, string[]>
}

beforeEach(() => {
  process.env.DNDAI_HOME = mkdtempSync(join(tmpdir(), "dndai-char-create-"))
  db = createCampaign("criacao", {
    name: "Criação",
    premise: "p",
    tone: "",
    sandbox: true,
  })
})

afterEach(() => db.close())

describe("criação de personagem SRD e opções", () => {
  it("todas as 12 classes retornam escolhas de perícia válidas", () => {
    for (const cls of Object.keys(CLASSES)) {
      const opts = getCharacterCreationOptions("Humano", cls, "Acólito")
      assert.equal(opts.class.id, cls)
      assert.ok(opts.class.savingThrows.length === 2, `Salvaguardas de ${cls}`)
      const skillChoice = opts.class.choices.find((c) => c.kind === "skill")
      assert.ok(skillChoice, `Classe ${cls} deve ter escolha de perícias`)
      assert.ok(skillChoice!.choose >= 2, `Classe ${cls} escolhe pelo menos 2 perícias`)
      assert.ok(
        skillChoice!.options.length >= skillChoice!.choose,
        `Opções suficientes para ${cls}`,
      )
      for (const o of skillChoice!.options) {
        assert.ok(SKILLS[o.id], `Perícia "${o.id}" deve ser uma perícia SRD válida`)
      }
    }
  })

  it("todos os antecedentes SRD retornam suas proficiências e escolhas", () => {
    const catalog = getCreationCatalog()
    for (const bg of catalog.backgrounds) {
      const opts = getCharacterCreationOptions("Humano", "guerreiro", bg.id)
      assert.ok(opts.background.id, `Antecedente ${bg.id}`)
      assert.ok(
        opts.background.proficiencies.length >= 2,
        `Antecedente ${bg.id} concede proficiências`,
      )
    }
    // Caso específico do Acólito SRD
    const acolyte = getCharacterCreationOptions("Humano", "clérigo", "acolyte")
    assert.ok(
      acolyte.background.proficiencies.some((p) => p.id === "intuicao"),
      "Acólito tem Intuição",
    )
    assert.ok(
      acolyte.background.proficiencies.some((p) => p.id === "religiao"),
      "Acólito tem Religião",
    )
    const langChoice = acolyte.background.choices.find(
      (c) => c.kind === "language",
    )
    assert.ok(langChoice, "Acólito tem escolha de idiomas")
    assert.equal(langChoice!.choose, 2, "Acólito escolhe 2 idiomas")
  })

  it("raças com bônus fixos, meio-elfo e raças sem escolha", () => {
    // Humano: +1 em todos
    const human = getCharacterCreationOptions("Humano", "guerreiro", "acolyte")
    assert.deepEqual(human.race.fixedBonuses, {
      for: 1,
      des: 1,
      con: 1,
      int: 1,
      sab: 1,
      car: 1,
    })
    assert.equal(
      human.race.choices.filter((c) => c.kind === "ability").length,
      0,
    )

    // Alto Elfo: +2 Des, +1 Int
    const elf = getCharacterCreationOptions("high-elf", "mago", "acolyte")
    assert.deepEqual(elf.race.fixedBonuses, { des: 2, int: 1 })
    assert.equal(elf.race.choices.filter((c) => c.kind === "ability").length, 0)

    // Meio-Elfo: +2 Car fixo e escolha de 2 +1 livres
    const halfElf = getCharacterCreationOptions(
      "meio-elfo",
      "bardo",
      "acolyte",
    )
    assert.deepEqual(halfElf.race.fixedBonuses, { car: 2 })
    const abilityChoice = halfElf.race.choices.find((c) => c.kind === "ability")
    assert.ok(abilityChoice, "Meio-Elfo tem escolha de atributos")
    assert.equal(abilityChoice!.choose, 2)
    assert.ok(
      abilityChoice!.options.every((o) => o.id !== "car"),
      "Escolhas do meio-elfo não incluem Carisma",
    )
    assert.ok(
      halfElf.race.choices.some((c) => c.kind === "skill" && c.choose === 2),
      "Meio-Elfo tem Versatilidade em Perícias",
    )
  })

  it("rejeição de bônus racial, perícia, idioma, ferramenta ou item inválido", () => {
    const baseScores = { for: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 }

    // Rejeita meio-elfo sem os dois +1 distintos fora de Carisma
    assert.throws(
      () =>
        transaction(db, () =>
          createPc(db, {
            name: "MeioElfoFalho",
            race: "Meio-Elfo",
            class: "guerreiro",
            base_abilities: baseScores,
            choices: { ...validCreationChoices("Meio-Elfo", "guerreiro"), "racial-ability-bonus": ["car", "for"] },
          }),
        ),
      /Meio-elfo exige/,
    )

    // Rejeita meio-elfo com atributos duplicados
    assert.throws(
      () =>
        transaction(db, () =>
          createPc(db, {
            name: "MeioElfoDup",
            race: "Meio-Elfo",
            class: "guerreiro",
            base_abilities: baseScores,
            choices: { ...validCreationChoices("Meio-Elfo", "guerreiro"), "racial-ability-bonus": ["for", "for"] },
          }),
        ),
      /Meio-elfo exige/,
    )

    // Rejeita atributos finais que não conferem com base + bônus racial
    assert.throws(
      () =>
        transaction(db, () =>
          createPc(db, {
            name: "Adulterado",
            race: "Humano",
            class: "guerreiro",
            base_abilities: baseScores,
            abilities: { ...baseScores, for: 20 },
          }),
        ),
      /não correspondem aos valores-base/,
    )

    // Rejeita perícia fora do grupo da classe, mesmo que o cliente forje o payload.
    assert.throws(
      () =>
        transaction(db, () =>
          createPc(db, {
            name: "PericiaInvalida",
            race: "Humano",
            class: "guerreiro",
            base_abilities: baseScores,
            choices: { ...validCreationChoices("Humano", "guerreiro"), "class-skills": ["voo-espacial", "atletismo"] },
          }),
        ),
      /não é uma opção permitida/,
    )

    // Rejeita idioma inventado
    assert.throws(
      () =>
        transaction(db, () =>
          createPc(db, {
            name: "IdiomaInvalido",
            race: "Humano",
            class: "guerreiro",
            base_abilities: baseScores,
            choices: { ...validCreationChoices("Humano", "guerreiro"), "racial-language": ["klingon"] },
          }),
        ),
      /não é uma opção permitida/,
    )

    // Rejeita ferramenta fora do grupo racial concedido.
    assert.throws(
      () =>
        transaction(db, () =>
          createPc(db, {
            name: "FerramentaInvalida",
            race: "Anão da Colina",
            class: "guerreiro",
            background: "acolyte",
            base_abilities: baseScores,
            choices: { ...validCreationChoices("Anão da Colina", "guerreiro"), "racial-tool": ["thieves-tools"] },
          }),
        ),
      /não é uma opção permitida/,
    )

    // Rejeita item inexistente no SRD
    assert.throws(
      () =>
        transaction(db, () =>
          createPc(db, {
            name: "ItemInvalido",
            race: "Humano",
            class: "guerreiro",
            base_abilities: baseScores,
            choices: { ...validCreationChoices("Humano", "guerreiro"), "equipment-class-0": ["pistola-laser"] },
          }),
        ),
      /não é uma opção permitida/,
    )
  })

  it("equipamento escolhido aparece no inventário", () => {
    const baseScores = { for: 15, des: 13, con: 14, int: 10, sab: 12, car: 8 }
    transaction(db, () =>
      createPc(db, {
        name: "Valeroso",
        race: "Humano",
        class: "guerreiro",
        background: "acolyte",
        base_abilities: baseScores,
        choices: {
          ...validCreationChoices("Humano", "guerreiro", "acolyte"),
          "class-skills": ["atletismo", "percepcao"],
          "racial-language": ["elvish"],
          "background-languages": ["giant", "gnomish"],
          "equipment-class-0": ["chain-mail"],
          "equipment-class-1": ["longsword+shield"],
          "equipment-class-2": ["crossbow-light+crossbow-bolt:20"],
          "equipment-class-3": ["dungeoneers-pack"],
          "equipment-bg-holy-symbol": ["amulet"],
        },
      }),
    )

    const pid = pcId(db)!
    const pc = getCharacter(db, pid)
    assert.equal(pc.name, "Valeroso")
    // Base 15+1=16 For, 13+1=14 Des, 14+1=15 Con, etc.
    assert.equal(pc.sheet.abilities.for, 16)
    assert.equal(pc.sheet.abilities.des, 14)
    assert.equal(pc.sheet.abilities.con, 15)
    assert.equal(pc.sheet.baseAbilities?.for, 15)
    assert.ok(pc.sheet.languages.includes("elvish"))
    assert.ok(pc.sheet.skills.includes("atletismo"))
    assert.ok(pc.sheet.skills.includes("intuicao")) // de Acólito

    // Itens no inventário
    const items = all<ItemRow>(
      db,
      "SELECT * FROM items WHERE owner_char = ?",
      pid,
    )
    assert.ok(items.length >= 5)
    assert.ok(items.some((i) => i.name === "Cota de Malha" && i.equipped === 1))
    assert.ok(items.some((i) => i.name === "Escudo" && i.equipped === 1))
    assert.ok(items.some((i) => i.name === "Espada Longa"))
    assert.ok(items.some((i) => i.name === "Besta Leve"))
    assert.ok(items.some((i) => i.name === "Amuleto Sagrado"))
    // CA com Cota de Malha (16) + Escudo (+2) = 18
    assert.equal(pc.ac, 18)
  })

  it("ficha antiga abre com defaults seguros", () => {
    // Insere diretamente um JSON no banco simulando ficha legada sem os novos campos
    const legacySheet = {
      race: "Humano",
      class: "guerreiro",
      subclass: "",
      background: "Herói do Povo",
      abilities: { for: 16, des: 12, con: 14, int: 10, sab: 12, car: 8 },
      skills: ["atletismo"],
      saves: ["for", "con"],
      hp: 12,
      ac: 16,
    }
    db.prepare(
      "INSERT INTO characters(id, kind, name, summary, hp, max_hp, ac, level, cp, sheet, attitude, created_turn) VALUES('pc:antigo', 'pc', 'Veterano', '', 12, 12, 16, 1, 0, ?, 0, 0)",
    ).run(JSON.stringify(legacySheet))

    const char = getCharacter(db, "pc:antigo")
    assert.equal(char.name, "Veterano")
    assert.equal(char.sheet.baseAbilities, null)
    assert.deepEqual(char.sheet.proficiencies, [])
    assert.deepEqual(char.sheet.tools, [])
    assert.deepEqual(char.sheet.languages, [])
    assert.deepEqual(char.sheet.creationChoices, {})
    assert.ok(char.sheet.resources["segundo-folego"])
  })

  it("subclasse nos níveis corretos: Clérigo/Bruxo/Feiticeiro (1), Mago/Druida (2), Bardo/Guerreiro/Ladino (3)", () => {
    assert.equal(subclassRequiredLevel("clerigo"), 1)
    assert.equal(subclassRequiredLevel("bruxo"), 1)
    assert.equal(subclassRequiredLevel("feiticeiro"), 1)

    assert.equal(subclassRequiredLevel("mago"), 2)
    assert.equal(subclassRequiredLevel("druida"), 2)

    assert.equal(subclassRequiredLevel("bardo"), 3)
    assert.equal(subclassRequiredLevel("guerreiro"), 3)
    assert.equal(subclassRequiredLevel("ladino"), 3)
    assert.equal(subclassRequiredLevel("paladino"), 3)
    assert.equal(subclassRequiredLevel("barbaro"), 3)
    assert.equal(subclassRequiredLevel("monge"), 3)
    assert.equal(subclassRequiredLevel("patrulheiro"), 3)
  })

  it("ASI extra de Guerreiro (6 e 14) e Ladino (10)", () => {
    const scores = { for: 16, des: 14, con: 14, int: 10, sab: 10, car: 8 }

    // Guerreiro no nível 6
    const f6 = defaultSheet({
      class: "guerreiro",
      subclass: "champion",
      abilities: { ...scores },
    })
    const optF6 = levelUpOptions(f6, 5)
    assert.equal(optF6.level, 6)
    assert.equal(optF6.asi, true, "Guerreiro nível 6 deve ter ASI")

    // Guerreiro no nível 14
    const f14 = defaultSheet({
      class: "guerreiro",
      subclass: "champion",
      abilities: { ...scores },
    })
    const optF14 = levelUpOptions(f14, 13)
    assert.equal(optF14.level, 14)
    assert.equal(optF14.asi, true, "Guerreiro nível 14 deve ter ASI")

    // Ladino no nível 10
    const r10 = defaultSheet({
      class: "ladino",
      subclass: "thief",
      abilities: { ...scores },
    })
    const optR10 = levelUpOptions(r10, 9)
    assert.equal(optR10.level, 10)
    assert.equal(optR10.asi, true, "Ladino nível 10 deve ter ASI")

    // Outra classe (ex.: Mago no 6) não tem ASI no 6
    const w6 = defaultSheet({
      class: "mago",
      subclass: "evocation",
      abilities: { ...scores },
    })
    const optW6 = levelUpOptions(w6, 5)
    assert.equal(optW6.asi, false, "Mago nível 6 não tem ASI extra")
  })

  it("escolha de subclasse atualiza as opções específicas dela antes de confirmar nível", () => {
    // Patrulheiro subindo do 2 para o 3
    const ranger = defaultSheet({
      class: "patrulheiro",
      abilities: { for: 12, des: 16, con: 14, int: 10, sab: 14, car: 8 },
    })
    // Sem passar subclasse ainda
    const beforeSub = levelUpOptions(ranger, 2)
    assert.equal(beforeSub.subclass.required, true)
    assert.ok(
      !beforeSub.choices.some((c) => c.id === "hunters-prey"),
      "Sem a subclasse Hunter, não há escolhas de Hunter's Prey",
    )

    // Passando a subclasse candidata "hunter"
    const withSub = levelUpOptions(ranger, 2, "hunter")
    assert.ok(
      withSub.choices.some((c) => c.id === "hunters-prey"),
      "Com a subclasse 'hunter', opções de Hunter's Prey aparecem",
    )
    const preyChoice = withSub.choices.find((c) => c.id === "hunters-prey")
    assert.equal(preyChoice!.choose, 1)
    assert.ok(
      preyChoice!.options.some((o) => o.id === "hunters-prey-colossus-slayer"),
    )
  })
})
