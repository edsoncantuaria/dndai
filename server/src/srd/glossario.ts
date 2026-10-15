// Nomes em PT-BR das coleções que o upstream não traduz (só 3 de 25 têm pt-BR oficial).
// Entra como camada sobre o inglês; tradução oficial, quando existir, tem prioridade.
export const GLOSSARIO: Record<string, Record<string, string>> = {
  classes: { barbarian: "Bárbaro", bard: "Bardo", cleric: "Clérigo", druid: "Druida", fighter: "Guerreiro", monk: "Monge", paladin: "Paladino", ranger: "Patrulheiro", rogue: "Ladino", sorcerer: "Feiticeiro", warlock: "Bruxo", wizard: "Mago" },
  species: { dragonborn: "Draconato", dwarf: "Anão", elf: "Elfo", gnome: "Gnomo", goliath: "Golias", halfling: "Halfling", human: "Humano", orc: "Orc", tiefling: "Tiefling" },
  backgrounds: { acolyte: "Acólito", criminal: "Criminoso", sage: "Sábio", soldier: "Soldado" },
  skills: { acrobatics: "Acrobacia", "animal-handling": "Lidar com Animais", arcana: "Arcanismo", athletics: "Atletismo", deception: "Enganação", history: "História", insight: "Intuição", intimidation: "Intimidação", investigation: "Investigação", medicine: "Medicina", nature: "Natureza", perception: "Percepção", performance: "Atuação", persuasion: "Persuasão", religion: "Religião", "sleight-of-hand": "Prestidigitação", stealth: "Furtividade", survival: "Sobrevivência" },
  "damage-types": { acid: "Ácido", bludgeoning: "Contundente", cold: "Frio", fire: "Fogo", force: "Energia", lightning: "Elétrico", necrotic: "Necrótico", piercing: "Perfurante", poison: "Veneno", psychic: "Psíquico", radiant: "Radiante", slashing: "Cortante", thunder: "Trovão" },
  conditions: { blinded: "Cego", charmed: "Enfeitiçado", deafened: "Surdo", exhaustion: "Exaustão", frightened: "Amedrontado", grappled: "Agarrado", incapacitated: "Incapacitado", invisible: "Invisível", paralyzed: "Paralisado", petrified: "Petrificado", poisoned: "Envenenado", prone: "Caído", restrained: "Contido", stunned: "Atordoado", unconscious: "Inconsciente" },
  "magic-schools": { abjuration: "Abjuração", conjuration: "Conjuração", divination: "Adivinhação", enchantment: "Encantamento", evocation: "Evocação", illusion: "Ilusão", necromancy: "Necromancia", transmutation: "Transmutação" },
}
