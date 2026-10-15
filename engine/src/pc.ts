import { z } from "zod";
import { type DB, index, metaNum, setMeta } from "./db.ts";
import {
  type Ability,
  ABILITIES,
  CLASSES,
  mod,
  parseAbility,
  parseClass,
  parseSkill,
  STARTING_GP,
  spellSlots,
  norm,
} from "./rules.ts";
import {
  chooseFeature,
  pendingFeatureChoices,
  racialInfo,
  resolveSubclass,
  subclassRequiredLevel,
  syncProgression,
  validateRacialAbilities,
} from "./progression.ts";
import { defaultSheet, newId, parseMoney, pcId, resolveRef } from "./world.ts";
import {
  getCharacterCreationOptions,
  translateItem,
  translateLanguage,
  translateTool,
} from "./character-options.ts";
import { loadSrd } from "./srd.ts";

const PcSchema = z
  .object({
    name: z.string().trim().min(1),
    race: z.string().trim().min(1),
    class: z.string().trim().min(1),
    subclass: z.string().default(""),
    background: z.string().default(""),
    summary: z.string().default(""),
    level: z.number().int().min(1).max(20).default(1),
    abilities: z
      .object({
        for: z.number().int().min(1).max(20),
        des: z.number().int().min(1).max(20),
        con: z.number().int().min(1).max(20),
        int: z.number().int().min(1).max(20),
        sab: z.number().int().min(1).max(20),
        car: z.number().int().min(1).max(20),
      })
      .strict()
      .optional(),
    base_abilities: z
      .object({
        for: z.number().int().min(1).max(20),
        des: z.number().int().min(1).max(20),
        con: z.number().int().min(1).max(20),
        int: z.number().int().min(1).max(20),
        sab: z.number().int().min(1).max(20),
        car: z.number().int().min(1).max(20),
      })
      .strict()
      .optional(),
    choices: z.record(z.array(z.string().min(1))).default({}),
    skills: z.array(z.string()).default([]),
    expertise: z.array(z.string()).default([]),
    languages: z.array(z.string()).default([]),
    tools: z.array(z.string()).default([]),
    equipment_choices: z.array(z.string()).default([]),
    ac: z.number().int().min(1).optional(),
    hp: z.number().int().positive().optional(),
    speed: z.number().positive().optional(),
    money: z.union([z.number().int(), z.string()]).default(0),
    place: z.string().optional(),
    items: z
      .array(
        z
          .object({
            name: z.string().min(1),
            qty: z.number().int().positive().default(1),
            kind: z.string().default("equipamento"),
            props: z.record(z.unknown()).default({}),
            equipped: z.boolean().default(false),
            notes: z.string().default(""),
          })
          .strict(),
      )
      .default([]),
    spells: z.array(z.string()).default([]),
    features: z.array(z.string()).default([]),
    portrait: z.string().optional(),
  })
  .strict();

interface MaterializedItem {
  name: string;
  qty: number;
  kind: string;
  props: Record<string, unknown>;
  equipped: boolean;
  notes: string;
}

function resolveSrdItemRecord(
  index: string,
  qty = 1,
  allEq: Record<string, any>,
): MaterializedItem {
  const e = allEq[index];
  if (!e)
    throw new Error(
      `Item "${index}" inválido: não encontrado no catálogo SRD.`,
    );
  const cat = e.equipment_category?.index;
  let kind = "equipamento";
  const props: Record<string, unknown> = {};
  let equipped = false;

  if (cat === "armor") {
    if (e.armor_category === "Shield") {
      kind = "escudo";
      props.ac_bonus = e.armor_class?.base ?? 2;
      equipped = true;
    } else {
      kind = "armadura";
      props.ac = e.armor_class?.base ?? 11;
      if (e.armor_class?.dex_bonus) {
        props.max_dex = e.armor_class.max_bonus ?? 99;
      } else {
        props.max_dex = 0;
      }
      equipped = true;
    }
  } else if (cat === "weapon") {
    kind = "arma";
    if (e.damage) {
      props.damage = e.damage.damage_dice;
      const dt = e.damage.damage_type?.index;
      const DT_MAP: Record<string, string> = {
        slashing: "cortante",
        piercing: "perfurante",
        bludgeoning: "contundente",
      };
      props.damage_type = DT_MAP[dt] ?? dt;
    }
  } else if (cat === "tools") {
    kind = "ferramenta";
  }

  return {
    name: translateItem(index),
    qty,
    kind,
    props,
    equipped,
    notes: "",
  };
}

