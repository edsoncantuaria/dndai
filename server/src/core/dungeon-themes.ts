// Textos e tabelas de tema das masmorras (PT-BR). O motor sorteia; o Mestre enriquece com detalhes de cena.
export interface Puzzle { title: string; prompt: string; skill: string; alt?: string; hint: string }
export interface Trap { name: string; trigger: string; note: string; ability: "dex" | "con" | "wis" | "int" | "str"; dtype: string }
export interface Hazard { name: string; note: string; ability: "dex" | "con" | "str" | "wis"; dtype: string }

export interface Theme {
  label: string
  places: string[]
  epithets: string[]
  rooms: { entrada: string[]; salao: string[]; camara: string[]; corredor: string[]; cofre: string[]; chefe: string[]; santuario: string[] }
  senses: string[]
  aura?: string
  puzzles: Puzzle[]
  traps: Trap[]
  hazards: Hazard[]
  bosses: string[]
  keys: string[]
}

export const THEMES: Record<string, Theme> = {
  cripta: {
    label: "Cripta", places: ["Cripta", "Catacumbas", "Necrópole", "Mausoléu"], epithets: ["dos Sussurros", "do Rei Pálido", "das Mil Velas Apagadas", "de Osso e Cinza", "dos Votos Quebrados"],
    rooms: { entrada: ["Portal de Pedra Rachada", "Átrio dos Epitáfios"], salao: ["Salão das Urnas", "Nave Sepulcral", "Galeria dos Sarcófagos"], camara: ["Câmara dos Embalsamadores", "Cela do Vigia Morto", "Ossuário Menor"], corredor: ["Corredor das Lápides", "Passagem dos Candelabros"], cofre: ["Cripta do Tesouro Funerário", "Sepulcro do Nobre Esquecido"], chefe: ["Trono do Rei Sepultado", "Sala da Última Vigília"], santuario: ["Capela Esquecida"] },
    senses: ["ar frio e cheiro de terra úmida", "o eco de passos que não são seus", "velas que se acendem sozinhas e apagam sem vento", "um sussurro de nomes antigos"], aura: "shadowfell",
    puzzles: [{ title: "As Quatro Urnas", prompt: "Quatro urnas com inscrições de nascimento e morte; só uma ordem apaga o selo do sarcófago.", skill: "history", alt: "investigation", hint: "As datas formam uma sequência de reinados." }, { title: "O Espelho de Cinza", prompt: "Um espelho mostra a sala sem os mortos; tocar a imagem certa abre a passagem.", skill: "perception", alt: "arcana", hint: "Só um sarcófago aparece fechado no reflexo." }],
    traps: [{ name: "Laje que cede sobre estacas", trigger: "pisar", note: "uma laje solta revela estacas enferrujadas", ability: "dex", dtype: "piercing" }, { name: "Glifo de gemido", trigger: "tocar", note: "um glifo necrótico explode em lamento", ability: "con", dtype: "necrotic" }, { name: "Lâminas no corredor", trigger: "pisar", note: "lâminas deslizam das paredes", ability: "dex", dtype: "slashing" }],
    hazards: [{ name: "Névoa de grave", note: "uma névoa fria e doce que rouba o fôlego", ability: "con", dtype: "necrotic" }],
    bosses: ["o Rei Sepultado", "a Rainha de Cinzas", "o Guardião Sem Nome"], keys: ["Chave de Osso", "Selo de Cera Negra"],
  },
  caverna: {
    label: "Caverna", places: ["Caverna", "Gruta", "Covil", "Abismo Rochoso"], epithets: ["da Garganta Negra", "do Uivo", "das Estalactites Sangrentas", "do Troll Sem Sono", "dos Ecos"],
    rooms: { entrada: ["Boca da Gruta", "Fenda de Entrada"], salao: ["Salão das Estalagmites", "Caverna do Lago Subterrâneo", "Câmara do Eco"], camara: ["Toca dos Saqueadores", "Alcova de Ossos Roídos", "Ninho de Carniça"], corredor: ["Túnel Gotejante", "Passagem Estreita"], cofre: ["Fenda do Butim", "Esconderijo do Chefe"], chefe: ["Trono de Pedra Bruta", "Covil do Líder"], santuario: ["Nascente Cristalina"] },
    senses: ["gotejar constante e cheiro de mofo e fumaça velha", "pegadas largas na lama", "um brilho de fungos nas paredes", "o rugido distante que a pedra amplifica"],
    puzzles: [{ title: "A Ponte de Pedra Móvel", prompt: "Blocos de pedra sobre um abismo giram quando pisados; só um caminho é firme.", skill: "perception", alt: "athletics", hint: "Os blocos seguros têm arranhões de botas." }],
    traps: [{ name: "Desabamento de seixos", trigger: "pisar", note: "um fio de cipó derruba pedras", ability: "dex", dtype: "bludgeoning" }, { name: "Armadilha de urso gigante", trigger: "pisar", note: "dentes de ferro escondidos sob folhas secas", ability: "dex", dtype: "piercing" }],
    hazards: [{ name: "Gás de pântano", note: "bolhas de gás em uma poça lamacenta", ability: "con", dtype: "poison" }, { name: "Chão escorregadio", note: "lodo sobre um declive", ability: "dex", dtype: "bludgeoning" }],
    bosses: ["o Chefe da Matilha", "a Mãe de Presas", "o Gigante Solitário"], keys: ["Chave de Chifre", "Anel de Ferro Pesado"],
  },
  ruina: {
    label: "Ruína", places: ["Ruínas", "Cidadela Arruinada", "Fortaleza Caída", "Mosteiro Desmoronado"], epithets: ["de Aldermor", "do Último Sol", "das Torres Quebradas", "do Conselho Esquecido", "de Corvo e Hera"],
    rooms: { entrada: ["Portão Arrombado", "Pátio de Entrada"], salao: ["Grande Salão Sem Teto", "Biblioteca Queimada", "Refeitório de Pedra"], camara: ["Quartel Abandonado", "Sala do Arquivista", "Cela de Interrogatório"], corredor: ["Muralha Interna", "Escadaria Rachada"], cofre: ["Tesouraria Selada", "Cofre do Mestre de Armas"], chefe: ["Salão do Trono Rachado", "Torre do Comandante"], santuario: ["Capela Dessacralizada"] },
    senses: ["hera crescendo sobre o brasão", "vento assobiando por janelas vazias", "pó e cacos que estalam sob as botas", "o eco de um sino distante"],
    puzzles: [{ title: "O Brasão Partido", prompt: "Quatro pedaços de um brasão devem ser recolocados para abrir o arquivo.", skill: "history", alt: "investigation", hint: "Os animais heráldicos aparecem nos vitrais." }],
    traps: [{ name: "Fio de alarme com besta", trigger: "pisar", note: "uma besta antiga ainda armada", ability: "dex", dtype: "piercing" }, { name: "Teto que desmorona", trigger: "tocar", note: "vigas apodrecidas cedem", ability: "dex", dtype: "bludgeoning" }],
    hazards: [{ name: "Piso podre", note: "tábuas que rangem sobre um porão", ability: "dex", dtype: "bludgeoning" }],
    bosses: ["o Comandante Condenado", "a Arquimaga Esquecida", "o Golem da Muralha"], keys: ["Chave de Ferro Enferrujada", "Selo do Conselho"],
  },
  "torre-arcana": {
    label: "Torre arcana", places: ["Torre", "Observatório", "Sanctum", "Colégio"], epithets: ["de Vel'Orath", "das Sete Chamas", "do Mago Cego", "do Véu Rasgado", "dos Astros Caídos"],
    rooms: { entrada: ["Hall de Cristal", "Saguão dos Selos"], salao: ["Biblioteca Flutuante", "Observatório de Lentes", "Salão dos Espelhos"], camara: ["Laboratório Alquímico", "Gabinete de Invocação", "Estufa Arcana"], corredor: ["Escada em Espiral Infinita", "Corredor dos Portais"], cofre: ["Câmara de Reagentes", "Cofre do Grimório"], chefe: ["Sanctum do Arquimago", "Sala do Núcleo Arcano"], santuario: ["Jardim de Mana"] },
    senses: ["faíscas azuis estalando no ar", "livros que viram páginas sozinhos", "um zumbido de energia nos dentes", "símbolos que mudam quando você desvia o olhar"], aura: "arcane-surge",
    puzzles: [{ title: "Runas Gêmeas", prompt: "Duas paredes de runas respondem uma à outra; só quem completar o par apaga o selo.", skill: "arcana", alt: "investigation", hint: "Cada runa é o inverso da outra." }, { title: "O Autômato Charadista", prompt: "Um autômato faz perguntas sobre elementos; resposta errada o enfurece.", skill: "arcana", alt: "persuasion", hint: "Ele só aceita respostas curtas." }],
    traps: [{ name: "Glifo de relâmpago", trigger: "tocar", note: "um glifo solta uma descarga", ability: "dex", dtype: "lightning" }, { name: "Selo de paralisia", trigger: "abrir", note: "um selo trava os músculos", ability: "con", dtype: "force" }, { name: "Chama guardiã", trigger: "pisar", note: "jatos de fogo mágico", ability: "dex", dtype: "fire" }],
    hazards: [{ name: "Tempestade de mana", note: "faíscas incontroláveis varrem o salão", ability: "dex", dtype: "lightning" }],
    bosses: ["o Arquimago Dissolvido", "a Mente da Torre", "o Elemental Enjaulado"], keys: ["Chave de Cristal", "Anel-Selo Arcano"],
  },
  esgoto: {
    label: "Esgotos", places: ["Esgotos", "Subterrâneos", "Canais Antigos", "Cisternas"], epithets: ["de Porto Velho", "do Rei dos Ratos", "da Cidade Sob a Cidade", "das Águas Cinzentas"],
    rooms: { entrada: ["Grelha de Acesso", "Escada Úmida"], salao: ["Cisterna Principal", "Encruzilhada dos Canais"], camara: ["Ninho de Contrabandistas", "Esconderijo dos Culturistas", "Sala das Bombas"], corredor: ["Canal Estreito", "Túnel de Ratos"], cofre: ["Depósito Contrabandista", "Cofre Alagado"], chefe: ["Trono de Lixo e Ouro", "Reservatório Profundo"], santuario: ["Nicho do Santo dos Esgotos"] },
    senses: ["fedor azedo e água escorrendo", "guinchos que ecoam nos canos", "uma lanterna balançando ao longe", "água pelos tornozelos, fria e escura"],
    puzzles: [{ title: "As Comportas", prompt: "Três comportas controlam o nível da água; só uma ordem seca o corredor.", skill: "investigation", alt: "survival", hint: "A água sobe pelo lado oposto ao da roda." }],
    traps: [{ name: "Cano de vapor", trigger: "tocar", note: "um registro estoura vapor fervente", ability: "dex", dtype: "fire" }, { name: "Fio com sinos e dardos", trigger: "pisar", note: "dardos com veneno de rato", ability: "con", dtype: "poison" }],
    hazards: [{ name: "Correnteza súbita", note: "uma comporta cede e a água arrasta tudo", ability: "str", dtype: "bludgeoning" }, { name: "Esporos tóxicos", note: "mofo escuro libera esporos", ability: "con", dtype: "poison" }],
    bosses: ["o Rei dos Ratos", "a Aranha-Pantana", "o Culto da Lama"], keys: ["Chave Enferrujada de Cano", "Medalhão de Contrabandista"],
  },
  "ninho-de-dragao": {
    label: "Ninho de dragão", places: ["Covil", "Ninho", "Montanha", "Forja"], epithets: ["de Cinza Viva", "do Dragão Sem Sono", "das Brasas Eternas", "da Asa Quebrada", "de Ouro e Fumaça"],
    rooms: { entrada: ["Boca de Fumaça", "Desfiladeiro Chamuscado"], salao: ["Câmara das Escamas", "Galeria dos Ossos de Cavaleiros", "Salão dos Troféus Derretidos"], camara: ["Ninho dos Kobolds", "Fornalha dos Servos", "Dormitório dos Cultistas"], corredor: ["Passagem de Lava Fria", "Rampa de Carvão"], cofre: ["Tesouro Disperso", "Câmara de Ouro Derretido"], chefe: ["Leito do Dragão", "Trono de Moedas"], santuario: ["Fonte Mineral"] },
    senses: ["calor seco e cheiro de enxofre", "moedas rangendo sob os pés", "o ronco profundo de algo imenso", "pedra vitrificada que reflete a tocha"], aura: "stormwild",
    puzzles: [{ title: "O Guardião de Metal", prompt: "Uma estátua de dragão exige o tributo certo: peso, brilho ou história.", skill: "persuasion", alt: "history", hint: "Dragões valorizam a verdade bem contada." }],
    traps: [{ name: "Jato de chamas", trigger: "pisar", note: "dutos de gás inflamável", ability: "dex", dtype: "fire" }, { name: "Pilha de moedas falsa", trigger: "tocar", note: "moedas escondem um fosso de brasas", ability: "dex", dtype: "fire" }],
    hazards: [{ name: "Gases vulcânicos", note: "fumaça sufocante sobe de uma fenda", ability: "con", dtype: "poison" }, { name: "Chão de lava fria", note: "crostas finas sobre brasas", ability: "dex", dtype: "fire" }],
    bosses: ["o Dragão do Ninho", "a Rainha das Brasas", "o Velho Wyrm"], keys: ["Chave de Escama", "Presa Entalhada"],
  },
  "bosque-feerico": {
    label: "Bosque feérico", places: ["Bosque", "Clareira", "Jardim", "Corte"], epithets: ["do Crepúsculo", "das Mil Luzes", "da Rainha de Espinhos", "dos Espelhos de Água", "do Verão Eterno"],
    rooms: { entrada: ["Arco de Raízes", "Círculo de Cogumelos"], salao: ["Clareira dos Vagalumes", "Salão das Hastes", "Lago Espelhado"], camara: ["Toca da Raposa Prateada", "Gruta de Musgo Cantante", "Jardim de Espinhos"], corredor: ["Trilha de Folhas Douradas", "Ponte de Cipós"], cofre: ["Árvore dos Presentes", "Nicho do Duende"], chefe: ["Trono de Raízes", "Corte da Rainha"], santuario: ["Fonte da Memória"] },
    senses: ["música distante e perfume de flores impossíveis", "o tempo parece esticar e encolher", "olhos curiosos entre as folhas", "risadinhas que viram vento"], aura: "feybleed",
    puzzles: [{ title: "O Jogo do Duende", prompt: "Um duende propõe um jogo de adivinhação; perder custa uma lembrança ou um favor.", skill: "insight", alt: "deception", hint: "Ele nunca mente, mas esconde partes da verdade." }, { title: "A Dança dos Cogumelos", prompt: "Círculos de cogumelos mudam de lugar a cada passo; o ritmo certo abre o caminho.", skill: "performance", alt: "nature", hint: "Siga a música, não o caminho." }],
    traps: [{ name: "Espinhos de sonho", trigger: "tocar", note: "espinhos mergulham o alvo em torpor", ability: "wis", dtype: "psychic" }, { name: "Rede de cipós", trigger: "pisar", note: "cipós que se fecham como mãos", ability: "str", dtype: "bludgeoning" }],
    hazards: [{ name: "Néctar inebriante", note: "o aroma das flores confunde a mente", ability: "wis", dtype: "psychic" }],
    bosses: ["a Rainha de Espinhos", "o Cervo Coroado", "a Bruxa do Crepúsculo"], keys: ["Chave de Folha Dourada", "Flor Selada de Cera"],
  },
  abismo: {
    label: "Abismo", places: ["Abismo", "Fenda Infernal", "Cratera", "Fortaleza Ardente"], epithets: ["das Cem Correntes", "de Brasa e Pacto", "do Senhor das Moscas", "dos Gritos Eternos"],
    rooms: { entrada: ["Fenda Sulfurosa", "Portal Rachado"], salao: ["Salão das Correntes", "Forja de Almas", "Praça dos Contratos"], camara: ["Cela de Pactuados", "Câmara das Chamas Negras", "Matadouro Ritual"], corredor: ["Ponte de Ossos", "Rampa de Cinzas"], cofre: ["Cofre dos Pactos", "Tesouro dos Condenados"], chefe: ["Trono de Obsidiana", "Fosso do Senhor"], santuario: ["Altar Profanado"] },
    senses: ["calor opressivo e cheiro de ferro e enxofre", "sussurros em línguas que ferem", "correntes arrastando em algum lugar", "sombras que acompanham o seu ritmo"], aura: "shadowfell",
    puzzles: [{ title: "O Contrato Selado", prompt: "Um contrato flutua exigindo uma assinatura; cada cláusula esconde um preço.", skill: "insight", alt: "investigation", hint: "A cláusula mais curta é a mais perigosa." }],
    traps: [{ name: "Corrente que prende", trigger: "pisar", note: "correntes incandescentes saltam do piso", ability: "dex", dtype: "fire" }, { name: "Glifo de dor", trigger: "tocar", note: "um selo infernal pune o toque", ability: "con", dtype: "necrotic" }],
    hazards: [{ name: "Rio de brasas", note: "um córrego de brasas cruza a passagem", ability: "dex", dtype: "fire" }],
    bosses: ["o Senhor das Cinzas", "a Duquesa dos Pactos", "o Arconte Caído"], keys: ["Chave de Ferro Negro", "Selo de Sangue"],
  },
  "templo-esquecido": {
    label: "Templo esquecido", places: ["Templo", "Santuário", "Abadia", "Panteão"], epithets: ["da Chama Dourada", "do Deus Adormecido", "das Mil Preces", "do Sol Quebrado", "da Aurora Perdida"],
    rooms: { entrada: ["Escadaria Cerimonial", "Vestíbulo dos Peregrinos"], salao: ["Nave Central", "Salão dos Ex-Votos", "Galeria dos Vitrais"], camara: ["Cela dos Sacerdotes", "Sala dos Rituais", "Scriptorium"], corredor: ["Claustro de Colunas", "Passagem das Estátuas"], cofre: ["Tesouro do Templo", "Relicário"], chefe: ["Sanctum do Altar-Mor", "Câmara do Avatar"], santuario: ["Capela da Vigília"] },
    senses: ["incenso velho e luz dourada", "estátuas cujos olhares parecem seguir você", "um canto coral quase inaudível", "poeira que brilha como ouro"], aura: "hallowed",
    puzzles: [{ title: "As Sete Preces", prompt: "Sete estátuas aguardam as palavras de uma prece em ordem para abrir o relicário.", skill: "religion", alt: "history", hint: "A ordem segue o nascer do sol até o fim da noite." }],
    traps: [{ name: "Estátua que golpeia", trigger: "tocar", note: "uma estátua guardiã golpeia com espada de pedra", ability: "dex", dtype: "slashing" }, { name: "Luz cegante", trigger: "abrir", note: "um clarão radiante dispara do relicário", ability: "con", dtype: "radiant" }],
    hazards: [{ name: "Água benta venenosa", note: "a pia envenenada borbulha", ability: "con", dtype: "poison" }],
    bosses: ["o Avatar Corrompido", "o Sumo Sacerdote Eterno", "o Guardião de Pedra"], keys: ["Chave Solar", "Medalhão Votivo"],
  },
  "mina-ana": {
    label: "Mina anã", places: ["Mina", "Salões Profundos", "Forja Perdida", "Fortaleza Subterrânea"], epithets: ["de Khaz Dorin", "da Veia Prateada", "do Martelo Calado", "das Brasas Azuis", "de Pedra e Juramento"],
    rooms: { entrada: ["Portão de Runas Anãs", "Galeria de Entrada"], salao: ["Grande Salão das Colunas", "Forja Central", "Câmara das Bigornas"], camara: ["Alojamentos dos Mineiros", "Armazém de Minério", "Sala das Máquinas"], corredor: ["Galeria Escorada", "Trilho de Vagonetes"], cofre: ["Cofre dos Mestres", "Câmara das Gemas"], chefe: ["Trono do Rei Anão", "Coração da Forja"], santuario: ["Santuário do Ancestral"] },
    senses: ["o tilintar de metal e cheiro de pedra molhada", "veios cintilantes nas paredes", "o ranger de madeira de escoramento", "um bafo quente de forja apagada"],
    puzzles: [{ title: "A Porta de Runas", prompt: "Uma porta anã pede o nome de um ancestral cravado nas colunas do salão.", skill: "history", alt: "investigation", hint: "Os nomes mais velhos têm as runas mais gastas." }],
    traps: [{ name: "Vagoneta desgovernada", trigger: "pisar", note: "um trilho solta uma vagoneta", ability: "dex", dtype: "bludgeoning" }, { name: "Poço de gás", trigger: "tocar", note: "gás de mina explode com a chama", ability: "con", dtype: "fire" }, { name: "Eixo giratório", trigger: "pisar", note: "dentes de engrenagem emergem", ability: "dex", dtype: "slashing" }],
    hazards: [{ name: "Escoras podres", note: "o teto rangendo promete desabar", ability: "dex", dtype: "bludgeoning" }],
    bosses: ["o Rei Anão Corrompido", "o Golem da Forja", "o Verme de Pedra"], keys: ["Chave de Martelo", "Runa de Passagem"],
  },
}
export const THEME_IDS = Object.keys(THEMES)
