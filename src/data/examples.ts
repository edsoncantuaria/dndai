// src/data/examples.ts
import { HomebrewContentType } from '@/services/homebrewService';

export const EXAMPLES: Record<HomebrewContentType, any> = {
  race: {
    "name": "Anão",
    "speed": 25,
    "ability_bonuses": [
      {
        "ability_score": {
          "index": "con",
          "name": "CON"
        },
        "bonus": 2
      }
    ],
    "alignment": "A maioria dos anões é leal, acreditando firmemente nos benefícios de uma sociedade bem ordenada. Eles tendem para o bem, com um forte senso de justiça.",
    "age": "Anões maturam no mesmo ritmo que os humanos, mas são considerados jovens até atingirem a idade de 50 anos. Em média, eles vivem cerca de 350 anos.",
    "size": "Medium",
    "size_description": "Anões têm entre 1,20 e 1,50 metro de altura e pesam cerca de 75 kg. Seu tamanho é Médio.",
    "starting_proficiencies": [
      {
        "index": "battleaxes",
        "name": "Machados de Batalha"
      },
      {
        "index": "handaxes",
        "name": "Machadinhas"
      },
      {
        "index": "light-hammers",
        "name": "Martelos Leves"
      },
      {
        "index": "warhammers",
        "name": "Martelos de Guerra"
      }
    ],
    "starting_proficiency_options": {
      "choose": 1,
      "type": "proficiencies",
      "from": {
        "option_set_type": "options_array",
        "options": [
          {
            "option_type": "reference",
            "item": { "index": "smiths-tools", "name": "Ferramentas de Ferreiro" }
          },
          {
            "option_type": "reference",
            "item": { "index": "brewers-supplies", "name": "Suprimentos de Cervejeiro" }
          },
          {
            "option_type": "reference",
            "item": { "index": "masons-tools", "name": "Ferramentas de Pedreiro" }
          }
        ]
      }
    },
    "languages": [
      {
        "index": "common",
        "name": "Comum"
      },
      {
        "index": "dwarvish",
        "name": "Anão"
      }
    ],
    "language_desc": "Você pode falar, ler e escrever Comum e Anão. O idioma Anão é cheio de consoantes duras e sons guturais, e essa característica transparece em qualquer outro idioma que um anão possa falar.",
    "traits": [
      {
        "index": "darkvision",
        "name": "Visão no Escuro"
      },
      {
        "index": "dwarven-resilience",
        "name": "Resiliência Anã"
      },
      {
        "index": "stonecunning",
        "name": "Astúcia da Pedra"
      }
    ],
    "subraces": [
      {
        "index": "hill-dwarf",
        "name": "Anão da Colina"
      }
    ]
  },
  subrace: {
    "name": "Alto Elfo",
    "race": {
      "index": "elf",
      "name": "Elfo"
    },
    "desc": "Como um alto elfo, você tem uma mente aguçada e um domínio da magia. Em muitos dos mundos de D&D, existem dois tipos de altos elfos. Um tipo é altivo e recluso, acreditando ser superior aos não-elfos e até mesmo a outros elfos. O outro tipo é mais comum e amigável, e muitas vezes encontrado entre humanos e outras raças.",
    "ability_bonuses": [
      {
        "ability_score": { "index": "int", "name": "INT" },
        "bonus": 1
      }
    ],
    "starting_proficiencies": [
      { "index": "longswords", "name": "Espadas Longas" },
      { "index": "shortswords", "name": "Espadas Curtas" },
      { "index": "shortbows", "name": "Arcos Curtos" },
      { "index": "longbows", "name": "Arcos Longos" }
    ],
    "languages": [],
    "racial_traits": [
        {
            "index": "high-elf-cantrip",
            "name": "Truque de Alto Elfo"
        },
        {
            "index": "extra-language",
            "name": "Idioma Extra"
        }
    ]
  },
  class: {
    "name": "Guerreiro",
    "hit_die": 10,
    "proficiency_choices": [
      {
        "desc": "Escolha duas perícias de: Acrobacia, Adestrar Animais, Atletismo, História, Intuição, Intimidação, Percepção e Sobrevivência",
        "choose": 2,
        "type": "proficiencies",
        "from": {
          "option_set_type": "options_array",
          "options": [
            { "option_type": "reference", "item": { "index": "skill-acrobatics" } },
            { "option_type": "reference", "item": { "index": "skill-animal-handling" } },
            { "option_type": "reference", "item": { "index": "skill-athletics" } }
          ]
        }
      }
    ],
    "proficiencies": [
      { "name": "Todas as Armaduras" },
      { "name": "Escudos" },
      { "name": "Armas Simples" },
      { "name": "Armas Marciais" }
    ],
    "saving_throws": [
      { "index": "str", "name": "STR" },
      { "index": "con", "name": "CON" }
    ],
    "starting_equipment_options": [
      {
        "desc": "(a) cota de malha ou (b) armadura de couro, arco longo e 20 flechas",
        "choose": 1,
        "from": {
            "option_set_type": "options_array",
            "options": [
                { "option_type": "counted_reference", "count": 1, "of": { "index": "chain-mail" } },
                { "option_type": "multiple", "items": [
                    { "option_type": "counted_reference", "count": 1, "of": { "index": "leather-armor" }},
                    { "option_type": "counted_reference", "count": 1, "of": { "index": "longbow" }},
                    { "option_type": "counted_reference", "count": 20, "of": { "index": "arrow" }}
                ]}
            ]
        }
      }
    ],
    "subclasses": [
      { "index": "champion", "name": "Campeão" }
    ]
  },
  subclass: {
    "name": "Campeão",
    "subclass_flavor": "Arquétipo Marcial",
    "desc": ["O arquétipo do Campeão foca no desenvolvimento da pura força física, aprimorada com precisão e mortalidade devastadoras."],
    "class": { "index": "fighter", "name": "Guerreiro" },
    "features": [
        {
            "name": "Crítico Aprimorado",
            "desc": ["A partir do 3º nível, seus ataques com armas adquirem um acerto crítico em uma rolagem de 19 ou 20."],
            "level": 3
        },
        {
            "name": "Atleta Notável",
            "desc": ["A partir do 7º nível, você pode adicionar metade do seu bônus de proficiência (arredondado para cima) a qualquer teste de Força, Destreza ou Constituição que você fizer que ainda não use seu bônus de proficiência."],
            "level": 7
        }
    ]
  },
  spell: {
    "name": "Bola de Fogo",
    "desc": ["Um raio de luz amarela sai do seu dedo indicador, e então floresce com um rugido baixo em uma explosão de chamas. Cada criatura em uma esfera de 6 metros de raio centrada em um ponto que você escolher dentro do alcance deve fazer um teste de resistência de Destreza. Um alvo sofre 8d6 de dano de fogo em uma falha, ou metade do dano em um sucesso."],
    "higher_level": ["Quando você conjura esta magia usando um espaço de magia de 4º nível ou superior, o dano aumenta em 1d6 para cada nível de espaço acima do 3º."],
    "range": "150 pés",
    "components": ["V", "S", "M"],
    "material": "Uma pequena bola de guano de morcego e enxofre.",
    "ritual": false,
    "duration": "Instantâneo",
    "concentration": false,
    "casting_time": "1 ação",
    "level": 3,
    "attack_type": "ranged",
    "damage": {
      "damage_type": { "index": "fire", "name": "Fogo" },
      "damage_at_slot_level": { "3": "8d6", "4": "9d6", "5": "10d6" }
    },
    "school": { "index": "evocation", "name": "Evocação" }
  },
  item: {
    "name": "Espada Longa",
    "equipment_category": { "index": "weapon", "name": "Arma" },
    "weapon_category": "Marcial",
    "weapon_range": "Corpo a Corpo",
    "category_range": "Corpo a Corpo Marcial",
    "cost": { "quantity": 15, "unit": "gp" },
    "damage": {
      "damage_dice": "1d8",
      "damage_type": { "index": "slashing", "name": "Cortante" }
    },
    "range": { "normal": 5 },
    "weight": 3,
    "properties": [
      { "index": "versatile", "name": "Versátil (1d10)" }
    ]
  },
  monster: {
    "name": "Goblin",
    "size": "Small",
    "type": "humanoid",
    "subtype": "goblinoid",
    "alignment": "neutral evil",
    "armor_class": 15,
    "hit_points": 7,
    "hit_dice": "2d6",
    "speed": { "walk": "30 ft." },
    "strength": 8, "dexterity": 14, "constitution": 10, "intelligence": 10, "wisdom": 8, "charisma": 8,
    "proficiencies": [{ "value": 6, "proficiency": { "index": "skill-stealth" }}],
    "senses": { "darkvision": "60 ft.", "passive_perception": 9 },
    "languages": "Comum, Goblin",
    "challenge_rating": 0.25,
    "xp": 50,
    "special_abilities": [{
      "name": "Fuga Ágil",
      "desc": "O goblin pode realizar a ação de Desengajar ou Esconder-se como uma ação bônus em cada um de seus turnos."
    }],
    "actions": [{
      "name": "Cimitarra",
      "desc": "Ataque com Arma Corpo a Corpo: +4 para acertar, alcance de 1,5 m, um alvo. Acerto: 5 (1d6 + 2) de dano cortante.",
      "attack_bonus": 4,
      "damage": [{ "damage_dice": "1d6 + 2", "damage_type": { "index": "slashing" }}]
    }]
  },
  background: {
    "name": "Acólito",
    "starting_proficiencies": [
        { "index": "skill-insight" },
        { "index": "skill-religion" }
    ],
    "language_options": { "choose": 2 },
    "starting_equipment": [
        { "equipment": { "index": "holy-symbol" }, "quantity": 1 },
        { "equipment": { "index": "prayer-book" }, "quantity": 1 }
    ],
    "feature": {
        "name": "Abrigo dos Fiéis",
        "desc": ["Como acólito, você tem o respeito daqueles que compartilham sua fé e pode realizar as cerimônias de sua divindade. Você e seus companheiros podem esperar receber cura e cuidados gratuitos em um templo de sua fé."]
    },
    "personality_traits": {
      "choose": 2, "from": { "options": [
        { "string": "Eu idolatro um herói particular da minha fé." },
        { "string": "Eu vejo presságios em cada evento e ação." }
      ]}
    },
    "ideals": { "choose": 1, "from": { "options": [{ "desc": "Tradição. As tradições ancestrais de adoração devem ser preservadas." }]}},
    "bonds": { "choose": 1, "from": { "options": [{ "string": "Eu morreria para recuperar uma relíquia ancestral de minha fé." }]}},
    "flaws": { "choose": 1, "from": { "options": [{ "string": "Eu julgo os outros severamente, e a mim mesmo mais ainda." }]}}
  },
  feat: {
    "name": "Atleta",
    "prerequisites": [],
    "desc": [
      "Você passou por um extenso treinamento físico para ganhar os seguintes benefícios:",
      "• Aumente sua pontuação de Força ou Destreza em 1, até um máximo de 20.",
      "• Quando você está caído, levantar-se usa apenas 1,5 metro de seu movimento.",
      "• Escalar não custa movimento extra.",
      "• Você pode fazer um salto em distância ou em altura com corrida após percorrer apenas 1,5 metro a pé, em vez de 3 metros."
    ]
  }
};