export function createPc(db: DB, input: unknown): string[] {
  if (pcId(db))
    throw new Error("Esta campanha já tem um personagem do jogador.");
  const parsed = PcSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `Ficha inválida: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const p = parsed.data;
  const cls = parseClass(p.class);
  if (!cls)
    throw new Error(
      `Classe "${p.class}" desconhecida. Use: ${Object.keys(CLASSES).join(", ")}.`,
    );
  const def = CLASSES[cls];

  // --- 1. ATRIBUTOS & BÔNUS RACIAIS ---
  if (!p.abilities && !p.base_abilities) {
    throw new Error("Informe abilities ou base_abilities.");
  }

  const isHalfElf = norm(p.race) === "meioelfo" || norm(p.race) === "halfelf";
  const rInfo = racialInfo(p.race);

  let finalAbilities: Record<Ability, number>;
  if (p.base_abilities) {
    const computed: Record<Ability, number> = { ...p.base_abilities };
    if (rInfo) {
      for (const [a, b] of Object.entries(rInfo.bonuses)) {
        computed[a as Ability] += b;
      }
    }
    if (isHalfElf) {
      const freeChoices = (
        p.choices["racial-ability-bonus"] ??
        p.choices["racial_ability_bonus"] ??
        p.choices["ability"] ??
        []
      )
        .map(parseAbility)
        .filter(Boolean) as Ability[];

      if (
        freeChoices.length !== 2 ||
        freeChoices[0] === freeChoices[1] ||
        freeChoices.includes("car")
      ) {
        throw new Error(
          "Meio-elfo exige +2 Carisma e +1 em dois outros atributos diferentes.",
        );
      }
      for (const a of freeChoices) computed[a] += 1;
    }

    if (p.abilities) {
      for (const a of ABILITIES) {
        if (p.abilities[a] !== computed[a]) {
          throw new Error(
            "Atributos finais não correspondem aos valores-base + bônus raciais SRD.",
          );
        }
      }
      finalAbilities = p.abilities;
    } else {
      finalAbilities = computed;
    }
  } else {
    finalAbilities = p.abilities!;
  }

  validateRacialAbilities(p.race, finalAbilities, p.base_abilities);

  // --- 2. SUBCLASSE ---
  const subclass = p.subclass ? resolveSubclass(cls, p.subclass).index : "";
  if (subclass && p.level < subclassRequiredLevel(cls)) {
    throw new Error("A escolha de subclasse ainda não está disponível.");
  }

  // --- 3. PERÍCIAS ---
  const toSkill = (s: string) => {
    const k = parseSkill(s);
    if (!k) throw new Error(`Perícia "${s}" desconhecida.`);
    return k;
  };

  // Verificar se há duplicatas dentro das perícias explicitamente escolhidas
  const chosenSkills = p.skills.map(toSkill);
  if (new Set(chosenSkills).size !== chosenSkills.length) {
    throw new Error("Perícias duplicadas não permitidas na seleção.");
  }

  // Obter opções e proficiências de raça / antecedente / classe se conhecidos
  let optCatalog: ReturnType<typeof getCharacterCreationOptions> | null = null;
  try {
    optCatalog = getCharacterCreationOptions(
      p.race,
      cls,
      p.background || "acolyte",
    );
  } catch {
    /* Raças ou antecedentes caseiros continuam válidos */
  }

  const bgSkills: string[] = [];
  if (optCatalog) {
    for (const prof of optCatalog.background.proficiencies) {
      const sk = parseSkill(prof.id);
      if (sk) bgSkills.push(sk);
    }
  }

  // O app moderno identifica cada resposta pelo grupo oferecido pelo motor.
  // Portanto, uma opção válida em outro grupo não concede proficiência ou item.
  const creationGroups = optCatalog
    ? [...optCatalog.race.choices, ...optCatalog.class.choices, ...optCatalog.background.choices, ...optCatalog.equipment]
    : [];
  const selectedCreationChoices: Record<string, string[]> = {};
  if (optCatalog && p.base_abilities) {
    const groupIds = new Set(creationGroups.map((group) => group.id));
    for (const id of Object.keys(p.choices)) {
      if (!groupIds.has(id))
        throw new Error(`Escolha de criação "${id}" não é reconhecida pelo catálogo SRD.`);
    }
    if (p.skills.length || p.languages.length || p.tools.length || p.equipment_choices.length)
      throw new Error("Use choices por grupo para enviar perícias, idiomas, ferramentas e equipamento iniciais.");
    for (const group of creationGroups) {
      const selected = p.choices[group.id] ?? [];
      if (selected.length !== group.choose || new Set(selected).size !== selected.length)
        throw new Error(`${group.label}: escolha exatamente ${group.choose} opção(ões) sem repetir.`);
      const allowed = new Set(group.options.map((option) => option.id));
      for (const id of selected) {
        if (!allowed.has(id))
          throw new Error(`${group.label}: "${id}" não é uma opção permitida.`);
      }
      selectedCreationChoices[group.id] = selected;
    }
  }

  const racialSkills: string[] = [];
  if (isHalfElf) {
    const halfElfSkills = (selectedCreationChoices["racial-skill"] ?? p.choices["racial-skill"] ?? []).map(toSkill);
    if (halfElfSkills.length === 2 && halfElfSkills[0] !== halfElfSkills[1]) {
      racialSkills.push(...halfElfSkills);
    }
  } else {
    const raceKey = norm(p.race);
    if (raceKey.includes("elf") && !raceKey.includes("half"))
      racialSkills.push("percepcao");
    if (raceKey.includes("orc")) racialSkills.push("intimidacao");
  }

  // Unir perícias de classe, antecedente e raça sem duplicatas
  const selectedSkills = optCatalog && p.base_abilities
    ? creationGroups
        .filter((group) => group.kind === "skill" && group.id !== "racial-skill")
        .flatMap((group) => selectedCreationChoices[group.id] ?? [])
        .map(toSkill)
    : chosenSkills;
  const allSkills = [
    ...new Set([...selectedSkills, ...bgSkills, ...racialSkills]),
  ];
  const expertise = p.expertise.map(toSkill);

  // --- 4. IDIOMAS & FERRAMENTAS & PROFICIÊNCIAS ---
  const allLangOptions = [
    "common",
    "dwarvish",
    "elvish",
    "giant",
    "gnomish",
    "goblin",
    "halfling",
    "orc",
    "abyssal",
    "celestial",
    "draconic",
    "deep-speech",
    "infernal",
    "primordial",
    "sylvan",
    "undercommon",
  ];
  const toLang = (l: string) => {
    const k = norm(l);
    const found = allLangOptions.find(
      (opt) => norm(opt) === k || norm(translateLanguage(opt)) === k,
    );
    if (!found) throw new Error(`Idioma "${l}" desconhecido no catálogo SRD.`);
    return found;
  };

  const chosenLanguages = (optCatalog && p.base_abilities
    ? creationGroups.filter((group) => group.kind === "language").flatMap((group) => selectedCreationChoices[group.id] ?? [])
    : [...p.languages, ...(p.choices["racial-language"] ?? []), ...(p.choices["background-languages"] ?? [])]
  ).map(toLang);

  const defaultLanguages: string[] = ["common"];
  const rk = norm(p.race);
  if (rk.includes("elf") || rk.includes("halfelf"))
    defaultLanguages.push("elvish");
  if (rk.includes("dwarf") || rk.includes("anao"))
    defaultLanguages.push("dwarvish");
  if (rk.includes("gnom")) defaultLanguages.push("gnomish");
  if (rk.includes("halfling")) defaultLanguages.push("halfling");
  if (rk.includes("orc")) defaultLanguages.push("orc");
  if (rk.includes("dracon") || rk.includes("dragon"))
    defaultLanguages.push("draconic");
  if (rk.includes("tiefling")) defaultLanguages.push("infernal");

  const finalLanguages = [
    ...new Set([...defaultLanguages, ...chosenLanguages]),
  ];

  const chosenTools = optCatalog && p.base_abilities
    ? creationGroups.filter((group) => group.kind === "tool").flatMap((group) => selectedCreationChoices[group.id] ?? [])
    : [...p.tools, ...(p.choices["racial-tool"] ?? []), ...(p.choices["background-tools"] ?? []), ...(p.choices["class-tools-0"] ?? []), ...(p.choices["class-tools-1"] ?? [])];
  const fixedTools =
    optCatalog?.background.proficiencies
      .map((p) => p.id)
      .filter(
        (id) =>
          id.includes("tools") ||
          id.includes("supplies") ||
          id.includes("kit") ||
          id.includes("vehicles"),
      ) ?? [];
  const finalTools = [...new Set([...fixedTools, ...chosenTools])];

  const finalProficiencies = [
    ...(optCatalog?.class.proficiencies.map((pr) => pr.id) ?? []),
  ];

  // --- 5. EQUIPAMENTO INICIAL ---
  const allEqList = loadSrd("equipment") as any[];
  const allEqMap = Object.fromEntries(allEqList.map((e) => [e.index, e]));
  const materializedItems: MaterializedItem[] = [];

  // Itens fixos de classe
  const allClasses = loadSrd("classes") as any[];
  const srdCls = allClasses.find((c) => parseClass(c.index) === cls);
  const fixedClassItems =
    srdCls?.starting_equipment?.starting_equipment ??
    srdCls?.starting_equipment ??
    [];
  for (const it of fixedClassItems) {
    const idx = it.equipment?.index ?? it.equipment;
    if (idx && typeof idx === "string") {
      materializedItems.push(
        resolveSrdItemRecord(idx, it.quantity ?? 1, allEqMap),
      );
    }
  }

  // Itens fixos de antecedente
  const allBgs = loadSrd("backgrounds") as any[];
  const srdBg = allBgs.find(
    (b) =>
      norm(b.index) === norm(p.background) ||
      norm(b.name) === norm(p.background),
  );
  const fixedBgItems = srdBg?.starting_equipment ?? [];
  for (const it of fixedBgItems) {
    const idx = it.equipment?.index ?? it.equipment;
    if (idx && typeof idx === "string") {
      materializedItems.push(
        resolveSrdItemRecord(idx, it.quantity ?? 1, allEqMap),
      );
    }
  }

  // Escolhas de equipamento
  const equipmentChoices = optCatalog && p.base_abilities
    ? optCatalog.equipment.flatMap((group) => selectedCreationChoices[group.id] ?? [])
    : p.equipment_choices;
  for (const choiceStr of equipmentChoices) {
    const parts = choiceStr.split("+");
    for (const part of parts) {
      const [idx, qtyStr] = part.split(":");
      const qty = qtyStr ? Number.parseInt(qtyStr, 10) || 1 : 1;
      materializedItems.push(resolveSrdItemRecord(idx, qty, allEqMap));
    }
  }

  // Itens explícitos fornecidos na chamada
  for (const it of p.items) {
    materializedItems.push({
      name: it.name,
      qty: it.qty,
      kind: it.kind,
      props: it.props,
      equipped: it.equipped,
      notes: it.notes,
    });
  }

  // --- 6. CÁLCULO DE PV E CA ---
  const conMod = mod(finalAbilities.con);
  const avg = Math.floor(def.hitDie / 2) + 1;
  const computedHp =
    def.hitDie + conMod + (p.level - 1) * Math.max(1, avg + conMod);
  const perLevel = Math.max(1, def.hitDie + conMod);
  const hpCeiling = perLevel * p.level;
  if (p.hp !== undefined && p.hp > hpCeiling) {
    throw new Error(
      `PV iniciais ${p.hp} acima do máximo rolável da classe (${hpCeiling}). O motor usa ${Math.max(1, computedHp)} se você omitir hp.`,
    );
  }
  const hp = Math.max(1, p.hp ?? computedHp);

  const desMod = mod(finalAbilities.des);
  let computedAc = 10 + desMod;
  const equippedArmor = materializedItems.find(
    (i) =>
      i.kind === "armadura" && i.equipped && typeof i.props.ac === "number",
  );
  const equippedShield = materializedItems.find(
    (i) =>
      i.kind === "escudo" && i.equipped && typeof i.props.ac_bonus === "number",
  );
  if (equippedArmor) {
    const maxDex = (equippedArmor.props.max_dex as number) ?? 99;
    computedAc = (equippedArmor.props.ac as number) + Math.min(desMod, maxDex);
  }
  if (equippedShield) {
    computedAc += (equippedShield.props.ac_bonus as number) ?? 2;
  }
  const ac = p.ac ?? computedAc;
  if (ac < 8 || ac > 25)
    throw new Error(`CA ${ac} fora do intervalo inicial 8–25.`);

  // --- 7. DINHEIRO INICIAL ---
  const wealth = STARTING_GP[cls];
  const askedCp = Math.max(0, parseMoney(p.money));
  const startingCp = askedCp === 0 ? wealth.avg * 100 : askedCp;
  if (startingCp > wealth.max * 100) {
    throw new Error(
      `Dinheiro inicial acima do máximo da classe ${def.label} (${wealth.max} po). Omita money para usar a média (${wealth.avg} po).`,
    );
  }

  // --- 8. GRAVAR FICHA & SINCRONIZAR PROGRESSÃO ---
  const slots: Record<string, { max: number; used: number }> = {};
  for (const [lvl, max] of Object.entries(spellSlots(cls, p.level))) {
    slots[lvl] = { max, used: 0 };
  }

  const creationChoices: Record<string, string[]> = {
    ...p.choices,
    ...(equipmentChoices.length ? { equipment: equipmentChoices } : {}),
  };

  const sheet = defaultSheet({
    race: p.race,
    class: cls,
    subclass,
    background: p.background,
    abilities: finalAbilities,
    baseAbilities: p.base_abilities ?? null,
    skills: allSkills,
    expertise,
    saves: def.saves,
    proficiencies: finalProficiencies,
    tools: finalTools,
    languages: finalLanguages,
    creationChoices,
    slots,
    spells: p.spells,
    features: p.features,
    hitDice: { die: def.hitDie, max: p.level, used: 0 },
    speed: p.speed ?? rInfo?.speed ?? 9,
    portrait: p.portrait,
  });

  syncProgression(sheet, p.level);
  for (const [id, selected] of Object.entries(p.choices)) {
    // Escolhas de criação racial/perícia não são features de nível
    try {
      chooseFeature(sheet, p.level, id, selected);
    } catch {
      /* escolhas que não são features de progressão são salvas em creationChoices */
    }
  }

  const place = p.place ? resolveRef(db, p.place, ["place"]) : null;
  const id = newId(db, "pc", p.name);
  const turn = metaNum(db, "turn");

  db.prepare(
    "INSERT INTO characters(id, kind, name, summary, place_id, hp, max_hp, ac, level, cp, sheet, attitude, created_turn) VALUES(?, 'pc', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)",
  ).run(
    id,
    p.name,
    p.summary,
    place,
    hp,
    hp,
    ac,
    p.level,
    startingCp,
    JSON.stringify(sheet),
    turn,
  );
  setMeta(db, "prep_sealed", 1);
  if (place)
    db.prepare("UPDATE places SET visited = 1 WHERE id = ?").run(place);

  for (const it of materializedItems) {
    db.prepare(
      "INSERT INTO items(id, owner_char, name, qty, kind, props, equipped, notes) VALUES(?,?,?,?,?,?,?,?)",
    ).run(
      newId(db, "item", it.name),
      id,
      it.name,
      it.qty,
      it.kind,
      JSON.stringify(it.props),
      it.equipped ? 1 : 0,
      it.notes,
    );
  }

  index(
    db,
    id,
    "entidade",
    `${p.name} — ${p.race} ${def.label} — ${p.summary}`,
  );
  const pending = pendingFeatureChoices(sheet, p.level);

  return [
    `+ personagem do jogador ${p.name} [${id}]: ${p.race} ${def.label} nível ${p.level}, ${hp} PV, CA ${ac}${place ? `, em ${place}` : " (sem local: use move ou recrie com place)"}.`,
    ...pending.map(
      (c) =>
        `Escolha pendente: ${c.name} (${c.id}), ${c.choose} opção(ões). Use feature choose pc ${c.id} <opções>.`,
    ),
    ...(!subclass && p.level >= subclassRequiredLevel(cls)
      ? [
          "Subclasse pendente: escolha com o jogador; será exigida na próxima subida de nível.",
        ]
      : []),
  ];
}
