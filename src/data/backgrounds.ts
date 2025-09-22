// data/backgrounds.ts
import type { ApiBackground } from '../types';

export const localBackgrounds: ApiBackground[] = [
  {
    "index": "acolyte",
    "name": "Acólito",
    "url": "/api/backgrounds/acolyte",
    "starting_proficiencies": [
        { "name": "Skill: Insight", "type": "Skills" },
        { "name": "Skill: Religion", "type": "Skills" }
    ],
    "language_options": { "choose": 2 },
    "starting_equipment": [
        { "equipment": { "index": "holy-symbol-amulet", "name": "Um símbolo sagrado (um amuleto)", "url": "/api/equipment/holy-symbol-amulet" },"quantity": 1 },
        { "equipment": { "index": "prayer-book", "name": "Um livro de orações ou um rosário", "url": "/api/equipment/prayer-book" }, "quantity": 1 },
        { "equipment": { "index": "incense-block", "name": "5 varetas de incenso", "url": "/api/equipment/incense-block" }, "quantity": 1 },
        { "equipment": { "index": "vestments", "name": "Vestimentas", "url": "/api/equipment/vestments" }, "quantity": 1 },
        { "equipment": { "index": "clothes-common", "name": "Roupas Comuns", "url": "/api/equipment/clothes-common" }, "quantity": 1 },
        { "equipment": { "index": "pouch", "name": "Bolsa contendo 15 po", "url": "/api/equipment/pouch" }, "quantity": 1 }
    ],
    "starting_equipment_options": [],
    "feature": { "name": "Abrigo dos Fiéis", "desc": ["Como acólito, você comanda o respeito daqueles que compartilham sua fé e pode realizar as cerimônias religiosas de sua divindade. Você e seus companheiros de aventura podem esperar receber cura e cuidados gratuitos em um templo, santuário ou outra presença estabelecida de sua fé, embora devam fornecer quaisquer componentes materiais necessários para as magias."] },
    "personality_traits": { "choose": 2, "from": { "options": [{ "string": "Eu idolatro um herói da minha fé e constantemente me refiro aos seus feitos e exemplo." }, { "string": "Eu posso encontrar um terreno comum entre os inimigos mais ferozes, empatizando com eles e sempre trabalhando em prol da paz." }, { "string": "Eu vejo presságios em cada evento e ação. Os deuses falam conosco o tempo todo." }, { "string": "Nada pode abalar minha atitude otimista." }] } },
    "ideals": { "choose": 1, "from": { "options": [{ "desc": "Tradição. As tradições antigas de adoração e sacrifício devem ser preservadas e mantidas.", "alignments": [{ "index": "lawful-good", "name": "Leal e Bom", "url": "/api/alignments/lawful-good" }] }, { "desc": "Fé. Eu confio que minha divindade guiará minhas ações. Tenho fé que, se eu trabalhar duro, as coisas darão certo.", "alignments": [{ "index": "lawful-good", "name": "Leal e Bom", "url": "/api/alignments/lawful-good" }] }] } },
    "bonds": { "choose": 1, "from": { "options": [{ "string": "Eu faria qualquer coisa para recuperar uma relíquia antiga da minha fé que foi perdida há muito tempo." }, { "string": "Eu devo minha vida ao sacerdote que me acolheu quando meus pais morreram." }] } },
    "flaws": { "choose": 1, "from": { "options": [{ "string": "Eu julgo os outros com dureza e a mim mesmo com mais dureza ainda." }, { "string": "Eu deposito muita confiança naqueles que detêm o poder dentro da hierarquia da minha igreja." }] } }
  },
  {
    "index": "charlatan",
    "name": "Charlatão",
    "url": "/api/backgrounds/charlatan",
    "starting_proficiencies": [
      { "name": "Skill: Deception", "type": "Skills" },
      { "name": "Skill: Sleight of Hand", "type": "Skills" },
      { "name": "Kit de Disfarce", "type": "Artisan's Tools" },
      { "name": "Kit de Falsificação", "type": "Artisan's Tools" }
    ],
    "language_options": { "choose": 0 },
    "starting_equipment": [
      { "equipment": { "index": "clothes-fine", "name": "Um conjunto de roupas finas", "url": "/api/equipment/clothes-fine" }, "quantity": 1 },
      { "equipment": { "index": "disguise-kit", "name": "Kit de Disfarce", "url": "/api/equipment/disguise-kit" }, "quantity": 1 },
      { "equipment": { "index": "pouch", "name": "Bolsa contendo 15 po", "url": "/api/equipment/pouch" }, "quantity": 1 }
    ],
    "starting_equipment_options": [{
      "choose": 1,
      "type": "choice",
      "desc": "Escolha de item de trapaça",
      "from": {
        "option_set_type": "options_array",
        "options": [
          { "type": "counted_reference", "count": 1, "of": { "index": "ten-stoppered-bottles", "name": "Dez garrafas com rolha cheias de líquido colorido", "url": "/api/equipment/stoppered-bottle" } },
          { "type": "counted_reference", "count": 1, "of": { "index": "weighted-dice", "name": "Um conjunto de dados viciados", "url": "/api/equipment/dice-set-weighted" } },
          { "type": "counted_reference", "count": 1, "of": { "index": "deck-marked-cards", "name": "Um baralho de cartas marcadas", "url": "/api/equipment/cards-marked-deck" } },
          { "type": "counted_reference", "count": 1, "of": { "index": "signet-ring", "name": "Anel de sinete de um duque imaginário", "url": "/api/equipment/signet-ring" } }
        ]
      }
    }],
    "feature": { "name": "Identidade Falsa", "desc": ["Você criou uma segunda identidade que inclui documentação, conhecidos estabelecidos e disfarces que permitem que você assuma essa persona.", "Você pode forjar documentos, incluindo papéis oficiais e cartas pessoais, desde que tenha visto um exemplo do tipo de documento ou caligrafia que está tentando copiar."] },
    "personality_traits": { "choose": 2, "from": { "options": [{ "string": "Eu me apaixono e desapaixono facilmente, e estou sempre atrás de alguém." }, { "string": "Eu tenho uma piada para cada ocasião, especialmente aquelas onde o humor é inapropriado." }, { "string": "A bajulação é meu truque preferido para conseguir o que quero." }, { "string": "Sou um apostador nato que não resiste a arriscar por uma potencial recompensa." }] } },
    "ideals": { "choose": 1, "from": { "options": [{ "desc": "Independência. Sou um espírito livre — ninguém me diz o que fazer.", "alignments": [{ "index": "chaotic-neutral", "name": "Caótico e Neutro", "url": "/api/alignments/chaotic-neutral" }] }, { "desc": "Justiça. Eu nunca engano pessoas que não podem perder algumas moedas.", "alignments": [{ "index": "lawful-good", "name": "Leal e Bom", "url": "/api/alignments/lawful-good" }, { "index": "lawful-neutral", "name": "Leal e Neutro", "url": "/api/alignments/lawful-neutral" }] }] } },
    "bonds": { "choose": 1, "from": { "options": [{ "string": "Eu enganei a pessoa errada e preciso evitá-la ou consertar as coisas." }, { "string": "Eu devo tudo ao meu mentor, que me ensinou os truques." }] } },
    "flaws": { "choose": 1, "from": { "options": [{ "string": "Não consigo resistir a um rosto bonito." }, { "string": "Estou sempre endividado." }] } }
  },
  {
    "index": "entertainer",
    "name": "Artista",
    "url": "/api/backgrounds/entertainer",
    "starting_proficiencies": [
        { "name": "Skill: Acrobatics", "type": "Skills" }, 
        { "name": "Skill: Performance", "type": "Skills" },
        { "name": "Kit de Disfarce", "type": "Artisan's Tools" }
    ],
    "starting_proficiency_options": [{ "choose": 1, "type": "proficiencies", "desc": "Escolha de Instrumento Musical", "from": { "option_set_type": "equipment_category", "equipment_category": { "index": "musical-instruments", "name": "Instrumentos Musicais", "url": "/api/equipment-categories/musical-instruments" } }}],
    "language_options": { "choose": 0 },
    "starting_equipment": [
        { "equipment": { "index": "disguise-kit", "name": "Kit de Disfarce", "url": "/api/equipment/disguise-kit" }, "quantity": 1 },
        { "equipment": { "index": "pouch", "name": "Bolsa contendo 15 po", "url": "/api/equipment/pouch" }, "quantity": 1 }
    ],
    "starting_equipment_options": [{
      "choose": 1, "type": "choice", "desc": "Escolha de um instrumento musical", "from": { "option_set_type": "equipment_category", "equipment_category": { "index": "musical-instruments", "name": "Instrumentos Musicais", "url": "/api/equipment-categories/musical-instruments" } }
    }, {
      "choose": 1, "type": "choice", "desc": "Escolha de uma lembrança", "from": { "option_set_type": "options_array", "options": [
          { "type": "counted_reference", "count": 1, "of": { "index": "favor-of-an-admirer", "name": "Lembrança de um admirador (uma carta de amor, mecha de cabelo ou bugiganga)", "url": "/api/equipment/favor-of-an-admirer" } }
        ]}
    }],
    "feature": { "name": "A Pedido do Público", "desc": ["Você sempre pode encontrar um lugar para se apresentar, geralmente em uma estalagem ou taverna, mas às vezes em um circo, teatro ou na corte de um nobre.", "Nesses lugares, você recebe alojamento e comida gratuitos de qualidade modesta."] },
    "personality_traits": { "choose": 2, "from": { "options": [{ "string": "Eu conheço uma história relevante para quase toda situação." }, { "string": "Sempre que chego a um lugar novo, coleciono os rumores locais e os espalho." }, { "string": "Eu faço qualquer coisa por um pouco de aplauso." }, { "string": "Eu sou sempre a alma da festa." }] } },
    "ideals": { "choose": 1, "from": { "options": [{ "desc": "Criatividade. O mundo precisa de novas ideias e ações ousadas.", "alignments": [{ "index": "chaotic-good", "name": "Caótico e Bom", "url": "/api/alignments/chaotic-good" }] }, { "desc": "Beleza. O que é belo nos aponta para o que é verdadeiro.", "alignments": [{ "index": "neutral-good", "name": "Neutro e Bom", "url": "/api/alignments/neutral-good" }] }] } },
    "bonds": { "choose": 1, "from": { "options": [{ "string": "Eu idolatro um herói dos contos antigos e meço meus feitos contra os dele." }, { "string": "Trarei uma fúria terrível sobre os malfeitores que destruíram minha terra natal." }] } },
    "flaws": { "choose": 1, "from": { "options": [{ "string": "Sou um bobo por um rosto bonito." }, { "string": "Não consigo resistir a correr riscos." }] } }
  },
  {
    "index": "folk-hero",
    "name": "Herói do Povo",
    "url": "/api/backgrounds/folk-hero",
    "starting_proficiencies": [
        { "name": "Skill: Animal Handling", "type": "Skills" }, 
        { "name": "Skill: Survival", "type": "Skills" },
        { "name": "Veículos (terrestres)", "type": "Vehicles (Land)" }
    ],
    "starting_proficiency_options": [{ "choose": 1, "type": "proficiencies", "desc": "Escolha de Ferramentas de Artesão", "from": { "option_set_type": "equipment_category", "equipment_category": { "index": "artisans-tools", "name": "Ferramentas de Artesão", "url": "/api/equipment-categories/artisans-tools" } }}],
    "language_options": { "choose": 0 },
    "starting_equipment": [{ "equipment": { "index": "shovel", "name": "Pá", "url": "/api/equipment/shovel" }, "quantity": 1 }, { "equipment": { "index": "pot-iron", "name": "Panela de Ferro", "url": "/api/equipment/pot-iron" }, "quantity": 1 }, { "equipment": { "index": "clothes-common", "name": "Roupas Comuns", "url": "/api/equipment/clothes-common" }, "quantity": 1 }, { "equipment": { "index": "pouch", "name": "Bolsa contendo 10 po", "url": "/api/equipment/pouch" }, "quantity": 1 }],
    "starting_equipment_options": [{ "choose": 1, "type": "choice", "desc": "Escolha de Ferramentas de Artesão (item)", "from": { "option_set_type": "equipment_category", "equipment_category": { "index": "artisans-tools", "name": "Ferramentas de Artesão", "url": "/api/equipment-categories/artisans-tools" } } }],
    "feature": { "name": "Hospitalidade Rústica", "desc": ["Como você vem do povo comum, você se encaixa facilmente entre eles.", "Você pode encontrar um lugar para se esconder, descansar ou se recuperar entre outras pessoas do povo, a menos que tenha se mostrado um perigo para elas."] },
    "personality_traits": { "choose": 2, "from": { "options": [{ "string": "Eu julgo as pessoas por suas ações, não por suas palavras." }, { "string": "Se alguém está em apuros, estou sempre pronto para ajudar." }, { "string": "Tenho um forte senso de justiça e sempre tento consertar as coisas." }, { "string": "Tenho uma família antiga da qual me lembro com orgulho." }] } },
    "ideals": { "choose": 1, "from": { "options": [{ "desc": "Liberdade. Tiranos não devem oprimir o povo.", "alignments": [{ "index": "neutral-good", "name": "Neutro e Bom", "url": "/api/alignments/neutral-good" }] }, { "desc": "Comunidade. É o dever de todos ajudar as pessoas.", "alignments": [{ "index": "lawful-good", "name": "Leal e Bom", "url": "/api/alignments/lawful-good" }] }] } },
    "bonds": { "choose": 1, "from": { "options": [{ "string": "Minha família é tudo o que tenho; devo protegê-la." }, { "string": "Trarei honra à minha aldeia com meus feitos." }] } },
    "flaws": { "choose": 1, "from": { "options": [{ "string": "O tirano que governa minha terra não medirá esforços para me ver fracassar." }, { "string": "Eu costumo agir antes de pensar para defender os outros." }] } }
  },
  {
    "index": "guild-artisan",
    "name": "Artesão de Guilda",
    "url": "/api/backgrounds/guild-artisan",
    "starting_proficiencies": [
        { "name": "Skill: Insight", "type": "Skills" }, 
        { "name": "Skill: Persuasion", "type": "Skills" }
    ],
    "starting_proficiency_options": [{ "choose": 1, "type": "proficiencies", "desc": "Escolha de Ferramentas de Artesão", "from": { "option_set_type": "equipment_category", "equipment_category": { "index": "artisans-tools", "name": "Ferramentas de Artesão", "url": "/api/equipment-categories/artisans-tools" } }}],
    "language_options": { "choose": 1 },
    "starting_equipment": [{ "equipment": { "index": "clothes-travelers", "name": "Roupas de Viajante", "url": "/api/equipment/clothes-travelers" }, "quantity": 1 }, { "equipment": { "index": "pouch", "name": "Bolsa contendo 15 po", "url": "/api/equipment/pouch" }, "quantity": 1 }],
    "starting_equipment_options": [{ "choose": 1, "type": "choice", "desc": "Escolha de Ferramentas de Artesão (item)", "from": { "option_set_type": "equipment_category", "equipment_category": { "index": "artisans-tools", "name": "Ferramentas de Artesão", "url": "/api/equipment-categories/artisans-tools" } } }],
    "feature": { "name": "Membro de Guilda", "desc": ["Como um membro estabelecido e respeitado de uma guilda, você pode contar com certos benefícios. Membros da guilda fornecem alojamento e comida se necessário, e pagam pelo seu funeral, se preciso.", "Em algumas cidades e vilas, uma sede da guilda oferece um lugar central para encontrar outros membros da sua profissão, o que pode ser uma boa fonte de patronos, aliados ou informação."] },
    "personality_traits": { "choose": 2, "from": { "options": [{ "string": "Acredito que tudo que vale a pena ser feito, vale a pena ser bem feito. Não posso evitar—sou perfeccionista." }, { "string": "Sou um esnobe que despreza aqueles que não conseguem apreciar a arte refinada." }, { "string": "Eu sempre quero saber como as coisas funcionam e o que motiva as pessoas." }, { "string": "Estou cheio de aforismos espirituosos e tenho um provérbio para cada ocasião." }] } },
    "ideals": { "choose": 1, "from": { "options": [{ "desc": "Comunidade. É o dever de todas as pessoas civilizadas fortalecer os laços da comunidade e a segurança da civilização.", "alignments": [{ "index": "lawful-good", "name": "Leal e Bom", "url": "/api/alignments/lawful-good" }] }, { "desc": "Generosidade. Meus talentos me foram dados para que eu pudesse usá-los para beneficiar o mundo.", "alignments": [{ "index": "neutral-good", "name": "Neutro e Bom", "url": "/api/alignments/neutral-good" }] }] } },
    "bonds": { "choose": 1, "from": { "options": [{ "string": "A oficina onde aprendi meu ofício é o lugar mais importante do mundo para mim." }, { "string": "Eu criei uma grande obra para alguém e depois descobri que essa pessoa não era digna de recebê-la. Ainda estou procurando por alguém que seja digno." }] } },
    "flaws": { "choose": 1, "from": { "options": [{ "string": "Farei qualquer coisa para colocar as mãos em algo raro ou inestimável." }, { "string": "Tenho um ciúme terrível de qualquer um que consiga ofuscar meu trabalho." }] } }
  },
  {
    "index": "hermit",
    "name": "Eremita",
    "url": "/api/backgrounds/hermit",
    "starting_proficiencies": [
        { "name": "Skill: Medicine", "type": "Skills" }, 
        { "name": "Skill: Religion", "type": "Skills" },
        { "name": "Kit de Herbalismo", "type": "Artisan's Tools" }
    ],
    "language_options": { "choose": 1 },
    "starting_equipment": [{ "equipment": { "index": "scroll-case", "name": "Estojo de pergaminhos", "url": "/api/equipment/scroll-case" }, "quantity": 1 }, { "equipment": { "index": "winter-blanket", "name": "Cobertor de Inverno", "url": "/api/equipment/winter-blanket" }, "quantity": 1 }, { "equipment": { "index": "clothes-common", "name": "Roupas Comuns", "url": "/api/equipment/clothes-common" }, "quantity": 1 }, { "equipment": { "index": "herbalism-kit", "name": "Kit de Herbalismo", "url": "/api/equipment/herbalism-kit" }, "quantity": 1 }, { "equipment": { "index": "pouch", "name": "Bolsa contendo 5 po", "url": "/api/equipment/pouch" }, "quantity": 1 }],
    "starting_equipment_options": [],
    "feature": { "name": "Descoberta", "desc": ["A reclusão silenciosa de seu longo tempo como eremita lhe deu acesso a uma descoberta única e poderosa. A natureza exata dessa revelação depende da natureza de sua reclusão.", "Pode ser uma grande verdade sobre o cosmos, as divindades, os seres poderosos dos planos exteriores ou as forças da natureza."] },
    "personality_traits": { "choose": 2, "from": { "options": [{ "string": "Sinto uma empatia tremenda por todos que sofrem." }, { "string": "Eu raramente falo, preferindo observar e escutar." }, { "string": "Fico com raiva rapidamente quando vejo uma injustiça." }, { "string": "Eu constantemente penso no significado filosófico ou místico de minhas experiências." }] } },
    "ideals": { "choose": 1, "from": { "options": [{ "desc": "Sabedoria. Se eu entendo a vida, posso agir corretamente.", "alignments": [{ "index": "neutral-good", "name": "Neutro e Bom", "url": "/api/alignments/neutral-good" }, { "index": "lawful-neutral", "name": "Leal e Neutro", "url": "/api/alignments/lawful-neutral" }] }, { "desc": "Solidão. Eu valorizo a paz acima de tudo.", "alignments": [{ "index": "neutral", "name": "Neutro", "url": "/api/alignments/neutral" }] }] } },
    "bonds": { "choose": 1, "from": { "options": [{ "string": "Meu isolamento foi quebrado quando descobri algo perigoso; devo proteger os outros disso." }, { "string": "Devo minha vida a um viajante que visitou meu eremitério há muito tempo." }] } },
    "flaws": { "choose": 1, "from": { "options": [{ "string": "Desconfio das pessoas, vendo segundas intenções onde talvez não existam." }, { "string": "Sou excessivamente cauteloso a ponto de não agir." }] } }
  },
  {
    "index": "noble",
    "name": "Nobre",
    "url": "/api/backgrounds/noble",
    "starting_proficiencies": [
        { "name": "Skill: History", "type": "Skills" }, 
        { "name": "Skill: Persuasion", "type": "Skills" }
    ],
    "starting_proficiency_options": [{ "choose": 1, "type": "proficiencies", "desc": "Escolha de um Conjunto de Jogo", "from": { "option_set_type": "equipment_category", "equipment_category": { "index": "gaming-sets", "name": "Conjuntos de Jogos", "url": "/api/equipment-categories/gaming-sets" } }}],
    "language_options": { "choose": 1 },
    "starting_equipment": [{ "equipment": { "index": "clothes-fine", "name": "Roupas finas", "url": "/api/equipment/clothes-fine" }, "quantity": 1 }, { "equipment": { "index": "signet-ring", "name": "Anel de sinete", "url": "/api/equipment/signet-ring" }, "quantity": 1 }, { "equipment": { "index": "scroll-pedigree", "name": "Um pergaminho de pedigree", "url": "/api/equipment/scroll-pedigree" }, "quantity": 1 }, { "equipment": { "index": "pouch", "name": "Bolsa contendo 25 po", "url": "/api/equipment/pouch" }, "quantity": 1 }],
    "starting_equipment_options": [],
    "feature": { "name": "Posição de Privilégio", "desc": ["Graças ao seu nascimento nobre, as pessoas tendem a pensar o melhor de você. Você é bem-vindo na alta sociedade, e as pessoas assumem que você tem o direito de estar onde quer que esteja.", "O povo comum faz todo o esforço para acomodá-lo e evitar seu descontentamento, e outras pessoas de alta estirpe o tratam como um membro da mesma esfera social."] },
    "personality_traits": { "choose": 2, "from": { "options": [{ "string": "Minha bajulação eloquente faz com que todos com quem converso se sintam a pessoa mais maravilhosa e importante do mundo." }, { "string": "O povo me ama por minha bondade e generosidade." }, { "string": "Eu me esforço muito para estar sempre com a melhor aparência e seguir as últimas modas." }, { "string": "Eu honestamente acredito que todos estão abaixo de mim." }] } },
    "ideals": { "choose": 1, "from": { "options": [{ "desc": "Respeito. O respeito me é devido por causa da minha posição, mas todas as pessoas, independentemente da sua condição, merecem ser tratadas com dignidade.", "alignments": [{ "index": "lawful-good", "name": "Leal e Bom", "url": "/api/alignments/lawful-good" }] }, { "desc": "Responsabilidade. É meu dever respeitar a autoridade daqueles que estão acima de mim, assim como os que estão abaixo de mim devem respeitar a minha.", "alignments": [{ "index": "lawful-neutral", "name": "Leal e Neutro", "url": "/api/alignments/lawful-neutral" }] }] } },
    "bonds": { "choose": 1, "from": { "options": [{ "string": "Eu protegerei meu povo, não importa o que aconteça." }, { "string": "Minha lealdade à minha família é inabalável." }] } },
    "flaws": { "choose": 1, "from": { "options": [{ "string": "Eu secretamente acredito que todos estão abaixo de mim." }, { "string": "Eu escondo uma dívida de jogo vergonhosa de minha família." }] } }
  },
  {
    "index": "orphan",
    "name": "Órfão",
    "url": "/api/backgrounds/orphan",
    "starting_proficiencies": [
        { "name": "Skill: Sleight of Hand", "type": "Skills" },
        { "name": "Skill: Stealth", "type": "Skills" },
        { "name": "Kit de Disfarce", "type": "Artisan's Tools" },
        { "name": "Ferramentas de Ladrão", "type": "Artisan's Tools" }
    ],
    "language_options": { "choose": 0 },
    "starting_equipment": [
        { "equipment": { "index": "knife", "name": "Uma faca pequena", "url": "/api/equipment/knife" }, "quantity": 1 },
        { "equipment": { "index": "map-city", "name": "Um mapa da cidade onde cresceu", "url": "/api/equipment/map-city" }, "quantity": 1 },
        { "equipment": { "index": "pet-mouse", "name": "Um rato de estimação", "url": "/api/equipment/pet-mouse" }, "quantity": 1 },
        { "equipment": { "index": "token-parents", "name": "Uma lembrança de seus pais", "url": "/api/equipment/token-parents" }, "quantity": 1 },
        { "equipment": { "index": "clothes-common", "name": "Roupas Comuns", "url": "/api/equipment/clothes-common" }, "quantity": 1 },
        { "equipment": { "index": "pouch", "name": "Bolsa contendo 10 po", "url": "/api/equipment/pouch" }, "quantity": 1 }
    ],
    "starting_equipment_options": [],
    "feature": { "name": "Segredos da Cidade", "desc": ["Você conhece os padrões secretos e o fluxo das cidades e pode encontrar passagens através da expansão urbana que outros não notariam. Quando não está em combate, você (e os companheiros que lidera) pode viajar entre dois locais na cidade duas vezes mais rápido do que sua velocidade normalmente permitiria."] },
    "personality_traits": { "choose": 2, "from": { "options": [
        { "string": "Eu escondo comida e bugigangas em lugares secretos." }, 
        { "string": "Eu pergunto 'por quê?' constantemente." }, 
        { "string": "Eu gosto de explorar lugares novos e desconhecidos." }, 
        { "string": "Eu sou extremamente protetor com meus amigos." }
    ] } },
    "ideals": { "choose": 1, "from": { "options": [
        { "desc": "Respeito. Todas as pessoas, ricas ou pobres, merecem respeito.", "alignments": [{ "index": "lawful-good", "name": "Leal e Bom", "url": "/api/alignments/lawful-good" }] }, 
        { "desc": "Comunidade. Devemos cuidar uns dos outros, pois ninguém mais o fará.", "alignments": [{ "index": "neutral-good", "name": "Neutro e Bom", "url": "/api/alignments/neutral-good" }] }
    ] } },
    "bonds": { "choose": 1, "from": { "options": [
        { "string": "Minha cidade é meu lar, e eu a defenderei até a morte." }, 
        { "string": "Eu patrocino um orfanato para evitar que outros sofram o que eu sofri." }
    ] } },
    "flaws": { "choose": 1, "from": { "options": [
        { "string": "Eu sou incrivelmente desconfiado com todos." }, 
        { "string": "Quando vejo o que quero, faço qualquer coisa para obtê-lo." }
    ] } }
  },
  {
    "index": "sage",
    "name": "Sábio",
    "url": "/api/backgrounds/sage",
    "starting_proficiencies": [
        { "name": "Skill: Arcana", "type": "Skills" },
        { "name": "Skill: History", "type": "Skills" }
    ],
    "language_options": { "choose": 2 },
    "starting_equipment": [
        { "equipment": { "index": "ink-1-ounce-bottle", "name": "Um frasco de tinta preta", "url": "/api/equipment/ink-1-ounce-bottle" }, "quantity": 1 },
        { "equipment": { "index": "ink-pen", "name": "Uma caneta de tinta", "url": "/api/equipment/ink-pen" }, "quantity": 1 },
        { "equipment": { "index": "knife", "name": "Uma faca pequena", "url": "/api/equipment/knife" }, "quantity": 1 },
        { "equipment": { "index": "book", "name": "Um livro", "url": "/api/equipment/book" }, "quantity": 1 },
        { "equipment": { "index": "clothes-common", "name": "Roupas comuns", "url": "/api/equipment/clothes-common" }, "quantity": 1 },
        { "equipment": { "index": "pouch", "name": "Bolsa contendo 10 po", "url": "/api/equipment/pouch" }, "quantity": 1 }
    ],
    "starting_equipment_options": [],
    "feature": { "name": "Pesquisador", "desc": ["Quando você tenta aprender ou lembrar de uma informação, se você não souber essa informação, muitas vezes sabe onde e de quem pode obtê-la.", "Geralmente, essa informação vem de uma biblioteca, escriba, universidade ou outra pessoa ou lugar sábio. Seu DM pode decidir que o conhecimento que você procura está escondido em um lugar quase inacessível, ou simplesmente não pode ser encontrado."] },
    "personality_traits": { "choose": 2, "from": { "options": [{ "string": "Eu uso palavras polissilábicas para parecer mais inteligente." }, { "string": "Estou disposto a ouvir todos os lados de um argumento antes de tomar minha própria decisão." }, { "string": "Estou horrível em mentir." }, { "string": "Não há nada que eu goste mais do que um bom mistério." }] } },
    "ideals": { "choose": 1, "from": { "options": [{ "desc": "Conhecimento. O caminho para o poder e a auto-aperfeiçoamento é através do conhecimento.", "alignments": [{ "index": "neutral", "name": "Neutro", "url": "/api/alignments/neutral" }] }, { "desc": "Lógica. As emoções não devem nublar nosso pensamento lógico.", "alignments": [{ "index": "lawful-neutral", "name": "Leal e Neutro", "url": "/api/alignments/lawful-neutral" }] }] } },
    "bonds": { "choose": 1, "from": { "options": [{ "string": "É meu dever proteger meu mentor." }, { "string": "Eu vendi minha alma por conhecimento. Espero recuperá-la um dia." }] } },
    "flaws": { "choose": 1, "from": { "options": [{ "string": "Estou facilmente distraído pela promessa de informação." }, { "string": "A maioria das pessoas é muito estúpida para debater um tópico comigo." }] } }
  }
]
