
export const TRANSLATIONS_SPELLS: Record<string, any> = {
  "Acid Arrow": {
    "name": "Flecha Ácida",
    "desc": [
      "Uma flecha verde cintilante corre em direção a um alvo dentro do alcance e explode em um jato de ácido. Faça um ataque mágico de longo alcance contra o alvo. Em caso de acerto, o alvo recebe 4d4 de dano de ácido imediatamente e 2d4 de dano de ácido no final de seu próximo turno. Se errar, a flecha espirra ácido no alvo, causando metade do dano inicial e nenhum dano no final do próximo turno."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 3º nível ou superior, o dano (tanto inicial quanto posterior) aumenta em 1d4 para cada nível de espaço acima do 2º."
    ],
    "material": "Folha de ruibarbo em pó e estômago de víbora.",
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "attack_type": "variado",
    "damage_type": "Ácido"
  },
  "Acid Splash": {
    "name": "Respingo de ácido",
    "desc": [
      "Você arremessa uma bolha de ácido. Escolha uma criatura dentro do alcance ou duas criaturas dentro do alcance que estejam a até 1,5 metro uma da outra. O alvo deve ser bem-sucedido em um arremesso de salvamento de destreza ou sofrerá 1d6 de dano de ácido.",
      "O dano desse feitiço aumenta em 1d6 quando você atinge o 5º nível (2d6), o 11º nível (3d6) e o 17º nível (4d6)."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Ácido"
  },
  "Aid": {
    "name": "Ajuda",
    "desc": [
      "Seu feitiço fortalece seus aliados com resistência e determinação. Escolha até três criaturas dentro do alcance. O máximo de pontos de vida de cada alvo e os pontos de vida atuais aumentam em 5 durante o período."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 3º nível ou superior, os pontos de vida do alvo aumentam em 5 pontos adicionais para cada nível de espaço acima do 2º."
    ],
    "material": "Uma pequena tira de tecido branco.",
    "duration": "8 horas",
    "casting_time": "1 ação"
  },
  "Alarm": {
    "name": "Alarme",
    "desc": [
      "Você aciona um alarme contra intrusões indesejadas. Escolha uma porta, uma janela ou uma área dentro do alcance que não seja maior do que um cubo de 6 metros. Até o fim do feitiço, um alarme o alertará sempre que uma criatura de tamanho pequeno ou maior tocar ou entrar na área protegida. Ao lançar o feitiço, você pode designar criaturas que não dispararão o alarme. Você também escolhe se o alarme é mental ou audível.",
      "Um alarme mental o alerta com um ping em sua mente se você estiver a menos de 1 milha da área protegida. Esse ping o despertará se estiver dormindo.",
      "Um alarme sonoro produz o som de um sino de mão por 10 segundos em um raio de 60 pés."
    ],
    "material": "Um pequeno sino e um pedaço de fio de prata fina.",
    "duration": "8 horas",
    "casting_time": "1 minuto"
  },
  "Alter Self": {
    "name": "Idade Autônomo",
    "desc": [
      "Você assume uma forma diferente. Quando lançar o feitiço, escolha uma das seguintes opções, cujos efeitos duram a duração do feitiço. Enquanto o feitiço durar, você pode encerrar uma opção como uma ação para obter os benefícios de uma opção diferente.",
      "***Aquatic Adaptation.*** Você adapta seu corpo a um ambiente aquático, fazendo brotar guelras e criando teias entre os dedos. Você pode respirar debaixo d'água e ganhar uma velocidade de natação igual à sua velocidade de caminhada.",
      "***Mudança de aparência*** Você transforma sua aparência. Você decide como será sua aparência, incluindo altura, peso, características faciais, som da voz, comprimento do cabelo, coloração e características distintivas, se houver. Você pode se apresentar como um membro de outra raça, embora nenhuma de suas estatísticas seja alterada. Você também não pode aparecer como uma criatura de tamanho diferente do seu, e sua forma básica permanece a mesma; se você for bípede, não poderá usar esse feitiço para se tornar quadrúpede, por exemplo. A qualquer momento durante a duração do feitiço, você pode usar sua ação para mudar sua aparência dessa forma novamente.",
      "***Armas naturais*** Você desenvolve garras, presas, espinhos, chifres ou uma arma natural diferente de sua escolha. Seus golpes desarmados causam 1d6 de dano por contusão, perfuração ou corte, conforme apropriado à arma natural escolhida, e você é proficiente com seus golpes desarmados. Finalmente, a arma natural é mágica e você tem um bônus de +1 nas rolagens de ataque e dano que fizer com ela."
    ],
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Animal Friendship": {
    "name": "Amizade animal",
    "desc": [
      "Esse feitiço permite que você convença uma fera de que não quer fazer mal a ela. Escolha um animal que você possa ver dentro do alcance. Ela deve ver e ouvir você. Se a Inteligência do animal for 4 ou maior, o feitiço falha. Caso contrário, o animal deve ser bem-sucedido em um lance de salvamento de sabedoria ou será encantado por você durante a duração do feitiço. Se você ou um de seus companheiros ferir o alvo, o feitiço termina."
    ],
    "material": "Um pedaço de comida.",
    "duration": "24 horas",
    "casting_time": "1 ação"
  },
  "Animal Messenger": {
    "name": "Mensageiro de animais",
    "desc": [
      "Por meio desse feitiço, você usa um animal para entregar uma mensagem. Escolha um animal minúsculo que você possa ver dentro do alcance, como um esquilo, um gaio azul ou um morcego. Você especifica um local, que deve ter visitado, e um destinatário que corresponda a uma descrição geral, como \"um homem ou mulher vestido com o uniforme da guarda da cidade\" ou \"um anão ruivo usando um chapéu pontudo\". Você também fala uma mensagem de até vinte e cinco palavras. O animal-alvo viaja durante o feitiço em direção ao local especificado, percorrendo cerca de 80 quilômetros por 24 horas para um mensageiro voador, ou 80 quilômetros para outros animais.",
      "Quando o mensageiro chega, ele entrega sua mensagem à criatura que você descreveu, reproduzindo o som de sua voz. O mensageiro fala somente com uma criatura que corresponda à descrição que você deu. Se o mensageiro não chegar ao seu destino antes do fim do feitiço, a mensagem será perdida e a criatura voltará para o local onde você lançou o feitiço."
    ],
    "higher_level": [
      "Se você lançar esse feitiço usando um espaço de feitiço de 3º nível ou superior, a duração do feitiço aumentará em 48 horas para cada nível de espaço acima do 2º."
    ],
    "material": "Um pedaço de comida.",
    "duration": "24 horas",
    "casting_time": "1 ação"
  },
  "Animal Shapes": {
    "name": "Formas de animais",
    "desc": [
      "Sua magia transforma os outros em feras. Escolha qualquer número de criaturas dispostas que você possa ver dentro do alcance. Você transforma cada alvo na forma de uma fera grande ou menor com um grau de desafio igual ou inferior a 4. Nos turnos seguintes, você pode usar sua ação para transformar as criaturas afetadas em novas formas.",
      "A transformação dura a duração de cada alvo ou até que o alvo chegue a 0 pontos de vida ou morra. Você pode escolher uma forma diferente para cada alvo. As estatísticas de jogo de um alvo são substituídas pelas estatísticas da fera escolhida, embora o alvo mantenha seu alinhamento e as pontuações de Inteligência, Sabedoria e Carisma. O alvo assume os pontos de vida de sua nova forma e, quando reverte para sua forma normal, retorna ao número de pontos de vida que tinha antes de se transformar. Se ele reverter como resultado de cair para 0 pontos de vida, qualquer dano em excesso será transferido para sua forma normal. Enquanto o excesso de dano não reduzir a forma normal da criatura a 0 pontos de vida, ela não ficará inconsciente. A criatura está limitada nas ações que pode realizar devido à natureza de sua nova forma e não pode falar nem lançar feitiços.",
      "O equipamento do alvo se funde com a nova forma. O alvo não pode ativar, empunhar ou se beneficiar de nenhum de seus equipamentos."
    ],
    "duration": "Até 24 horas",
    "casting_time": "1 ação"
  },
  "Animate Dead": {
    "name": "Animate Dead",
    "desc": [
      "Esse feitiço cria um servo morto-vivo. Escolha uma pilha de ossos ou um cadáver de um humanoide médio ou pequeno dentro do alcance. Seu feitiço imbui o alvo com uma imitação imunda de vida, transformando-o em uma criatura morta-viva. O alvo se torna um esqueleto se você escolheu ossos ou um zumbi se escolheu um cadáver (o GM tem as estatísticas de jogo da criatura).",
      "Em cada um de seus turnos, você pode usar uma ação adicional para comandar mentalmente qualquer criatura que tenha criado com esse feitiço se a criatura estiver a até 60 pés de você (se você controlar várias criaturas, poderá comandar qualquer uma ou todas elas ao mesmo tempo, emitindo o mesmo comando para cada uma). Você decide qual ação a criatura realizará e para onde ela se moverá durante o próximo turno, ou pode emitir um comando geral, como guardar uma determinada câmara ou corredor. Se você não der nenhum comando, a criatura só se defenderá contra criaturas hostis. Uma vez dada uma ordem, a criatura continua a segui-la até que sua tarefa seja concluída.",
      "A criatura fica sob seu controle por 24 horas, após as quais ela deixa de obedecer a qualquer comando que você tenha dado a ela. Para manter o controle da criatura por mais 24 horas, você deve lançar esse feitiço na criatura novamente antes que o período atual de 24 horas termine. Esse uso do feitiço reafirma o seu controle sobre até quatro criaturas que você animou com esse feitiço, em vez de animar uma nova."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço de feitiço de 4º nível ou superior, você anima ou reafirma o controle sobre duas criaturas mortas-vivas adicionais para cada nível de espaço acima do 3º. Cada uma das criaturas deve vir de um cadáver ou pilha de ossos diferente."
    ],
    "material": "Uma gota de sangue, um pedaço de carne e uma pitada de pó de osso.",
    "duration": "Instantâneo",
    "casting_time": "1 minuto"
  },
  "Animate Objects": {
    "name": "Animar objetos",
    "desc": [
      "Os objetos ganham vida ao seu comando. Escolha até dez objetos não mágicos dentro do alcance que não estejam sendo usados ou carregados. Alvos médios contam como dois objetos, alvos grandes contam como quatro objetos e alvos enormes contam como oito objetos. Não é possível animar nenhum objeto maior que Huge. Cada alvo é animado e se torna uma criatura sob seu controle até que o feitiço termine ou até que seja reduzido a 0 pontos de vida.",
      "Como uma ação bônus, você pode comandar mentalmente qualquer criatura que tenha feito com esse feitiço se ela estiver a até 500 pés de você (se você controlar várias criaturas, poderá comandar uma ou todas elas ao mesmo tempo, emitindo o mesmo comando para cada uma). Você decide qual ação a criatura realizará e para onde ela se moverá durante o próximo turno, ou pode emitir um comando geral, como guardar uma determinada câmara ou corredor. Se você não emitir nenhum comando, a criatura só se defenderá contra criaturas hostis. Uma vez dada uma ordem, a criatura continua a segui-la até que sua tarefa seja concluída.",
      "##### Estatísticas de objetos animados",
      "| Tamanho | HP | AC | Ataque | Str | Dex |",
      "|---|---|---|---|---|---|",
      "| Tiny | 20 | 18 | +8 para acertar, 1d4 + 4 de dano | 4 | 18 |",
      "| Pequeno | 25 | 16 | +6 para acertar, 1d8 + 2 de dano | 6 | 14 |",
      "| Médio | 40 | 13 | +5 para acertar, 2d6 + 1 de dano | 10 | 12 |",
      "| Grande | 50 | 10 | +6 para acertar, 2d10 + 2 de dano | 14 | 10 |",
      "| Enorme | 80 | 10 | +8 para acertar, 2d12 + 4 de dano | 18 | 6 |",
      "Um objeto animado é um construto com CA, pontos de vida, ataques, força e destreza determinados pelo seu tamanho. Sua Constituição é 10 e sua Inteligência e Sabedoria são 3, e seu Carisma é 1. Sua velocidade é de 30 pés; se o objeto não tiver pernas ou outros apêndices que possa usar para locomoção, ele terá uma velocidade de voo de 30 pés e poderá pairar. Se o objeto estiver firmemente preso a uma superfície ou a um objeto maior, como uma corrente presa a uma parede, sua velocidade é 0. Ele tem visão cega com um raio de 30 pés e fica cego além dessa distância. Quando o objeto animado chega a 0 pontos de vida, ele volta à sua forma original de objeto e qualquer dano restante é transferido para sua forma original de objeto.",
      "Se você comandar um objeto para atacar, ele poderá fazer um único ataque corpo a corpo contra uma criatura em um raio de 1,5 metro. Ele faz um ataque de slam com um bônus de ataque e dano de espancamento determinado pelo seu tamanho. O GM pode determinar que um objeto específico cause dano cortante ou perfurante com base em sua forma."
    ],
    "higher_level": [
      "Se você lançar esse feitiço usando um espaço de feitiço de 6º nível ou superior, poderá animar dois objetos adicionais para cada nível de espaço acima do 5º."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Antilife Shell": {
    "name": "Concha Antilife",
    "desc": [
      "Uma barreira cintilante se estende a partir de você em um raio de 3 metros e se move com você, permanecendo centralizada em você e protegendo criaturas que não sejam mortos-vivos e construtos. A barreira dura por toda a duração.",
      "A barreira impede que uma criatura afetada passe ou alcance a barreira. Uma criatura afetada pode lançar feitiços ou fazer ataques com armas de alcance ou de longo alcance através da barreira.",
      "Se você se mover de forma que uma criatura afetada seja forçada a atravessar a barreira, o feitiço termina."
    ],
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Antimagic Field": {
    "name": "Campo Antimagic",
    "desc": [
      "Uma esfera invisível de antimagia de 3 metros de raio o envolve. Essa área é separada da energia mágica que permeia o multiverso. Dentro da esfera, os feitiços não podem ser lançados, as criaturas convocadas desaparecem e até mesmo os itens mágicos se tornam mundanos. Até que o feitiço termine, a esfera se move com você, centrada em você.",
      "Os feitiços e outros efeitos mágicos, exceto aqueles criados por um artefato ou uma divindade, são suprimidos na esfera e não podem se projetar para dentro dela. Um espaço gasto para lançar um feitiço suprimido é consumido. Enquanto um efeito está suprimido, ele não funciona, mas o tempo que ele passa suprimido é contado em sua duração.",
      "***Efeitos direcionados *** Feitiços e outros efeitos mágicos, como míssil mágico e encantar pessoa, que têm como alvo uma criatura ou um objeto na esfera não têm efeito sobre esse alvo.",
      "***A área de outro feitiço ou efeito mágico, como a bola de fogo, não pode se estender para dentro da esfera. Se a esfera se sobrepuser a uma área de magia, a parte da área coberta pela esfera será suprimida. Por exemplo, as chamas criadas por uma parede de fogo são suprimidas dentro da esfera, criando uma lacuna na parede se a sobreposição for grande o suficiente.",
      "***Qualquer feitiço ativo ou outro efeito mágico em uma criatura ou objeto na esfera é suprimido enquanto a criatura ou o objeto estiver dentro dela.",
      "***Itens mágicos*** As propriedades e os poderes dos itens mágicos são suprimidos na esfera. Por exemplo, uma espada longa +1 na esfera funciona como uma espada longa não mágica.",
      "As propriedades e os poderes de uma arma mágica são suprimidos se ela for usada contra um alvo na esfera ou empunhada por um atacante na esfera. Se uma arma mágica ou uma munição mágica sair totalmente da esfera (por exemplo, se você disparar uma flecha mágica ou lançar uma lança mágica em um alvo fora da esfera), a magia do item deixará de ser suprimida assim que ele sair.",
      "***Viagens mágicas*** O teletransporte e as viagens planares não funcionam na esfera, quer a esfera seja o destino ou o ponto de partida dessas viagens mágicas. Um portal para outro local, mundo ou plano de existência, bem como uma abertura para um espaço extradimensional, como o criado pelo feitiço truque da corda, fecha temporariamente enquanto estiver na esfera.",
      "***Criaturas e objetos*** Uma criatura ou objeto convocado ou criado por magia deixa de existir temporariamente na esfera. Essa criatura reaparece instantaneamente quando o espaço que ela ocupava não estiver mais dentro da esfera.",
      "***Feitiços e efeitos mágicos, como dissipar magia, não têm efeito sobre a esfera. Da mesma forma, as esferas criadas por diferentes feitiços de campo antimagia não anulam umas às outras."
    ],
    "material": "Uma pitada de ferro em pó ou limalha de ferro.",
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Antipathy/Sympathy": {
    "name": "Antipatia/Simpatia",
    "desc": [
      "Esse feitiço atrai ou repele criaturas de sua escolha. Você tem como alvo algo dentro do alcance, seja um objeto ou criatura de tamanho Enorme ou menor ou uma área que não seja maior do que um cubo de 60 metros. Em seguida, especifique um tipo de criatura inteligente, como dragões vermelhos, goblins ou vampiros. Você investe o alvo com uma aura que atrai ou repele as criaturas especificadas durante o período. Escolha antipatia ou simpatia como efeito da aura.",
      "***O encantamento faz com que as criaturas do tipo que você designou sintam um desejo intenso de deixar a área e evitar o alvo. Quando essa criatura puder ver o alvo ou estiver a menos de 60 pés dele, a criatura deve ser bem-sucedida em um arremesso de sabedoria ou ficará assustada. A criatura permanece assustada enquanto puder ver o alvo ou estiver a até 60 pés dele. Enquanto estiver assustada com o alvo, a criatura deve usar seu movimento para se deslocar para o local seguro mais próximo de onde não possa ver o alvo. Se a criatura se mover a mais de 60 pés do alvo e não puder vê-lo, a criatura não estará mais assustada, mas ficará assustada novamente se recuperar a visão do alvo ou se mover a menos de 60 pés dele.",
      "***Simpatia: O encantamento faz com que as criaturas especificadas sintam um desejo intenso de se aproximar do alvo quando estiverem a menos de 60 pés dele ou puderem vê-lo. Quando essa criatura puder ver o alvo ou estiver a menos de 60 pés dele, ela deverá ser bem-sucedida em um lançamento de sabedoria ou usar seu movimento em cada um de seus turnos para entrar na área ou se mover ao alcance do alvo. Quando essa criatura puder ver o alvo ou estiver a menos de 60 pés dele, ela deverá ser bem-sucedida em um arremesso de sabedoria ou usar seu movimento em cada um de seus turnos para entrar na área ou se mover ao alcance do alvo. Quando a criatura tiver feito isso, ela não poderá se afastar do alvo por vontade própria.",
      "Se o alvo danificar ou ferir de outra forma uma criatura afetada, essa criatura poderá fazer um lance de economia de sabedoria para encerrar o efeito, conforme descrito abaixo.",
      "***Se uma criatura afetada terminar seu turno sem estar a até 60 pés do alvo ou sem conseguir vê-lo, ela fará um arremesso salvador de sabedoria. Se o salvamento for bem-sucedido, a criatura não será mais afetada pelo alvo e reconhecerá o sentimento de repugnância ou atração como mágico. Além disso, a criatura afetada pelo feitiço pode fazer outra tentativa de defesa de sabedoria a cada 24 horas enquanto o feitiço persistir.",
      "Uma criatura que conseguir se salvar desse efeito fica imune a ele por 1 minuto, após o qual pode ser afetada novamente."
    ],
    "material": "Um pedaço de alume embebido em vinagre para o efeito de antipatia ou uma gota de mel para o efeito de simpatia.",
    "duration": "10 dias",
    "casting_time": "1 hora"
  },
  "Arcane Eye": {
    "name": "Olho Arcano",
    "desc": [
      "Você cria um olho mágico invisível dentro do alcance que paira no ar durante o período.",
      "Você recebe mentalmente informações visuais do olho, que tem visão normal e visão escura até 30 pés. O olho pode olhar em todas as direções.",
      "Como uma ação, você pode mover o olho até 30 pés em qualquer direção. Não há limite para a distância que o olho pode se afastar de você, mas ele não pode entrar em outro plano de existência. Uma barreira sólida bloqueia o movimento do olho, mas o olho pode passar por uma abertura de até 1 polegada de diâmetro."
    ],
    "material": "Um pouco de pele de morcego.",
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Arcane Hand": {
    "name": "Mão Arcana",
    "desc": [
      "Você cria uma mão grande de força cintilante e translúcida em um espaço desocupado que você possa ver dentro do alcance. A mão dura a duração do feitiço e se move sob seu comando, imitando os movimentos de sua própria mão.",
      "A mão é um objeto que tem CA 20 e pontos de vida iguais ao seu máximo de pontos de vida. Se ela cair para 0 pontos de vida, o feitiço termina. Ela tem Força de 26 (+8) e Destreza de 10 (+0). A mão não preenche seu espaço.",
      "Ao lançar o feitiço e como uma ação bônus nos turnos seguintes, você pode mover a mão até 60 pés e causar um dos seguintes efeitos com ela.",
      "***Punho cerrado: A mão atinge uma criatura ou objeto em um raio de 1,5 metro. Faça um ataque mágico corpo a corpo para a mão usando suas estatísticas de jogo. Em caso de acerto, o alvo recebe 4d8 de dano de força.",
      "***A mão tenta empurrar uma criatura em um raio de 1,5 metro na direção que você escolher. Faça uma verificação com a Força da mão contestada pela verificação de Força (Atletismo) do alvo. Se o alvo for de tamanho Médio ou menor, você tem vantagem na verificação. Se você for bem-sucedido, a mão empurra o alvo até 1,5 metro mais um número de metros igual a cinco vezes o seu modificador de habilidade de lançamento de feitiço. A mão se move com o alvo para permanecer a até 1,5 m dele.",
      "***A mão tenta agarrar uma criatura Enorme ou menor em um raio de 1,5 m dela. Você usa a pontuação de Força da mão para resolver o agarramento. Se o alvo for Médio ou menor, você tem vantagem na verificação. Enquanto a mão estiver agarrando o alvo, você pode usar uma ação adicional para fazer com que a mão o esmague. Ao fazer isso, o alvo recebe dano de arma branca igual a 2d6 + seu modificador de habilidade de lançamento de feitiço.",
      "***A mão se interpõe entre você e uma criatura que você escolher até que você dê a ela um comando diferente. A mão se move para ficar entre você e o alvo, fornecendo-lhe meia cobertura contra o alvo. O alvo não pode se mover pelo espaço da mão se sua pontuação de Força for menor ou igual à pontuação de Força da mão. Se a pontuação de Força for maior que a pontuação de Força da mão, o alvo pode se mover em sua direção pelo espaço da mão, mas esse espaço é um terreno difícil para o alvo."
    ],
    "higher_level": [
      "Quando você conjura esse feitiço usando um espaço de feitiço de 6º nível ou superior, o dano da opção de punho cerrado aumenta em 2d8 e o dano da opção de mão agarrada aumenta em 2d6 para cada nível de espaço acima do 5º."
    ],
    "material": "Uma casca de ovo e uma luva de pele de cobra.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Arcane Lock": {
    "name": "Trava Arcana",
    "desc": [
      "Se você tocar em uma porta, janela, portão, baú ou outra porta de entrada fechada, ela ficará trancada pelo tempo que durar. Você e as criaturas designadas por você ao lançar esse feitiço podem abrir o objeto normalmente. Você também pode definir uma senha que, quando falada a menos de 1,5 m do objeto, suprime esse feitiço por 1 minuto. Caso contrário, o objeto fica intransponível até ser quebrado ou o feitiço ser dissipado ou suprimido. Lançar knock no objeto suprime o bloqueio arcano por 10 minutos.",
      "Enquanto afetado por esse feitiço, o objeto é mais difícil de ser quebrado ou aberto à força; a DC para quebrá-lo ou abrir qualquer fechadura aumenta em 10."
    ],
    "material": "Pó de ouro no valor mínimo de 25gp, que o feitiço consome.",
    "duration": "Até que seja dissipado",
    "casting_time": "1 ação"
  },
  "Arcane Sword": {
    "name": "Espada Arcana",
    "desc": [
      "Você cria um plano de força em forma de espada que paira dentro do alcance. Ele dura por toda a duração.",
      "Quando a espada aparece, você faz um ataque mágico corpo a corpo contra um alvo de sua escolha em um raio de 1,5 metro da espada. Se for atingido, o alvo recebe 3d10 de dano de força. Até que o feitiço termine, você pode usar uma ação adicional em cada um de seus turnos para mover a espada até 6 metros para um local que possa ver e repetir esse ataque contra o mesmo alvo ou um alvo diferente."
    ],
    "material": "Uma espada de platina em miniatura com empunhadura e pomo de cobre e zinco, no valor de 250 gp.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação",
    "attack_type": "corpo a corpo",
    "damage_type": "Força"
  },
  "Arcanist's Magic Aura": {
    "name": "Aura Mágica do Arcanista",
    "desc": [
      "Você coloca uma ilusão em uma criatura ou em um objeto que você toca para que os feitiços de adivinhação revelem informações falsas sobre ele. O alvo pode ser uma criatura disposta ou um objeto que não esteja sendo carregado ou usado por outra criatura.",
      "Quando você lançar o feitiço, escolha um ou ambos os efeitos a seguir. O efeito dura por toda a duração. Se você lançar esse feitiço na mesma criatura ou objeto todos os dias durante 30 dias, colocando o mesmo efeito nele todas as vezes, a ilusão durará até ser dissipada.",
      "***Aura falsa: Você altera a forma como o alvo aparece para feitiços e efeitos mágicos, como detectar magia, que detectam auras mágicas. Você pode fazer um objeto não mágico parecer mágico, um objeto mágico parecer não mágico ou alterar a aura mágica do objeto para que ele pareça pertencer a uma escola específica de magia que você escolher. Ao usar esse efeito em um objeto, você pode tornar a falsa magia aparente para qualquer criatura que manuseie o item.",
      "***Você altera a forma como o alvo aparece para os feitiços e efeitos mágicos que detectam tipos de criatura, como o Sentido Divino de um paladino ou o acionamento de um feitiço de símbolo. Você escolhe um tipo de criatura e outros feitiços e efeitos mágicos tratam o alvo como se fosse uma criatura daquele tipo ou daquele alinhamento."
    ],
    "material": "Um pequeno quadrado de seda.",
    "duration": "24 horas",
    "casting_time": "1 ação"
  },
  "Astral Projection": {
    "name": "Projeção Astral",
    "desc": [
      "Você e até oito criaturas dispostas dentro do alcance projetam seus corpos astrais no Plano Astral (o feitiço falha e a conjuração é desperdiçada se você já estiver nesse plano). O corpo material que você deixa para trás está inconsciente e em um estado de animação suspensa; ele não precisa de comida ou ar e não envelhece.",
      "Seu corpo astral se assemelha à sua forma mortal em quase todos os aspectos, reproduzindo suas estatísticas de jogo e suas posses. A principal diferença é o acréscimo de um cordão prateado que se estende entre as omoplatas e segue atrás de você, tornando-se invisível depois de 1 pé. Esse cordão é sua ligação com seu corpo material. Enquanto a corda permanecer intacta, você poderá encontrar o caminho de casa. Se o cordão for cortado - algo que só pode acontecer quando um efeito especificamente o determina - sua alma e seu corpo se separam, matando-o instantaneamente.",
      "Sua forma astral pode viajar livremente pelo Plano Astral e pode passar por portais que levam a qualquer outro plano. Se você entrar em um novo plano ou retornar ao plano em que estava quando lançou esse feitiço, seu corpo e suas posses serão transportados pelo cordão de prata, permitindo que você entre novamente em seu corpo ao entrar no novo plano. Sua forma astral é uma encarnação separada. Qualquer dano ou outros efeitos que se apliquem a ela não têm efeito sobre seu corpo físico, nem persistem quando você retorna a ele.",
      "O feitiço termina para você e seus companheiros quando você usa a sua ação para descartá-lo. Quando o feitiço termina, a criatura afetada retorna ao seu corpo físico e desperta.",
      "O feitiço também pode terminar mais cedo para você ou um de seus companheiros. Um feitiço de dissipação de magia bem-sucedido usado contra um corpo astral ou físico encerra o feitiço para essa criatura. Se o corpo original de uma criatura ou sua forma astral chegar a 0 pontos de vida, o feitiço será encerrado para essa criatura. Se o feitiço terminar e o cordão de prata estiver intacto, o cordão puxará a forma astral da criatura de volta ao seu corpo, encerrando seu estado de animação suspensa.",
      "Se você retornar ao seu corpo prematuramente, seus companheiros permanecerão em suas formas astrais e precisarão encontrar o caminho de volta para seus corpos, geralmente caindo para 0 pontos de vida."
    ],
    "material": "Para cada criatura afetada por esse feitiço, você deve fornecer um jacinto no valor de pelo menos 1.000gp e uma barra de prata ornamentada no valor de pelo menos 100gp, todos consumidos pelo feitiço.",
    "duration": "Especial",
    "casting_time": "1 hora"
  },
  "Augury": {
    "name": "Augúrio",
    "desc": [
      "Ao lançar bastões incrustados de pedras preciosas, rolar ossos de dragão, dispor cartas ornamentadas ou usar alguma outra ferramenta de adivinhação, você recebe um presságio de uma entidade de outro mundo sobre os resultados de um curso de ação específico que você planeja realizar nos próximos 30 minutos. O MJ escolhe entre os seguintes presságios possíveis:",
      "- Saúde, para bons resultados",
      "- Ai, por resultados ruins",
      "- Bem e mal, tanto para resultados bons quanto ruins",
      "- Nada, para resultados que não sejam especialmente bons ou ruins",
      "O feitiço não leva em conta nenhuma circunstância possível que possa alterar o resultado, como o lançamento de feitiços adicionais ou a perda ou ganho de um companheiro.",
      "Se você lançar o feitiço duas ou mais vezes antes de completar seu próximo descanso longo, haverá uma chance cumulativa de 25% de obter uma leitura aleatória para cada lançamento após o primeiro. O GM faz essa rolagem em segredo."
    ],
    "material": "Bastões, ossos ou fichas semelhantes especialmente marcados, com valor mínimo de 25gp.",
    "duration": "Instantâneo",
    "casting_time": "1 minuto"
  },
  "Awaken": {
    "name": "Despertar",
    "desc": [
      "Depois de passar o tempo de conjuração traçando caminhos mágicos dentro de uma pedra preciosa, você toca um animal ou planta enorme ou menor. O alvo não deve ter pontuação de Inteligência ou deve ter uma Inteligência igual ou inferior a 3. O alvo ganha uma Inteligência de 10. O alvo também ganha a capacidade de falar um idioma que você conhece. Se o alvo for uma planta, ele ganha a capacidade de mover seus membros, raízes, vinhas, trepadeiras e assim por diante, e ganha sentidos semelhantes aos de um humano. Seu MJ escolhe as estatísticas apropriadas para a planta desperta, como as estatísticas para o arbusto desperto ou a árvore desperta.",
      "O animal ou planta desperto fica encantado por você por 30 dias ou até que você ou seus companheiros façam algo prejudicial a ele. Quando a condição de encantamento termina, a criatura desperta escolhe se quer continuar amigável com você, com base em como você a tratou enquanto estava encantada."
    ],
    "material": "Uma ágata com valor mínimo de 1.000 gp, que o feitiço consome.",
    "duration": "Instantâneo",
    "casting_time": "8 horas"
  },
  "Bane": {
    "name": "Bane",
    "desc": [
      "Até três criaturas de sua escolha que você possa ver dentro do alcance devem fazer lances de defesa de carisma. Sempre que um alvo que falhar nessa jogada de defesa fizer uma rolagem de ataque ou uma jogada de defesa antes que o feitiço termine, o alvo deve rolar um d4 e subtrair o número rolado da rolagem de ataque ou da jogada de defesa."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço de feitiço de 2º nível ou superior, você pode ter como alvo uma criatura adicional para cada nível de espaço acima do 1º."
    ],
    "material": "Uma gota de sangue.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Banishment": {
    "name": "Banimento",
    "desc": [
      "Você tenta enviar uma criatura que possa ver dentro do alcance para outro plano de existência. O alvo deve ser bem-sucedido em um lance de salvamento de carisma ou será banido.",
      "Se o alvo for nativo do plano de existência em que você está, você o banirá para um demiplano inofensivo. Enquanto estiver lá, o alvo ficará incapacitado. O alvo permanece lá até que o feitiço termine, momento em que ele reaparece no espaço que deixou ou no espaço desocupado mais próximo, se esse espaço estiver ocupado.",
      "Se o alvo for nativo de um plano de existência diferente daquele em que você está, ele será banido com um leve ruído de estalo, retornando ao seu plano de origem. Se o feitiço terminar antes de 1 minuto, o alvo reaparece no espaço que deixou ou no espaço desocupado mais próximo, se esse espaço estiver ocupado. Caso contrário, o alvo não retorna."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço de feitiço de 5º nível ou superior, você pode ter como alvo uma criatura adicional para cada nível de espaço acima do 4º."
    ],
    "material": "Um item desagradável para o alvo.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Barkskin": {
    "name": "Pele de casca",
    "desc": [
      "Você toca uma criatura disposta. Até que o feitiço termine, a pele do alvo terá uma aparência áspera, semelhante a uma casca de árvore, e a CA do alvo não poderá ser inferior a 16, independentemente do tipo de armadura que estiver usando."
    ],
    "material": "Um punhado de casca de carvalho.",
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Beacon of Hope": {
    "name": "Farol da Esperança",
    "desc": [
      "Esse feitiço concede esperança e vitalidade. Escolha qualquer número de criaturas dentro do alcance. Durante o período de duração, cada alvo tem vantagem nos arremessos salvadores de sabedoria e nos arremessos salvadores de morte e recupera o número máximo de pontos de vida possível de qualquer cura."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Bestow Curse": {
    "name": "Conceder maldição",
    "desc": [
      "Você toca em uma criatura, e essa criatura deve ser bem-sucedida em um teste de resistência de sabedoria ou será amaldiçoada pela duração do feitiço. Quando você lançar esse feitiço, escolha a natureza da maldição dentre as seguintes opções:",
      "- Escolha uma pontuação de habilidade. Enquanto estiver amaldiçoado, o alvo terá desvantagem nas verificações de habilidade e nos arremessos salvadores feitos com essa pontuação de habilidade.",
      "- Enquanto estiver amaldiçoado, o alvo tem desvantagem nas rolagens de ataque contra você.",
      "- Enquanto estiver amaldiçoado, o alvo deve fazer um arremesso de sabedoria no início de cada um de seus turnos. Se falhar, ele desperdiça sua ação naquele turno sem fazer nada.",
      "- Enquanto o alvo estiver amaldiçoado, seus ataques e magias causam 1d8 de dano necrótico extra ao alvo.",
      "Um feitiço de remoção de maldição encerra esse efeito. A critério do MJ, você pode escolher um efeito de maldição alternativo, mas ele não deve ser mais poderoso do que os descritos acima. O MJ tem a palavra final sobre o efeito dessa maldição."
    ],
    "higher_level": [
      "Se você lançar esse feitiço usando um espaço para feitiço de 4º nível ou superior, a duração será de concentração, até 10 minutos. Se você usar um espaço para feitiço de 5º nível ou superior, a duração será de 8 horas. Se você usar um espaço para feitiço de 7º nível ou superior, a duração será de 24 horas. Se você usar um espaço para feitiço de 9º nível, o feitiço durará até ser dissipado. O uso de um espaço para feitiço de 5º nível ou superior concede uma duração que não requer concentração."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Black Tentacles": {
    "name": "Tentáculos negros",
    "desc": [
      "Tentáculos de ébano contorcidos preenchem um quadrado de 6 metros no solo que você pode ver dentro do alcance. Durante esse período, esses tentáculos transformam o solo da área em um terreno difícil.",
      "Quando uma criatura entra na área afetada pela primeira vez em um turno ou inicia seu turno nessa área, ela deve ser bem-sucedida em um arremesso de salvamento de Destreza ou sofrerá 3d6 de dano de espancamento e será restringida pelos tentáculos até que o feitiço termine. Uma criatura que iniciar seu turno na área e já estiver imobilizada pelos tentáculos sofrerá 3d6 de dano por arma branca.",
      "Uma criatura presa pelos tentáculos pode usar sua ação para fazer um teste de Força ou Destreza (à sua escolha) contra o seu feitiço de salvar a CD. Se for bem-sucedida, ela se liberta."
    ],
    "material": "Um pedaço de tentáculo de um polvo gigante ou de uma lula gigante",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação",
    "damage_type": "Espancamento"
  },
  "Blade Barrier": {
    "name": "Barreira de lâminas",
    "desc": [
      "Você cria uma parede vertical de lâminas giratórias e afiadas feitas de energia mágica. A parede aparece dentro do alcance e dura por toda a duração. Você pode criar uma parede reta de até 100 pés de comprimento, 20 pés de altura e 5 pés de espessura, ou uma parede em forma de anel de até 60 pés de diâmetro, 20 pés de altura e 5 pés de espessura. A parede fornece cobertura de três quartos para as criaturas atrás dela e seu espaço é um terreno difícil.",
      "Quando uma criatura entra na área da muralha pela primeira vez em um turno ou começa seu turno ali, ela deve fazer um arremesso salvador de destreza. Se a defesa falhar, a criatura receberá 6d10 de dano cortante. Em um salvamento bem-sucedido, a criatura recebe metade do dano."
    ],
    "duration": "Até 10 minutos",
    "casting_time": "1 ação",
    "damage_type": "Corte"
  },
  "Bless": {
    "name": "Bênção",
    "desc": [
      "Você abençoa até três criaturas de sua escolha dentro do alcance. Sempre que um alvo fizer uma jogada de ataque ou uma jogada de defesa antes de o feitiço terminar, o alvo poderá rolar um d4 e adicionar o número rolado à jogada de ataque ou à jogada de defesa."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço de feitiço de 2º nível ou superior, você pode ter como alvo uma criatura adicional para cada nível de espaço acima do 1º."
    ],
    "material": "Uma aspersão de água benta.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Blight": {
    "name": "Blight",
    "desc": [
      "A energia necromântica se derrama sobre uma criatura de sua escolha que você possa ver dentro do alcance, drenando a umidade e a vitalidade dela. O alvo deve fazer um arremesso salvador de Constituição. O alvo recebe 8d8 de dano necrótico se o salvamento falhar, ou metade do dano se for bem-sucedido. O feitiço não tem efeito sobre mortos-vivos ou construtos.",
      "Se você tiver como alvo uma criatura vegetal ou uma planta mágica, ela faz o arremesso de defesa com desvantagem e o feitiço causa o dano máximo a ela.",
      "Se você tiver como alvo uma planta não mágica que não seja uma criatura, como uma árvore ou um arbusto, ela não fará um arremesso salvador; ela simplesmente murcha e morre."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 5º nível ou superior, o dano aumenta em 1d8 para cada nível de espaço acima do 4º."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Necrótico"
  },
  "Blindness/Deafness": {
    "name": "Cegueira/surdez",
    "desc": [
      "Você pode cegar ou ensurdecer um inimigo. Escolha uma criatura que você possa ver dentro do alcance para fazer um arremesso salvador de Constituição. Se falhar, o alvo ficará cego ou ensurdecido (à sua escolha) durante o período. No final de cada um de seus turnos, o alvo pode fazer um arremesso salvador de Constituição. Se for bem-sucedido, o feitiço termina."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço de feitiço de 3º nível ou superior, você pode ter como alvo uma criatura adicional para cada nível de espaço acima do 2º."
    ],
    "duration": "1 minuto",
    "casting_time": "1 ação"
  },
  "Blink": {
    "name": "Piscar",
    "desc": [
      "Role um d20 no final de cada um de seus turnos durante a duração do feitiço. Se o resultado for 11 ou maior, você desaparece do seu plano de existência atual e aparece no Plano Etéreo (o feitiço falha e a conjuração é desperdiçada se você já estiver nesse plano). No início do seu próximo turno, e quando o feitiço terminar se você estiver no Plano Etéreo, você retorna a um espaço desocupado de sua escolha que possa ser visto em um raio de 3 metros do espaço de onde desapareceu. Se nenhum espaço desocupado estiver disponível dentro desse alcance, você aparecerá no espaço desocupado mais próximo (escolhido aleatoriamente se mais de um espaço estiver igualmente próximo). Você pode descartar esse feitiço como uma ação.",
      "Enquanto estiver no Ethereal Plane (Plano Etéreo), você pode ver e ouvir o plano do qual se originou, que é moldado em tons de cinza, e você não pode ver nada a mais de 60 pés de distância. Você só pode afetar e ser afetado por outras criaturas no Ethereal Plane. As criaturas que não estão lá não podem percebê-lo nem interagir com você, a menos que tenham a capacidade de fazer isso."
    ],
    "duration": "1 minuto",
    "casting_time": "1 ação"
  },
  "Blur": {
    "name": "Desfoque",
    "desc": [
      "Seu corpo fica embaçado, mudando e oscilando para todos que o veem. Durante esse período, qualquer criatura tem desvantagem nas rolagens de ataque contra você. Um atacante é imune a esse efeito se não depender da visão, como no caso da blindsight, ou se puder ver através de ilusões, como no caso da truesight."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Branding Smite": {
    "name": "Branding Smite",
    "desc": [
      "Na próxima vez que você acertar uma criatura com um ataque de arma antes do fim desse feitiço, a arma brilhará com radiância astral enquanto você a golpeia. O ataque causa um dano radiante extra de 2d6 ao alvo, que se torna visível se estiver invisível, e o alvo emite uma luz fraca em um raio de 1,5 m e não pode se tornar invisível até que o feitiço termine."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 3º nível ou superior, o dano extra aumenta em 1d6 para cada nível de espaço acima do 2º."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação bônus",
    "damage_type": "Radiante"
  },
  "Burning Hands": {
    "name": "Mãos ardentes",
    "desc": [
      "Quando você segura suas mãos com os polegares se tocando e os dedos abertos, uma fina camada de chamas sai das pontas dos dedos estendidos. Cada criatura em um cone de 15 pés deve fazer um arremesso de salvamento de destreza. Uma criatura recebe 3d6 de dano de fogo se a defesa falhar, ou metade do dano se for bem-sucedida.",
      "O fogo inflama qualquer objeto inflamável na área que não esteja sendo usado ou carregado."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 2º nível ou superior, o dano aumenta em 1d6 para cada nível de espaço acima do 1º."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Incêndio"
  },
  "Call Lightning": {
    "name": "Chame o Lightning",
    "desc": [
      "Uma nuvem de tempestade aparece na forma de um cilindro com 3 metros de altura e um raio de 60 pés, centralizado em um ponto que você pode ver a 30 metros diretamente acima de você. O feitiço falha se você não conseguir ver um ponto no ar onde a nuvem de tempestade possa aparecer (por exemplo, se você estiver em uma sala que não possa acomodar a nuvem).",
      "Ao lançar o feitiço, escolha um ponto que você possa ver dentro do alcance. Um raio desce da nuvem até esse ponto. Cada criatura em um raio de 1,5 m desse ponto deve fazer um teste de resistência de destreza. Uma criatura recebe 3d10 de dano de raio se a defesa falhar, ou metade do dano se for bem-sucedida. Em cada um de seus turnos até que o feitiço termine, você pode usar sua ação para invocar um raio dessa forma novamente, visando o mesmo ponto ou um diferente.",
      "Se você estiver ao ar livre em condições de tempestade quando lançar esse feitiço, ele lhe dará controle sobre a tempestade existente em vez de criar uma nova. Nessas condições, o dano do feitiço aumenta em 1d10."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 4º nível ou superior, o dano aumenta em 1d10 para cada nível de espaço acima do 3º."
    ],
    "duration": "Até 10 minutos",
    "casting_time": "1 ação",
    "damage_type": "Relâmpagos"
  },
  "Calm Emotions": {
    "name": "Acalmar as emoções",
    "desc": [
      "Você tenta suprimir emoções fortes em um grupo de pessoas. Cada humanoide em uma esfera de 20 pés de raio centrada em um ponto que você escolher dentro do alcance deve fazer um lance de proteção de carisma; uma criatura pode escolher falhar nesse lance de proteção se desejar. Se uma criatura falhar em seu lance de proteção, escolha um dos dois efeitos a seguir. Você pode suprimir qualquer efeito que faça com que um alvo seja encantado ou amedrontado. Quando esse feitiço termina, qualquer efeito suprimido é retomado, desde que sua duração não tenha expirado nesse meio tempo.",
      "Como alternativa, você pode tornar o alvo indiferente em relação a criaturas de sua escolha com as quais ele seja hostil. Essa indiferença termina se o alvo for atacado ou prejudicado por um feitiço ou se testemunhar algum de seus amigos sendo prejudicado. Quando o feitiço termina, a criatura se torna hostil novamente, a menos que o GM decida o contrário."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Chain Lightning": {
    "name": "Cadeia de relâmpagos",
    "desc": [
      "Você cria um raio que vai em direção a um alvo de sua escolha que você possa ver dentro do alcance. Em seguida, três raios saltam desse alvo para até três outros alvos, cada um dos quais deve estar a até 30 pés do primeiro alvo. O alvo pode ser uma criatura ou um objeto e pode ser atingido por apenas um dos raios.",
      "O alvo deve fazer um arremesso de salvamento de destreza. O alvo recebe 10d8 de dano de raio se a defesa falhar, ou metade do dano se for bem-sucedida."
    ],
    "higher_level": [
      "Quando você lançar esse feitiço usando um espaço de feitiço de 7º nível ou superior, um raio adicional saltará do primeiro alvo para outro alvo para cada nível de espaço acima do 6º."
    ],
    "material": "Um pedaço de pele; um pedaço de âmbar, vidro ou uma haste de cristal; e três alfinetes de prata.",
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Relâmpagos"
  },
  "Charm Person": {
    "name": "Pessoa com charme",
    "desc": [
      "Você tenta encantar um humanoide que possa ver dentro do alcance. Ele deve fazer um arremesso de sabedoria e o faz com vantagem se você ou seus companheiros estiverem lutando com ele. Se ela falhar no arremesso de defesa, será encantada por você até que o feitiço termine ou até que você ou seus companheiros façam algo prejudicial a ela. A criatura encantada considera você como um conhecido amigável. Quando o feitiço termina, a criatura sabe que foi encantada por você."
    ],
    "higher_level": [
      "Ao conjurar esse feitiço usando um espaço de feitiço de 2º nível ou superior, você pode ter como alvo uma criatura adicional para cada nível de espaço acima do 1º. As criaturas devem estar a uma distância de até 30 pés uma da outra quando você as tiver como alvo."
    ],
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Chill Touch": {
    "name": "Toque frio",
    "desc": [
      "Você cria uma mão fantasmagórica e esquelética no espaço de uma criatura dentro do alcance. Faça um ataque mágico de longo alcance contra a criatura para atacá-la com o frio da sepultura. Em caso de acerto, o alvo recebe 1d8 de dano necrótico e não pode recuperar pontos de vida até o início do seu próximo turno. Até lá, a mão se agarra ao alvo.",
      "Se você atingir um alvo morto-vivo, ele também terá desvantagem em rolagens de ataque contra você até o final do seu próximo turno.",
      "O dano desse feitiço aumenta em 1d8 quando você atinge o 5º nível (2d8), o 11º nível (3d8) e o 17º nível (4d8)."
    ],
    "duration": "1 rodada",
    "casting_time": "1 ação",
    "attack_type": "variado",
    "damage_type": "Necrótico"
  },
  "Circle of Death": {
    "name": "Círculo da Morte",
    "desc": [
      "Uma esfera de energia negativa se espalha em uma esfera de 60 pés de raio a partir de um ponto dentro do alcance. Cada criatura nessa área deve fazer um arremesso de defesa de constituição. O alvo recebe 8d6 de dano necrótico se a defesa falhar ou metade do dano se for bem-sucedida."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 7º nível ou superior, o dano aumenta em 2d6 para cada nível de espaço acima do 6º."
    ],
    "material": "O pó de uma pérola negra esmagada com valor mínimo de 500 gp.",
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Necrótico"
  },
  "Clairvoyance": {
    "name": "Clarividência",
    "desc": [
      "Você cria um sensor invisível dentro do alcance em um local que lhe seja familiar (um lugar que já tenha visitado ou visto antes) ou em um local óbvio que não lhe seja familiar (como atrás de uma porta, em uma esquina ou em um bosque). O sensor permanece no local durante todo o tempo e não pode ser atacado ou interagido de outra forma.",
      "Ao lançar o feitiço, você escolhe ver ou ouvir. Você pode usar o sentido escolhido por meio do sensor como se estivesse no espaço dele. Como sua ação, você pode alternar entre ver e ouvir.",
      "Uma criatura que pode ver o sensor (como uma criatura que se beneficia da invisibilidade ou da visão verdadeira) vê um orbe luminoso e intangível do tamanho de seu punho."
    ],
    "material": "Um foco no valor mínimo de 100gp, um chifre de joia para ouvir ou um olho de vidro para ver.",
    "duration": "Até 10 minutos",
    "casting_time": "10 minutos"
  },
  "Clone": {
    "name": "Clone",
    "desc": [
      "Esse feitiço cria uma duplicata inerte de uma criatura viva como proteção contra a morte. Esse clone se forma dentro de um recipiente selado e cresce até atingir o tamanho máximo e a maturidade após 120 dias; você também pode optar por fazer com que o clone seja uma versão mais jovem da mesma criatura. Ele permanece inerte e dura indefinidamente, desde que seu recipiente não seja perturbado.",
      "A qualquer momento depois que o clone amadurecer, se a criatura original morrer, sua alma será transferida para o clone, desde que a alma esteja livre e disposta a retornar. O clone é fisicamente idêntico ao original e tem a mesma personalidade, memórias e habilidades, mas nenhum dos equipamentos do original. Os restos físicos da criatura original, se ainda existirem, tornam-se inertes e não podem ser restaurados à vida, pois a alma da criatura está em outro lugar."
    ],
    "material": "Um diamante no valor de pelo menos 1.000 libras e pelo menos 1 polegada cúbica de carne da criatura a ser clonada, que o feitiço consome, e um recipiente no valor de pelo menos 2.000 libras que tenha uma tampa selável e seja grande o suficiente para conter uma criatura média, como uma enorme urna, caixão, cisto cheio de lama no chão ou recipiente de cristal cheio de água salgada.",
    "duration": "Instantâneo",
    "casting_time": "1 hora"
  },
  "Cloudkill": {
    "name": "Morte na nuvem",
    "desc": [
      "Você cria uma esfera de névoa verde-amarelada venenosa com 20 pés de raio, centrada em um ponto que você escolher dentro do alcance. A névoa se espalha pelos cantos. Ela dura a duração ou até que um vento forte a disperse, encerrando o feitiço. Sua área é fortemente obscurecida.",
      "Quando uma criatura entra na área do feitiço pela primeira vez em um turno ou começa o seu turno ali, essa criatura deve fazer um arremesso salvador de Constituição. A criatura recebe 5d8 de dano de veneno se o salvamento falhar, ou metade do dano se for bem-sucedido. As criaturas são afetadas mesmo que prendam a respiração ou não precisem respirar.",
      "A névoa se afasta 3 metros de você no início de cada um de seus turnos, rolando pela superfície do solo. Os vapores, por serem mais pesados que o ar, afundam até o nível mais baixo do terreno, chegando até mesmo a se espalhar por aberturas."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 6º nível ou superior, o dano aumenta em 1d8 para cada nível de espaço acima do 5º."
    ],
    "duration": "Até 10 minutos",
    "casting_time": "1 ação",
    "damage_type": "Veneno"
  },
  "Color Spray": {
    "name": "Spray de cor",
    "desc": [
      "Um conjunto deslumbrante de luzes coloridas e intermitentes sai de sua mão. Role 6d10; o total é o número de pontos de vida das criaturas que esse feitiço pode afetar. As criaturas em um cone de 15 pés com origem em você são afetadas em ordem crescente de seus pontos de vida atuais (ignorando criaturas inconscientes e criaturas que não podem ver).",
      "Começando pela criatura com o menor número atual de pontos de vida, cada criatura afetada por esse feitiço fica cega até que o feitiço termine. Subtraia os pontos de vida de cada criatura do total antes de passar para a criatura com o próximo ponto de vida mais baixo. Os pontos de vida de uma criatura devem ser iguais ou inferiores ao total restante para que ela seja afetada."
    ],
    "higher_level": [
      "Quando você lançar esse feitiço usando um espaço de feitiço de 2º nível ou superior, role 2d10 adicionais para cada nível de espaço acima do 1º."
    ],
    "material": "Uma pitada de pó ou areia colorida de vermelho, amarelo e azul.",
    "duration": "1 rodada",
    "casting_time": "1 ação"
  },
  "Command": {
    "name": "Comando",
    "desc": [
      "Você fala um comando de uma palavra para uma criatura que possa ver dentro do alcance. O alvo deve ser bem-sucedido em um arremesso de sabedoria ou seguir o comando em seu próximo turno. O feitiço não terá efeito se o alvo for um morto-vivo, se ele não entender seu idioma ou se o comando for diretamente prejudicial a ele.",
      "A seguir, alguns comandos típicos e seus efeitos. Você pode emitir um comando diferente dos descritos aqui. Se fizer isso, o GM determinará como o alvo se comportará. Se o alvo não puder seguir seu comando, o feitiço termina.",
      "***O alvo se move em sua direção pela rota mais curta e direta, terminando o turno se estiver a menos de 1,5 m de você.",
      "***O alvo deixa cair o que estiver segurando e termina seu turno.",
      "***O alvo passa o turno se afastando de você pelo meio mais rápido disponível.",
      "***O alvo cai de bruços e termina seu turno.",
      "***O alvo não se move e não realiza nenhuma ação. Uma criatura voadora permanece no ar, desde que seja capaz de fazê-lo. Se precisar se mover para permanecer no ar, ela voa a distância mínima necessária para permanecer no ar. Se precisar se mover para permanecer no ar, ela voa a distância mínima necessária para permanecer no ar."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço de feitiço de 2º nível ou superior, você pode afetar uma criatura adicional para cada nível de espaço acima do 1º. As criaturas devem estar em um raio de 30 pés uma da outra quando você as atingir."
    ],
    "duration": "1 rodada",
    "casting_time": "1 ação"
  },
  "Commune": {
    "name": "Município",
    "desc": [
      "Você entra em contato com a sua divindade ou com um representante divino e faz até três perguntas que podem ser respondidas com um sim ou um não. Você deve fazer suas perguntas antes que o feitiço termine. Você recebe uma resposta correta para cada pergunta.",
      "Os seres divinos não são necessariamente oniscientes, portanto, você pode receber \"obscuro\" como resposta se uma pergunta se referir a informações que estão além do conhecimento da divindade. Em um caso em que uma resposta de uma palavra possa ser enganosa ou contrária aos interesses da divindade, o GM pode oferecer uma frase curta como resposta.",
      "Se você lançar o feitiço duas ou mais vezes antes de terminar seu próximo descanso longo, haverá uma chance cumulativa de 25% de não obter resposta para cada lançamento após o primeiro. O GM faz essa rolagem em segredo."
    ],
    "material": "Incenso e um frasco de água benta ou profana.",
    "duration": "1 minuto",
    "casting_time": "1 minuto"
  },
  "Commune With Nature": {
    "name": "Comunhão com a natureza",
    "desc": [
      "Você se torna brevemente um com a natureza e adquire conhecimento do território ao redor. Ao ar livre, o feitiço lhe dá conhecimento da terra em um raio de 3 milhas de você. Em cavernas e outros ambientes subterrâneos naturais, o raio é limitado a 300 pés. O feitiço não funciona onde a natureza foi substituída por construções, como em masmorras e cidades.",
      "Você obtém instantaneamente conhecimento de até três fatos de sua escolha sobre qualquer um dos seguintes assuntos relacionados à área:",
      "- terreno e corpos d'água",
      "- plantas, minerais, animais ou povos predominantes",
      "- poderosos celestiais, feéricos, demônios, elementais ou mortos-vivos",
      "- influência de outros planos de existência",
      "- edifícios",
      "Por exemplo, você pode determinar a localização de mortos-vivos poderosos na área, a localização das principais fontes de água potável e a localização de qualquer cidade próxima."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 minuto"
  },
  "Comprehend Languages": {
    "name": "Compreensão de idiomas",
    "desc": [
      "Durante esse período, você entende o significado literal de qualquer idioma falado que ouvir. Você também entende qualquer idioma escrito que vir, mas deve estar tocando a superfície em que as palavras estão escritas. Leva cerca de 1 minuto para ler uma página de texto.",
      "Esse feitiço não decodifica mensagens secretas em um texto ou um glifo, como um sigilo arcano, que não faça parte de um idioma escrito."
    ],
    "material": "Uma pitada de fuligem e sal.",
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Compulsion": {
    "name": "Compulsão",
    "desc": [
      "As criaturas de sua escolha que você puder ver dentro do alcance e que puderem ouvi-lo devem fazer um lance de defesa de sabedoria. Um alvo é automaticamente bem-sucedido nessa jogada de defesa se não puder ser encantado. Se a defesa falhar, o alvo será afetado por esse feitiço. Até que o feitiço termine, você pode usar uma ação adicional em cada um dos seus turnos para designar uma direção horizontal para você. Cada alvo afetado deve usar o máximo possível de seu movimento para se deslocar nessa direção em seu próximo turno. Ele pode realizar qualquer ação antes de se mover. Depois de se mover dessa forma, ele pode fazer outra defesa de Sabedoria para tentar encerrar o efeito.",
      "Um alvo não é obrigado a se mover em direção a um perigo obviamente mortal, como uma fogueira ou um poço, mas provocará ataques de oportunidade para se mover na direção designada."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Cone of Cold": {
    "name": "Cone de Frio",
    "desc": [
      "Uma rajada de ar frio irrompe de suas mãos. Cada criatura em um cone de 60 pés deve fazer um arremesso de defesa de constituição. Uma criatura recebe 8d8 de dano de frio se o salvamento falhar, ou metade do dano se for bem-sucedido.",
      "Uma criatura morta por esse feitiço se torna uma estátua congelada até descongelar."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 6º nível ou superior, o dano aumenta em 1d8 para cada nível de espaço acima do 5º."
    ],
    "material": "Um pequeno cone de cristal ou vidro.",
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Frio"
  },
  "Confusion": {
    "name": "Confusão",
    "desc": [
      "Esse feitiço ataca e distorce a mente das criaturas, gerando ilusões e provocando ações descontroladas. Cada criatura em uma esfera de 3 metros de raio centrada em um ponto que você escolher dentro do alcance deve ser bem-sucedida em um arremesso de defesa de Sabedoria quando você lançar esse feitiço ou será afetada por ele.",
      "Um alvo afetado não pode ter reações e deve rolar um d10 no início de cada um de seus turnos para determinar seu comportamento naquele turno.",
      "| d10 | Comportamento |",
      "|---|---|",
      "| 1 | A criatura usa todo o seu movimento para se deslocar em uma direção aleatória. Para determinar a direção, role um d8 e atribua uma direção a cada face do dado. A criatura não realiza nenhuma ação nesse turno. |",
      "| 2-6 | A criatura não se move nem realiza ações nesse turno. |",
      "| 7-8 | A criatura usa sua ação para fazer um ataque corpo a corpo contra uma criatura determinada aleatoriamente que esteja ao seu alcance. Se não houver nenhuma criatura ao seu alcance, a criatura não fará nada nesse turno. |",
      "| 9-10 | A criatura pode agir e se mover normalmente. |",
      "No final de cada um de seus turnos, o alvo afetado pode fazer um arremesso de defesa de Sabedoria. Se for bem-sucedido, esse efeito termina para esse alvo."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 5º nível ou superior, o raio da esfera aumenta em 1,5 metro para cada nível de espaço acima do 4º."
    ],
    "material": "Três cascas de nozes.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Conjure Animals": {
    "name": "Conjurar animais",
    "desc": [
      "Você invoca espíritos feéricos que assumem a forma de feras e aparecem em espaços desocupados que você pode ver dentro do alcance. Escolha uma das seguintes opções para o que aparece:",
      "- Uma fera de desafio de classificação 2 ou inferior",
      "- Duas feras de desafio de nível 1 ou inferior",
      "- Quatro feras de desafio com classificação 1/2 ou inferior",
      "- Oito feras de desafio de nível 1/4 ou inferior",
      "- Cada fera também é considerada feérica e desaparece quando chega a 0 pontos de vida ou quando o feitiço termina.",
      "As criaturas convocadas são amigáveis com você e seus companheiros. Role a iniciativa para as criaturas convocadas como um grupo, que tem seus próprios turnos. Elas obedecem a qualquer comando verbal que você der a elas (não é necessária nenhuma ação sua). Se você não der nenhum comando a elas, elas se defendem de criaturas hostis, mas não realizam nenhuma ação.",
      "O GM tem as estatísticas das criaturas."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando determinados espaços de feitiço de nível superior, você escolhe uma das opções de invocação acima e mais criaturas aparecem: o dobro com um espaço de 5º nível e o triplo com um espaço de 7º nível."
    ],
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Conjure Celestial": {
    "name": "Conjurar Celestial",
    "desc": [
      "Você convoca um celestial de grau de desafio 4 ou inferior, que aparece em um espaço desocupado que você pode ver dentro do alcance. O celestial desaparece quando cai para 0 pontos de vida ou quando o feitiço termina.",
      "O celestial é amigável com você e seus companheiros durante esse período. Role a iniciativa para o celestial, que tem seus próprios turnos. Ele obedece a todos os comandos verbais que você der a ele (não é necessária nenhuma ação sua), desde que não violem seu alinhamento. Se você não der nenhum comando ao celestial, ele se defenderá de criaturas hostis, mas não realizará nenhuma ação.",
      "O GM tem as estatísticas do celestial."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço de feitiço de 9º nível, você invoca um celestial de grau de desafio 5 ou inferior."
    ],
    "duration": "Até 1 hora",
    "casting_time": "1 minuto"
  },
  "Conjure Elemental": {
    "name": "Conjurar Elemental",
    "desc": [
      "Você invoca um servo elemental. Escolha uma área de ar, terra, fogo ou água que preencha um cubo de 3 metros dentro do alcance. Um elemental de grau de desafio 5 ou inferior apropriado para a área escolhida aparece em um espaço desocupado em um raio de 3 metros. Por exemplo, um elemental do fogo emerge de uma fogueira e um elemental da terra surge do chão. O elemental desaparece quando chega a 0 pontos de vida ou quando o feitiço termina.",
      "O elemental é amigável com você e seus companheiros durante esse período. Role a iniciativa para o elemental, que tem seus próprios turnos. Ele obedece a qualquer comando verbal que você der a ele (não é necessária nenhuma ação de sua parte). Se você não der nenhum comando ao elemental, ele se defenderá de criaturas hostis, mas não realizará nenhuma ação.",
      "Se sua concentração for interrompida, o elemental não desaparecerá. Em vez disso, você perde o controle do elemental, ele se torna hostil a você e a seus companheiros e pode atacar. Um elemental descontrolado não pode ser dispensado por você e desaparece uma hora depois de ter sido convocado.",
      "O GM tem as estatísticas do elemental."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 6º nível ou superior, a classificação de desafio aumenta em 1 para cada nível de espaço acima do 5º."
    ],
    "material": "Queimar incenso para o ar, argila macia para a terra, enxofre e fósforo para o fogo, ou água e areia para a água.",
    "duration": "Até 1 hora",
    "casting_time": "1 minuto"
  },
  "Conjure Fey": {
    "name": "Conjurar Fey",
    "desc": [
      "Você invoca uma criatura feérica de grau de desafio 6 ou inferior ou um espírito feérico que assume a forma de uma fera de grau de desafio 6 ou inferior. Ela aparece em um espaço desocupado que você pode ver dentro do alcance. A criatura feérica desaparece quando chega a 0 pontos de vida ou quando o feitiço termina.",
      "A criatura feérica é amigável com você e seus companheiros durante esse período. Role a iniciativa para a criatura, que tem seus próprios turnos. Ela obedece a quaisquer comandos verbais que você der a ela (nenhuma ação é necessária), desde que não violem seu alinhamento. Se você não der nenhum comando à criatura feérica, ela se defenderá de criaturas hostis, mas não realizará nenhuma outra ação.",
      "Se sua concentração for quebrada, a criatura feérica não desaparecerá. Em vez disso, você perde o controle da criatura feérica, ela se torna hostil a você e a seus companheiros e pode atacar. Uma criatura feérica descontrolada não pode ser dispensada por você e desaparece uma hora após ter sido convocada.",
      "O GM tem as estatísticas da criatura feérica."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 7º nível ou superior, a classificação de desafio aumenta em 1 para cada nível de espaço acima do 6º."
    ],
    "duration": "Até 1 hora",
    "casting_time": "1 minuto"
  },
  "Conjure Minor Elementals": {
    "name": "Conjurar elementais menores",
    "desc": [
      "Você invoca elementais que aparecem em espaços desocupados que você pode ver dentro do alcance. Você escolhe uma das seguintes opções para o que aparece:",
      "- Um elemental de grau de desafio 2 ou inferior",
      "- Dois elementais de nível de desafio 1 ou inferior",
      "- Quatro elementais de grau de desafio 1/2 ou inferior",
      "- Oito elementais de grau de desafio 1/4 ou inferior.",
      "Um elemental convocado por esse feitiço desaparece quando chega a 0 pontos de vida ou quando o feitiço termina.",
      "As criaturas convocadas são amigáveis com você e seus companheiros. Role a iniciativa para as criaturas convocadas como um grupo, que tem seus próprios turnos. Elas obedecem a qualquer comando verbal que você der a elas (não é necessária nenhuma ação sua). Se você não der nenhum comando a elas, elas se defendem de criaturas hostis, mas não realizam nenhuma ação.",
      "O GM tem as estatísticas das criaturas."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando determinados espaços de feitiço de nível superior, você escolhe uma das opções de invocação acima e mais criaturas aparecem: o dobro com um espaço de 6º nível e o triplo com um espaço de 8º nível."
    ],
    "duration": "Até 1 hora",
    "casting_time": "1 minuto"
  },
  "Conjure Woodland Beings": {
    "name": "Conjurar seres da floresta",
    "desc": [
      "Você invoca criaturas feéricas que aparecem em espaços desocupados que você pode ver dentro do alcance. Escolha uma das seguintes opções para o que aparece:",
      "- Uma criatura feérica de grau de desafio 2 ou inferior",
      "- Duas criaturas feéricas de grau de desafio 1 ou inferior",
      "- Quatro criaturas feéricas de grau de desafio 1/2 ou inferior",
      "- Oito criaturas feéricas de grau de desafio 1/4 ou inferior",
      "Uma criatura convocada desaparece quando chega a 0 pontos de vida ou quando o feitiço termina.",
      "As criaturas convocadas são amigáveis com você e seus companheiros. Role a iniciativa para as criaturas convocadas como um grupo, que têm seus próprios turnos. Elas obedecem a qualquer comando verbal que você der a elas (não é necessária nenhuma ação sua). Se você não der nenhum comando a elas, elas se defendem de criaturas hostis, mas não realizam nenhuma ação.",
      "O GM tem as estatísticas das criaturas."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando determinados espaços de feitiço de nível superior, você escolhe uma das opções de invocação acima e mais criaturas aparecem: o dobro com um espaço de 6º nível e o triplo com um espaço de 8º nível."
    ],
    "material": "Uma baga de azevinho por criatura convocada.",
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Contact Other Plane": {
    "name": "Contato com outro avião",
    "desc": [
      "Você contata mentalmente um semideus, o espírito de um sábio morto há muito tempo ou alguma outra entidade misteriosa de outro plano. Entrar em contato com essa inteligência extraplanar pode sobrecarregar ou até mesmo quebrar sua mente. Quando lançar esse feitiço, faça um lance de salvamento de inteligência DC 15. Em caso de falha, você recebe 6d6 de dano psíquico e fica insano até terminar um descanso longo. Enquanto estiver insano, você não poderá realizar ações, não poderá entender o que as outras criaturas dizem, não poderá ler e falará apenas em linguagem sem sentido. Um feitiço de restauração maior lançado em você encerra esse efeito.",
      "Em um salvamento bem-sucedido, você pode fazer até cinco perguntas à entidade. Você deve fazer suas perguntas antes que o feitiço termine. O MJ responde a cada pergunta com uma palavra, como \"sim\", \"não\", \"talvez\", \"nunca\", \"irrelevante\" ou \"não está claro\" (se a entidade não souber a resposta para a pergunta). Se uma resposta de uma palavra for enganosa, o GM poderá oferecer uma frase curta como resposta."
    ],
    "duration": "1 minuto",
    "casting_time": "1 minuto"
  },
  "Contagion": {
    "name": "Contágio",
    "desc": [
      "Seu toque causa doença. Faça um ataque mágico corpo a corpo contra uma criatura ao seu alcance. Em caso de acerto, você aflige a criatura com uma doença de sua escolha dentre as descritas abaixo.",
      "No final de cada um dos turnos do alvo, ele deve fazer um lance de defesa de constituição. Após falhar em três desses arremessos de defesa, os efeitos da doença duram por toda a duração e a criatura para de fazer esses salvamentos. Após ser bem-sucedida em três desses arremessos de defesa, a criatura se recupera da doença e o feitiço termina.",
      "Como esse feitiço induz uma doença natural em seu alvo, qualquer efeito que remova uma doença ou melhore os efeitos de uma doença se aplica a ele.",
      "***A dor toma conta da mente da criatura e seus olhos ficam brancos como leite. A criatura tem desvantagem nas verificações de sabedoria e nos lançamentos de defesa de sabedoria e fica cega.",
      "***Febre da febre *** Uma febre furiosa varre o corpo da criatura. A criatura tem desvantagem em verificações de força, lançamentos salvadores de força e rolagens de ataque que usam força.",
      "***Podridão da carne*** A carne da criatura se decompõe. A criatura tem desvantagem em verificações de Carisma e vulnerabilidade a todos os danos.",
      "***A mente da criatura fica febril. A criatura tem desvantagem em verificações de inteligência e em lances salvadores de inteligência, e a criatura se comporta como se estivesse sob os efeitos do feitiço de confusão durante o combate.",
      "***Convulsão: A criatura é tomada por tremores. A criatura tem desvantagem em verificações de destreza, jogadas de salvamento de destreza e rolagens de ataque que usam a destreza.",
      "***A criatura começa a sangrar incontrolavelmente. A criatura tem desvantagem nas verificações de constituição e nos lançamentos de defesa de constituição. Além disso, sempre que a criatura recebe dano, ela fica atordoada até o final de seu próximo turno."
    ],
    "duration": "7 dias",
    "casting_time": "1 ação",
    "attack_type": "corpo a corpo"
  },
  "Contingency": {
    "name": "Contingência",
    "desc": [
      "Escolha um feitiço de 5º nível ou inferior que você possa conjurar, que tenha um tempo de conjuração de 1 ação e que possa ter você como alvo. Você lança esse feitiço - chamado de feitiço contingente - como parte da contingência de lançamento, gastando espaços de feitiço para ambos, mas o feitiço contingente não entra em vigor. Em vez disso, ela entra em vigor quando ocorre uma determinada circunstância. Você descreve essa circunstância quando lança os dois feitiços. Por exemplo, uma contingência lançada com respiração aquática pode estipular que a respiração aquática entra em vigor quando você é engolido pela água ou por um líquido semelhante.",
      "O feitiço de contingência entra em vigor imediatamente após a circunstância ser atendida pela primeira vez, quer você queira ou não, e a contingência termina.",
      "O feitiço de contingência tem efeito apenas em você, mesmo que normalmente possa atingir outras pessoas. Você pode usar apenas um feitiço de contingência por vez. Se você lançar esse feitiço novamente, o efeito de outro feitiço de contingência sobre você será encerrado. Além disso, a contingência termina em você se o componente material dela não estiver em sua pessoa."
    ],
    "material": "Uma estatueta de si mesmo esculpida em marfim e decorada com pedras preciosas no valor mínimo de 1.500 gp.",
    "duration": "10 dias",
    "casting_time": "10 minutos"
  },
  "Continual Flame": {
    "name": "Continual Flame",
    "desc": [
      "Uma chama, equivalente em brilho a uma tocha, surge de um objeto que você toca. O efeito se parece com o de uma chama comum, mas não gera calor e não usa oxigênio. Uma chama contínua pode ser coberta ou escondida, mas não pode ser sufocada ou apagada."
    ],
    "material": "Pó de rubi no valor de 50 gp, que o feitiço consome.",
    "duration": "Até que seja dissipado",
    "casting_time": "1 ação"
  },
  "Control Water": {
    "name": "Controle de água",
    "desc": [
      "Até o fim do feitiço, você controla qualquer água livre dentro de uma área escolhida por você que seja um cubo de até 30 metros de lado. Você pode escolher um dos seguintes efeitos ao lançar esse feitiço. Como uma ação em seu turno, você pode repetir o mesmo efeito ou escolher um diferente.",
      "***Você faz com que o nível de toda a água parada na área suba até 6 metros. Se a área incluir uma margem, a água da inundação transbordará para a terra firme.",
      "Se você escolher uma área em um grande corpo d'água, criará uma onda de 6 metros de altura que se desloca de um lado a outro da área e depois despenca. Todos os veículos enormes ou menores no caminho da onda são levados com ela para o outro lado. Os veículos enormes ou menores atingidos pela onda têm 25% de chance de capotar.",
      "O nível da água permanece elevado até que o feitiço termine ou você escolha um efeito diferente. Se esse efeito produziu uma onda, ela se repetirá no início do seu próximo turno enquanto durar o efeito de inundação.",
      "***Você faz com que a água na área se separe e crie uma trincheira. A trincheira se estende pela área do feitiço e a água separada forma uma parede em ambos os lados. A trincheira permanece até que o feitiço termine ou você escolha um efeito diferente. A água então preenche lentamente a trincheira no decorrer da próxima rodada até que o nível normal da água seja restaurado.",
      "***Você faz com que a água corrente na área se mova na direção que você escolher, mesmo que a água tenha que passar por cima de obstáculos, subir paredes ou tomar outras direções improváveis. A água na área se move conforme você a direciona, mas quando ultrapassa a área do feitiço, ela retoma seu fluxo com base nas condições do terreno. A água continua a se mover na direção que você escolheu até que o feitiço termine ou você escolha um efeito diferente.",
      "***Esse efeito requer uma massa de água de pelo menos 15 pés quadrados e 25 pés de profundidade. Você causa a formação de um redemoinho no centro da área. O redemoinho forma um vórtice com 5 pés de largura na base, até 50 pés de largura no topo e 25 pés de altura. Qualquer criatura ou objeto na água e em um raio de 25 pés do vórtice é puxado 10 pés em direção a ele. Uma criatura pode nadar para longe do vórtice fazendo um teste de Força (Atletismo) contra a sua CD de proteção contra feitiço.",
      "Quando uma criatura entra no vórtice pela primeira vez em um turno ou inicia seu turno nele, ela deve fazer um arremesso de resistência. Se o salvamento falhar, a criatura recebe 2d8 de dano de arma branca e fica presa no vórtice até o fim do feitiço. Em um salvamento bem-sucedido, a criatura recebe metade do dano e não fica presa no vórtice. Uma criatura presa no vórtice pode usar sua ação para tentar nadar para longe do vórtice, conforme descrito acima, mas tem desvantagem no teste de Força (Atletismo) para fazer isso.",
      "Na primeira vez em cada turno em que um objeto entra no vórtice, ele recebe 2d8 de dano de arma branca; esse dano ocorre a cada rodada em que o objeto permanece no vórtice."
    ],
    "material": "Uma gota de água e uma pitada de pó.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação",
    "damage_type": "Espancamento"
  },
  "Control Weather": {
    "name": "Controle do clima",
    "desc": [
      "Você assume o controle do clima em um raio de 8 km por toda a duração. Você deve estar ao ar livre para lançar esse feitiço. A mudança para um local onde você não tenha um caminho claro para o céu encerra o feitiço mais cedo.",
      "Ao lançar o feitiço, você altera as condições climáticas atuais, que são determinadas pelo GM com base no clima e na estação. Você pode alterar a precipitação, a temperatura e o vento. Leva 1d4 x 10 minutos para as novas condições entrarem em vigor. Quando isso acontecer, você poderá alterar as condições novamente. Quando o feitiço termina, o clima volta gradualmente ao normal.",
      "Ao alterar as condições meteorológicas, localize uma condição atual nas tabelas a seguir e altere seu estágio em um, para cima ou para baixo. Ao alterar o vento, você pode mudar sua direção.",
      "##### Precipitação",
      "| Estágio | Condição |",
      "|---|---|",
      "| 1 | Limpar |",
      "| 2 | Nuvens claras",
      "| 3 Nublado ou neblina no solo",
      "| 4 | Chuva, granizo ou neve",
      "| 5 Chuva torrencial, granizo intenso ou nevasca",
      "##### Temperatura",
      "| Estágio | Condição |",
      "|---|---|",
      "| 1 | Calor insuportável",
      "| 2 | Quente |",
      "| 3 | Quente",
      "| 4 | Legal",
      "| 5 | Frio |",
      "| 6 | Frio ártico |",
      "##### Wind",
      "| Estágio | Condição |",
      "|---|---|",
      "| 1 | Calma |",
      "| 2 | Vento moderado",
      "| 3 | Vento forte",
      "| 4 | Sarna",
      "| 5 | Storm |"
    ],
    "material": "Queima de incenso e pedaços de terra e madeira misturados na água.",
    "duration": "Até 8 horas",
    "casting_time": "10 minutos"
  },
  "Counterspell": {
    "name": "Contrafeitiço",
    "desc": [
      "Você tenta interromper uma criatura no processo de lançar um feitiço. Se a criatura estiver lançando um feitiço de 3º nível ou inferior, o feitiço falha e não tem efeito. Se ela estiver lançando um feitiço de 4º nível ou superior, faça uma verificação de habilidade usando sua habilidade de lançar feitiços. O DC é igual a 10 + o nível do feitiço. Em caso de sucesso, o feitiço da criatura falha e não tem efeito."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço para feitiço de 4º nível ou superior, o feitiço interrompido não tem efeito se seu nível for menor ou igual ao nível do espaço para feitiço que você usou."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 reação"
  },
  "Create Food and Water": {
    "name": "Criar alimentos e água",
    "desc": [
      "Você cria 45 libras de alimento e 30 galões de água no chão ou em contêineres dentro do alcance, o suficiente para sustentar até quinze humanóides ou cinco corcéis por 24 horas. A comida é insípida, mas nutritiva, e estraga se não for consumida após 24 horas. A água é limpa e não estraga."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Create or Destroy Water": {
    "name": "Criar ou destruir água",
    "desc": [
      "Você cria ou destrói a água.",
      "***Você cria até 10 galões de água limpa dentro do alcance em um recipiente aberto. Alternativamente, a água cai como chuva em um cubo de 30 pés dentro do alcance.",
      "***Destruição de água: Destrói até 10 galões de água em um recipiente aberto dentro do alcance. Alternativamente, você destrói a névoa em um cubo de 30 pés dentro do alcance."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço de feitiço de 2º nível ou superior, você cria ou destrói 10 galões adicionais de água ou o tamanho do cubo aumenta em 1,5 m para cada nível de espaço acima do 1º."
    ],
    "material": "Uma gota de água, se estiver criando água, ou alguns grãos de areia, se estiver destruindo-a.",
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Create Undead": {
    "name": "Criar mortos-vivos",
    "desc": [
      "Você pode lançar esse feitiço somente à noite. Escolha até três cadáveres de humanoides médios ou pequenos dentro do alcance. Cada cadáver se torna um ghoul sob seu controle. (O GM tem as estatísticas do jogo para essas criaturas).",
      "Como uma ação bônus em cada um de seus turnos, você pode comandar mentalmente qualquer criatura que tenha animado com esse feitiço se a criatura estiver a até 120 pés de você (se você controlar várias criaturas, poderá comandar qualquer uma ou todas elas ao mesmo tempo, emitindo o mesmo comando para cada uma). Você decide qual ação a criatura realizará e para onde ela se moverá durante seu próximo turno ou pode emitir um comando geral, como guardar uma câmara ou um corredor específico. Se você não emitir nenhum comando, a criatura só se defenderá contra criaturas hostis. Uma vez dada uma ordem, a criatura continua a segui-la até que sua tarefa seja concluída.",
      "A criatura fica sob seu controle por 24 horas, após as quais ela deixa de obedecer a qualquer comando que você tenha dado a ela. Para manter o controle da criatura por mais 24 horas, você deve lançar esse feitiço na criatura antes que o período atual de 24 horas termine. Esse uso do feitiço reafirma o seu controle sobre até três criaturas que você tenha animado com esse feitiço, em vez de animar novas criaturas."
    ],
    "higher_level": [
      "Ao conjurar esse feitiço usando um espaço de feitiço de 7º nível, você pode animar ou reafirmar o controle sobre quatro ghouls. Ao conjurar esse feitiço usando um espaço de feitiço de 8º nível, você pode animar ou reafirmar o controle sobre cinco ghouls ou dois ghasts ou wights. Ao lançar esse feitiço usando um espaço de feitiço de 9º nível, você pode animar ou reafirmar o controle de seis carniçais, três ghasts ou wights ou duas múmias."
    ],
    "material": "Um pote de barro cheio de terra de sepultura, um pote de barro cheio de água salobra e uma pedra de ônix preto de 150 gp para cada cadáver.",
    "duration": "Instantâneo",
    "casting_time": "1 minuto"
  },
  "Creation": {
    "name": "Criação",
    "desc": [
      "Você puxa feixes de material das sombras da Shadowfell para criar um objeto não vivo de matéria vegetal dentro do alcance: produtos macios, corda, madeira ou algo semelhante. Você também pode usar esse feitiço para criar objetos minerais, como pedra, cristal ou metal. O objeto criado não pode ser maior do que um cubo de 1,5 m e deve ter uma forma e um material que você já tenha visto antes.",
      "A duração depende do material do objeto. Se o objeto for composto de vários materiais, use a duração mais curta.",
      "| Material | Duration |",
      "|---|---|",
      "| Matéria vegetal | 1 dia | 1 dia",
      "| Pedra ou cristal | 12 horas",
      "| Metais preciosos | 1 hora",
      "| Gemas | 10 minutos |",
      "| Adamantina ou mithral 1 minuto",
      "O uso de qualquer material criado por esse feitiço como componente material de outro feitiço faz com que esse feitiço falhe."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 6º nível ou superior, o cubo aumenta em 1,5 m para cada nível de espaço acima do 5º."
    ],
    "material": "Um pequeno pedaço de matéria do mesmo tipo do item que você planeja criar.",
    "duration": "Especial",
    "casting_time": "1 minuto"
  },
  "Cure Wounds": {
    "name": "Cura de feridas",
    "desc": [
      "Uma criatura que você tocar recupera um número de pontos de vida igual a 1d8 + seu modificador de habilidade de lançamento de feitiço. Esse feitiço não tem efeito sobre mortos-vivos ou construtos."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 2º nível ou superior, a cura aumenta em 1d8 para cada nível de espaço acima do 1º."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Dancing Lights": {
    "name": "Luzes Dançantes",
    "desc": [
      "Você cria até quatro luzes do tamanho de tochas dentro do alcance, fazendo com que elas apareçam como tochas, lanternas ou esferas brilhantes que pairam no ar durante o tempo. Você também pode combinar as quatro luzes em uma forma brilhante vagamente humanoide de tamanho médio. Qualquer que seja a forma escolhida, cada luz emite uma luz fraca em um raio de 3 metros.",
      "Como uma ação bônus no seu turno, você pode mover as luzes até 60 pés para um novo local dentro do alcance. Uma luz deve estar a até 6 metros de outra luz criada por esse feitiço, e uma luz se apaga se exceder o alcance do feitiço."
    ],
    "material": "Um pouco de fósforo ou wychwood, ou um glowworm.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Darkness": {
    "name": "Escuridão",
    "desc": [
      "A escuridão mágica se espalha a partir de um ponto que você escolher dentro do alcance para preencher uma esfera de 15 pés de raio durante a duração. A escuridão se espalha pelos cantos. Uma criatura com visão escura não pode ver através dessa escuridão e a luz não mágica não pode iluminá-la.",
      "Se o ponto escolhido estiver em um objeto que você esteja segurando ou que não esteja sendo usado ou carregado, a escuridão emana do objeto e se move com ele. Cobrir completamente a fonte da escuridão com um objeto opaco, como uma tigela ou um elmo, bloqueia a escuridão.",
      "Se alguma área desse feitiço se sobrepuser a uma área de luz criada por um feitiço de 2º nível ou inferior, o feitiço que criou a luz será dissipado."
    ],
    "material": "Pele de morcego e uma gota de piche ou um pedaço de carvão.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Darkvision": {
    "name": "Visão escura",
    "desc": [
      "Você toca em uma criatura disposta a conceder a ela a capacidade de enxergar no escuro. Durante esse período, essa criatura tem visão no escuro em um alcance de 60 pés."
    ],
    "material": "Uma pitada de cenoura seca ou uma ágata.",
    "duration": "8 horas",
    "casting_time": "1 ação"
  },
  "Daylight": {
    "name": "Luz do dia",
    "desc": [
      "Uma esfera de luz de 60 pés de raio se espalha a partir de um ponto que você escolher dentro do alcance. A esfera é uma luz brilhante e emite uma luz fraca por mais 60 pés.",
      "Se você escolher um ponto em um objeto que esteja segurando ou que não esteja sendo usado ou carregado, a luz brilhará no objeto e se moverá com ele. Cobrir completamente o objeto afetado com um objeto opaco, como uma tigela ou um elmo, bloqueia a luz.",
      "Se alguma área desse feitiço se sobrepuser a uma área de escuridão criada por um feitiço de 3º nível ou inferior, o feitiço que criou a escuridão será dissipado."
    ],
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Death Ward": {
    "name": "Ala da Morte",
    "desc": [
      "Você toca uma criatura e concede a ela uma medida de proteção contra a morte.",
      "Na primeira vez em que o alvo cairia para 0 pontos de vida como resultado de receber dano, ele cai para 1 ponto de vida e o feitiço termina.",
      "Se o feitiço ainda estiver em vigor quando o alvo for submetido a um efeito que o mataria instantaneamente sem causar dano, esse efeito será negado contra o alvo e o feitiço terminará."
    ],
    "duration": "8 horas",
    "casting_time": "1 ação"
  },
  "Delayed Blast Fireball": {
    "name": "Explosão retardada Bola de fogo",
    "desc": [
      "Um feixe de luz amarela sai do seu dedo apontado e se condensa para permanecer em um ponto escolhido dentro do alcance como um cordão brilhante durante todo o tempo. Quando o feitiço termina, seja porque sua concentração foi quebrada ou porque você decidiu encerrá-lo, o cordão se transforma, com um rugido baixo, em uma explosão de chamas que se espalha pelos cantos. Cada criatura em uma esfera de 20 pés de raio centrada nesse ponto deve fazer um arremesso salvador de destreza. Uma criatura recebe dano de fogo igual ao dano total acumulado em uma defesa fracassada, ou metade do dano em uma defesa bem-sucedida.",
      "O dano básico do feitiço é 12d6. Se, no final do seu turno, o cordão ainda não tiver sido detonado, o dano aumenta em 1d6.",
      "Se a pérola brilhante for tocada antes do término do intervalo, a criatura que a tocar deverá fazer um arremesso de salvamento de destreza. Se a defesa falhar, o feitiço termina imediatamente, fazendo com que o cordão irrompa em chamas. Em um salvamento bem-sucedido, a criatura pode arremessar o cordão a até 12 metros. Quando atinge uma criatura ou um objeto sólido, o feitiço termina e o cordão explode.",
      "O fogo danifica objetos na área e inflama objetos inflamáveis que não estão sendo usados ou carregados."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 8º nível ou superior, o dano básico aumenta em 1d6 para cada nível de espaço acima do 7º."
    ],
    "material": "Uma pequena bola de guano de morcego e enxofre.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação",
    "damage_type": "Incêndio"
  },
  "Demiplane": {
    "name": "Demiplano",
    "desc": [
      "Você cria uma porta sombria em uma superfície plana e sólida que possa ser vista dentro do alcance. A porta é grande o suficiente para permitir que criaturas médias passem sem impedimentos. Quando aberta, a porta leva a um demiplano que parece ser uma sala vazia de 9 metros em cada dimensão, feita de madeira ou pedra. Quando o feitiço termina, a porta desaparece, e quaisquer criaturas ou objetos dentro do demiplano permanecem presos lá, pois a porta também desaparece do outro lado.",
      "Cada vez que lançar esse feitiço, você pode criar um novo demiplano ou fazer com que a porta sombria se conecte a um demiplano que você criou com um lançamento anterior desse feitiço. Além disso, se você conhecer a natureza e o conteúdo de um demiplano criado por outro feitiço lançado por outra criatura, poderá fazer com que a porta sombria se conecte a esse demiplano."
    ],
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Detect Evil and Good": {
    "name": "Detectar o mal e o bem",
    "desc": [
      "Durante esse período, você sabe se há uma aberração, celestial, elemental, feérico, demônio ou morto-vivo em um raio de 30 pés de você, bem como onde a criatura está localizada. Da mesma forma, você sabe se há um lugar ou objeto em um raio de 30 pés de você que tenha sido consagrado ou profanado magicamente.",
      "O feitiço pode penetrar na maioria das barreiras, mas é bloqueado por 1 pé de pedra, 1 polegada de metal comum, uma folha fina de chumbo ou 3 pés de madeira ou terra."
    ],
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Detect Magic": {
    "name": "Detectar Magia",
    "desc": [
      "Durante esse período, você sente a presença de magia em um raio de 30 pés de você. Se sentir a magia dessa forma, você pode usar sua ação para ver uma aura fraca em torno de qualquer criatura ou objeto visível na área que seja portador de magia e aprender a escola de magia, se houver.",
      "O feitiço pode penetrar na maioria das barreiras, mas é bloqueado por 1 pé de pedra, 1 polegada de metal comum, uma folha fina de chumbo ou 3 pés de madeira ou terra."
    ],
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Detect Poison and Disease": {
    "name": "Detectar veneno e doença",
    "desc": [
      "Durante esse período, você pode sentir a presença e a localização de venenos, criaturas venenosas e doenças em um raio de 30 pés de você. Você também identifica o tipo de veneno, criatura venenosa ou doença em cada caso.",
      "O feitiço pode penetrar na maioria das barreiras, mas é bloqueado por 1 pé de pedra, 1 polegada de metal comum, uma folha fina de chumbo ou 3 pés de madeira ou terra."
    ],
    "material": "Uma folha de teixo.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Detect Thoughts": {
    "name": "Detectar pensamentos",
    "desc": [
      "Durante esse período, você pode ler os pensamentos de determinadas criaturas. Ao lançar o feitiço e como sua ação em cada turno até o fim do feitiço, você pode concentrar sua mente em qualquer criatura que possa ver em um raio de 30 pés. Se a criatura que você escolher tiver uma Inteligência igual ou inferior a 3 ou não falar nenhum idioma, ela não será afetada.",
      "Inicialmente, você aprende os pensamentos superficiais da criatura - o que está mais em sua mente naquele momento. Como uma ação, você pode mudar sua atenção para os pensamentos de outra criatura ou tentar sondar mais profundamente a mente da mesma criatura. Se você sondar mais profundamente, o alvo deve fazer um arremesso salvador de Sabedoria. Se ele falhar, você terá uma visão do raciocínio (se houver), do estado emocional e de algo que se destaca na mente dele (como algo que o preocupa, ama ou odeia). Se for bem-sucedido, o feitiço termina. De qualquer forma, o alvo sabe que você está sondando a mente dele e, a menos que você desvie sua atenção para os pensamentos de outra criatura, a criatura pode usar a ação no turno dela para fazer um teste de Inteligência contestado pelo seu teste de Inteligência; se for bem-sucedido, o feitiço termina.",
      "As perguntas dirigidas verbalmente à criatura-alvo moldam naturalmente o curso de seus pensamentos, portanto esse feitiço é particularmente eficaz como parte de um interrogatório.",
      "Você também pode usar esse feitiço para detectar a presença de criaturas pensantes que não pode ver. Ao lançar o feitiço ou como sua ação durante a duração, você pode procurar por pensamentos em um raio de 30 pés de você. O feitiço pode penetrar em barreiras, mas 2 pés de rocha, 2 polegadas de qualquer metal que não seja chumbo ou uma folha fina de chumbo o bloqueia. Você não pode detectar uma criatura com Inteligência igual ou inferior a 3 ou uma criatura que não fale nenhum idioma.",
      "Depois de detectar a presença de uma criatura dessa forma, você pode ler seus pensamentos pelo resto da duração, conforme descrito acima, mesmo que não possa vê-la, mas ela ainda deve estar dentro do alcance."
    ],
    "material": "Uma moeda de cobre.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Dimension Door": {
    "name": "Dimensão da porta",
    "desc": [
      "Você se teletransporta de seu local atual para qualquer outro local dentro do alcance. Você chega exatamente ao local desejado. Pode ser um local que você possa ver, visualizar ou descrever, informando a distância e a direção, como \"200 pés em linha reta para baixo\" ou \"para cima, para noroeste, em um ângulo de 45 graus, 300 pés\".",
      "Você pode levar objetos, desde que o peso deles não exceda o que você pode carregar. Você também pode trazer uma criatura disposta, do seu tamanho ou menor, que esteja carregando equipamentos até o limite de sua capacidade de carga. A criatura deve estar a até 1,5 metro de você quando lançar esse feitiço.",
      "Se você chegar em um local já ocupado por um objeto ou criatura, você e qualquer criatura que estiver viajando com você receberão 4d6 de dano de força e o feitiço não conseguirá teletransportá-lo."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Força"
  },
  "Disguise Self": {
    "name": "Disfarce de si mesmo",
    "desc": [
      "Você faz com que você mesmo - incluindo suas roupas, armaduras, armas e outros pertences em seu corpo - pareça diferente até que o feitiço termine ou até que você use sua ação para descartá-lo. Você pode parecer 1 pé mais baixo ou mais alto e pode parecer magro, gordo ou um pouco mais baixo. Não é possível mudar seu tipo de corpo, portanto, você deve adotar uma forma que tenha a mesma disposição básica de membros. Caso contrário, a extensão da ilusão fica a seu critério.",
      "As alterações provocadas por esse feitiço não resistem a uma inspeção física. Por exemplo, se você usar esse feitiço para adicionar um chapéu à sua roupa, os objetos passarão pelo chapéu e qualquer pessoa que o tocar não sentirá nada ou sentirá sua cabeça e seu cabelo. Se você usar esse feitiço para parecer mais magro do que é, a mão de alguém que estender a mão para tocá-lo esbarrará em você enquanto estiver aparentemente no ar.",
      "Para discernir que você está disfarçado, uma criatura pode usar a ação dela para inspecionar sua aparência e deve ser bem-sucedida em um teste de Inteligência (Investigação) contra a sua CD de proteção contra feitiço."
    ],
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Disintegrate": {
    "name": "Desintegrar",
    "desc": [
      "Um fino raio verde sai do seu dedo apontado para um alvo que você possa ver dentro do alcance. O alvo pode ser uma criatura, um objeto ou uma criação de força mágica, como a parede criada pela parede de força.",
      "A criatura alvo desse feitiço deve fazer um arremesso de salvamento de destreza. Se o salvamento falhar, o alvo receberá 10d6 + 40 de dano de força. Se esse dano reduzir o alvo a 0 pontos de vida, ele será desintegrado.",
      "Uma criatura desintegrada e tudo o que ela estiver vestindo ou carregando, exceto itens mágicos, são reduzidos a uma pilha de poeira cinza fina. A criatura só pode ser restaurada à vida por meio de uma ressurreição verdadeira ou de um feitiço de desejo.",
      "Esse feitiço desintegra automaticamente um objeto não mágico Grande ou menor ou uma criação de força mágica. Se o alvo for um objeto ou criação de força Enorme ou maior, esse feitiço desintegra uma porção de 3 metros cúbicos dele. Um item mágico não é afetado por esse feitiço."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 7º nível ou superior, o dano aumenta em 3d6 para cada nível de espaço acima do 6º."
    ],
    "material": "Uma pedra de amolar e uma pitada de pó.",
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Força"
  },
  "Dispel Evil and Good": {
    "name": "Dissipar o mal e o bem",
    "desc": [
      "Uma energia cintilante envolve e protege você de feudos, mortos-vivos e criaturas originárias de fora do Plano Material. Durante esse período, celestiais, elementais, feéricos, demônios e mortos-vivos têm desvantagem nas rolagens de ataque contra você.",
      "Você pode encerrar o feitiço antecipadamente usando uma das seguintes funções especiais.",
      "***Como sua ação, você toca uma criatura que possa alcançar e que esteja encantada, amedrontada ou possuída por um celestial, um elemental, um feérico, um demônio ou um morto-vivo. A criatura que você tocar não estará mais encantada, amedrontada ou possuída por tais criaturas.",
      "***Como sua ação, faça um ataque mágico corpo a corpo contra um celestial, um elemental, um feérico, um demônio ou um morto-vivo que você possa alcançar. Se for atingido, você tentará levar a criatura de volta ao seu plano de origem. A criatura deve ser bem-sucedida em um arremesso de salvamento de carisma ou será enviada de volta ao seu plano de origem (se ainda não estiver lá). Se não estiver em seu plano de origem, os mortos-vivos são enviados para o Shadowfell e os fey são enviados para o Feywild."
    ],
    "material": "Água benta ou prata e ferro em pó.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Dispel Magic": {
    "name": "Dissipar Magia",
    "desc": [
      "Escolha uma criatura, objeto ou efeito mágico dentro do alcance. Qualquer feitiço de 3º nível ou inferior no alvo é encerrado. Para cada feitiço de 4º nível ou superior no alvo, faça uma verificação de habilidade usando sua habilidade de conjuração de feitiços. O DC é igual a 10 + o nível do feitiço. Se a verificação for bem-sucedida, o feitiço termina."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço para feitiço de 4º nível ou superior, você automaticamente encerra os efeitos de um feitiço no alvo se o nível do feitiço for igual ou inferior ao nível do espaço para feitiço que você usou."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Divination": {
    "name": "Adivinhação",
    "desc": [
      "Sua magia e uma oferenda o colocam em contato com um deus ou com os servos de um deus. Você faz uma única pergunta sobre um objetivo, evento ou atividade específica que ocorrerá dentro de 7 dias. O GM oferece uma resposta verdadeira. A resposta pode ser uma frase curta, uma rima enigmática ou um presságio.",
      "O feitiço não leva em conta nenhuma circunstância possível que possa alterar o resultado, como o lançamento de feitiços adicionais ou a perda ou ganho de um companheiro.",
      "Se você lançar o feitiço duas ou mais vezes antes de terminar seu próximo descanso longo, há uma chance cumulativa de 25% de obter uma leitura aleatória para cada lançamento após o primeiro. O GM faz essa rolagem em segredo."
    ],
    "material": "Incenso e uma oferenda de sacrifício apropriada à sua religião, no valor total de pelo menos 25gp, que o feitiço consome.",
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Divine Favor": {
    "name": "Favorecimento Divino",
    "desc": [
      "Sua oração o fortalece com radiância divina. Até que o feitiço termine, seus ataques com arma causam 1d4 de dano radiante extra em um acerto."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação bônus",
    "damage_type": "Radiante"
  },
  "Divine Word": {
    "name": "Verbo Divino",
    "desc": [
      "Você pronuncia uma palavra divina, imbuída do poder que moldou o mundo no início da criação. Escolha qualquer número de criaturas que você possa ver dentro do alcance. Cada criatura que puder ouvi-lo deverá fazer um arremesso salvador de Carisma. Se a defesa falhar, a criatura sofrerá um efeito baseado em seus pontos de vida atuais:",
      "- 50 pontos de vida ou menos: surdo por 1 minuto",
      "- 40 pontos de vida ou menos: ensurdecido e cego por 10 minutos",
      "- 30 pontos de vida ou menos: cego, ensurdecido e atordoado por 1 hora",
      "- 20 pontos de vida ou menos: morte instantânea",
      "Independentemente de seus pontos de vida atuais, um celestial, um elemental, um feérico ou um demônio que falhar em seu salvamento é forçado a voltar ao seu plano de origem (se ainda não estiver lá) e não pode retornar ao seu plano atual por 24 horas por qualquer meio que não seja um feitiço de desejo."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação bônus"
  },
  "Dominate Beast": {
    "name": "Dominar a fera",
    "desc": [
      "Você tenta seduzir uma criatura que possa ver dentro do alcance. Ela deve ser bem-sucedida em um lance de defesa de sabedoria ou será encantada por você durante esse período. Se você ou criaturas que lhe são simpáticas estiverem lutando contra ela, ela tem vantagem no arremesso de defesa.",
      "Enquanto a criatura estiver encantada, você terá um vínculo telepático com ela, desde que vocês dois estejam no mesmo plano de existência. Você pode usar esse vínculo telepático para emitir comandos para a criatura enquanto estiver consciente (nenhuma ação é necessária), aos quais ela faz o possível para obedecer. Você pode especificar um curso de ação simples e geral, como \"Ataque aquela criatura\", \"Corra até ali\" ou \"Pegue aquele objeto\". Se a criatura cumprir a ordem e não receber mais nenhuma orientação sua, ela se defenderá e se preservará da melhor forma possível.",
      "Você pode usar sua ação para assumir o controle total e preciso do alvo. Até o final do seu próximo turno, a criatura realiza apenas as ações que você escolher e não faz nada que você não permita que ela faça. Durante esse período, você também pode fazer com que a criatura use uma reação, mas isso exige que você também use a sua própria reação. Cada vez que o alvo recebe dano, ele faz um novo lance de proteção de sabedoria contra o feitiço. Se o lançamento de defesa for bem-sucedido, o feitiço termina."
    ],
    "higher_level": [
      "Quando você lança esse feitiço com um espaço de feitiço de 9º nível, a duração é de concentração, até 8 horas."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Dominate Monster": {
    "name": "Dominar Monstro",
    "desc": [
      "Você tenta seduzir uma criatura que possa ver dentro do alcance. Ela deve ser bem-sucedida em um lance de defesa de sabedoria ou será encantada por você durante esse período. Se você ou criaturas que lhe são simpáticas estiverem lutando contra ela, ela tem vantagem no arremesso de defesa.",
      "Enquanto a criatura estiver encantada, você terá um vínculo telepático com ela, desde que vocês dois estejam no mesmo plano de existência. Você pode usar esse vínculo telepático para emitir comandos para a criatura enquanto estiver consciente (nenhuma ação é necessária), aos quais ela faz o possível para obedecer. Você pode especificar um curso de ação simples e geral, como \"Ataque aquela criatura\", \"Corra até ali\" ou \"Pegue aquele objeto\". Se a criatura cumprir a ordem e não receber nenhuma outra orientação sua, ela se defenderá e se preservará da melhor forma possível.",
      "Você pode usar sua ação para assumir o controle total e preciso do alvo. Até o final do seu próximo turno, a criatura realiza apenas as ações que você escolher e não faz nada que você não permita que ela faça. Durante esse período, você também pode fazer com que a criatura use uma reação, mas isso exige que você também use a sua própria reação.",
      "Cada vez que o alvo recebe dano, ele faz um novo lance de defesa de sabedoria contra o feitiço. Se o arremesso de defesa for bem-sucedido, o feitiço termina."
    ],
    "higher_level": [
      "Quando você lança esse feitiço com um espaço de feitiço de 9º nível, a duração é de concentração, até 8 horas."
    ],
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Dominate Person": {
    "name": "Pessoa dominante",
    "desc": [
      "Você tenta seduzir um humanoide que possa ver dentro do alcance. Ele deve ser bem-sucedido em um lance de salvamento de sabedoria ou será encantado por você durante esse período. Se você ou criaturas que lhe são simpáticas estiverem lutando contra ele, ele tem vantagem no lance de defesa.",
      "Enquanto o alvo estiver encantado, você terá um vínculo telepático com ele, desde que estejam no mesmo plano de existência. Você pode usar esse vínculo telepático para emitir comandos para a criatura enquanto estiver consciente (nenhuma ação é necessária), aos quais ela faz o possível para obedecer. Você pode especificar um curso de ação simples e geral, como \"Ataque aquela criatura\", \"Corra até ali\" ou \"Pegue aquele objeto\". Se a criatura cumprir a ordem e não receber mais nenhuma orientação sua, ela se defenderá e se preservará da melhor forma possível.",
      "Você pode usar sua ação para assumir o controle total e preciso do alvo. Até o final do seu próximo turno, a criatura realiza apenas as ações que você escolher e não faz nada que você não permita que ela faça. Durante esse período, você também pode fazer com que a criatura use uma reação, mas isso exige que você também use a sua própria reação.",
      "Cada vez que o alvo recebe dano, ele faz um novo lance de defesa de sabedoria contra o feitiço. Se o lançamento de defesa for bem-sucedido, o feitiço termina."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 6º nível, a duração é de concentração, até 10 minutos. Quando você usa um espaço de feitiço de 7º nível, a duração é de concentração, até 1 hora. Quando você usa um espaço para feitiço de 8º nível ou superior, a duração é de concentração, até 8 horas."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Dream": {
    "name": "Sonho",
    "desc": [
      "Esse feitiço molda os sonhos de uma criatura. Escolha uma criatura conhecida por você como alvo desse feitiço. O alvo deve estar no mesmo plano de existência que você. As criaturas que não dormem, como os elfos, não podem ser contatadas por esse feitiço. Você, ou uma criatura disposta que você tocar, entra em estado de transe, agindo como um mensageiro.",
      "Enquanto está em transe, o mensageiro está ciente do ambiente ao seu redor, mas não pode realizar ações nem se mover.",
      "Se o alvo estiver dormindo, o mensageiro aparecerá nos sonhos do alvo e poderá conversar com ele enquanto ele estiver dormindo, durante toda a duração do feitiço. O mensageiro também pode moldar o ambiente do sonho, criando paisagens, objetos e outras imagens. O mensageiro pode sair do transe a qualquer momento, encerrando o efeito do feitiço antecipadamente. O alvo se lembra perfeitamente do sonho ao acordar. Se o alvo estiver acordado quando você lançar o feitiço, o mensageiro saberá disso e poderá encerrar o transe (e o feitiço) ou esperar que o alvo adormeça, momento em que o mensageiro aparecerá nos sonhos do alvo.",
      "Você pode fazer com que o mensageiro pareça monstruoso e aterrorizante para o alvo. Se você fizer isso, o mensageiro poderá entregar uma mensagem de no máximo dez palavras e, em seguida, o alvo deverá fazer um arremesso de sabedoria. Se o salvamento falhar, os ecos da monstruosidade fantasmagórica geram um pesadelo que dura a duração do sono do alvo e o impede de obter qualquer benefício desse descanso. Além disso, quando o alvo acorda, ele recebe 3d6 de dano psíquico.",
      "Se você tiver uma parte do corpo, uma mecha de cabelo, um corte de unha ou parte semelhante do corpo do alvo, o alvo fará seu arremesso de defesa com desvantagem."
    ],
    "material": "Um punhado de areia, um pouco de tinta e uma pena de escrever arrancada de um pássaro adormecido.",
    "duration": "8 horas",
    "casting_time": "1 minuto",
    "damage_type": "Psíquico"
  },
  "Druidcraft": {
    "name": "Artesanato druida",
    "desc": [
      "Sussurrando para os espíritos da natureza, você cria um dos seguintes efeitos dentro do \"alcance\":",
      "- Você cria um efeito sensorial minúsculo e inofensivo que prevê como será o clima em seu local nas próximas 24 horas. O efeito pode se manifestar como uma esfera dourada para céu limpo, uma nuvem para chuva, flocos de neve caindo para neve e assim por diante. Esse efeito persiste por 1 rodada.",
      "- Você faz uma flor desabrochar instantaneamente, uma vagem de semente se abrir ou um broto de folha desabrochar.",
      "- Você cria um efeito sensorial instantâneo e inofensivo, como folhas caindo, uma lufada de vento, o som de um animal pequeno ou o leve cheiro de gambá. O efeito deve caber em um cubo de 1,5 m.",
      "- Você acende ou apaga instantaneamente uma vela, uma tocha ou uma pequena fogueira."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Earthquake": {
    "name": "Terremoto",
    "desc": [
      "Você cria um distúrbio sísmico em um ponto no solo que pode ser visto dentro do alcance. Durante esse período, um tremor intenso rasga o solo em um círculo de 100 pés de raio centrado nesse ponto e sacode criaturas e estruturas em contato com o solo nessa área.",
      "O solo na área se torna um terreno difícil. Cada criatura no solo que estiver se concentrando deve fazer um lance de defesa de constituição. Se a defesa falhar, a concentração da criatura é quebrada.",
      "Quando você lançar esse feitiço e no final de cada turno que passar concentrado nele, cada criatura no chão na área deverá fazer um teste de resistência de destreza. Se a defesa falhar, a criatura é derrubada.",
      "Esse feitiço pode ter efeitos adicionais dependendo do terreno na área, conforme determinado pelo GM.",
      "Fissuras. As fissuras se abrem em toda a área do feitiço no início do seu próximo turno após o lançamento do feitiço. Um total de 1d6 dessas fissuras se abre em locais escolhidos pelo MJ. Cada uma tem 1d10 x 3 metros de profundidade, 3 metros de largura e se estende de uma borda da área do feitiço até o lado oposto. Uma criatura que estiver em um local onde uma fissura se abre deve ser bem-sucedida em um lançamento de salvamento de destreza ou cairá. A criatura que for bem-sucedida em um lançamento de salvamento se move com a borda da fissura à medida que ela se abre.",
      "Uma fissura que se abre sob uma estrutura faz com que ela entre em colapso automaticamente (veja abaixo).",
      "Estruturas. O tremor causa 50 de dano de arma branca a qualquer estrutura em contato com o solo na área quando você lança o feitiço e no início de cada um dos seus turnos até que o feitiço termine. Se uma estrutura chegar a 0 pontos de vida, ela entrará em colapso e poderá causar danos às criaturas próximas. Uma criatura dentro da metade da distância da altura da estrutura deve fazer um arremesso salvador de destreza. Se o salvamento falhar, a criatura recebe 5d6 de dano contundente, fica de bruços e é enterrada nos escombros, exigindo um teste de Força (Atletismo) DC 20 como uma ação para escapar. O GM pode ajustar o DC para mais ou para menos, dependendo da natureza dos escombros. Em um salvamento bem-sucedido, a criatura recebe metade do dano e não cai de bruços nem fica enterrada."
    ],
    "material": "Uma pitada de terra, um pedaço de pedra e um pedaço de argila.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Eldritch Blast": {
    "name": "Explosão Eldritch",
    "desc": [
      "Um feixe de energia crepitante se dirige a uma criatura dentro do alcance. Faça um ataque mágico de longo alcance contra o alvo. Em caso de acerto, o alvo recebe 1d10 de dano de força. O feitiço cria mais de um feixe quando você atinge níveis mais altos: dois feixes no 5º nível, três feixes no 11º nível e quatro feixes no 17º nível. Você pode direcionar os feixes para o mesmo alvo ou para alvos diferentes. Faça uma rolagem de ataque separada para cada feixe."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "attack_type": "variado",
    "damage_type": "Força"
  },
  "Enhance Ability": {
    "name": "Aprimorar a capacidade",
    "desc": [
      "Você toca uma criatura e concede a ela um aprimoramento mágico. Escolha um dos seguintes efeitos; o alvo recebe esse efeito até o fim do feitiço.",
      "***Resistência do urso*** O alvo tem vantagem em verificações de constituição. Ele também ganha 2d6 pontos de vida temporários, que são perdidos quando o feitiço termina.",
      "***Força do touro: O alvo tem vantagem em verificações de força e sua capacidade de carga dobra.",
      "***Graça do gato *** O alvo tem vantagem em verificações de destreza. Ele também não sofre dano ao cair de 6 metros ou menos se não estiver incapacitado.",
      "***Esplendor da Águia: O alvo tem vantagem em verificações de Carisma.",
      "***Astúcia da Raposa *** O alvo tem vantagem em verificações de inteligência.",
      "***Sabedoria da Coruja: O alvo tem vantagem em verificações de sabedoria."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço de feitiço de 3º nível ou superior, você pode ter como alvo uma criatura adicional para cada nível de espaço acima do 2º."
    ],
    "material": "Pele ou pena de um animal.",
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Enlarge/Reduce": {
    "name": "Ampliar/Reduzir",
    "desc": [
      "Você faz com que uma criatura ou um objeto que possa ver dentro do alcance aumente ou diminua de tamanho durante o período. Escolha uma criatura ou um objeto que não esteja sendo usado ou carregado. Se o alvo não estiver disposto, ele pode fazer um arremesso salvador de Constituição. Se for bem-sucedido, o feitiço não terá efeito.",
      "Se o alvo for uma criatura, tudo o que ela estiver vestindo ou carregando mudará de tamanho com ela. Qualquer item deixado cair por uma criatura afetada retorna ao tamanho normal imediatamente.",
      "***Enlarge.*** O tamanho do alvo dobra em todas as dimensões e seu peso é multiplicado por oito. Esse crescimento aumenta seu tamanho em uma categoria - de Médio para Grande, por exemplo. Se não houver espaço suficiente para o alvo dobrar de tamanho, a criatura ou o objeto atingirá o tamanho máximo possível no espaço disponível. Até o fim do feitiço, o alvo também tem vantagem em verificações de Força e lançamentos de defesa de Força. As armas do alvo também crescem para corresponder ao seu novo tamanho. Enquanto essas armas estiverem ampliadas, os ataques do alvo com elas causam 1d4 de dano extra.",
      "***O tamanho do alvo é reduzido à metade em todas as dimensões e seu peso é reduzido a um oitavo do normal. Essa redução diminui seu tamanho em uma categoria - de Médio para Pequeno, por exemplo. Até o fim do feitiço, o alvo também tem desvantagem nas verificações de Força e nos lançamentos de defesa de Força. As armas do alvo também diminuem para corresponder ao seu novo tamanho. Enquanto essas armas estiverem reduzidas, os ataques do alvo com elas causam 1d4 a menos de dano (isso não pode reduzir o dano para menos de 1)."
    ],
    "material": "Uma pitada de pó de ferro.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Entangle": {
    "name": "Emaranhado",
    "desc": [
      "Ervas daninhas e cipós que se agarram brotam do solo em um quadrado de 6 metros a partir de um ponto dentro do alcance. Durante esse período, essas plantas transformam o solo da área em um terreno difícil.",
      "Uma criatura que estiver na área quando você lançar o feitiço deve ser bem-sucedida em um teste de resistência de força ou será restringida pelas plantas emaranhadas até que o feitiço termine. Uma criatura presa pelas plantas pode usar sua ação para fazer um teste de Força contra a CD de proteção do feitiço. Se for bem-sucedida, ela se liberta.",
      "Quando o feitiço termina, as plantas conjuradas murcham."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Enthrall": {
    "name": "Enthrall",
    "desc": [
      "Você tece uma sequência de palavras que o distrai, fazendo com que as criaturas de sua escolha que você possa ver dentro do alcance e que possam ouvi-lo façam um lance de defesa de sabedoria. Qualquer criatura que não possa ser encantada é bem-sucedida nesse arremesso de defesa automaticamente e, se você ou seus companheiros estiverem lutando contra uma criatura, ela terá vantagem no arremesso. Se a defesa falhar, o alvo terá desvantagem em verificações de Sabedoria (Percepção) feitas para perceber qualquer criatura que não seja você até que o feitiço termine ou até que o alvo não possa mais ouvi-lo. O feitiço termina se você estiver incapacitado ou não puder mais falar."
    ],
    "duration": "1 minuto",
    "casting_time": "1 ação"
  },
  "Etherealness": {
    "name": "Etherealness",
    "desc": [
      "Você entra nas regiões de fronteira do Plano Etéreo, na área em que ele se sobrepõe ao seu plano atual. Você permanecerá na Fronteira Etérea enquanto durar o feitiço ou até que use sua ação para descartá-lo. Durante esse período, você pode se mover em qualquer direção. Durante esse tempo, você pode se mover em qualquer direção. Se você se mover para cima ou para baixo, cada pé de movimento custa um pé extra. Você pode ver e ouvir o plano de onde se originou, mas tudo lá parece cinza e você não consegue ver nada a mais de 60 pés de distância.",
      "Enquanto estiver no Plano Etéreo, você só pode afetar e ser afetado por outras criaturas desse plano. As criaturas que não estão no Plano Etéreo não podem percebê-lo e não podem interagir com você, a menos que uma habilidade especial ou magia lhes dê essa capacidade.",
      "Você ignora todos os objetos e efeitos que não estejam no Plano Etéreo, o que lhe permite mover-se por objetos que você percebe no plano de onde veio.",
      "Quando o feitiço termina, você retorna imediatamente ao plano de onde se originou no local que ocupa atualmente. Se estiver ocupando o mesmo local que um objeto sólido ou uma criatura quando isso acontecer, você será imediatamente empurrado para o espaço desocupado mais próximo que puder ocupar e sofrerá dano de força igual ao dobro do número de metros que for movido.",
      "Esse feitiço não terá efeito se você o lançar enquanto estiver no Plano Etéreo ou em um plano que não faça fronteira com ele, como um dos Planos Externos."
    ],
    "higher_level": [
      "Ao conjurar esse feitiço usando um espaço de feitiço de 8º nível ou superior, você pode ter como alvo até três criaturas dispostas (incluindo você) para cada nível de espaço acima do 7º. As criaturas devem estar a até 3 metros de você quando lançar o feitiço."
    ],
    "duration": "8 horas",
    "casting_time": "1 ação"
  },
  "Expeditious Retreat": {
    "name": "Retirada rápida",
    "desc": [
      "Esse feitiço permite que você se mova em um ritmo incrível. Ao lançar esse feitiço e, depois, como uma ação bônus em cada um dos seus turnos até que o feitiço termine, você pode realizar a ação de Dash."
    ],
    "duration": "Até 10 minutos",
    "casting_time": "1 ação bônus"
  },
  "Eyebite": {
    "name": "Olhos",
    "desc": [
      "Durante o período de duração do feitiço, seus olhos se transformam em um vazio escuro imbuído de poder pavoroso. Uma criatura de sua escolha em um raio de 60 pés que você possa ver deve ser bem-sucedida em um arremesso de sabedoria ou ser afetada por um dos seguintes efeitos de sua escolha durante o período. Em cada um de seus turnos até que o feitiço termine, você pode usar sua ação para mirar em outra criatura, mas não pode mirar em uma criatura novamente se ela tiver sido bem-sucedida em um teste de resistência contra essa conjuração de eyebite.",
      "***O alvo fica inconsciente. Ele acorda se sofrer algum dano ou se outra criatura usar sua ação para sacudir o dorminhoco.",
      "***O alvo está com medo de você. Em cada um de seus turnos, a criatura amedrontada deve realizar a ação Dash e se afastar de você pela rota mais segura e mais curta disponível, a menos que não tenha para onde se mover. Se o alvo se mover para um local a pelo menos 60 pés de distância de você, onde não possa mais vê-lo, esse efeito termina.",
      "***O alvo tem desvantagem em rolagens de ataque e verificações de habilidade. No final de cada um de seus turnos, ele pode fazer outro arremesso salvador de sabedoria. Se for bem-sucedido, o efeito termina."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Fabricate": {
    "name": "Fabricar",
    "desc": [
      "Você converte matérias-primas em produtos do mesmo material. Por exemplo, você pode fabricar uma ponte de madeira a partir de um grupo de árvores, uma corda a partir de um pedaço de cânhamo e roupas a partir de linho ou lã.",
      "Escolha matérias-primas que você possa ver dentro do alcance. Você pode fabricar um objeto Grande ou menor (contido em um cubo de 3 metros ou oito cubos de 1,5 metro conectados), se tiver uma quantidade suficiente de matéria-prima. No entanto, se estiver trabalhando com metal, pedra ou outra substância mineral, o objeto fabricado não pode ser maior do que Médio (contido em um único cubo de 1,5 m). A qualidade dos objetos fabricados por esse feitiço é proporcional à qualidade das matérias-primas.",
      "Criaturas ou itens mágicos não podem ser criados ou transmutados por esse feitiço. Você também não pode usá-lo para criar itens que normalmente exigem um alto grau de habilidade, como joias, armas, vidros ou armaduras, a menos que tenha proficiência com o tipo de ferramenta de artesão usada para criar esses objetos."
    ],
    "duration": "Instantâneo",
    "casting_time": "10 minutos"
  },
  "Faerie Fire": {
    "name": "Faerie Fire",
    "desc": [
      "Cada objeto em um cubo de 6 metros dentro do alcance é delineado em luz azul, verde ou violeta (à sua escolha). Qualquer criatura na área quando o feitiço é lançado também é delineada em luz se falhar em um arremesso de salvamento de destreza. Enquanto durar o feitiço, os objetos e as criaturas afetadas emitirão uma luz fraca em um raio de 3 metros.",
      "Qualquer rolagem de ataque contra uma criatura ou objeto afetado tem vantagem se o atacante puder vê-lo, e a criatura ou objeto afetado não pode se beneficiar do fato de ser invisível."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Faithful Hound": {
    "name": "Cão de Caça Fiel",
    "desc": [
      "Você conjura um cão de guarda fantasma em um espaço desocupado que você possa ver dentro do alcance, onde ele permanece por toda a duração, até que você o dispense como uma ação ou até que você se afaste mais de 30 metros dele.",
      "O cão de caça fica invisível para todas as criaturas, exceto para você, e não pode ser ferido. Quando uma criatura pequena ou maior se aproxima até 30 pés dele sem antes falar a senha que você especificou ao lançar esse feitiço, o cão de caça começa a latir alto. O cão de caça vê criaturas invisíveis e pode ver o Plano Etéreo. Ele ignora ilusões.",
      "No início de cada um de seus turnos, o cão de caça tenta morder uma criatura hostil a você em um raio de 1,5 metro. O bônus de ataque do cão de caça é igual ao seu modificador de habilidade de lançamento de feitiço + seu bônus de proficiência. Em caso de acerto, ele causa 4d8 de dano perfurante."
    ],
    "material": "Um pequeno apito de prata, um pedaço de osso e um fio",
    "duration": "8 horas",
    "casting_time": "1 ação",
    "attack_type": "corpo a corpo",
    "damage_type": "Piercing"
  },
  "False Life": {
    "name": "Vida falsa",
    "desc": [
      "Ao se fortalecer com um fac-símile necromântico de vida, você ganha 1d4 + 4 pontos de vida temporários durante o período."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço de feitiço de 2º nível ou superior, você ganha 5 pontos de vida temporários adicionais para cada nível de espaço acima do 1º."
    ],
    "material": "Uma pequena quantidade de álcool ou destilados.",
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Fear": {
    "name": "Medo",
    "desc": [
      "Você projeta uma imagem fantasmagórica dos piores medos de uma criatura. Cada criatura em um cone de 30 pés deve ser bem-sucedida em um arremesso de sabedoria ou largará o que estiver segurando e ficará amedrontada durante esse período.",
      "Enquanto estiver amedrontada por esse feitiço, a criatura deve realizar a ação de Dash e se afastar de você pela rota mais segura disponível em cada um de seus turnos, a menos que não tenha para onde se mover. Se a criatura terminar o turno em um local onde não tenha linha de visão para você, ela poderá fazer um arremesso de sabedoria. Se a defesa for bem-sucedida, o feitiço termina para essa criatura."
    ],
    "material": "Uma pena branca ou o coração de uma galinha.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Feather Fall": {
    "name": "Queda de penas",
    "desc": [
      "Escolha até cinco criaturas em queda dentro do alcance. A velocidade de descida de uma criatura em queda diminui para 60 pés por rodada até o fim do feitiço. Se a criatura aterrissar antes do fim do feitiço, ela não sofrerá dano de queda e poderá aterrissar de pé, e o feitiço terminará para essa criatura."
    ],
    "material": "Uma pequena pena ou um pedaço de penugem.",
    "duration": "1 minuto",
    "casting_time": "1 reação"
  },
  "Feeblemind": {
    "name": "Mente fraca",
    "desc": [
      "Você explode a mente de uma criatura que possa ver dentro do alcance, tentando destruir o intelecto e a personalidade dela. O alvo recebe 4d6 de dano psíquico e deve fazer um arremesso salvador de inteligência.",
      "Se a defesa falhar, os escores de Inteligência e Carisma da criatura se tornam 1. A criatura não pode lançar feitiços, ativar itens mágicos, compreender a linguagem ou se comunicar de forma inteligível. Entretanto, a criatura pode identificar seus amigos, segui-los e até mesmo protegê-los.",
      "Ao final de cada 30 dias, a criatura pode repetir seu lance de defesa contra esse feitiço. Se ela for bem-sucedida em seu lance de defesa, o feitiço termina.",
      "O feitiço também pode ser encerrado por uma restauração maior, cura ou desejo."
    ],
    "material": "Um punhado de esferas de argila, cristal, vidro ou minerais.",
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Psíquico"
  },
  "Find Familiar": {
    "name": "Encontrar familiaridade",
    "desc": [
      "Você ganha o serviço de um familiar, um espírito que assume uma forma animal à sua escolha: morcego, gato, caranguejo, sapo, falcão, lagarto, polvo, coruja, cobra venenosa, peixe, rato, corvo, cavalo marinho, aranha ou doninha. Aparecendo em um espaço desocupado dentro do alcance, o familiar tem as estatísticas da forma escolhida, embora seja um celestial, feérico ou demônio (à sua escolha) em vez de uma fera.",
      "Seu familiar age independentemente de você, mas sempre obedece aos seus comandos. Em combate, ele rola sua própria iniciativa e age em seu próprio turno. Um familiar não pode atacar, mas pode realizar outras ações normalmente.",
      "Quando o familiar chega a 0 pontos de vida, ele desaparece, sem deixar nenhuma forma física. Ele reaparece depois que você lançar esse feitiço novamente.",
      "Enquanto seu familiar estiver a até 30 metros de você, você pode se comunicar com ele telepaticamente. Além disso, como uma ação, você pode ver através dos olhos do seu familiar e ouvir o que ele ouve até o início do seu próximo turno, recebendo os benefícios de quaisquer sentidos especiais que o familiar tenha. Durante esse período, você fica surdo e cego em relação aos seus próprios sentidos.",
      "Como uma ação, você pode dispensar temporariamente seu familiar. Ele desaparece em uma dimensão de bolso, onde aguarda sua convocação. Como alternativa, você pode dispensá-lo para sempre. Como uma ação, enquanto ele estiver temporariamente dispensado, você pode fazer com que ele reapareça em qualquer espaço desocupado em um raio de 30 pés de você.",
      "Você não pode ter mais de um familiar ao mesmo tempo. Se lançar esse feitiço enquanto já tiver um familiar, você fará com que ele adote uma nova forma. Escolha uma das formas da lista acima. Seu familiar se transforma na criatura escolhida.",
      "Finalmente, quando você lança um feitiço com alcance de toque, seu familiar pode lançar o feitiço como se tivesse lançado o feitiço. Seu familiar deve estar a até 30 metros de você e deve usar a reação dele para lançar o feitiço quando você o lançar. Se o feitiço exigir uma rolagem de ataque, você usará seu modificador de ação para a rolagem."
    ],
    "material": "10gp de carvão, incenso e ervas que devem ser consumidos pelo fogo em um braseiro de latão.",
    "duration": "Instantâneo",
    "casting_time": "1 hora"
  },
  "Find Steed": {
    "name": "Encontrar Steed",
    "desc": [
      "Você invoca um espírito que assume a forma de um corcel excepcionalmente inteligente, forte e leal, criando um vínculo duradouro com ele. Aparecendo em um espaço desocupado dentro do alcance, o corcel assume a forma que você escolher, como um cavalo de guerra, um pônei, um camelo, um alce ou um mastim. (Seu MJ pode permitir que outros animais sejam convocados como corcéis.) O corcel tem as estatísticas da forma escolhida, embora seja celestial, feérico ou demoníaco (à sua escolha) em vez de seu tipo normal. Além disso, se o corcel tiver uma Inteligência de 5 ou menos, a Inteligência dele passa a ser 6 e ele ganha a capacidade de entender um idioma de sua escolha que você fale.",
      "Seu corcel o serve como montaria, tanto em combate quanto fora dele, e você tem um vínculo instintivo com ele que lhe permite lutar como uma unidade contínua. Enquanto estiver montado em seu corcel, você pode fazer com que qualquer feitiço lançado que tenha como alvo apenas você também tenha como alvo seu corcel.",
      "Quando o corcel chega a 0 pontos de vida, ele desaparece, não deixando para trás nenhuma forma física. Você também pode dispensar seu corcel a qualquer momento como uma ação, fazendo com que ele desapareça. Em ambos os casos, lançar esse feitiço novamente invoca o mesmo corcel, restaurado ao seu máximo de pontos de vida.",
      "Enquanto seu corcel estiver a menos de 1 milha de você, você pode se comunicar com ele telepaticamente.",
      "Você não pode ter mais de um corcel ligado por esse feitiço ao mesmo tempo. Como uma ação, você pode liberar o corcel de seu vínculo a qualquer momento, fazendo com que ele desapareça."
    ],
    "duration": "Instantâneo",
    "casting_time": "10 minutos"
  },
  "Find the Path": {
    "name": "Encontre o caminho",
    "desc": [
      "Esse feitiço permite que você encontre a rota física mais curta e direta para um local fixo específico com o qual você esteja familiarizado no mesmo plano de existência. Se você nomear um destino em outro plano de existência, um destino que se mova (como uma fortaleza móvel) ou um destino que não seja específico (como \"o covil de um dragão verde\"), o feitiço falhará.",
      "Durante todo o tempo, enquanto estiver no mesmo plano de existência do destino, você sabe a que distância ele está e em que direção se encontra. Enquanto estiver viajando para lá, sempre que lhe for apresentada uma opção de caminhos ao longo do percurso, você determinará automaticamente qual é o caminho mais curto e direto (mas não necessariamente o mais seguro) para o destino."
    ],
    "material": "Um conjunto de ferramentas divinatórias - como ossos, bastões de marfim, cartas, dentes ou runas esculpidas - no valor de 100gp e um objeto do local que você deseja encontrar.",
    "duration": "Até 24 horas",
    "casting_time": "1 minuto"
  },
  "Find Traps": {
    "name": "Localizar armadilhas",
    "desc": [
      "Você sente a presença de qualquer armadilha dentro do alcance que esteja na linha de visão. Uma armadilha, para os fins desse feitiço, inclui qualquer coisa que possa infligir um efeito repentino ou inesperado que você considere prejudicial ou indesejável e que tenha sido especificamente planejado como tal por seu criador. Assim, o feitiço detectaria uma área afetada pelo feitiço de alarme, um glifo de proteção ou uma armadilha mecânica de fosso, mas não revelaria uma fraqueza natural no piso, um teto instável ou um sumidouro oculto.",
      "Esse feitiço apenas revela que uma armadilha está presente. Você não fica sabendo a localização de cada armadilha, mas fica sabendo a natureza geral do perigo representado por uma armadilha que você detecta."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Finger of Death": {
    "name": "Dedo da Morte",
    "desc": [
      "Você envia energia negativa através de uma criatura que você possa ver dentro do alcance, causando-lhe uma dor lancinante. O alvo deve fazer um arremesso salvador de Constituição. Ele recebe 7d8 + 30 de dano necrótico se o salvamento falhar, ou metade do dano se for bem-sucedido.",
      "Um humanoide morto por esse feitiço ressuscita no início do seu próximo turno como um zumbi que está permanentemente sob seu comando, seguindo suas ordens verbais da melhor forma possível."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Necrótico"
  },
  "Fire Bolt": {
    "name": "Parafuso de fogo",
    "desc": [
      "Você arremessa um cisco de fogo em uma criatura ou objeto dentro do alcance. Faça um ataque mágico de longo alcance contra o alvo. Em caso de acerto, o alvo recebe 1d10 de dano de fogo. Um objeto inflamável atingido por esse feitiço se incendeia se não estiver sendo usado ou carregado.",
      "O dano desse feitiço aumenta em 1d10 quando você atinge o 5º nível (2d10), o 11º nível (3d10) e o 17º nível (4d10)."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "attack_type": "variado",
    "damage_type": "Incêndio"
  },
  "Fire Shield": {
    "name": "Escudo de fogo",
    "desc": [
      "Uma chama fina e vaporosa envolve seu corpo durante o feitiço, irradiando uma luz brilhante em um raio de 3 metros e uma luz fraca por mais 3 metros. Você pode encerrar o feitiço usando uma ação para fazê-lo desaparecer.",
      "As chamas estão ao seu redor como um escudo térmico ou frio, à sua escolha. O escudo térmico lhe dá resistência a dano por frio e o frio a dano por fogo.",
      "Além disso, sempre que uma criatura em um raio de 1,5 m atingir você com um ataque corpo a corpo, chamas sairão do escudo. O atacante então sofre 2d8 pontos de dano de fogo ou frio, dependendo do modelo."
    ],
    "material": "Um pouco de fósforo ou um vaga-lume.",
    "duration": "10 minutos",
    "casting_time": "1 ação",
    "damage_type": "Incêndio"
  },
  "Fire Storm": {
    "name": "Tempestade de fogo",
    "desc": [
      "Uma tempestade composta de folhas de chamas crepitantes aparece em um local que você escolher dentro do alcance. A área da tempestade consiste em até dez cubos de 3 metros, que você pode organizar como quiser. Cada cubo deve ter pelo menos uma face adjacente à face de outro cubo. Cada criatura na área deve fazer um arremesso salvador de destreza. Ela recebe 7d10 de dano de fogo se a defesa falhar, ou metade do dano se for bem-sucedida.",
      "O fogo danifica os objetos na área e inflama objetos inflamáveis que não estejam sendo usados ou carregados. Se você escolher, a vida vegetal na área não será afetada por esse feitiço."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Incêndio"
  },
  "Fireball": {
    "name": "Bola de fogo",
    "desc": [
      "Um raio brilhante sai do seu dedo indicador e vai até um ponto que você escolher dentro do alcance e, em seguida, se transforma em uma explosão de chamas com um rugido baixo. Cada criatura em uma esfera de 20 pés de raio centrada nesse ponto deve fazer um arremesso salvador de destreza. Um alvo recebe 8d6 de dano de fogo se a defesa falhar, ou metade do dano se for bem-sucedida.",
      "O fogo se espalha pelos cantos. Ele incendeia objetos inflamáveis na área que não estão sendo usados ou carregados."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 4º nível ou superior, o dano aumenta em 1d6 para cada nível de espaço acima do 3º."
    ],
    "material": "Uma pequena bola de guano de morcego e enxofre.",
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Incêndio"
  },
  "Flame Blade": {
    "name": "Lâmina de chama",
    "desc": [
      "Você evoca uma lâmina ardente em sua mão livre. A lâmina tem tamanho e formato semelhantes aos de uma cimitarra e dura por toda a duração. Se você soltar a lâmina, ela desaparece, mas você pode evocá-la novamente como uma ação adicional.",
      "Você pode usar sua ação para fazer um ataque mágico corpo a corpo com a lâmina de fogo. Em caso de acerto, o alvo recebe 3d6 de dano de fogo.",
      "A lâmina flamejante emite luz brilhante em um raio de 3 metros e luz fraca por mais 3 metros."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 4º nível ou superior, o dano aumenta em 1d6 para cada dois níveis de espaço acima do 2º."
    ],
    "material": "Folha de sumagre.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação bônus",
    "damage_type": "Incêndio"
  },
  "Flame Strike": {
    "name": "Golpe de chama",
    "desc": [
      "Uma coluna vertical de fogo divino ruge dos céus em um local que você especificar. Cada criatura em um cilindro de 10 pés de raio e 40 pés de altura, centrado em um ponto dentro do alcance, deve fazer um arremesso de salvamento de destreza. Uma criatura recebe 4d6 de dano de fogo e 4d6 de dano radiante se a defesa falhar, ou metade do dano se for bem-sucedida."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 6º nível ou superior, o dano de fogo ou o dano radiante (à sua escolha) aumenta em 1d6 para cada nível de espaço acima do 5º."
    ],
    "material": "Uma pitada de enxofre.",
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Incêndio"
  },
  "Flaming Sphere": {
    "name": "Esfera Flamejante",
    "desc": [
      "Uma esfera de fogo de 1,5 m de diâmetro aparece em um espaço desocupado de sua escolha dentro do alcance e dura a duração. Qualquer criatura que termine seu turno em um raio de 1,5 m da esfera deve fazer um arremesso salvador de destreza. A criatura recebe 2d6 de dano de fogo se a defesa falhar, ou metade do dano se for bem-sucedida.",
      "Como uma ação adicional, você pode mover a esfera até 30 pés. Se você colidir a esfera com uma criatura, essa criatura deve fazer um arremesso salvador contra o dano da esfera, e a esfera para de se mover nesse turno.",
      "Ao mover a esfera, você pode direcioná-la por cima de barreiras de até 1,5 metro de altura e saltá-la por fossos de até 3 metros de largura. A esfera inflama objetos inflamáveis que não estejam sendo usados ou carregados e emite luz brilhante em um raio de 6 metros e luz fraca por mais 6 metros."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 3º nível ou superior, o dano aumenta em 1d6 para cada nível de espaço acima do 2º."
    ],
    "material": "Um pouco de sebo, uma pitada de enxofre e um pouco de ferro em pó.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação",
    "damage_type": "Incêndio"
  },
  "Flesh to Stone": {
    "name": "Da carne à pedra",
    "desc": [
      "Você tenta transformar em pedra uma criatura que possa ver dentro do alcance. Se o corpo do alvo for feito de carne, a criatura deve fazer um arremesso salvador de Constituição. Se o salvamento falhar, a criatura será restringida enquanto sua carne começa a endurecer. Em um salvamento bem-sucedido, a criatura não é afetada.",
      "Uma criatura restringida por esse feitiço deve fazer outro arremesso de defesa de constituição no final de cada um de seus turnos. Se ela for bem-sucedida em salvar três vezes contra esse feitiço, o feitiço termina. Se falhar em seus salvamentos três vezes, ela será transformada em pedra e estará sujeita à condição de petrificada durante o período. Os sucessos e fracassos não precisam ser consecutivos; mantenha o controle de ambos até que o alvo obtenha três sucessos iguais.",
      "Se a criatura estiver fisicamente quebrada enquanto estiver petrificada, ela sofrerá deformidades semelhantes se voltar ao seu estado original.",
      "Se você mantiver sua concentração nesse feitiço por toda a duração possível, a criatura será transformada em pedra até que o efeito seja removido."
    ],
    "material": "Uma pitada de limão, água e terra.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Floating Disk": {
    "name": "Disco flutuante",
    "desc": [
      "Esse feitiço cria um plano de força circular e horizontal, com 3 pés de diâmetro e 1 polegada de espessura, que flutua 3 pés acima do solo em um espaço desocupado de sua escolha que você possa ver dentro do alcance. O disco permanece por toda a duração e pode suportar até 500 libras. Se mais peso for colocado sobre ele, o feitiço termina e tudo o que estiver no disco cai no chão.",
      "O disco fica imóvel enquanto você estiver a menos de 6 metros dele. Se você se afastar mais de 6 metros dele, o disco o seguirá de modo a permanecer a 6 metros de você. O disco pode se mover em terrenos irregulares, subir ou descer escadas, encostas e similares, mas não pode atravessar uma mudança de elevação de 3 metros ou mais. Por exemplo, o disco não pode se mover em um poço de 3 metros de profundidade, nem pode sair desse poço se tiver sido criado no fundo.",
      "Se você se afastar mais de 30 metros do disco (normalmente porque ele não consegue contornar um obstáculo para segui-lo), o feitiço termina."
    ],
    "material": "Uma gota de mercúrio.",
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Fly": {
    "name": "Voar",
    "desc": [
      "Você toca uma criatura disposta. O alvo ganha uma velocidade de voo de 60 pés durante o período. Quando o feitiço termina, o alvo cai se ainda estiver no ar, a menos que consiga parar a queda."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço de feitiço de 4º nível ou superior, você pode ter como alvo uma criatura adicional para cada nível de espaço acima do 3º."
    ],
    "material": "Uma pena de asa de qualquer pássaro.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Fog Cloud": {
    "name": "Nuvem de neblina",
    "desc": [
      "Você cria uma esfera de neblina com 20 pés de raio centrada em um ponto dentro do alcance. A esfera se espalha pelos cantos e sua área fica fortemente obscurecida. Ela dura a duração ou até que um vento de velocidade moderada ou maior (pelo menos 10 milhas por hora) a disperse."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 2º nível ou superior, o raio da névoa aumenta em 6 metros para cada nível de espaço acima do 1º."
    ],
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Forbiddance": {
    "name": "Proibição",
    "desc": [
      "Você cria uma proteção contra viagens mágicas que protege até 40.000 pés quadrados de espaço no chão a uma altura de 30 pés acima do chão. Durante esse período, as criaturas não podem se teletransportar para a área nem usar portais, como os criados pelo feitiço de portal, para entrar na área. O feitiço torna a área à prova de viagens planares e, portanto, impede que as criaturas acessem a área por meio do Plano Astral, do Plano Etéreo, do Feywild, do Shadowfell ou do feitiço de mudança de plano.",
      "Além disso, o feitiço causa dano aos tipos de criaturas que você escolher quando o lançar. Escolha uma ou mais das seguintes opções: celestiais, elementais, feéricos, demônios e mortos-vivos. Quando uma criatura escolhida entra na área do feitiço pela primeira vez em um turno ou começa seu turno lá, a criatura recebe 5d10 de dano radiante ou necrótico (sua escolha ao lançar esse feitiço).",
      "Ao lançar esse feitiço, você pode designar uma senha. A criatura que falar a senha ao entrar na área não sofrerá dano do feitiço.",
      "A área do feitiço não pode se sobrepor à área de outro feitiço de proibição. Se você conjurar proibição todos os dias durante 30 dias no mesmo local, o feitiço durará até ser dissipado e os componentes materiais serão consumidos na última conjuração."
    ],
    "material": "Uma aspersão de água benta, incenso raro e rubi em pó no valor de pelo menos 1.000 gp.",
    "duration": "24 horas",
    "casting_time": "10 minutos"
  },
  "Forcecage": {
    "name": "Gaiola de força",
    "desc": [
      "Uma prisão imóvel, invisível e em forma de cubo, composta de força mágica, passa a existir em torno de uma área que você escolher dentro do alcance. A prisão pode ser uma gaiola ou uma caixa sólida, conforme sua escolha.",
      "Uma prisão em forma de gaiola pode ter até 6 metros de lado e é feita com barras de 1/2 polegada de diâmetro espaçadas de 1/2 polegada.",
      "Uma prisão no formato de uma caixa pode ter até 3 metros de lado, criando uma barreira sólida que impede que qualquer matéria passe por ela e bloqueia qualquer feitiço lançado dentro ou fora da área.",
      "Quando você lança o feitiço, qualquer criatura que esteja completamente dentro da área da gaiola fica presa. As criaturas que estiverem apenas parcialmente dentro da área, ou aquelas grandes demais para caberem dentro da área, são empurradas para longe do centro da área até que estejam completamente fora dela.",
      "Uma criatura dentro da gaiola não pode sair dela por meios não mágicos. Se a criatura tentar usar teletransporte ou viagem interplanar para sair da gaiola, ela deverá primeiro fazer um arremesso salvador de carisma. Se for bem-sucedida, a criatura poderá usar essa magia para sair da gaiola. Em caso de falha, a criatura não pode sair da gaiola e desperdiça o uso da magia ou do efeito. A gaiola também se estende para o Plano Etéreo, bloqueando a viagem etérea.",
      "Esse feitiço não pode ser dissipado por magia de dissipação."
    ],
    "material": "Pó de rubi no valor de 1.500 gp.",
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Foresight": {
    "name": "Previsão",
    "desc": [
      "Você toca uma criatura disposta e concede uma habilidade limitada de ver o futuro imediato. Durante esse período, o alvo não pode ser surpreendido e tem vantagem em rolagens de ataque, verificações de habilidade e jogadas de defesa. Além disso, outras criaturas têm desvantagem em rolagens de ataque contra o alvo durante esse período.",
      "Esse feitiço termina imediatamente se você o lançar novamente antes do fim de sua duração."
    ],
    "material": "Uma pena de beija-flor.",
    "duration": "8 horas",
    "casting_time": "1 minuto"
  },
  "Freedom of Movement": {
    "name": "Liberdade de movimento",
    "desc": [
      "Você toca uma criatura disposta. Durante esse período, o movimento do alvo não é afetado por terreno difícil, e os feitiços e outros efeitos mágicos não podem reduzir a velocidade do alvo nem fazer com que ele fique paralisado ou imobilizado.",
      "O alvo também pode gastar 1,5 m de movimento para escapar automaticamente de restrições não mágicas, como algemas ou uma criatura que o tenha agarrado. Por fim, estar debaixo d'água não impõe nenhuma penalidade ao movimento ou aos ataques do alvo."
    ],
    "material": "Uma tira de couro, presa ao braço ou a um apêndice semelhante.",
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Freezing Sphere": {
    "name": "Esfera de congelamento",
    "desc": [
      "Um globo gélido de energia fria sai da ponta dos seus dedos até um ponto de sua escolha dentro do alcance, onde explode em uma esfera de 60 pés de raio. Cada criatura dentro da área deve fazer um teste de resistência de Constituição. Se a defesa falhar, a criatura recebe 10d6 de dano de frio. Em um salvamento bem-sucedido, ela recebe metade do dano.",
      "Se o globo atingir um corpo d'água ou um líquido que seja principalmente água (não incluindo criaturas aquáticas), ele congela o líquido a uma profundidade de 6 polegadas em uma área de 30 pés quadrados. Esse gelo dura 1 minuto. As criaturas que estavam nadando na superfície da água congelada ficam presas no gelo. Uma criatura aprisionada pode usar uma ação para fazer um teste de Força contra a sua CD de proteção contra feitiço para se libertar.",
      "Você pode se abster de disparar o globo depois de completar o feitiço, se desejar. Um pequeno globo do tamanho de uma pedra de estilingue, frio ao toque, aparece em sua mão. A qualquer momento, você ou uma criatura a quem você der o globo pode arremessá-lo (a um alcance de 40 pés) ou arremessá-lo com uma funda (ao alcance normal da funda). Ele se despedaça com o impacto, com o mesmo efeito do lançamento normal do feitiço. Você também pode colocar o globo no chão sem estilhaçá-lo. Após 1 minuto, se o globo ainda não tiver se despedaçado, ele explodirá."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 7º nível ou superior, o dano aumenta em 1d6 para cada nível de espaço acima do 6º."
    ],
    "material": "Uma pequena esfera de cristal.",
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Frio"
  },
  "Gaseous Form": {
    "name": "Forma gasosa",
    "desc": [
      "Você transforma uma criatura disposta que você tocar, juntamente com tudo o que ela estiver vestindo e carregando, em uma nuvem nebulosa pela duração do feitiço. O feitiço termina se a criatura chegar a 0 pontos de vida. Uma criatura incorpórea não é afetada.",
      "Enquanto estiver nessa forma, o único método de movimento do alvo é uma velocidade de voo de 3 metros. O alvo pode entrar e ocupar o espaço de outra criatura. O alvo tem resistência a dano não mágico e tem vantagem nos arremessos de defesa de Força, Destreza e Constituição. O alvo pode passar por pequenos buracos, aberturas estreitas e até mesmo por simples rachaduras, embora trate os líquidos como se fossem superfícies sólidas. O alvo não pode cair e permanece pairando no ar mesmo quando atordoado ou incapacitado de outra forma.",
      "Enquanto estiver na forma de uma nuvem nebulosa, o alvo não poderá falar nem manipular objetos, e os objetos que estiver carregando ou segurando não poderão ser derrubados, usados ou interagidos de outra forma. O alvo não pode atacar nem lançar feitiços."
    ],
    "material": "Um pouco de gaze e um fio de fumaça.",
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Gate": {
    "name": "Portão",
    "desc": [
      "Você conjura um portal que liga um espaço desocupado que você pode ver dentro do alcance a um local preciso em um plano de existência diferente. O portal é uma abertura circular, que você pode fazer com 1,5 a 3 metros de diâmetro. Você pode orientar o portal em qualquer direção que escolher. O portal dura por toda a duração.",
      "O portal tem uma frente e um verso em cada plano em que aparece. Só é possível viajar pelo portal movendo-se pela frente dele. Qualquer coisa que faça isso é instantaneamente transportada para o outro plano, aparecendo no espaço desocupado mais próximo do portal.",
      "As divindades e outros governantes planares podem impedir que os portais criados por esse feitiço se abram em sua presença ou em qualquer lugar dentro de seus domínios.",
      "Ao lançar esse feitiço, você pode falar o nome de uma criatura específica (um pseudônimo, título ou apelido não funciona). Se essa criatura estiver em um plano diferente daquele em que você está, o portal se abrirá na vizinhança imediata da criatura nomeada e a atrairá para o espaço desocupado mais próximo do seu lado do portal. Você não ganha nenhum poder especial sobre a criatura, e ela é livre para agir como o MJ julgar apropriado. Ela pode ir embora, atacar você ou ajudá-lo."
    ],
    "material": "Um diamante que vale pelo menos 5.000gp.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Geas": {
    "name": "Bom",
    "desc": [
      "Você dá um comando mágico a uma criatura que possa ver dentro do alcance, forçando-a a realizar algum serviço ou a se abster de alguma ação ou curso de atividade conforme você decidir. Se a criatura puder entendê-lo, ela deverá ser bem-sucedida em um lance de salvamento de sabedoria ou ficará encantada por você enquanto durar o comando. Enquanto a criatura estiver encantada por você, ela sofrerá 5d10 de dano psíquico toda vez que agir de forma diretamente contrária às suas instruções, mas não mais do que uma vez por dia. Uma criatura que não consegue entender você não é afetada por esse feitiço.",
      "Você pode emitir qualquer comando que desejar, exceto uma atividade que resultaria em morte certa. Se você emitir um comando suicida, o feitiço será encerrado.",
      "Você pode encerrar o feitiço antecipadamente usando uma ação para descartá-lo. Um feitiço de remoção de maldição, restauração maior ou desejo também o encerra."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço para feitiço de 7º ou 8º nível, a duração é de 1 ano. Quando você conjura esse feitiço usando um espaço para feitiço de 9º nível, ele dura até ser encerrado por um dos feitiços mencionados acima."
    ],
    "duration": "30 dias",
    "casting_time": "1 minuto"
  },
  "Gentle Repose": {
    "name": "Repouso suave",
    "desc": [
      "Você toca um cadáver ou outros restos mortais. Durante esse período, o alvo é protegido da decomposição e não pode se tornar um morto-vivo.",
      "O feitiço também estende efetivamente o limite de tempo para ressuscitar o alvo dos mortos, já que os dias passados sob a influência desse feitiço não contam para o limite de tempo de feitiços como o de ressuscitar mortos."
    ],
    "material": "Uma pitada de sal e uma peça de cobre colocadas em cada um dos olhos do cadáver, que devem permanecer ali durante todo o tempo.",
    "duration": "10 dias",
    "casting_time": "1 ação"
  },
  "Giant Insect": {
    "name": "Inseto gigante",
    "desc": [
      "Você transforma até dez centopeias, três aranhas, cinco vespas ou um escorpião dentro do alcance em versões gigantes de suas formas naturais durante o período. Uma centopeia se torna uma centopeia gigante, uma aranha se torna uma aranha gigante, uma vespa se torna uma vespa gigante e um escorpião se torna um escorpião gigante.",
      "Cada criatura obedece aos seus comandos verbais e, em combate, elas agem no seu turno a cada rodada. O GM tem as estatísticas para essas criaturas e resolve suas ações e movimentos.",
      "A criatura permanece em seu tamanho gigante enquanto durar o efeito, até que caia para 0 pontos de vida ou até que você use uma ação para anular o efeito sobre ela.",
      "O GM pode permitir que você escolha alvos diferentes. Por exemplo, se você transformar uma abelha, sua versão gigante poderá ter as mesmas estatísticas de uma vespa gigante."
    ],
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Glibness": {
    "name": "Glibness",
    "desc": [
      "Até o fim do feitiço, ao fazer uma verificação de Carisma, você pode substituir o número que rolar por um 15. Além disso, não importa o que você diga, a magia que determinaria se você está dizendo a verdade indica que você está sendo sincero."
    ],
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Globe of Invulnerability": {
    "name": "Globo da Invulnerabilidade",
    "desc": [
      "Uma barreira imóvel e levemente cintilante surge em um raio de 3 metros ao seu redor e permanece por toda a duração.",
      "Qualquer feitiço de 5º nível ou inferior lançado de fora da barreira não pode afetar criaturas ou objetos dentro dela, mesmo que o feitiço seja lançado usando um espaço de feitiço de nível superior. Esse feitiço pode ter como alvo criaturas e objetos dentro da barreira, mas não tem efeito sobre eles. Da mesma forma, a área dentro da barreira é excluída das áreas afetadas por esses feitiços."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 7º nível ou superior, a barreira bloqueia feitiços de um nível superior para cada nível de espaço acima do 6º."
    ],
    "material": "Uma conta de vidro ou cristal que se estilhaça quando o feitiço termina.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Glyph of Warding": {
    "name": "Glifo de proteção",
    "desc": [
      "Ao lançar esse feitiço, você inscreve um glifo que prejudica outras criaturas, seja em uma superfície (como uma mesa ou uma seção do piso ou da parede) ou dentro de um objeto que possa ser fechado (como um livro, um pergaminho ou um baú de tesouro) para ocultar o glifo. Se você escolher uma superfície, o glifo poderá cobrir uma área da superfície que não exceda 3 metros de diâmetro. Se você escolher um objeto, esse objeto deverá permanecer em seu lugar; se o objeto for movido a mais de 3 metros de onde você lançou esse feitiço, o glifo será quebrado e o feitiço terminará sem ser acionado.",
      "O glifo é quase invisível e requer uma verificação bem-sucedida de Inteligência (Investigação) contra a sua CD de proteção contra feitiço para ser encontrado.",
      "Você decide o que aciona o glifo quando lança o feitiço. Para glifos inscritos em uma superfície, os gatilhos mais comuns incluem tocar ou ficar sobre o glifo, remover outro objeto que cubra o glifo, aproximar-se a uma certa distância do glifo ou manipular o objeto no qual o glifo está inscrito. Para glifos inscritos em um objeto, os acionadores mais comuns incluem abrir esse objeto, aproximar-se a uma certa distância do objeto ou ver ou ler o glifo. Quando um glifo é acionado, esse feitiço termina.",
      "Você pode refinar ainda mais o gatilho para que o feitiço seja ativado somente em determinadas circunstâncias ou de acordo com características físicas (como altura ou peso), tipo de criatura (por exemplo, a proteção pode ser definida para afetar aberrações ou drow) ou alinhamento. Você também pode definir condições para criaturas que não acionam o glifo, como aquelas que dizem uma determinada senha.",
      "Quando você inscrever o glifo, escolha * runas explosivas* ou um *glifo de feitiço*.",
      "***Runas explosivas Quando acionado, o glifo entra em erupção com energia mágica em uma esfera de 20 pés de raio centrada no glifo. A esfera se espalha pelos cantos. Cada criatura na área deve fazer um lance de salvamento de Destreza. Uma criatura recebe 5d8 de dano de ácido, frio, fogo, relâmpago ou trovão em um arremesso de defesa que falhe (sua escolha ao criar o glifo) ou metade do dano em um arremesso bem-sucedido.",
      "***Você pode armazenar um feitiço preparado de 3º nível ou inferior no glifo, lançando-o como parte da criação do glifo. O feitiço deve ter como alvo uma única criatura ou uma área. O feitiço que está sendo armazenado não tem efeito imediato quando lançado dessa forma. Quando o glifo é acionado, o feitiço armazenado é lançado. Se o feitiço tiver um alvo, ele terá como alvo a criatura que acionou o glifo. Se o feitiço afetar uma área, a área será centralizada nessa criatura. Se o feitiço convocar criaturas hostis ou criar objetos nocivos ou armadilhas, eles aparecerão o mais próximo possível do intruso e o atacarão. Se o feitiço exigir concentração, ele durará até o final de sua duração total."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 4º nível ou superior, o dano de um glifo de runas explosivas aumenta em 1d8 para cada nível de espaço acima do 3º. Se você criar um glifo de feitiço, poderá armazenar qualquer feitiço de até o mesmo nível do espaço usado para o glifo de proteção."
    ],
    "material": "Incenso e diamante em pó no valor mínimo de 200 gp, que o feitiço consome.",
    "duration": "Até que seja dissipado",
    "casting_time": "1 hora"
  },
  "Goodberry": {
    "name": "Goodberry",
    "desc": [
      "Até dez bagas aparecem em sua mão e são infundidas com magia durante esse período. Uma criatura pode usar sua ação para comer uma baga. Comer uma baga restaura 1 ponto de vida, e a baga fornece nutrição suficiente para sustentar uma criatura por um dia.",
      "As bagas perdem sua potência se não forem consumidas dentro de 24 horas após o lançamento desse feitiço."
    ],
    "material": "Um ramo de visco.",
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Grease": {
    "name": "Graxa",
    "desc": [
      "A graxa escorregadia cobre o solo em um quadrado de 3 metros centrado em um ponto dentro do alcance e o transforma em terreno difícil durante o período.",
      "Quando a graxa aparece, cada criatura que estiver em sua área deve ser bem-sucedida em uma jogada de salvamento de destreza ou cair de bruços. Uma criatura que entre na área ou termine seu turno ali também deve ser bem-sucedida em uma tentativa de defesa de destreza ou cair de bruços."
    ],
    "material": "Um pouco de pele de porco ou manteiga.",
    "duration": "1 minuto",
    "casting_time": "1 ação"
  },
  "Greater Invisibility": {
    "name": "Invisibilidade maior",
    "desc": [
      "Você ou uma criatura que você tocar se tornará invisível até o fim do feitiço. Qualquer coisa que o alvo esteja vestindo ou carregando fica invisível enquanto estiver com ele."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Greater Restoration": {
    "name": "Maior restauração",
    "desc": [
      "Você imbui uma criatura que você toca com energia positiva para desfazer um efeito debilitante. Você pode reduzir o nível de exaustão do alvo em um, ou acabar com um dos seguintes efeitos no alvo:",
      "- Um efeito que encantou ou petrificou o alvo",
      "- Uma maldição, incluindo a sintonização do alvo com um item mágico amaldiçoado",
      "- Qualquer redução em um dos escores de habilidade do alvo",
      "- Um efeito que reduz o máximo de pontos de vida do alvo"
    ],
    "material": "Pó de diamante com valor mínimo de 100gp, que o feitiço consome.",
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Guardian of Faith": {
    "name": "Guardião da fé",
    "desc": [
      "Um guardião espectral grande aparece e paira por toda a duração em um espaço desocupado de sua escolha que você possa ver dentro do alcance. O guardião ocupa esse espaço e é indistinto, exceto por uma espada e um escudo reluzentes com o símbolo de sua divindade.",
      "Qualquer criatura hostil a você que se mova para um espaço dentro de 3 metros do guardião pela primeira vez em um turno deve ser bem-sucedida em um arremesso de salvamento de destreza. A criatura recebe 20 de dano radiante se a defesa falhar, ou metade do dano se for bem-sucedida. O guardião desaparece quando tiver causado um total de 60 de dano."
    ],
    "duration": "8 horas",
    "casting_time": "1 ação",
    "damage_type": "Radiante"
  },
  "Guards and Wards": {
    "name": "Guardas e vigias",
    "desc": [
      "Você cria uma proteção que protege até 2.500 pés quadrados de espaço no chão (uma área de 15 pés quadrados, ou cem quadrados de 5 pés ou vinte e cinco quadrados de 10 pés). A área protegida pode ter até 6 metros de altura e ter o formato que você desejar. Você pode proteger vários andares de uma fortaleza dividindo a área entre eles, desde que possa entrar em cada área contígua enquanto estiver lançando o feitiço.",
      "Ao lançar esse feitiço, você pode especificar indivíduos que não são afetados por um ou todos os efeitos que você escolher. Você também pode especificar uma senha que, quando dita em voz alta, torna o locutor imune a esses efeitos.",
      "Os guardas e proteções criam os seguintes efeitos dentro da área protegida.",
      "***Corredores: A névoa preenche todos os corredores protegidos, tornando-os bastante obscuros. Além disso, em cada cruzamento ou passagem ramificada que ofereça uma opção de direção, há 50% de chance de uma criatura que não seja você acreditar que está indo na direção oposta à que escolheu.",
      "***Todas as portas na área protegida são magicamente trancadas, como se estivessem seladas por um feitiço de fechadura arcana. Além disso, você pode cobrir até dez portas com uma ilusão (equivalente à função de objeto ilusório do feitiço de ilusão menor) para fazê-las parecerem seções simples de parede.",
      "***Escadas*** As teias preenchem todas as escadas na área protegida de cima para baixo, como o feitiço de teia. Esses fios voltam a crescer em 10 minutos se forem queimados ou arrancados enquanto durarem os guardas e as proteções.",
      "***Você pode colocar um dos seguintes efeitos mágicos à sua escolha dentro da área protegida da fortaleza.",
      "- Coloque luzes dançantes em quatro corredores. Você pode designar um programa simples para que as luzes se repitam enquanto durarem os guardas e enfermarias.",
      "- Coloque a boca mágica em dois locais.",
      "- Coloque a nuvem fétida em dois locais. Os vapores aparecem nos locais que você designar; eles retornam em 10 minutos se forem dispersos pelo vento enquanto durarem os guardas e as proteções.",
      "- Coloque uma rajada de vento constante em um corredor ou sala.",
      "- Coloque uma sugestão em um local. Você seleciona uma área de até 1,5 metro quadrado, e qualquer criatura que entrar ou passar por essa área recebe a sugestão mentalmente.",
      "Toda a área protegida irradia magia. Se for bem-sucedida, uma magia de dissipação lançada em um efeito específico removerá apenas esse efeito.",
      "Você pode criar uma estrutura permanentemente guardada e protegida lançando esse feitiço todos os dias durante um ano."
    ],
    "material": "Incenso ardente, uma pequena quantidade de enxofre e óleo, um barbante com nó, uma pequena quantidade de sangue de umber hulk e uma pequena haste de prata no valor de pelo menos 10 gp.",
    "duration": "24 horas",
    "casting_time": "10 minutos"
  },
  "Guidance": {
    "name": "Orientação",
    "desc": [
      "Você toca uma criatura disposta. Uma vez antes de o feitiço terminar, o alvo pode rolar um d4 e adicionar o número rolado a uma verificação de habilidade de sua escolha. Ele pode rolar o dado antes ou depois de fazer a verificação de habilidade. O feitiço então termina."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Guiding Bolt": {
    "name": "Parafuso de guia",
    "desc": [
      "Um lampejo de luz vai em direção a uma criatura de sua escolha dentro do alcance. Faça um ataque mágico de longo alcance contra o alvo. Em caso de acerto, o alvo recebe 4d6 de dano radiante, e a próxima rolagem de ataque feita contra esse alvo antes do final do seu próximo turno tem vantagem, graças à luz mística fraca que brilha no alvo até então."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 2º nível ou superior, o dano aumenta em 1d6 para cada nível de espaço acima do 1º."
    ],
    "duration": "1 rodada",
    "casting_time": "1 ação",
    "attack_type": "variado",
    "damage_type": "Radiante"
  },
  "Gust of Wind": {
    "name": "Rajada de vento",
    "desc": [
      "Uma linha de vento forte com 60 pés de comprimento e 10 pés de largura sai de você em uma direção que você escolher durante a duração do feitiço. Cada criatura que iniciar seu turno na linha deve ser bem-sucedida em um arremesso salvador de força ou ser empurrada 15 pés para longe de você em uma direção que siga a linha.",
      "Qualquer criatura na linha deve gastar 2 pés de movimento para cada 1 pé que ela se mover ao se aproximar de você.",
      "A rajada dispersa o gás ou o vapor e apaga velas, tochas e chamas desprotegidas semelhantes na área. Ela faz com que as chamas protegidas, como as de lanternas, dancem descontroladamente e tem 50% de chance de extingui-las.",
      "Como uma ação adicional em cada um dos seus turnos antes do fim do feitiço, você pode mudar a direção em que a linha sai de você."
    ],
    "material": "Uma semente de leguminosa.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Hallow": {
    "name": "Hallow",
    "desc": [
      "Você toca um ponto e infunde uma área ao redor dele com poder sagrado (ou profano). A área pode ter um raio de até 60 pés, e o feitiço falha se o raio incluir uma área que já esteja sob o efeito de um feitiço de santidade. A área afetada está sujeita aos seguintes efeitos.",
      "Primeiro, celestiais, elementais, feéricos, demônios e mortos-vivos não podem entrar na área, nem podem encantar, assustar ou possuir criaturas dentro dela. Qualquer criatura encantada, amedrontada ou possuída por uma dessas criaturas deixa de ser encantada, amedrontada ou possuída ao entrar na área. Você pode excluir um ou mais desses tipos de criaturas desse efeito.",
      "Em segundo lugar, você pode vincular um efeito extra à área. Escolha o efeito da lista a seguir ou escolha um efeito oferecido pelo GM. Alguns desses efeitos se aplicam a criaturas na área; você pode designar se o efeito se aplica a todas as criaturas, a criaturas que seguem uma divindade ou líder específico ou a criaturas de um tipo específico, como minérios ou trolls. Quando uma criatura que seria afetada entra na área do feitiço pela primeira vez em um turno ou começa seu turno ali, ela pode fazer um arremesso salvador de carisma. Se for bem-sucedida, a criatura ignora o efeito extra até sair da área.",
      "***Coragem.*** As criaturas afetadas não podem ser assustadas enquanto estiverem na área.",
      "***Escuridão.*** A escuridão preenche a área. A luz normal, bem como a luz mágica criada por feitiços de nível inferior ao do espaço que você usou para lançar esse feitiço, não pode iluminar a área.",
      "***Luz do dia *** Luz brilhante preenche a área. A escuridão mágica criada por feitiços de nível inferior ao do espaço que você usou para lançar esse feitiço não pode extinguir a luz.",
      "***As criaturas afetadas na área têm resistência a um tipo de dano de sua escolha, exceto para espancamento, perfuração ou corte.",
      "***Vulnerabilidade à energia: As criaturas afetadas na área têm vulnerabilidade a um tipo de dano de sua escolha, exceto para espancamento, perfuração ou corte.",
      "***Os cadáveres enterrados na área não podem ser transformados em mortos-vivos.",
      "***Interferência extradimensional *** As criaturas afetadas não podem se mover ou viajar usando teletransporte ou por meios extradimensionais ou interplanares.",
      "***As criaturas afetadas ficam assustadas quando estão na área.",
      "***Nenhum som pode emanar de dentro da área e nenhum som pode chegar até ela.",
      "***As criaturas afetadas podem se comunicar com qualquer outra criatura na área, mesmo que não compartilhem um idioma comum."
    ],
    "material": "Ervas, óleos e incensos com valor mínimo de 1.000 gp, que o feitiço consome.",
    "duration": "Até que seja dissipado",
    "casting_time": "24 horas"
  },
  "Hallucinatory Terrain": {
    "name": "Terreno alucinante",
    "desc": [
      "Você faz com que o terreno natural em um cubo de 150 pés de alcance pareça, soe e cheire como algum outro tipo de terreno natural. Assim, é possível fazer com que campos abertos ou uma estrada se assemelhem a um pântano, colina, fenda ou outro terreno difícil ou intransponível. Uma lagoa pode parecer um prado gramado, um precipício uma encosta suave ou um barranco cheio de pedras uma estrada larga e suave. As estruturas, os equipamentos e as criaturas fabricados na área não são alterados em sua aparência.",
      "As características táteis do terreno permanecem inalteradas, portanto, é provável que as criaturas que entrarem na área vejam através da ilusão. Se a diferença não for óbvia ao toque, uma criatura que examinar cuidadosamente a ilusão pode tentar um teste de Inteligência (Investigação) contra a sua CD de proteção contra feitiço para não acreditar nela. Uma criatura que discernir a ilusão pelo que ela é, a verá como uma imagem vaga sobreposta ao terreno."
    ],
    "material": "Uma pedra, um galho e um pouco de planta verde.",
    "duration": "24 horas",
    "casting_time": "10 minutos"
  },
  "Harm": {
    "name": "Danos",
    "desc": [
      "Você libera uma doença virulenta em uma criatura que possa ver dentro do alcance. O alvo deve fazer um arremesso salvador de constituição. Se o salvamento falhar, ele sofrerá 14d6 de dano necrótico ou metade do dano se o salvamento for bem-sucedido. O dano não pode reduzir os pontos de vida do alvo para menos de 1. Se o alvo falhar no arremesso de defesa, seu máximo de pontos de vida será reduzido por 1 hora em um valor igual ao dano necrótico sofrido. Qualquer efeito que remova uma doença permite que o máximo de pontos de vida de uma criatura volte ao normal antes que esse tempo passe."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Necrótico"
  },
  "Haste": {
    "name": "Pressa",
    "desc": [
      "Escolha uma criatura disposta que você possa ver dentro do alcance. Até que o feitiço termine, a velocidade do alvo é dobrada, ele recebe um bônus de +2 na CA, tem vantagem nos lançamentos de defesa de destreza e recebe uma ação adicional em cada um de seus turnos. Essa ação só pode ser usada para realizar as ações de Ataque (somente um ataque com arma), Esquiva, Desvencilhar-se, Esconder-se ou Usar um Objeto.",
      "Quando o feitiço termina, o alvo não pode se mover ou realizar ações até depois do seu próximo turno, pois uma onda de letargia o envolve."
    ],
    "material": "Uma raspagem de raiz de alcaçuz.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Heal": {
    "name": "Cura",
    "desc": [
      "Escolha uma criatura que você possa ver dentro do alcance. Uma onda de energia positiva percorre a criatura, fazendo com que ela recupere 70 pontos de vida. Esse feitiço também acaba com a cegueira, a surdez e qualquer doença que esteja afetando o alvo. Esse feitiço não tem efeito sobre construtos ou mortos-vivos."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 7º nível ou superior, a quantidade de cura aumenta em 10 para cada nível de espaço acima do 6º."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Healing Word": {
    "name": "Palavra de cura",
    "desc": [
      "Uma criatura de sua escolha que você possa ver dentro do alcance recupera pontos de vida iguais a 1d4 + seu modificador de habilidade de lançamento de feitiço. Esse feitiço não tem efeito sobre mortos-vivos ou construtos."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 2º nível ou superior, a cura aumenta em 1d4 para cada nível de espaço acima do 1º."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação bônus"
  },
  "Heat Metal": {
    "name": "Metal térmico",
    "desc": [
      "Escolha um objeto de metal manufaturado, como uma arma de metal ou uma armadura de metal pesada ou média, que você possa ver dentro do alcance. Você faz com que o objeto brilhe em brasa. Qualquer criatura em contato físico com o objeto recebe 2d8 de dano de fogo quando o feitiço é lançado. Até que o feitiço termine, você pode usar uma ação adicional em cada um dos seus turnos subsequentes para causar esse dano novamente.",
      "Se uma criatura estiver segurando ou usando o objeto e receber o dano causado por ele, deverá ser bem-sucedida em um arremesso salvador de Constituição ou largar o objeto, se puder. Se não largar o objeto, ela terá desvantagem em rolagens de ataque e verificações de habilidade até o início do seu próximo turno."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 3º nível ou superior, o dano aumenta em 1d8 para cada nível de espaço acima do 2º."
    ],
    "material": "Um pedaço de ferro e uma chama.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação",
    "damage_type": "Incêndio"
  },
  "Hellish Rebuke": {
    "name": "Rebuke infernal",
    "desc": [
      "Você aponta o dedo e a criatura que lhe causou dano é momentaneamente cercada por chamas infernais. A criatura deve fazer um arremesso de salvamento de destreza. Ela recebe 2d10 de dano de fogo se a defesa falhar, ou metade do dano se for bem-sucedida."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 2º nível ou superior, o dano aumenta em 1d10 para cada nível de espaço acima do 1º."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 reação",
    "damage_type": "Incêndio"
  },
  "Heroes' Feast": {
    "name": "Festa dos heróis",
    "desc": [
      "Você oferece um grande banquete, incluindo comida e bebida magníficas. O banquete leva 1 hora para ser consumido e desaparece ao final desse tempo, e os efeitos benéficos não se manifestam até que essa hora termine. Até doze outras criaturas podem participar do banquete.",
      "Uma criatura que participa do banquete recebe vários benefícios. A criatura é curada de todas as doenças e venenos, torna-se imune a venenos e a ser amedrontada e faz todos os arremessos salvadores de sabedoria com vantagem. Seu máximo de pontos de vida também aumenta em 2d10 e ela ganha o mesmo número de pontos de vida. Esses benefícios duram 24 horas."
    ],
    "material": "Uma tigela incrustada de pedras preciosas no valor mínimo de 1.000gp, que o feitiço consome.",
    "duration": "Instantâneo",
    "casting_time": "10 minutos"
  },
  "Heroism": {
    "name": "Heroísmo",
    "desc": [
      "Uma criatura disposta que você tocar é imbuída de bravura. Até o fim do feitiço, a criatura é imune a ser amedrontada e ganha pontos de vida temporários iguais ao seu modificador de habilidade de conjuração no início de cada um de seus turnos. Quando o feitiço termina, o alvo perde quaisquer pontos de vida temporários remanescentes desse feitiço."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Hideous Laughter": {
    "name": "Riso Hediondo",
    "desc": [
      "Uma criatura de sua escolha que você possa ver dentro do alcance percebe tudo como hilariamente engraçado e cai em ataques de riso se esse feitiço a afetar. O alvo deve ser bem-sucedido em um arremesso de sabedoria ou cairá de bruços, ficando incapacitado e incapaz de se levantar durante todo o tempo. Uma criatura com pontuação de Inteligência igual ou inferior a 4 não é afetada.",
      "No final de cada um de seus turnos e sempre que sofrer dano, o alvo pode fazer outra jogada de defesa de sabedoria. O alvo tem vantagem no arremesso de defesa se ele for acionado por dano. Se for bem-sucedido, o feitiço termina."
    ],
    "material": "Pequenas tortas e uma pena que é agitada no ar.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Hold Monster": {
    "name": "Segurar monstro",
    "desc": [
      "Escolha uma criatura que você possa ver e alcançar. O alvo deve fazer um arremesso salvador de Sabedoria ou ficará paralisado pela duração do feitiço. Esse feitiço não tem efeito contra mortos-vivos. No final de cada rodada, o alvo pode fazer um novo lance de proteção de Sabedoria. Se for bem-sucedido, o feitiço termina para a criatura."
    ],
    "higher_level": [
      "Ao conjurar esse feitiço usando uma localização de nível 6 ou superior, você pode ter como alvo uma criatura adicional para cada nível de localização além do quinto. As criaturas devem estar dentro de um raio de 30 pés uma da outra quando você as tiver como alvo."
    ],
    "material": "Um pequeno pedaço de ferro.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Hold Person": {
    "name": "Segurar pessoa",
    "desc": [
      "Escolha um humanoide que você possa ver dentro do alcance. O alvo deve ser bem-sucedido em um arremesso de sabedoria ou ficará paralisado durante o período. No final de cada um de seus turnos, o alvo pode fazer outro lance de economia de sabedoria. Se for bem-sucedido, o feitiço termina no alvo."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço de feitiço de 3º nível ou superior, você pode ter como alvo um humanoide adicional para cada nível de espaço acima do 2º. Os humanoides devem estar a uma distância de até 30 pés um do outro quando você os tiver como alvo."
    ],
    "material": "Um pedaço pequeno e reto de ferro.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Holy Aura": {
    "name": "Aura sagrada",
    "desc": [
      "A luz divina sai de você e se funde em um brilho suave em um raio de 30 pés ao seu redor. As criaturas de sua escolha nesse raio, quando você lançar esse feitiço, derramam luz fraca em um raio de 1,5 m e têm vantagem em todos os lances de defesa, e outras criaturas têm desvantagem em rolagens de ataque contra elas até que o feitiço termine. Além disso, quando um demônio ou um morto-vivo atinge uma criatura afetada com um ataque corpo a corpo, a aura pisca com uma luz brilhante. O atacante deve ser bem-sucedido em um arremesso salvador de Constituição ou ficará cego até o fim do feitiço."
    ],
    "material": "Um pequeno relicário com valor mínimo de 1.000gp contendo uma relíquia sagrada, como um pedaço de tecido do manto de um santo ou um pedaço de pergaminho de um texto religioso.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Hunter's Mark": {
    "name": "Marca do caçador",
    "desc": [
      "Você escolhe uma criatura que possa ver dentro do alcance e a marca misticamente como sua presa. Até o fim do feitiço, você causa 1d6 de dano extra ao alvo sempre que o atingir com um ataque de arma e tem vantagem em qualquer verificação de Sabedoria (Percepção) ou Sabedoria (Sobrevivência) que fizer para encontrá-lo. Se o alvo cair para 0 pontos de vida antes do fim desse feitiço, você pode usar uma ação bônus em um turno subsequente para marcar uma nova criatura."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço para feitiço de 3º ou 4º nível, você pode manter a concentração no feitiço por até 8 horas. Ao usar um espaço para feitiço de 5º nível ou superior, você pode manter a concentração no feitiço por até 24 horas."
    ],
    "duration": "Até 1 hora",
    "casting_time": "1 ação bônus"
  },
  "Hypnotic Pattern": {
    "name": "Padrão hipnótico",
    "desc": [
      "Você cria um padrão sinuoso de cores que se entrelaça no ar dentro de um cubo de 30 pés dentro do alcance. O padrão aparece por um momento e desaparece. Cada criatura na área que vir o padrão deve fazer um arremesso de salvamento de sabedoria. Se o salvamento falhar, a criatura ficará encantada por toda a duração do feitiço. Enquanto estiver encantada por esse feitiço, a criatura fica incapacitada e tem velocidade 0.",
      "O feitiço termina para uma criatura afetada se ela sofrer qualquer dano ou se outra pessoa usar uma ação para sacudir a criatura de seu estupor."
    ],
    "material": "Um bastão de incenso brilhante ou um frasco de cristal cheio de material fosforescente.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Ice Storm": {
    "name": "Tempestade de gelo",
    "desc": [
      "Uma saraivada de gelo duro como pedra atinge o chão em um cilindro de 20 pés de raio e 40 pés de altura centrado em um ponto dentro do alcance. Cada criatura no cilindro deve fazer um arremesso salvador de destreza. Uma criatura recebe 2d8 de dano de contusão e 4d6 de dano de frio se a defesa falhar, ou metade do dano se for bem-sucedida.",
      "As pedras de granizo transformam a área de efeito da tempestade em um terreno difícil até o final do seu próximo turno."
    ],
    "higher_level": [
      "Quando você conjura esse feitiço usando um espaço de feitiço de 5º nível ou superior, o dano de espancamento aumenta em 1d8 para cada nível de espaço acima do 4º."
    ],
    "material": "Uma pitada de pó e algumas gotas de água.",
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Espancamento"
  },
  "Identify": {
    "name": "Identificar",
    "desc": [
      "Você escolhe um objeto que deve tocar durante o lançamento do feitiço. Se for um item mágico ou algum outro objeto imbuído de magia, você saberá suas propriedades e como usá-las, se requer sintonização para ser usado e quantas cargas ele tem, se houver. Você fica sabendo se algum feitiço está afetando o item e quais são eles. Se o item tiver sido criado por um feitiço, você saberá qual feitiço o criou.",
      "Se, em vez disso, você tocar em uma criatura durante o lançamento, saberá quais feitiços, se houver algum, estão afetando-a no momento."
    ],
    "material": "Uma pérola com valor mínimo de 100gp e uma pena de coruja.",
    "duration": "Instantâneo",
    "casting_time": "1 minuto"
  },
  "Illusory Script": {
    "name": "Script ilusório",
    "desc": [
      "Você escreve em pergaminho, papel ou outro material de escrita adequado e o imbui de uma ilusão potente que dura a duração.",
      "Para você e todas as criaturas que você designar ao lançar o feitiço, a escrita parece normal, escrita por você e transmite o significado que você pretendia quando escreveu o texto. Para todos os outros, a escrita aparece como se tivesse sido escrita em uma caligrafia desconhecida ou mágica que é ininteligível. Como alternativa, você pode fazer com que a escrita pareça ser uma mensagem totalmente diferente, escrita por outra mão e em outro idioma, embora o idioma deva ser um que você conheça.",
      "Se o feitiço for desfeito, o roteiro original e a ilusão desaparecerão.",
      "Uma criatura com visão verdadeira pode ler a mensagem oculta."
    ],
    "material": "Uma tinta à base de chumbo com valor mínimo de 10gp, que esse feitiço consome.",
    "duration": "10 dias",
    "casting_time": "1 minuto"
  },
  "Imprisonment": {
    "name": "Prisão",
    "desc": [
      "Você cria uma restrição mágica para prender uma criatura que você possa ver dentro do alcance. O alvo deve ser bem-sucedido em um arremesso de sabedoria ou ficará preso pelo feitiço; se for bem-sucedido, ele ficará imune a esse feitiço se você lançá-lo novamente. Enquanto estiver afetada por esse feitiço, a criatura não precisa respirar, comer ou beber e não envelhece. Os feitiços de adivinhação não podem localizar ou perceber o alvo.",
      "Ao lançar o feitiço, você escolhe uma das seguintes formas de aprisionamento.",
      "***O alvo é sepultado bem abaixo da terra em uma esfera de força mágica que é grande o suficiente para conter o alvo. Nada pode passar pela esfera, nem qualquer criatura pode se teletransportar ou usar viagens planares para entrar ou sair dela.",
      "O componente especial para essa versão do feitiço é um pequeno orbe de mithral.",
      "***Correntes pesadas, firmemente enraizadas no chão, prendem o alvo no lugar. O alvo fica preso até que o feitiço termine e não pode se mover ou ser movido por nenhum meio até então.",
      "O componente especial para essa versão do feitiço é uma fina corrente de metal precioso.",
      "***Prisão com hedge: O feitiço transporta o alvo para um pequeno demiplano que é protegido contra teletransporte e viagens planares. O demiplano pode ser um labirinto, uma gaiola, uma torre ou qualquer estrutura ou área confinada semelhante de sua escolha.",
      "O componente especial para essa versão do feitiço é uma representação em miniatura da prisão feita de jade.",
      "***O alvo encolhe até uma altura de 1 polegada e é aprisionado em uma pedra preciosa ou objeto semelhante. A luz pode atravessar a pedra normalmente (permitindo que o alvo veja para fora e que outras criaturas vejam para dentro), mas nada mais pode atravessá-la, nem mesmo por meio de teletransporte ou viagem planar. A pedra preciosa não pode ser cortada ou quebrada enquanto o feitiço estiver em vigor.",
      "O componente especial para essa versão do feitiço é uma pedra preciosa grande e transparente, como coríndon, diamante ou rubi.",
      "***O alvo adormece e não pode ser acordado.",
      "O componente especial para essa versão do feitiço consiste em ervas soporíferas raras.",
      "***Durante o lançamento do feitiço, em qualquer uma de suas versões, você pode especificar uma condição que fará com que o feitiço termine e libere o alvo. A condição pode ser tão específica ou elaborada quanto você quiser, mas o MJ deve concordar que a condição é razoável e tem uma probabilidade de se concretizar. As condições podem se basear no nome, na identidade ou na divindade de uma criatura, mas devem se basear em ações ou qualidades observáveis e não em fatores intangíveis, como nível, classe ou pontos de vida.",
      "Um feitiço de dissipação de magia pode encerrar o feitiço somente se for lançado como um feitiço de 9º nível, tendo como alvo a prisão ou o componente especial usado para criá-la.",
      "Você pode usar um componente especial específico para criar apenas uma prisão de cada vez. Se você lançar o feitiço novamente usando o mesmo componente, o alvo do primeiro lançamento será imediatamente liberado da prisão."
    ],
    "material": "Uma representação em velino ou uma estatueta esculpida à semelhança do alvo e um componente especial que varia de acordo com a versão do feitiço que você escolher, no valor de pelo menos 500gp por Hit Die do alvo.",
    "duration": "Até que seja dissipado",
    "casting_time": "1 minuto"
  },
  "Incendiary Cloud": {
    "name": "Nuvem Incendiária",
    "desc": [
      "Uma nuvem espiralada de fumaça atravessada por brasas brancas aparece em uma esfera de 20 pés de raio centrada em um ponto dentro do alcance. A nuvem se espalha pelos cantos e é fortemente obscurecida. Ela dura a duração ou até que um vento de velocidade moderada ou maior (pelo menos 16 quilômetros por hora) a disperse.",
      "Quando a nuvem aparece, cada criatura dentro dela deve fazer um arremesso de salvamento de destreza. Uma criatura recebe 10d8 de dano de fogo se a defesa falhar, ou metade do dano se for bem-sucedida. Uma criatura também deve fazer esse arremesso de defesa quando entrar na área do feitiço pela primeira vez em um turno ou quando terminar seu turno lá.",
      "A nuvem se afasta 3 metros diretamente de você em uma direção que você escolhe no início de cada um dos seus turnos."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação",
    "damage_type": "Incêndio"
  },
  "Inflict Wounds": {
    "name": "Infligir ferimentos",
    "desc": [
      "Faça um ataque mágico corpo a corpo contra uma criatura que você possa alcançar. Em caso de acerto, o alvo recebe 3d10 de dano necrótico."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 2º nível ou superior, o dano aumenta em 1d10 para cada nível de espaço acima do 1º."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "attack_type": "corpo a corpo",
    "damage_type": "Necrótico"
  },
  "Insect Plague": {
    "name": "Praga de insetos",
    "desc": [
      "Os gafanhotos, em enxame e mordedores, enchem uma esfera de 20 pés de raio centrada em um ponto que você escolher dentro do alcance. A esfera se espalha pelos cantos. A esfera permanece por toda a duração, e sua área é levemente obscurecida. A área da esfera é um terreno difícil.",
      "Quando a área aparece, cada criatura nela deve fazer um arremesso de defesa de constituição. Uma criatura recebe 4d10 de dano perfurante se o salvamento falhar, ou metade do dano se for bem-sucedido. Uma criatura também deve fazer esse arremesso de defesa quando entrar na área do feitiço pela primeira vez em um turno ou quando terminar seu turno ali."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 6º nível ou superior, o dano aumenta em 1d10 para cada nível de espaço acima do 5º."
    ],
    "material": "Alguns grãos de açúcar, alguns grãos de cereais e uma camada de gordura.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação",
    "damage_type": "Piercing"
  },
  "Instant Summons": {
    "name": "Invocações instantâneas",
    "desc": [
      "Você toca um objeto com peso igual ou inferior a 10 libras cuja dimensão mais longa seja igual ou inferior a 6 pés. O feitiço deixa uma marca invisível em sua superfície e inscreve de forma invisível o nome do item na safira que você usar como componente material. Cada vez que lançar esse feitiço, você deve usar uma safira diferente.",
      "A qualquer momento depois disso, você pode usar sua ação para dizer o nome do item e esmagar a safira. O item aparece instantaneamente em sua mão, independentemente das distâncias físicas ou planares, e o feitiço termina.",
      "Se outra criatura estiver segurando ou carregando o item, o esmagamento da safira não transportará o item para você, mas, em vez disso, você saberá quem é a criatura que possui o objeto e aproximadamente onde ela está localizada naquele momento.",
      "A magia Dissipar ou um efeito semelhante aplicado com sucesso à safira encerra o efeito desse feitiço."
    ],
    "material": "Uma safira no valor de 1.000 gp.",
    "duration": "Até que seja dissipado",
    "casting_time": "1 minuto"
  },
  "Invisibility": {
    "name": "Invisibilidade",
    "desc": [
      "Uma criatura que você tocar se tornará invisível até o fim do feitiço. Qualquer coisa que o alvo esteja vestindo ou carregando fica invisível enquanto estiver com ele. O feitiço termina para um alvo que ataca ou lança um feitiço."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço de feitiço de 3º nível ou superior, você pode ter como alvo uma criatura adicional para cada nível de espaço acima do 2º."
    ],
    "material": "Um cílio envolto em goma arábica.",
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Irresistible Dance": {
    "name": "Dança Irresistível",
    "desc": [
      "Escolha uma criatura que você possa ver dentro do alcance. O alvo começa uma dança cômica no lugar: embaralhando, batendo os pés e brincando durante todo o tempo. As criaturas que não podem ser encantadas são imunes a esse feitiço.",
      "Uma criatura dançante deve usar todo o seu movimento para dançar sem sair do espaço e tem desvantagem em jogadas de salvamento de destreza e em rolagens de ataque. Enquanto o alvo for afetado por esse feitiço, outras criaturas têm vantagem em rolagens de ataque contra ele. Como uma ação, a criatura dançante faz um arremesso salvador de sabedoria para recuperar o controle de si mesma. Se a defesa for bem-sucedida, o feitiço termina."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Jump": {
    "name": "Pular",
    "desc": [
      "Você toca em uma criatura. A distância de salto da criatura é triplicada até o fim do feitiço."
    ],
    "material": "A perna traseira de um gafanhoto.",
    "duration": "1 minuto",
    "casting_time": "1 ação"
  },
  "Knock": {
    "name": "Bater",
    "desc": [
      "Escolha um objeto que você possa ver dentro do alcance. O objeto pode ser uma porta, uma caixa, um baú, um conjunto de algemas, um cadeado ou outro objeto que contenha um meio mundano ou mágico que impeça o acesso.",
      "Um alvo que esteja fechado por uma fechadura mundana ou que esteja preso ou barrado torna-se destravado, desbloqueado ou não barrado. Se o objeto tiver várias travas, apenas uma delas será destravada.",
      "Se você escolher um alvo que esteja fechado com uma trava arcana, esse feitiço será suprimido por 10 minutos, período durante o qual o alvo poderá ser aberto e fechado normalmente.",
      "Quando você lança o feitiço, uma batida forte, audível a uma distância de até 300 pés, emana do objeto-alvo."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Legend Lore": {
    "name": "Lenda Lore",
    "desc": [
      "Dê um nome ou descreva uma pessoa, um lugar ou um objeto. O feitiço traz à sua mente um breve resumo da tradição significativa sobre a coisa que você nomeou. O conhecimento pode consistir em contos atuais, histórias esquecidas ou até mesmo conhecimento secreto que nunca foi amplamente conhecido. Se o objeto que você nomeou não for de importância lendária, você não obterá nenhuma informação. Quanto mais informações você já tiver sobre a coisa, mais precisas e detalhadas serão as informações que você receberá.",
      "As informações que você aprende são precisas, mas podem ser expressas em linguagem figurativa. Por exemplo, se você tiver um machado mágico misterioso em mãos, o feitiço pode produzir esta informação: \"Ai do malfeitor cuja mão tocar o machado, pois até mesmo o cabo corta a mão dos malfeitores. Somente uma verdadeira Criança de Pedra, amante e amada de Moradin, pode despertar os verdadeiros poderes do machado, e somente com a palavra sagrada *Rudnogg* nos lábios.\""
    ],
    "material": "Incenso no valor mínimo de 250 gp, que o feitiço consome, e quatro tiras de marfim no valor mínimo de 50 gp cada.",
    "duration": "Instantâneo",
    "casting_time": "10 minutos"
  },
  "Lesser Restoration": {
    "name": "Restauração menor",
    "desc": [
      "Você toca uma criatura e pode acabar com uma doença ou condição que a aflige. A condição pode ser cegueira, surdez, paralisia ou envenenamento."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Levitate": {
    "name": "Levitar",
    "desc": [
      "Uma criatura ou objeto de sua escolha que você possa ver dentro do alcance se eleva verticalmente, até 6 metros, e permanece suspenso durante todo o tempo. O feitiço pode levitar um alvo que pese até 500 libras. Uma criatura relutante que seja bem-sucedida em um arremesso salvador de constituição não é afetada.",
      "O alvo pode se mover apenas empurrando ou puxando um objeto fixo ou uma superfície ao alcance (como uma parede ou um teto), o que permite que ele se mova como se estivesse escalando. Você pode alterar a altitude do alvo em até 6 metros em qualquer direção no seu turno. Se você for o alvo, poderá se mover para cima ou para baixo como parte de seu movimento. Caso contrário, você pode usar sua ação para mover o alvo, que deve permanecer dentro do alcance do feitiço.",
      "Quando o feitiço termina, o alvo flutua suavemente até o chão se ainda estiver no ar."
    ],
    "material": "Um pequeno laço de couro ou um pedaço de arame dourado dobrado em forma de xícara com uma haste longa em uma extremidade.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Light": {
    "name": "Luz",
    "desc": [
      "Você toca um objeto que não seja maior do que 3 metros em qualquer dimensão. Até o fim do feitiço, o objeto emite luz brilhante em um raio de 6 metros e luz fraca por mais 6 metros. A luz pode ser colorida como você quiser. Cobrir completamente o objeto com algo opaco bloqueia a luz. O feitiço termina se você lançá-lo novamente ou descartá-lo como uma ação.",
      "Se o alvo for um objeto segurado ou usado por uma criatura hostil, essa criatura deverá ser bem-sucedida em um arremesso salvador de destreza para evitar o feitiço."
    ],
    "material": "Um vaga-lume ou musgo fosforescente.",
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Lightning Bolt": {
    "name": "Relâmpago",
    "desc": [
      "Um raio que forma uma linha de 30 metros de comprimento e 1,5 metro de largura sai de você na direção que escolher. Cada criatura na linha deve fazer um arremesso de salvamento de destreza. Uma criatura recebe 8d6 de dano de raio se a defesa falhar, ou metade do dano se for bem-sucedida.",
      "O raio incendeia objetos inflamáveis na área que não estão sendo usados ou carregados."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 4º nível ou superior, o dano aumenta em 1d6 para cada nível de espaço acima do 3º."
    ],
    "material": "Um pouco de pele e uma haste de âmbar, cristal ou vidro.",
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Relâmpagos"
  },
  "Locate Animals or Plants": {
    "name": "Localizar animais ou plantas",
    "desc": [
      "Descrever ou nomear um tipo específico de animal ou planta. Concentrando-se na voz da natureza ao seu redor, você aprende a direção e a distância da criatura ou planta mais próxima desse tipo em um raio de 8 km, se houver alguma."
    ],
    "material": "Um pouco de pelo de um cão de caça.",
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Locate Creature": {
    "name": "Localizar criatura",
    "desc": [
      "Descreva ou nomeie uma criatura que lhe seja familiar. Você sente a direção da localização da criatura, desde que ela esteja a até 1.000 pés de você. Se a criatura estiver se movendo, você saberá a direção do movimento dela.",
      "O feitiço pode localizar uma criatura específica conhecida por você ou a criatura mais próxima de um tipo específico (como um humano ou um unicórnio), desde que você tenha visto essa criatura de perto - em um raio de 30 pés - pelo menos uma vez. Se a criatura que você descreveu ou nomeou estiver em uma forma diferente, como sob os efeitos de um feitiço de polimorfia, esse feitiço não localiza a criatura.",
      "Esse feitiço não pode localizar uma criatura se a água corrente com pelo menos 3 metros de largura bloquear um caminho direto entre você e a criatura."
    ],
    "material": "Um pouco de pelo de um cão de caça.",
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Locate Object": {
    "name": "Localizar objeto",
    "desc": [
      "Descreva ou nomeie um objeto que lhe seja familiar. Você sente a direção da localização do objeto, desde que ele esteja a até 1.000 pés de você. Se o objeto estiver em movimento, você saberá a direção de seu movimento.",
      "O feitiço pode localizar um objeto específico conhecido por você, desde que você o tenha visto de perto - em um raio de 30 pés - pelo menos uma vez. Alternativamente, o feitiço pode localizar o objeto mais próximo de um tipo específico, como um determinado tipo de roupa, joia, mobília, ferramenta ou arma.",
      "Esse feitiço não pode localizar um objeto se qualquer espessura de chumbo, mesmo uma folha fina, bloquear um caminho direto entre você e o objeto."
    ],
    "material": "Um galho bifurcado.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Longstrider": {
    "name": "Longstrider",
    "desc": [
      "Você toca uma criatura. A velocidade do alvo aumenta em 3 metros até o fim do feitiço."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço de feitiço de 2º nível ou superior, você pode ter como alvo uma criatura adicional para cada espaço de feitiço acima do 1º."
    ],
    "material": "Uma pitada de sujeira.",
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Mage Armor": {
    "name": "Armadura de mago",
    "desc": [
      "Você toca uma criatura disposta que não esteja usando armadura, e uma força mágica protetora a envolve até o fim do feitiço. A CA básica do alvo passa a ser 13 + seu modificador de Destreza. O feitiço termina se o alvo vestir uma armadura ou se você descartar o feitiço como uma ação."
    ],
    "material": "Um pedaço de couro curado.",
    "duration": "8 horas",
    "casting_time": "1 ação"
  },
  "Mage Hand": {
    "name": "Mão de mago",
    "desc": [
      "Uma mão espectral e flutuante aparece em um ponto que você escolher dentro do alcance. A mão dura a duração do feitiço ou até que você a afaste como uma ação. A mão desaparece se estiver a mais de 30 pés de distância de você ou se você lançar esse feitiço novamente.",
      "Você pode usar sua ação para controlar a mão. Você pode usar a mão para manipular um objeto, abrir uma porta ou um recipiente destrancado, guardar ou recuperar um item de um recipiente aberto ou despejar o conteúdo de um frasco. Você pode mover a mão até 30 pés cada vez que a usar.",
      "A mão não pode atacar, ativar itens mágicos ou carregar mais de 10 libras."
    ],
    "duration": "1 minuto",
    "casting_time": "1 ação"
  },
  "Magic Circle": {
    "name": "Círculo Mágico",
    "desc": [
      "Você cria um cilindro de energia mágica com 10 pés de raio e 20 pés de altura centrado em um ponto no chão que você possa ver dentro do alcance. Runas brilhantes aparecem sempre que o cilindro cruza o chão ou outra superfície.",
      "Escolha um ou mais dos seguintes tipos de criaturas: celestiais, elementais, feéricos, demônios ou mortos-vivos. O círculo afeta uma criatura do tipo escolhido das seguintes maneiras:",
      "- A criatura não pode entrar voluntariamente no cilindro por meios não mágicos. Se a criatura tentar usar o teletransporte ou a viagem interplanar para entrar no cilindro, ela deverá primeiro ser bem-sucedida em um arremesso salvador de carisma.",
      "- A criatura tem desvantagem em rolagens de ataque contra alvos dentro do cilindro.",
      "- Os alvos dentro do cilindro não podem ser encantados, amedrontados ou possuídos pela criatura.",
      "Ao lançar esse feitiço, você pode optar por fazer com que a magia opere no sentido inverso, impedindo que uma criatura do tipo especificado saia do cilindro e protegendo os alvos fora dele."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 4º nível ou superior, a duração aumenta em 1 hora para cada nível de espaço acima do 3º."
    ],
    "material": "Água benta ou prata e ferro em pó no valor mínimo de 100 gp, que o feitiço consome.",
    "duration": "1 hora",
    "casting_time": "1 minuto"
  },
  "Magic Jar": {
    "name": "Jarra mágica",
    "desc": [
      "Seu corpo entra em estado catatônico enquanto sua alma o deixa e entra no recipiente que você usou para o componente material do feitiço. Enquanto sua alma habita o recipiente, você está ciente do ambiente ao seu redor como se estivesse no espaço do recipiente. Você não pode se mover nem usar reações. A única ação que pode realizar é projetar sua alma até 30 metros para fora do recipiente, retornando ao seu corpo vivo (e encerrando o feitiço) ou tentando possuir um corpo humanoide.",
      "Você pode tentar possuir qualquer humanoide que esteja a até 30 metros de você e que você possa ver (criaturas protegidas por um feitiço de proteção contra o mal e o bem ou de círculo mágico não podem ser possuídas). O alvo deve fazer um arremesso salvador de carisma. Em caso de falha, sua alma se desloca para o corpo do alvo, e a alma do alvo fica presa no recipiente. Se for bem-sucedido, o alvo resiste aos seus esforços para possuí-lo e você não poderá tentar possuí-lo novamente por 24 horas.",
      "Quando você possui o corpo de uma criatura, você a controla. Suas estatísticas de jogo são substituídas pelas estatísticas da criatura, embora você mantenha seu alinhamento e suas pontuações de Inteligência, Sabedoria e Carisma. Você mantém o benefício de suas próprias características de classe. Se o alvo tiver algum nível de classe, você não poderá usar nenhuma de suas características de classe.",
      "Enquanto isso, a alma da criatura possuída pode perceber a partir do contêiner usando seus próprios sentidos, mas não pode se mover ou realizar nenhuma ação.",
      "Enquanto estiver possuindo um corpo, você pode usar sua ação para retornar do corpo hospedeiro para o recipiente se ele estiver a até 30 metros de você, retornando a alma da criatura hospedeira para o corpo dela. Se o corpo do hospedeiro morrer enquanto você estiver nele, a criatura morre e você deve fazer um arremesso salvador de carisma contra a sua própria CD de feitiço. Se for bem-sucedido, você retorna ao recipiente se ele estiver a até 30 metros de você. Caso contrário, você morre.",
      "Se o recipiente for destruído ou o feitiço terminar, sua alma retornará imediatamente ao seu corpo. Se o seu corpo estiver a mais de 30 metros de distância de você ou se estiver morto quando você tentar retornar a ele, você morrerá. Se a alma de outra criatura estiver no recipiente quando ele for destruído, a alma da criatura retornará ao seu corpo se o corpo estiver vivo e a até 30 metros de distância. Caso contrário, a criatura morre.",
      "Quando o feitiço termina, o contêiner é destruído."
    ],
    "material": "Uma gema, um cristal, um relicário ou algum outro recipiente ornamental com valor mínimo de 500 gp.",
    "duration": "Até que seja dissipado",
    "casting_time": "1 minuto"
  },
  "Magic Missile": {
    "name": "Míssil mágico",
    "desc": [
      "Você cria três dardos brilhantes de força mágica. Cada dardo atinge uma criatura de sua escolha que você possa ver dentro do alcance. Um dardo causa 1d4 + 1 de dano de força ao seu alvo. Todos os dardos atingem simultaneamente e você pode direcioná-los para atingir uma ou várias criaturas."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 2º nível ou superior, o feitiço cria mais um dardo para cada nível de espaço acima do 1º."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Força"
  },
  "Magic Mouth": {
    "name": "Boca Mágica",
    "desc": [
      "Você envia uma mensagem a um objeto no alcance do feitiço. A mensagem é verbalizada quando as condições de ativação são atendidas. Escolha um objeto que você veja e que não esteja sendo usado ou carregado por outra criatura. Em seguida, diga a mensagem, que não deve exceder 25 palavras, mas a audição pode levar até 10 minutos. Por fim, estabeleça as circunstâncias que acionam o feitiço para entregar sua mensagem.",
      "Quando essas condições são atendidas, uma boca mágica aparece no objeto e articula a mensagem imitando sua voz, o mesmo tom usado durante a implantação da mensagem. Se o objeto selecionado tiver uma boca ou algo que se aproxime, como a boca de uma estátua, a boca mágica ganha vida nesse momento, dando a ilusão de que as palavras vêm da boca do objeto.",
      "Ao lançar esse feitiço, você pode decidir que o feitiço termina quando a mensagem é entregue ou pode persistir e repetir a mensagem sempre que as circunstâncias ocorrerem.",
      "A circunstância desencadeadora pode ser tão geral ou detalhada quanto você quiser, embora deva se basear em condições visuais ou sonoras que ocorram em um raio de 30 pés do objeto. Por exemplo, você poderia instruir a boca a falar quando qualquer criatura se mover em um raio de 30 pés do objeto ou quando um sino de prata tocar em um raio de 30 pés dele."
    ],
    "material": "Um favo de mel e pó de jade de pelo menos 10 polegadas, o feitiço consome.",
    "duration": "Até que seja dissipado",
    "casting_time": "1 minuto"
  },
  "Magic Weapon": {
    "name": "Arma mágica",
    "desc": [
      "Você toca uma arma não mágica. Até que o feitiço termine, essa arma se torna uma arma mágica com um bônus de +1 nas rolagens de ataque e nas rolagens de dano."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço para feitiço de 4º nível ou superior, o bônus aumenta para +2. Ao usar um espaço para feitiço de 6º nível ou superior, o bônus aumenta para +3."
    ],
    "duration": "Até 1 hora",
    "casting_time": "1 ação bônus"
  },
  "Magnificent Mansion": {
    "name": "Magnificent Mansion (Mansão Magnífica)",
    "desc": [
      "Você conjura uma habitação extradimensional ao alcance que dura a duração. Você escolhe a localização de sua única entrada. A entrada brilha levemente e tem 1,5 metro de largura e 3 metros de altura. Você e qualquer criatura designada por você ao lançar o feitiço podem entrar na habitação extradimensional enquanto o portal permanecer aberto. Você pode abrir ou fechar o portal se estiver a até 30 pés dele. Quando fechado, o portal fica invisível.",
      "Além do portal, há um magnífico saguão com várias câmaras. A atmosfera é limpa, fresca e acolhedora.",
      "Você pode criar qualquer planta baixa que desejar, mas o espaço não pode exceder 50 cubos, cada cubo com 3 metros de cada lado. O local é mobiliado e decorado conforme sua escolha. Ele contém comida suficiente para servir um banquete de nove pratos para até 100 pessoas. Uma equipe de 100 servos quase transparentes atende a todos que entram. Você decide a aparência visual desses servos e suas vestimentas. Eles são totalmente obedientes às suas ordens. Cada servo pode realizar qualquer tarefa que um servo humano normal possa realizar, mas não pode atacar nem realizar qualquer ação que possa prejudicar diretamente outra criatura. Assim, os servos podem buscar coisas, limpar, consertar, dobrar roupas, acender fogueiras, servir comida, servir vinho e assim por diante. Os criados podem ir a qualquer lugar da mansão, mas não podem sair dela. Os móveis e outros objetos criados por esse feitiço se dissipam em fumaça se forem removidos da mansão. Quando o feitiço termina, todas as criaturas dentro do espaço extradimensional são expulsas para os espaços abertos mais próximos da entrada."
    ],
    "material": "Um portal em miniatura esculpido em marfim, um pequeno pedaço de mármore polido e uma minúscula colher de prata, cada item valendo pelo menos 5 gp.",
    "duration": "24 horas",
    "casting_time": "1 minuto"
  },
  "Major Image": {
    "name": "Imagem principal",
    "desc": [
      "Você cria a imagem de um objeto, uma criatura ou algum outro fenômeno visível que não seja maior do que um cubo de 6 metros. A imagem aparece em um ponto que você pode ver dentro do alcance e dura a duração. Ela parece completamente real, incluindo sons, cheiros e temperatura apropriados à coisa retratada. Você não pode criar calor ou frio suficiente para causar dano, um som alto o bastante para causar dano de trovão ou ensurdecer uma criatura, ou um cheiro que possa adoecer uma criatura (como o fedor de um troglodita).",
      "Enquanto estiver dentro do alcance da ilusão, você pode usar sua ação para fazer com que a imagem se mova para qualquer outro ponto dentro do alcance. À medida que a imagem muda de local, você pode alterar sua aparência para que os movimentos pareçam naturais para a imagem. Por exemplo, se você criar a imagem de uma criatura e movê-la, poderá alterar a imagem para que ela pareça estar andando. Da mesma forma, você pode fazer com que a ilusão emita sons diferentes em momentos diferentes, até mesmo fazendo com que ela mantenha uma conversa, por exemplo.",
      "A interação física com a imagem revela que ela é uma ilusão, pois as coisas podem passar por ela. Uma criatura que use sua ação para examinar a imagem pode determinar que se trata de uma ilusão com um teste bem-sucedido de Inteligência (Investigação) contra sua CD de proteção contra feitiço. Se uma criatura discernir a ilusão pelo que ela é, ela poderá ver através da imagem e suas outras qualidades sensoriais se tornarão fracas para a criatura."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 6º nível ou superior, o feitiço dura até ser dissipado, sem exigir sua concentração."
    ],
    "material": "Um pouco de lã.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Mass Cure Wounds": {
    "name": "Cura em massa de ferimentos",
    "desc": [
      "Uma onda de energia de cura se espalha a partir de um ponto de sua escolha dentro do alcance. Escolha até seis criaturas em uma esfera de 30 pés de raio centrada nesse ponto. Cada alvo recupera pontos de vida iguais a 3d8 + seu modificador de habilidade de conjuração. Esse feitiço não tem efeito sobre mortos-vivos ou construtos."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 6º nível ou superior, a cura aumenta em 1d8 para cada nível de espaço acima do 5º."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Mass Heal": {
    "name": "Cura em massa",
    "desc": [
      "Uma inundação de energia de cura flui de você para as criaturas feridas ao seu redor. Você restaura até 700 pontos de vida, divididos como quiser entre qualquer número de criaturas que você possa ver dentro do alcance. As criaturas curadas por esse feitiço também são curadas de todas as doenças e de qualquer efeito que as torne cegas ou surdas. Esse feitiço não tem efeito sobre mortos-vivos ou construtos."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Mass Healing Word": {
    "name": "Missa Palavra de Cura",
    "desc": [
      "À medida que você pronuncia palavras de restauração, até seis criaturas de sua escolha que você possa ver dentro do alcance recuperam pontos de vida iguais a 1d4 + seu modificador de habilidade de lançar feitiços. Esse feitiço não tem efeito sobre mortos-vivos ou construtos."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 4º nível ou superior, a cura aumenta em 1d4 para cada nível de espaço acima do 3º."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação bônus"
  },
  "Mass Suggestion": {
    "name": "Sugestão de massa",
    "desc": [
      "Você sugere um curso de atividade (limitado a uma ou duas frases) e influencia magicamente até doze criaturas de sua escolha que você possa ver dentro do alcance e que possam ouvi-lo e entendê-lo. As criaturas que não podem ser encantadas são imunes a esse efeito. A sugestão deve ser formulada de modo a fazer com que o curso de ação pareça razoável. Pedir que a criatura se apunhale, se jogue em uma lança, se imole ou faça algum outro ato obviamente prejudicial nega automaticamente o efeito do feitiço.",
      "Cada alvo deve fazer um arremesso de sabedoria. Se o salvamento falhar, ele seguirá o curso de ação descrito por você da melhor forma possível. O curso de ação sugerido pode continuar por toda a duração. Se a atividade sugerida puder ser concluída em um tempo menor, o feitiço termina quando o sujeito termina o que lhe foi solicitado.",
      "Você também pode especificar condições que acionarão uma atividade especial durante a duração. Por exemplo, você pode sugerir que um grupo de soldados dê todo o seu dinheiro ao primeiro mendigo que encontrar. Se a condição não for atendida antes do fim do feitiço, a atividade não será realizada.",
      "Se você ou qualquer um de seus companheiros causar dano a uma criatura afetada por esse feitiço, o feitiço termina para essa criatura."
    ],
    "higher_level": [
      "Quando você conjura esse feitiço usando um espaço de feitiço de 7º nível, a duração é de 10 dias. Quando você usa um espaço de feitiço de 8º nível, a duração é de 30 dias. Quando você usa um espaço de feitiço de 9º nível, a duração é de um ano e um dia."
    ],
    "material": "Uma língua de cobra e um pouco de favo de mel ou uma gota de óleo doce.",
    "duration": "24 horas",
    "casting_time": "1 ação"
  },
  "Maze": {
    "name": "Labirinto",
    "desc": [
      "Você bane uma criatura que possa ver dentro do alcance para um demiplano labiríntico. O alvo permanece lá por toda a duração ou até que escape do labirinto.",
      "O alvo pode usar sua ação para tentar escapar. Ao fazer isso, ele faz um teste de Inteligência DC 20. Se for bem-sucedido, ele escapa e o feitiço termina (um minotauro ou demônio goristro é automaticamente bem-sucedido).",
      "Quando o feitiço termina, o alvo reaparece no espaço que deixou ou, se esse espaço estiver ocupado, no espaço desocupado mais próximo."
    ],
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Meld Into Stone": {
    "name": "Fusão em pedra",
    "desc": [
      "Você entra em um objeto ou superfície de pedra grande o suficiente para conter totalmente o seu corpo, fundindo a si mesmo e todo o equipamento que carrega com a pedra durante todo o tempo. Usando seu movimento, você entra na pedra em um ponto que pode tocar. Nada de sua presença permanece visível ou detectável por sentidos não mágicos.",
      "Enquanto estiver imerso na pedra, você não pode ver o que ocorre fora dela, e quaisquer verificações de Sabedoria (Percepção) feitas para ouvir sons fora dela são feitas com desvantagem. Você continua ciente da passagem do tempo e pode lançar feitiços em si mesmo enquanto estiver imerso na pedra. Você pode usar seu movimento para deixar a pedra onde entrou, o que encerra o feitiço. Caso contrário, você não poderá se mover.",
      "Pequenos danos físicos à pedra não o prejudicam, mas sua destruição parcial ou uma mudança em sua forma (a ponto de você não caber mais dentro dela) o expulsa e causa 6d6 de dano por arma branca. A destruição completa da pedra (ou a transmutação em uma substância diferente) o expulsa e causa 50 de dano por arma branca. Se for expulso, você cairá de bruços em um espaço desocupado mais próximo de onde entrou pela primeira vez."
    ],
    "duration": "8 horas",
    "casting_time": "1 ação"
  },
  "Mending": {
    "name": "Remendos",
    "desc": [
      "Esse feitiço repara uma única quebra ou rasgo em um objeto que você tocar, como uma chave quebrada, uma capa rasgada ou um odre vazando. Desde que a quebra ou o rasgo não seja maior do que 1 pé em qualquer dimensão, você o conserta, sem deixar vestígios do dano anterior.",
      "Esse feitiço pode reparar fisicamente um item mágico ou uma construção, mas não pode restaurar a magia desse objeto."
    ],
    "material": "Duas pedras angulares.",
    "duration": "Instantâneo",
    "casting_time": "1 minuto"
  },
  "Message": {
    "name": "Mensagem",
    "desc": [
      "Você aponta o dedo para uma criatura dentro do alcance e sussurra uma mensagem. O alvo (e somente o alvo) ouve a mensagem e pode responder em um sussurro que somente você pode ouvir.",
      "Você pode lançar esse feitiço através de objetos sólidos se estiver familiarizado com o alvo e souber que ele está além da barreira. O silêncio mágico, 1 pé de pedra, 1 polegada de metal comum, uma folha fina de chumbo ou 3 pés de madeira bloqueiam o feitiço. O feitiço não precisa seguir uma linha reta e pode viajar livremente pelos cantos ou por aberturas."
    ],
    "material": "Um pequeno pedaço de fio de cobre.",
    "duration": "1 rodada",
    "casting_time": "1 ação"
  },
  "Meteor Swarm": {
    "name": "Enxame de meteoros",
    "desc": [
      "Orbes flamejantes de fogo caem no chão em quatro pontos diferentes que você pode ver dentro do alcance. Cada criatura em uma esfera de 40 pés de raio centrada em cada ponto que você escolher deve fazer um arremesso salvador de destreza. A esfera se espalha pelos cantos. Uma criatura recebe 20d6 de dano de fogo e 20d6 de dano de espancamento se a defesa falhar, ou metade do dano se for bem-sucedida. Uma criatura na área de mais de uma explosão de fogo é afetada apenas uma vez.",
      "O feitiço danifica objetos na área e inflama objetos inflamáveis que não estejam sendo usados ou carregados."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Incêndio"
  },
  "Mind Blank": {
    "name": "Mente em branco",
    "desc": [
      "Até o fim do feitiço, uma criatura disposta que você tocar ficará imune a dano psíquico, a qualquer efeito que possa sentir suas emoções ou ler seus pensamentos, a feitiços de adivinhação e à condição de encantado. O feitiço anula até mesmo os feitiços de desejo e os feitiços ou efeitos de poder semelhante usados para afetar a mente do alvo ou para obter informações sobre ele."
    ],
    "duration": "24 horas",
    "casting_time": "1 ação"
  },
  "Minor Illusion": {
    "name": "Ilusão menor",
    "desc": [
      "Você cria um som ou uma imagem de um objeto dentro do alcance que dura a duração. A ilusão também termina se você a descartar como uma ação ou lançar esse feitiço novamente.",
      "Se você criar um som, o volume dele pode variar de um sussurro a um grito. Pode ser a sua voz, a voz de outra pessoa, o rugido de um leão, uma batida de tambores ou qualquer outro som que você escolher. O som continua ininterrupto durante toda a duração do feitiço, ou você pode emitir sons distintos em momentos diferentes antes de o feitiço terminar.",
      "Se você criar uma imagem de um objeto, como uma cadeira, pegadas na lama ou um pequeno baú, ela não poderá ser maior do que um cubo de 1,5 m. A imagem não pode criar som, luz, cheiro ou qualquer outro efeito sensorial. A interação física com a imagem revela que ela é uma ilusão, pois as coisas podem passar por ela.",
      "Se uma criatura usar sua ação para examinar o som ou a imagem, ela poderá determinar que se trata de uma ilusão com um teste bem-sucedido de Inteligência (Investigação) contra a sua CD de proteção contra feitiço. Se uma criatura discernir a ilusão pelo que ela é, a ilusão se torna fraca para a criatura."
    ],
    "material": "Um pouco de lã.",
    "duration": "1 minuto",
    "casting_time": "1 ação"
  },
  "Mirage Arcane": {
    "name": "Miragem Arcana",
    "desc": [
      "Você faz com que o terreno em uma área de até 1 milha quadrada pareça, soe, cheire e até se sinta como outro tipo de terreno. No entanto, a forma geral do terreno permanece a mesma. Campos abertos ou uma estrada podem se assemelhar a um pântano, colina, fenda ou outro terreno difícil ou intransitável. Uma lagoa pode parecer um prado gramado, um precipício uma encosta suave ou um barranco cheio de pedras uma estrada larga e suave.",
      "Da mesma forma, você pode alterar a aparência de estruturas ou adicioná-las onde não houver nenhuma. O feitiço não disfarça, oculta ou adiciona criaturas.",
      "A ilusão inclui elementos audíveis, visuais, táteis e olfativos, de modo que pode transformar um terreno limpo em um terreno difícil (ou vice-versa) ou impedir o movimento na área. Qualquer pedaço do terreno ilusório (como uma pedra ou um pedaço de pau) que seja removido da área do feitiço desaparece imediatamente.",
      "As criaturas com visão verdadeira podem ver através da ilusão a verdadeira forma do terreno; entretanto, todos os outros elementos da ilusão permanecem, portanto, embora a criatura esteja ciente da presença da ilusão, ela ainda pode interagir fisicamente com a ilusão."
    ],
    "duration": "10 dias",
    "casting_time": "10 minutos"
  },
  "Mirror Image": {
    "name": "Imagem espelhada",
    "desc": [
      "Três duplicatas ilusórias de você mesmo aparecem em seu espaço. Até que o feitiço termine, as duplicatas se movem com você e imitam suas ações, mudando de posição de modo que seja impossível identificar qual imagem é real. Você pode usar sua ação para descartar as duplicatas ilusórias.",
      "Toda vez que uma criatura atacar você durante a duração do feitiço, role um d20 para determinar se o ataque será direcionado a uma de suas duplicatas.",
      "Se você tiver três duplicatas, deverá rolar um 6 ou mais para mudar o alvo do ataque para uma duplicata. Com duas duplicatas, você deve rolar um 8 ou um valor maior. Com uma duplicata, você deve rolar um 11 ou um valor maior.",
      "A CA de uma duplicata é igual a 10 + seu modificador de Destreza. Se um ataque atingir uma duplicata, ela será destruída. Uma duplicata só pode ser destruída por um ataque que a atinja. Ela ignora todos os outros danos e efeitos. O feitiço termina quando todas as três duplicatas forem destruídas.",
      "Uma criatura não é afetada por esse feitiço se não puder ver, se depender de outros sentidos além da visão, como a visão cega, ou se puder perceber as ilusões como falsas, como a visão verdadeira."
    ],
    "duration": "1 minuto",
    "casting_time": "1 ação"
  },
  "Mislead": {
    "name": "Enganar",
    "desc": [
      "Você se torna invisível ao mesmo tempo em que um duplo ilusório de você aparece no local onde você está. O duplo dura por toda a duração, mas a invisibilidade termina se você atacar ou lançar um feitiço.",
      "Você pode usar a sua ação para mover o seu duplo ilusório até o dobro da sua velocidade e fazê-lo gesticular, falar e se comportar da maneira que desejar.",
      "Você pode ver pelos olhos dele e ouvir pelos ouvidos, como se estivesse no local onde ele está. Em cada um dos seus turnos, como ação bônus, você pode mudar do uso dos sentidos dele para o seu próprio, ou vice-versa. Enquanto estiver usando os sentidos dele, você fica cego e surdo em relação aos seus próprios arredores."
    ],
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Misty Step": {
    "name": "Misty Step",
    "desc": [
      "Brevemente cercado por uma névoa prateada, você se teletransporta até 30 pés para um espaço desocupado que possa ver."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação bônus"
  },
  "Modify Memory": {
    "name": "Modificar memória",
    "desc": [
      "Você tenta remodelar as memórias de outra criatura. Uma criatura que você possa ver deve fazer um arremesso de sabedoria. Se você estiver lutando com a criatura, ela tem vantagem no arremesso de defesa. Se o salvamento falhar, o alvo fica encantado por você durante o período. O alvo encantado fica incapacitado e desconhece os arredores, embora ainda possa ouvir você. Se ele sofrer qualquer dano ou for alvo de outro feitiço, esse feitiço termina e nenhuma das memórias do alvo é modificada.",
      "Enquanto esse amuleto durar, você pode afetar a memória do alvo de um evento que ele vivenciou nas últimas 24 horas e que não durou mais do que 10 minutos. Você pode eliminar permanentemente toda a memória do evento, permitir que o alvo se lembre do evento com perfeita clareza e detalhes exatos, alterar a memória dos detalhes do evento ou criar uma memória de algum outro evento.",
      "Você deve falar com o alvo para descrever como as memórias dele são afetadas, e ele deve ser capaz de entender o seu idioma para que as memórias modificadas se enraízem. A mente da criatura preenche todas as lacunas nos detalhes da sua descrição. Se o feitiço terminar antes que você termine de descrever as memórias modificadas, a memória da criatura não será alterada. Caso contrário, as memórias modificadas se estabelecerão quando o feitiço terminar.",
      "Uma memória modificada não afeta necessariamente o comportamento de uma criatura, principalmente se a memória contradizer as inclinações naturais, o alinhamento ou as crenças da criatura. Uma memória modificada ilógica, como a implantação de uma memória do quanto a criatura gostou de se encharcar de ácido, é descartada, talvez como um sonho ruim. O GM pode considerar que uma memória modificada é absurda demais para afetar uma criatura de forma significativa.",
      "Um feitiço de remoção de maldição ou de restauração maior lançado sobre o alvo restaura a memória verdadeira da criatura."
    ],
    "higher_level": [
      "Se você conjurar esse feitiço usando um espaço de feitiço de 6º nível ou superior, poderá alterar as memórias do alvo de um evento que ocorreu até 7 dias atrás (6º nível), 30 dias atrás (7º nível), 1 ano atrás (8º nível) ou qualquer momento no passado da criatura (9º nível)."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Moonbeam": {
    "name": "Raio de lua",
    "desc": [
      "Um feixe prateado de luz pálida brilha em um cilindro de 5 pés de raio e 40 pés de altura centrado em um ponto dentro do alcance. Até que o feitiço termine, uma luz fraca preenche o cilindro.",
      "Quando uma criatura entra na área do feitiço pela primeira vez em um turno ou começa seu turno ali, ela é envolvida por chamas fantasmagóricas que causam dor aguda e deve fazer um arremesso de defesa de Constituição. Ela recebe 2d10 de dano radiante se o salvamento falhar, ou metade do dano se for bem-sucedido.",
      "Um metamorfo faz seu arremesso salvador com desvantagem. Se falhar, ele também reverte instantaneamente para sua forma original e não pode assumir uma forma diferente até que deixe a luz do feitiço.",
      "Em cada um dos seus turnos depois de lançar esse feitiço, você pode usar uma ação para mover o feixe por 60 pés em qualquer direção."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 3º nível ou superior, o dano aumenta em 1dl0 para cada nível de espaço acima do 2º."
    ],
    "material": "Várias sementes de qualquer planta lunar e um pedaço de feldspato opalescente.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação",
    "damage_type": "Radiante"
  },
  "Move Earth": {
    "name": "Move Earth",
    "desc": [
      "Escolha uma área de terreno não maior que 40 pés em um lado dentro do alcance. Você pode remodelar a terra, a areia ou a argila na área da maneira que desejar durante o período. Você pode aumentar ou diminuir a elevação da área, criar ou preencher uma trincheira, erguer ou aplainar uma parede ou formar um pilar. A extensão de tais alterações não pode exceder a metade da maior dimensão da área. Portanto, se você afetar um quadrado de 40 pés, poderá criar um pilar de até 20 pés de altura, aumentar ou diminuir a elevação do quadrado em até 20 pés, cavar uma vala de até 20 pés de profundidade e assim por diante. Essas alterações levam 10 minutos para serem concluídas.",
      "Ao final de cada 10 minutos de concentração no feitiço, você pode escolher uma nova área de terreno para afetar.",
      "Como a transformação do terreno ocorre lentamente, as criaturas na área geralmente não podem ficar presas ou feridas pelo movimento do solo.",
      "Esse feitiço não pode manipular pedras naturais ou construções de pedra. As rochas e as estruturas se deslocam para acomodar o novo terreno. Se a forma como você moldar o terreno tornar uma estrutura instável, ela poderá desmoronar.",
      "Da mesma forma, esse feitiço não afeta diretamente o crescimento das plantas. A terra movida carrega todas as plantas junto com ela."
    ],
    "material": "Uma lâmina de ferro e um pequeno saco contendo uma mistura de solos - argila, barro e areia.",
    "duration": "Até 2 horas",
    "casting_time": "1 ação"
  },
  "Nondetection": {
    "name": "Não detecção",
    "desc": [
      "Durante esse período, você esconde um alvo que tocar da magia de adivinhação. O alvo pode ser uma criatura disposta, um local ou um objeto que não seja maior do que 3 metros em qualquer dimensão. O alvo não pode ser alvo de nenhuma magia de adivinhação ou percebido por meio de sensores mágicos de vidência."
    ],
    "material": "Uma pitada de pó de diamante no valor de 25 gp é espalhada sobre o alvo, que o feitiço consome.",
    "duration": "8 horas",
    "casting_time": "1 ação"
  },
  "Pass Without Trace": {
    "name": "Passe sem deixar rastros",
    "desc": [
      "Um véu de sombras e silêncio irradia de você, mascarando você e seus companheiros para que não sejam detectados. Durante esse período, cada criatura que você escolher em um raio de 30 pés (incluindo você) tem um bônus de +10 nos testes de Destreza (Furtividade) e não pode ser rastreada, exceto por meios mágicos. Uma criatura que recebe esse bônus não deixa rastros ou outros vestígios de sua passagem."
    ],
    "material": "Cinzas de uma folha queimada de visco e um ramo de abeto.",
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Passwall": {
    "name": "Senha",
    "desc": [
      "Uma passagem aparece em um ponto de sua escolha que você pode ver em uma superfície de madeira, gesso ou pedra (como uma parede, um teto ou um piso) dentro do alcance e dura a duração. Você escolhe as dimensões da abertura: até 1,5 metro de largura, 1,8 metro de altura e 6 metros de profundidade. A passagem não cria instabilidade em uma estrutura ao redor dela.",
      "Quando a abertura desaparece, quaisquer criaturas ou objetos que ainda estejam na passagem criada pelo feitiço são ejetados com segurança para um espaço desocupado mais próximo da superfície na qual você lançou o feitiço."
    ],
    "material": "Uma pitada de sementes de gergelim.",
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Phantasmal Killer": {
    "name": "Phantasmal Killer",
    "desc": [
      "Você se inspira nos pesadelos de uma criatura que possa ver dentro do alcance e cria uma manifestação ilusória de seus medos mais profundos, visível apenas para essa criatura. O alvo deve fazer um arremesso de salvamento de sabedoria. Se o salvamento falhar, o alvo fica amedrontado por toda a duração. No início de cada um dos turnos do alvo antes do fim do feitiço, o alvo deve ser bem-sucedido em um arremesso de sabedoria ou sofrerá 4d10 de dano psíquico. Em um salvamento bem-sucedido, o feitiço termina."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 5º nível ou superior, o dano aumenta em 1d10 para cada nível de espaço acima do 4º."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação",
    "damage_type": "Psíquico"
  },
  "Phantom Steed": {
    "name": "Corcel Fantasma",
    "desc": [
      "Uma criatura grande, quase real, semelhante a um cavalo aparece no chão em um espaço desocupado de sua escolha dentro do alcance. Você decide a aparência da criatura, mas ela está equipada com uma sela, um freio e uma rédea. Qualquer equipamento criado pelo feitiço desaparece em uma nuvem de fumaça se for carregado a mais de 3 metros de distância do cavalo.",
      "Durante esse período, você ou uma criatura de sua escolha pode montar o corcel. A criatura usa as estatísticas de um cavalo de montaria, exceto que tem uma velocidade de 100 pés e pode viajar 10 milhas em uma hora, ou 13 milhas em um ritmo rápido. Quando o feitiço termina, o corcel desaparece gradualmente, dando ao cavaleiro 1 minuto para desmontar. O feitiço termina se você usar uma ação para dispensá-lo ou se o corcel sofrer algum dano."
    ],
    "duration": "1 hora",
    "casting_time": "1 minuto"
  },
  "Planar Ally": {
    "name": "Aliado Planar",
    "desc": [
      "Você pede ajuda a uma entidade de outro mundo. O ser deve ser conhecido por você: um deus, um primordial, um príncipe demônio ou algum outro ser de poder cósmico. Essa entidade envia um celestial, um elemental ou um demônio leal a ela para ajudá-lo, fazendo com que a criatura apareça em um espaço desocupado dentro do alcance. Se você souber o nome de uma criatura específica, poderá falar esse nome ao lançar esse feitiço para solicitar essa criatura, embora possa obter uma criatura diferente de qualquer forma (escolha do MJ).",
      "Quando a criatura aparece, ela não é obrigada a se comportar de nenhuma maneira específica. Você pode pedir à criatura que realize um serviço em troca de pagamento, mas ela não é obrigada a fazer isso. A tarefa solicitada pode ser simples (atravessar o abismo de avião ou nos ajudar a lutar em uma batalha) ou complexa (espionar nossos inimigos ou nos proteger durante nossa incursão na masmorra). Você deve ser capaz de se comunicar com a criatura para barganhar seus serviços.",
      "O pagamento pode ser feito de várias formas. Um celestial pode exigir uma doação considerável de ouro ou itens mágicos para um templo aliado, enquanto um demônio pode exigir um sacrifício vivo ou um presente de tesouro. Algumas criaturas podem trocar seus serviços por uma missão realizada por você.",
      "Como regra geral, uma tarefa que pode ser medida em minutos requer um pagamento no valor de 100 gp por minuto. Uma tarefa medida em horas requer 1.000 gp por hora. E uma tarefa medida em dias (até 10 dias) requer 10.000 gp por dia. O GM pode ajustar esses pagamentos com base nas circunstâncias em que você lançou o feitiço. Se a tarefa estiver alinhada com o ethos da criatura, o pagamento poderá ser reduzido à metade ou até mesmo dispensado. As tarefas não perigosas normalmente exigem apenas metade do pagamento sugerido, enquanto as tarefas especialmente perigosas podem exigir um presente maior. As criaturas raramente aceitam tarefas que pareçam suicidas.",
      "Depois que a criatura concluir a tarefa, ou quando a duração do serviço acordada expirar, a criatura retorna ao seu plano de origem depois de se reportar a você, se apropriado para a tarefa e se possível. Se vocês não conseguirem chegar a um acordo sobre o preço do serviço da criatura, ela retornará imediatamente ao seu plano de origem.",
      "Uma criatura alistada para se juntar ao seu grupo conta como membro dele, recebendo uma parcela completa dos pontos de experiência concedidos."
    ],
    "duration": "Instantâneo",
    "casting_time": "10 minutos"
  },
  "Planar Binding": {
    "name": "Encadernação planar",
    "desc": [
      "Com esse feitiço, você tenta vincular um celestial, um elemental, um feérico ou um demônio a seu serviço. A criatura deve estar dentro do alcance durante todo o processo de conjuração do feitiço. (Normalmente, a criatura é primeiro convocada para o centro de um círculo mágico invertido a fim de mantê-la presa enquanto o feitiço é lançado). Ao final do lançamento, o alvo deve fazer um arremesso salvador de carisma. Se o salvamento falhar, ele será obrigado a servi-lo por toda a duração do feitiço. Se a criatura tiver sido convocada ou criada por outro feitiço, a duração desse feitiço será estendida para corresponder à duração desse feitiço.",
      "Uma criatura vinculada deve seguir suas instruções da melhor forma possível. Você pode ordenar que a criatura o acompanhe em uma aventura, guarde um local ou entregue uma mensagem. A criatura obedece à letra de suas instruções, mas se for hostil a você, ela se esforça para distorcer suas palavras para atingir seus próprios objetivos. Se a criatura executar suas instruções completamente antes do fim do feitiço, ela viajará até você para relatar esse fato se vocês estiverem no mesmo plano de existência. Se você estiver em um plano de existência diferente, ela retornará ao local onde você a amarrou e permanecerá lá até o fim do feitiço."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de nível mais alto, a duração aumenta para 10 dias com um espaço de 6º nível, para 30 dias com um espaço de 7º nível, para 180 dias com um espaço de 8º nível e para um ano e um dia com um espaço de 9º nível."
    ],
    "material": "Uma joia com valor mínimo de 1.000 gp, que o feitiço consome.",
    "duration": "24 horas",
    "casting_time": "1 hora"
  },
  "Plane Shift": {
    "name": "Mudança de avião",
    "desc": [
      "Você e até oito criaturas dispostas a dar as mãos em um círculo são transportados para um plano de existência diferente. Você pode especificar um destino em termos gerais, como a Cidade de Brass no Plano Elemental do Fogo ou o Palácio de Dispater no segundo nível dos Nove Infernos, e você aparecerá nesse destino ou próximo a ele. Se estiver tentando chegar à Cidade de Brass, por exemplo, você pode chegar à Rua de Aço, antes do Portão das Cinzas ou olhando a cidade do outro lado do Mar de Fogo, a critério do MJ.",
      "Como alternativa, se você conhecer a sequência de sigilo de um círculo de teletransporte em outro plano de existência, esse feitiço poderá levá-lo a esse círculo. Se o círculo de teletransporte for pequeno demais para conter todas as criaturas que você transportou, elas aparecerão nos espaços desocupados mais próximos ao círculo.",
      "Você pode usar esse feitiço para banir uma criatura que não queira ir para outro plano. Escolha uma criatura ao seu alcance e faça um ataque mágico corpo a corpo contra ela. Em caso de acerto, a criatura deve fazer um teste de defesa de carisma. Se a criatura falhar nessa defesa, ela será transportada para um local aleatório no plano de existência que você especificar. Uma criatura transportada dessa forma deve encontrar seu próprio caminho de volta ao seu plano de existência atual."
    ],
    "material": "Uma haste metálica bifurcada, com valor mínimo de 250 gp, sintonizada com um plano de existência específico.",
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "attack_type": "corpo a corpo"
  },
  "Plant Growth": {
    "name": "Crescimento da planta",
    "desc": [
      "Esse feitiço canaliza a vitalidade para as plantas em uma área específica. Há dois usos possíveis para o feitiço, concedendo benefícios imediatos ou de longo prazo.",
      "Se você lançar esse feitiço usando 1 ação, escolha um ponto dentro do alcance. Todas as plantas normais em um raio de 30 metros centrado nesse ponto se tornam espessas e cobertas de vegetação. Uma criatura que estiver se movendo pela área deve gastar 4 pés de movimento para cada 1 pé que se mover.",
      "Você pode excluir uma ou mais áreas de qualquer tamanho dentro da área do feitiço para que não sejam afetadas.",
      "Se lançar esse feitiço durante 8 horas, você enriquece a terra. Todas as plantas em um raio de 800 metros centrado em um ponto dentro do alcance ficam enriquecidas por 1 ano. As plantas produzem o dobro da quantidade normal de alimentos quando colhidas."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Poison Spray": {
    "name": "Spray de veneno",
    "desc": [
      "Você estende a mão em direção a uma criatura que possa ver dentro do alcance e projeta um sopro de gás nocivo da palma da mão. A criatura deve ser bem-sucedida em um arremesso salvador de Constituição ou sofrerá 1d12 de dano de veneno.",
      "O dano desse feitiço aumenta em 1d12 quando você atinge o 5º nível (2d12), o 11º nível (3d12) e o 17º nível (4d12)."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Veneno"
  },
  "Polymorph": {
    "name": "Polimorfo",
    "desc": [
      "Esse feitiço transforma uma criatura que você pode ver dentro do alcance em uma nova forma. Uma criatura que não queira se transformar deve fazer um arremesso de sabedoria para evitar o efeito. Um transformador de formas é automaticamente bem-sucedido nesse arremesso de defesa.",
      "A transformação dura a duração ou até que o alvo chegue a 0 pontos de vida ou morra. A nova forma pode ser qualquer fera cuja classificação de desafio seja igual ou menor que a do alvo (ou o nível do alvo, se ele não tiver uma classificação de desafio). As estatísticas de jogo do alvo, incluindo as pontuações de habilidade mental, são substituídas pelas estatísticas da fera escolhida. Ela mantém seu alinhamento e personalidade.",
      "O alvo assume os pontos de vida de sua nova forma. Quando reverte para sua forma normal, a criatura retorna ao número de pontos de vida que tinha antes de se transformar. Se ela reverter como resultado de cair para 0 hit points, qualquer excesso de dano será transferido para sua forma normal. Enquanto o excesso de dano não reduzir a forma normal da criatura a 0 pontos de vida, ela não ficará inconsciente.",
      "A criatura está limitada nas ações que pode realizar devido à natureza de sua nova forma e não pode falar, lançar feitiços ou realizar qualquer outra ação que exija mãos ou fala.",
      "O equipamento do alvo se funde com a nova forma. A criatura não pode ativar, usar, empunhar ou se beneficiar de nenhum de seus equipamentos."
    ],
    "material": "Um casulo de lagarta.",
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Power Word Kill": {
    "name": "Power Word Kill",
    "desc": [
      "Você pronuncia uma palavra de poder que pode obrigar uma criatura que você possa ver dentro do alcance a morrer instantaneamente. Se a criatura que você escolher tiver 100 pontos de vida ou menos, ela morrerá. Caso contrário, o feitiço não terá efeito."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Power Word Stun": {
    "name": "Palavra de poder Atordoar",
    "desc": [
      "Você profere uma palavra de poder capaz de subjugar a mente de uma criatura que você possa ver dentro do alcance, deixando-a atordoada. Se o alvo tiver 150 pontos de vida ou menos, ele ficará atordoado. Caso contrário, o feitiço não terá efeito.",
      "O alvo atordoado deve fazer um arremesso salvador de Constituição no final de cada um de seus turnos. Se a defesa for bem-sucedida, o efeito de atordoamento termina."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Prayer of Healing": {
    "name": "Oração de Cura",
    "desc": [
      "Até seis criaturas de sua escolha que você possa ver dentro do alcance recuperam, cada uma, pontos de vida iguais a 2d8 + seu modificador de habilidade de lançamento de feitiço. Esse feitiço não tem efeito sobre mortos-vivos ou construtos."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 3º nível ou superior, a cura aumenta em 1d8 para cada nível de espaço acima do 2º."
    ],
    "duration": "Instantâneo",
    "casting_time": "10 minutos"
  },
  "Prestidigitation": {
    "name": "Prestidigitação",
    "desc": [
      "Esse feitiço é um truque mágico menor que os feiticeiros iniciantes usam para praticar. Você cria um dos seguintes efeitos mágicos dentro do \"alcance\":",
      "Você cria um efeito sensorial instantâneo e inofensivo, como uma chuva de faíscas, um sopro de vento, notas musicais fracas ou um odor estranho.",
      "Você acende ou apaga instantaneamente uma vela, uma tocha ou uma pequena fogueira.",
      "Você limpa ou suja instantaneamente um objeto que não seja maior que 1 pé cúbico.",
      "Você resfria, aquece ou aromatiza até 1 pé cúbico de material não vivo por 1 hora.",
      "Você faz com que uma cor, uma pequena marca ou um símbolo apareça em um objeto ou superfície por 1 hora.",
      "Você cria uma bugiganga não mágica ou uma imagem ilusória que pode caber em sua mão e que dura até o final do seu próximo turno.",
      "Se você conjurar esse feitiço várias vezes, poderá ter até três de seus efeitos não instantâneos ativos por vez e poderá descartar esse efeito como uma ação."
    ],
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Prismatic Spray": {
    "name": "Spray prismático",
    "desc": [
      "Oito raios de luz multicoloridos saem de sua mão. Cada raio é de uma cor diferente e tem um poder e um propósito diferentes. Cada criatura em um cone de 60 pés deve fazer um arremesso salvador de destreza. Para cada alvo, role um d8 para determinar qual raio de cor o afeta.",
      "***1. Vermelho *** O alvo recebe 10d6 de dano de fogo se a defesa falhar, ou metade do dano se for bem-sucedida.",
      "***2. Laranja *** O alvo recebe 10d6 de dano de ácido se a defesa falhar, ou metade do dano se for bem-sucedida.",
      "***3. Amarelo *** O alvo recebe 10d6 de dano de raio se a defesa falhar, ou metade do dano se for bem-sucedida.",
      "***4. Verde *** O alvo recebe 10d6 de dano de veneno se a defesa falhar, ou metade do dano se for bem-sucedida.",
      "***5. Azul *** O alvo recebe 10d6 de dano de frio se a defesa falhar, ou metade do dano se for bem-sucedida.",
      "***6. Índigo *** Em um salvamento com falha, o alvo é restringido. Em seguida, ele deve fazer um arremesso de defesa de Constituição no final de cada um de seus turnos. Se conseguir salvar três vezes, o feitiço termina. Se falhar em seu salvamento três vezes, ele se transforma permanentemente em pedra e fica sujeito à condição de petrificado. Os sucessos e fracassos não precisam ser consecutivos; mantenha o controle de ambos até que o alvo obtenha três sucessos iguais.",
      "***7. Violeta *** Se o salvamento falhar, o alvo ficará cego. Ele deve então fazer um arremesso de sabedoria no início do seu próximo turno. Um salvamento bem-sucedido acaba com a cegueira. Se o salvamento falhar, a criatura é transportada para outro plano de existência à escolha do GM e não fica mais cega. (Normalmente, uma criatura que está em um plano que não é o seu plano de origem é banida para casa, enquanto outras criaturas são geralmente lançadas nos planos Astral ou Etéreo).",
      "***8. Especial *** O alvo é atingido por dois raios. Role mais duas vezes, fazendo um novo rolamento de qualquer 8."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Prismatic Wall": {
    "name": "Parede prismática",
    "desc": [
      "Um plano de luz cintilante e multicolorido forma uma parede vertical opaca - com até 90 pés de comprimento, 30 pés de altura e 1 polegada de espessura - centrada em um ponto que você possa ver dentro do alcance. Alternativamente, você pode moldar a parede em uma esfera de até 30 pés de diâmetro centrada em um ponto que você escolher dentro do alcance. A parede permanece no lugar por toda a duração. Se você posicionar a parede de modo que ela passe por um espaço ocupado por uma criatura, o feitiço falhará e sua ação e o espaço para feitiço serão desperdiçados.",
      "A parede emite luz brilhante a uma distância de 30 metros e luz fraca por mais 30 metros. Você e as criaturas que você designar no momento em que lançar o feitiço podem atravessar e permanecer perto da parede sem sofrer danos. Se outra criatura que puder ver a parede se mover para um raio de 6 metros dela ou começar seu turno ali, a criatura deverá ser bem-sucedida em um arremesso de defesa de Constituição ou ficará cega por 1 minuto.",
      "A parede consiste em sete camadas, cada uma com uma cor diferente. Quando uma criatura tenta alcançar ou atravessar a parede, ela o faz uma camada de cada vez, passando por todas as camadas da parede. Ao passar ou alcançar cada camada, a criatura deve fazer um arremesso de salvamento de destreza ou será afetada pelas propriedades dessa camada, conforme descrito abaixo.",
      "A parede pode ser destruída, também uma camada de cada vez, na ordem do vermelho ao violeta, por meios específicos para cada camada. Quando uma camada é destruída, ela permanece assim enquanto durar o feitiço. Uma haste de cancelamento destrói uma parede prismática, mas um campo antimagia não tem efeito sobre ela.",
      "***1. Vermelho *** A criatura recebe 10d6 de dano de fogo se falhar em um salvamento, ou metade do dano se for bem-sucedido. Enquanto essa camada estiver no lugar, os ataques de longo alcance não mágicos não podem atravessar a parede. A camada pode ser destruída causando pelo menos 25 de dano de frio a ela.",
      "***2. Laranja *** A criatura recebe 10d6 de dano de ácido se falhar em um salvamento, ou metade do dano se for bem-sucedido. Enquanto essa camada estiver no lugar, os ataques mágicos de longo alcance não podem atravessar a parede. A camada é destruída por um vento forte.",
      "***3. Amarelo *** A criatura recebe 10d6 de dano de raio se falhar em um salvamento, ou metade do dano se for bem-sucedido. Essa camada pode ser destruída causando pelo menos 60 de dano de força a ela.",
      "***4. Verde *** A criatura recebe 10d6 de dano de veneno se falhar em um salvamento, ou metade do dano se for bem-sucedido. Um feitiço de senha, ou outro feitiço de nível igual ou superior que possa abrir um portal em uma superfície sólida, destrói essa camada.",
      "***5. Azul *** A criatura recebe 10d6 de dano de frio se falhar em um salvamento, ou metade do dano se for bem-sucedido. Essa camada pode ser destruída causando pelo menos 25 de dano de fogo a ela.",
      "***6. Índigo *** Em um salvamento com falha, a criatura é restringida. Em seguida, ela deve fazer um arremesso de defesa de constituição no final de cada um de seus turnos. Se ela conseguir se salvar três vezes, o feitiço termina. Se falhar em seu salvamento três vezes, ela se transforma permanentemente em pedra e fica sujeita à condição de petrificada. Os sucessos e fracassos não precisam ser consecutivos; mantenha o controle de ambos até que a criatura obtenha três sucessos do mesmo tipo.",
      "Enquanto essa camada estiver no lugar, os feitiços não podem ser lançados através da parede. A camada é destruída pela luz brilhante emitida por um feitiço de luz do dia ou por um feitiço semelhante de nível igual ou superior.",
      "***7. Violeta *** Em um salvamento com falha, a criatura fica cega. Ela deve então fazer um arremesso de sabedoria no início do seu próximo turno. Um salvamento bem-sucedido acaba com a cegueira. Se falhar nesse salvamento, a criatura é transportada para outro plano à escolha do GM e não fica mais cega. (Normalmente, uma criatura que está em um plano que não é o seu plano de origem é banida para casa, enquanto outras criaturas são geralmente lançadas nos planos Astral ou Etéreo). Essa camada é destruída por um feitiço de dissipação de magia ou um feitiço semelhante de nível igual ou superior que possa acabar com feitiços e efeitos mágicos."
    ],
    "duration": "10 minutos",
    "casting_time": "1 ação"
  },
  "Private Sanctum": {
    "name": "Santuário particular",
    "desc": [
      "Você torna uma área dentro do alcance magicamente segura. A área é um cubo que pode ser tão pequeno quanto 1,5 metro ou tão grande quanto 30 metros de cada lado. O feitiço dura a duração do feitiço ou até que você use uma ação para descartá-lo.",
      "Ao lançar o feitiço, você decide que tipo de segurança o feitiço oferece, escolhendo uma ou todas as propriedades a seguir:",
      "- O som não pode atravessar a barreira na borda da área protegida.",
      "- A barreira da área protegida parece escura e enevoada, impedindo a visão (inclusive a visão no escuro) através dela.",
      "- Os sensores criados por feitiços de adivinhação não podem aparecer dentro da área protegida nem atravessar a barreira em seu perímetro.",
      "- As criaturas na área não podem ser alvo de feitiços de adivinhação.",
      "- Nada pode se teletransportar para dentro ou para fora da área protegida.",
      "- O deslocamento planar é bloqueado dentro da área protegida.",
      "O lançamento desse feitiço no mesmo local todos os dias durante um ano torna esse efeito permanente."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço para feitiço de 5º nível ou superior, você pode aumentar o tamanho do cubo em 30 metros para cada nível de espaço além do 4º. Assim, você poderia proteger um cubo que pode ter até 60 metros de um lado usando um espaço para feitiço de 5º nível."
    ],
    "material": "Uma folha fina de chumbo, um pedaço de vidro opaco, um chumaço de algodão ou tecido e crisólito em pó.",
    "duration": "24 horas",
    "casting_time": "10 minutos"
  },
  "Produce Flame": {
    "name": "Produzir chama",
    "desc": [
      "Uma chama tremeluzente aparece em sua mão. A chama permanece lá por toda a duração e não prejudica nem você nem seu equipamento. A chama emite uma luz brilhante em um raio de 3 metros e uma luz fraca em um raio adicional de 3 metros. O feitiço termina se você o descartar como uma ação ou se o lançar novamente.",
      "Você também pode atacar com a chama, embora isso encerre o feitiço. Ao lançar esse feitiço ou como uma ação em um turno posterior, você pode arremessar a chama em uma criatura em um raio de 30 pés de você. Faça um ataque mágico de longo alcance. Em caso de acerto, o alvo recebe 1d8 de dano de fogo.",
      "O dano desse feitiço aumenta em 1d8 quando você atinge o 5º nível (2d8), o 11º nível (3d8) e o 17º nível (4d8)."
    ],
    "duration": "10 minutos",
    "casting_time": "1 ação",
    "attack_type": "variado",
    "damage_type": "Incêndio"
  },
  "Programmed Illusion": {
    "name": "Ilusão programada",
    "desc": [
      "Você cria uma ilusão de um objeto, uma criatura ou algum outro fenômeno visível dentro do alcance que é ativado quando ocorre uma condição específica. A ilusão é imperceptível até então. Ela não pode ser maior do que um cubo de 30 pés e você decide, ao lançar o feitiço, como a ilusão se comporta e que sons emite. Essa performance planejada pode durar até 5 minutos.",
      "Quando a condição que você especificou ocorre, a ilusão passa a existir e funciona da maneira que você descreveu. Quando a ilusão termina de funcionar, ela desaparece e permanece inativa por 10 minutos. Após esse período, a ilusão pode ser ativada novamente.",
      "A condição de acionamento pode ser tão geral ou detalhada quanto você quiser, embora deva ser baseada em condições visuais ou sonoras que ocorram em um raio de 30 pés da área. Por exemplo, você pode criar uma ilusão de si mesmo para aparecer e alertar os outros que tentarem abrir uma porta presa, ou pode configurar a ilusão para ser acionada somente quando uma criatura disser a palavra ou frase correta.",
      "A interação física com a imagem revela que ela é uma ilusão, pois as coisas podem passar por ela. Uma criatura que use sua ação para examinar a imagem pode determinar que se trata de uma ilusão com um teste bem-sucedido de Inteligência (Investigação) contra sua CD de proteção contra feitiço. Se uma criatura discernir a ilusão pelo que ela é, ela poderá ver através da imagem e qualquer ruído que ela fizer soará vazio para a criatura."
    ],
    "material": "Um pouco de lã e pó de jade no valor de pelo menos 25 gp.",
    "duration": "Até que seja dissipado",
    "casting_time": "1 ação"
  },
  "Project Image": {
    "name": "Imagem do projeto",
    "desc": [
      "Você cria uma cópia ilusória de si mesmo que dura a duração. A cópia pode aparecer em qualquer local dentro do alcance que você já tenha visto antes, independentemente de obstáculos intermediários. A ilusão se parece e soa como você, mas é intangível. Se a ilusão sofrer algum dano, ela desaparece e o feitiço termina.",
      "Você pode usar sua ação para mover essa ilusão até o dobro de sua velocidade e fazê-la gesticular, falar e se comportar da maneira que desejar. Ela imita perfeitamente seus maneirismos.",
      "Você pode ver pelos olhos dele e ouvir pelos ouvidos, como se estivesse no espaço dele. No seu turno, como uma ação bônus, você pode mudar do uso dos sentidos dele para o seu próprio, ou vice-versa. Enquanto estiver usando os sentidos dele, você fica cego e surdo em relação aos seus próprios arredores.",
      "A interação física com a imagem revela que ela é uma ilusão, pois as coisas podem passar por ela. Uma criatura que use sua ação para examinar a imagem pode determinar que se trata de uma ilusão com um teste bem-sucedido de Inteligência (Investigação) contra sua CD de proteção contra feitiço. Se uma criatura discernir a ilusão pelo que ela é, ela poderá ver através da imagem e qualquer ruído que ela fizer soará vazio para a criatura."
    ],
    "material": "Uma pequena réplica de você feita com materiais que valem pelo menos 5 gp.",
    "duration": "Até 24 horas",
    "casting_time": "1 ação"
  },
  "Protection From Energy": {
    "name": "Proteção contra energia",
    "desc": [
      "Durante esse período, a criatura disposta que você tocar terá resistência a um tipo de dano de sua escolha: ácido, frio, fogo, raio ou trovão."
    ],
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Protection from Evil and Good": {
    "name": "Proteção contra o mal e o bem",
    "desc": [
      "Até que o feitiço termine, uma criatura disposta que você tocar estará protegida contra certos tipos de criaturas: aberrações, celestiais, elementais, feéricos, demônios e mortos-vivos.",
      "A proteção concede vários benefícios. As criaturas desses tipos têm desvantagem nas rolagens de ataque contra o alvo. O alvo também não pode ser encantado, amedrontado ou possuído por elas. Se o alvo já estiver encantado, amedrontado ou possuído por uma criatura desse tipo, o alvo terá vantagem em qualquer novo lance de defesa contra o efeito relevante."
    ],
    "material": "Água benta ou prata e ferro em pó, que o feitiço consome.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Protection from Poison": {
    "name": "Proteção contra veneno",
    "desc": [
      "Você toca uma criatura. Se ela estiver envenenada, você neutraliza o veneno. Se mais de um veneno afligir o alvo, você neutraliza um veneno que sabe que está presente ou neutraliza um aleatoriamente.",
      "Durante esse período, o alvo tem vantagem em lances de defesa contra envenenamento e tem resistência a dano de veneno."
    ],
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Purify Food and Drink": {
    "name": "Purificar alimentos e bebidas",
    "desc": [
      "Todos os alimentos e bebidas não mágicos em uma esfera de 1,5 m de raio centrada em um ponto de sua escolha dentro do alcance são purificados e ficam livres de veneno e doença."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Raise Dead": {
    "name": "Raise Dead",
    "desc": [
      "Você devolve à vida uma criatura morta que tenha tocado, desde que ela tenha morrido há menos de 10 dias. Se a alma da criatura estiver disposta e livre para se juntar ao corpo, a criatura volta à vida com 1 ponto de vida.",
      "Esse feitiço também neutraliza qualquer veneno e cura doenças não mágicas que afetavam a criatura no momento em que ela morreu. No entanto, esse feitiço não remove doenças mágicas, maldições ou efeitos semelhantes; se esses efeitos não forem removidos antes de lançar o feitiço, eles entrarão em vigor quando a criatura voltar à vida. O feitiço não pode devolver a vida a uma criatura morta-viva.",
      "Esse feitiço fecha todos os ferimentos mortais, mas não restaura partes do corpo que estejam faltando. Se a criatura estiver sem partes do corpo ou órgãos essenciais para sua sobrevivência - sua cabeça, por exemplo -, o feitiço falhará automaticamente.",
      "Voltar dos mortos é uma provação. O alvo sofre uma penalidade de -4 em todas as rolagens de ataque, jogadas de defesa e verificações de habilidade. Toda vez que o alvo termina um descanso longo, a penalidade é reduzida em 1 até desaparecer."
    ],
    "material": "Um diamante de pelo menos 500gp, que o feitiço consome.",
    "duration": "Instantâneo",
    "casting_time": "1 hora"
  },
  "Ray of Enfeeblement": {
    "name": "Ray of Enfeeblement",
    "desc": [
      "Um feixe negro de energia enervante sai de seu dedo em direção a uma criatura dentro do alcance. Faça um ataque mágico de longo alcance contra o alvo. Em caso de acerto, o alvo causa apenas metade do dano com ataques de armas que usam Força até que o feitiço termine.",
      "No final de cada um dos turnos do alvo, ele pode fazer um arremesso salvador de Constituição contra o feitiço. Se for bem-sucedido, o feitiço termina."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação",
    "attack_type": "variado"
  },
  "Ray of Frost": {
    "name": "Raio de gelo",
    "desc": [
      "Um feixe gélido de luz branco-azulada é lançado em direção a uma criatura dentro do alcance. Faça um ataque mágico de longo alcance contra o alvo. Em caso de acerto, ele recebe 1d8 de dano de frio e sua velocidade é reduzida em 3 metros até o início do seu próximo turno.",
      "O dano do feitiço aumenta em 1d8 quando você atinge o 5º nível (2d8), o 11º nível (3d8) e o 17º nível (4d8)."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "attack_type": "variado",
    "damage_type": "Frio"
  },
  "Regenerate": {
    "name": "Regenerar",
    "desc": [
      "Você toca uma criatura e estimula sua capacidade natural de cura. O alvo recupera 4d8 + 15 pontos de vida. Durante o período de duração do feitiço, o alvo recupera 1 ponto de vida no início de cada um de seus turnos (10 pontos de vida a cada minuto).",
      "Os membros cortados do corpo do alvo (dedos, pernas, caudas e assim por diante), se houver, são restaurados após 2 minutos. Se você tiver a parte cortada e segurá-la no coto, o feitiço fará com que o membro se una instantaneamente ao coto."
    ],
    "material": "Uma roda de oração e água benta.",
    "duration": "1 hora",
    "casting_time": "1 minuto"
  },
  "Reincarnate": {
    "name": "Reencarnação",
    "desc": [
      "Você toca um humanoide morto ou um pedaço de um humanoide morto. Desde que a criatura tenha morrido há menos de 10 dias, o feitiço forma um novo corpo adulto para ela e, em seguida, chama a alma para entrar nesse corpo. Se a alma do alvo não estiver livre ou disposta a fazer isso, o feitiço falha.",
      "A magia cria um novo corpo para a criatura habitar, o que provavelmente faz com que a raça da criatura mude. O GM rola um d 100 e consulta a tabela a seguir para determinar a forma que a criatura assume quando é restaurada à vida, ou o GM escolhe uma forma.",
      "| d100 | Raça |",
      "|---|---|",
      "| 01-04 | Dragonborn | Dragonborn",
      "| 05-13 | Anão, colina |",
      "| 14-21 | Anão, montanha",
      "| 22-25 | Elfo, escuro",
      "| 26-34 | Elfo, alto |",
      "| 35-42 | Elfo, madeira",
      "| 43-46 | Gnomo, floresta |",
      "| 47-52 | Gnomo, pedra |",
      "| 53-56 | Meio-elfo |",
      "| 57-60 | Meio-orc |",
      "| 61-68 | Halfling, pé leve",
      "| 69-76 | Halfling, robusto",
      "| 77-96 | Humanos |",
      "| 97-00 | Tiefling |",
      "A criatura reencarnada se lembra de sua vida e experiências anteriores. Ela mantém as capacidades que tinha em sua forma original, exceto que troca sua raça original pela nova e muda seus traços raciais de acordo."
    ],
    "material": "Óleos e unguentos raros com valor mínimo de 1.000 gp, que o feitiço consome.",
    "duration": "Instantâneo",
    "casting_time": "1 hora"
  },
  "Remove Curse": {
    "name": "Remover maldição",
    "desc": [
      "Ao seu toque, todas as maldições que afetam uma criatura ou objeto terminam. Se o objeto for um item mágico amaldiçoado, a maldição permanece, mas o feitiço quebra a sintonia do proprietário com o objeto para que ele possa ser removido ou descartado."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Resilient Sphere": {
    "name": "Esfera resiliente",
    "desc": [
      "Uma esfera de força cintilante envolve uma criatura ou objeto de tamanho Grande ou menor dentro do alcance. A criatura que não quiser deve fazer um arremesso de salvamento de destreza. Se a defesa falhar, a criatura fica envolta por toda a duração.",
      "Nada - nem objetos físicos, energia ou outros efeitos de feitiços - pode passar pela barreira, dentro ou fora dela, embora uma criatura na esfera possa respirar lá. A esfera é imune a todos os danos, e uma criatura ou objeto dentro dela não pode ser danificado por ataques ou efeitos provenientes do exterior, nem uma criatura dentro da esfera pode danificar qualquer coisa fora dela.",
      "A esfera não tem peso e é grande o suficiente para conter a criatura ou o objeto em seu interior. Uma criatura fechada pode usar sua ação para empurrar as paredes da esfera e, assim, rolar a esfera com até metade da velocidade da criatura. Da mesma forma, o globo pode ser pego e movido por outras criaturas.",
      "Um feitiço de desintegração direcionado ao globo o destrói sem prejudicar nada em seu interior."
    ],
    "material": "Uma peça hemisférica de cristal transparente e uma peça hemisférica correspondente de goma arábica.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Resistance": {
    "name": "Resistência",
    "desc": [
      "Você toca uma criatura disposta. Uma vez antes de o feitiço terminar, o alvo pode rolar um d4 e adicionar o número rolado a um lance de defesa de sua escolha. Ele pode rolar o dado antes ou depois de fazer o lance de defesa. O feitiço então termina."
    ],
    "material": "Uma capa em miniatura.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Resurrection": {
    "name": "Ressurreição",
    "desc": [
      "Você toca uma criatura morta há menos de um século, que não tenha morrido de velhice e que não seja um morto-vivo. Se a alma estiver livre e disposta, o alvo retornará à vida com todos os seus pontos de vida.",
      "Esse feitiço neutraliza qualquer veneno e cura doenças normais que afligiam a criatura quando ela morreu. No entanto, ele não remove doenças mágicas, maldições e similares; se esses efeitos não forem removidos antes de lançar o feitiço, eles afligirão o alvo quando ele retornar à vida.",
      "Esse feitiço fecha todos os ferimentos mortais e restaura qualquer parte do corpo que esteja faltando.",
      "Voltar dos mortos é uma provação. O alvo sofre uma penalidade de -4 em todas as rolagens de ataque, jogadas de defesa e verificações de habilidade. Toda vez que o alvo termina um descanso longo, a penalidade é reduzida em 1 até desaparecer.",
      "Lançar esse feitiço para restaurar a vida de uma criatura morta há um ano ou mais exige muito de você. Até que termine um descanso longo, você não poderá lançar feitiços novamente e terá desvantagem em todas as rolagens de ataque, verificações de habilidade e jogadas de defesa."
    ],
    "material": "Um diamante com valor mínimo de 1.000gp, que o feitiço consome.",
    "duration": "Instantâneo",
    "casting_time": "1 hora"
  },
  "Reverse Gravity": {
    "name": "Gravidade reversa",
    "desc": [
      "Esse feitiço reverte a gravidade em um cilindro de 50 pés de raio e 100 pés de altura centrado em um ponto dentro do alcance. Todas as criaturas e objetos que não estejam de alguma forma ancorados ao chão na área caem para cima e alcançam o topo da área quando você lança esse feitiço. Uma criatura pode fazer um arremesso salvador de destreza para se agarrar a um objeto fixo que possa alcançar, evitando assim a queda.",
      "Se algum objeto sólido (como um teto) for encontrado nessa queda, os objetos e criaturas em queda o atingirão da mesma forma que fariam em uma queda normal para baixo. Se um objeto ou criatura chegar ao topo da área sem atingir nada, ele permanecerá lá, oscilando levemente, durante todo o tempo.",
      "No final da duração, os objetos e criaturas afetados caem novamente."
    ],
    "material": "Uma pedra de amolar e limalha de ferro.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Revivify": {
    "name": "Revivificar",
    "desc": [
      "Você toca uma criatura que tenha morrido no último minuto. Essa criatura volta à vida com 1 ponto de vida. Esse feitiço não pode devolver a vida a uma criatura que tenha morrido de velhice, nem pode restaurar nenhuma parte do corpo que esteja faltando."
    ],
    "material": "Diamantes no valor de 300gp, que o feitiço consome.",
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Rope Trick": {
    "name": "Truque da corda",
    "desc": [
      "Você toca uma corda de até 60 pés de comprimento. Uma extremidade da corda se eleva no ar até que toda a corda fique pendurada perpendicularmente ao chão. Na extremidade superior da corda, uma entrada invisível se abre para um espaço extradimensional que dura até o fim do feitiço.",
      "O espaço extradimensional pode ser acessado subindo até o topo da corda. O espaço pode conter até oito criaturas médias ou menores. A corda pode ser puxada para dentro do espaço, fazendo com que a corda desapareça da vista fora do espaço.",
      "Ataques e feitiços não podem atravessar a entrada ou saída do espaço extradimensional, mas aqueles que estão dentro dele podem ver o que está acontecendo, como se estivessem em uma janela de 3 pés por 5 pés centralizada na corda.",
      "Tudo o que estiver dentro do espaço extradimensional sai quando o feitiço termina."
    ],
    "material": "Extrato de milho em pó e um pedaço de pergaminho torcido.",
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Sacred Flame": {
    "name": "Chama Sagrada",
    "desc": [
      "Um brilho semelhante a uma chama desce sobre uma criatura que você possa ver dentro do alcance. O alvo deve ser bem-sucedido em um arremesso salvador de destreza ou sofrerá 1d8 de dano radiante. O alvo não recebe o benefício de cobertura para esse lance de defesa.",
      "O dano do feitiço aumenta em 1d8 quando você atinge o 5º nível (2d8), o 11º nível (3d8) e o 17º nível (4d8)."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Radiante"
  },
  "Sanctuary": {
    "name": "Santuário",
    "desc": [
      "Você protege uma criatura dentro do alcance contra ataques. Até que o feitiço termine, qualquer criatura que tenha como alvo a criatura protegida com um ataque ou um feitiço nocivo deve primeiro fazer um arremesso de salvamento de sabedoria. Se a defesa falhar, a criatura deverá escolher um novo alvo ou perderá o ataque ou o feitiço. Esse feitiço não protege a criatura protegida de efeitos de área, como a explosão de uma bola de fogo.",
      "Se a criatura protegida fizer um ataque ou lançar um feitiço que afete uma criatura inimiga, esse feitiço termina."
    ],
    "material": "Um pequeno espelho prateado.",
    "duration": "1 minuto",
    "casting_time": "1 ação bônus"
  },
  "Scorching Ray": {
    "name": "Raio Escaldante",
    "desc": [
      "Você cria três raios de fogo e os arremessa contra alvos dentro do alcance. Você pode lançá-los em um alvo ou em vários.",
      "Faça um ataque mágico de longo alcance para cada raio. Em caso de acerto, o alvo recebe 2d6 de dano de fogo."
    ],
    "higher_level": [
      "Ao lançar esse feitiço usando um espaço de feitiço de 3º nível ou superior, você cria um raio adicional para cada nível de espaço acima do 2º."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Incêndio"
  },
  "Scrying": {
    "higher_level": [],
    "index": "scrying",
    "name": "Scrying",
    "desc": [
      "You can see and hear a particular creature you choose that is on the same plane of existence as you. The target must make a wisdom saving throw, which is modified by how well you know the target and the sort of physical connection you have to it. If a target knows you're casting this spell, it can fail the saving throw voluntarily if it wants to be observed.",
      "| Knowledge | Save Modifier |",
      "|---|---|",
      "| Secondhand (you have heard of the target) | +5 |",
      "| Firsthand (you have met the target) | +0 |",
      "| Familiar (you know the target well) | -5 |",
      "",
      "| Connection | Save Modifier |",
      "|---|---|",
      "| Likeness or picture | -2 |",
      "| Possession or garment | -4 |",
      "| Body part, lock of hair, bit of nail, or the like | -10 |",
      "On a successful save, the target isn't affected, and you can't use this spell against it again for 24 hours.",
      "On a failed save, the spell creates an invisible sensor within 10 feet of the target. You can see and hear through the sensor as if you were there. The sensor moves with the target, remaining within 10 feet of it for the duration. A creature that can see invisible objects sees the sensor as a luminous orb about the size of your fist.",
      "Instead of targeting a creature, you can choose a location you have seen before as the target of this spell. When you do, the sensor appears at that location and doesn't move."
    ],
    "range": "Self",
    "components": [
      "V",
      "S",
      "M"
    ],
    "material": "A focus worth at least 1,000 gp, such as a crystal ball, a silver mirror, or a font filled with holy water.",
    "ritual": false,
    "duration": "Up to 10 minutes",
    "concentration": true,
    "casting_time": "10 minutes",
    "level": 5,
    "dc": {
      "dc_type": {
        "index": "wis",
        "name": "WIS",
        "url": "/api/2014/ability-scores/wis"
      },
      "dc_success": "none"
    },
    "school": {
      "index": "divination",
      "name": "Adivinhação",
      "url": "/api/2014/magic-schools/divination"
    },
    "classes": [
      {
        "index": "bard",
        "name": "Bard",
        "url": "/api/2014/classes/bard"
      },
      {
        "index": "cleric",
        "name": "Cleric",
        "url": "/api/2014/classes/cleric"
      },
      {
        "index": "druid",
        "name": "Druid",
        "url": "/api/2014/classes/druid"
      },
      {
        "index": "warlock",
        "name": "Warlock",
        "url": "/api/2014/classes/warlock"
      },
      {
        "index": "wizard",
        "name": "Wizard",
        "url": "/api/2014/classes/wizard"
      }
    ],
    "subclasses": [
      {
        "index": "land",
        "name": "Land",
        "url": "/api/2014/subclasses/land"
      }
    ],
    "url": "/api/2014/spells/scrying",
    "updated_at": "2025-04-08T21:14:16.147Z"
  },
  "Secret Chest": {
    "name": "Baú Secreto",
    "desc": [
      "Você esconde um baú e todo o seu conteúdo no Plano Etéreo. Você deve tocar o baú e a réplica em miniatura que serve como componente material para o feitiço. O baú pode conter até 12 pés cúbicos de material não vivo (3 pés por 2 pés por 2 pés).",
      "Enquanto o baú permanecer no Plano Etéreo, você pode usar uma ação e tocar na réplica para recuperar o baú. Ele aparece em um espaço desocupado no chão a até 1,5 m de você. Você pode enviar o baú de volta ao Plano Etéreo usando uma ação e tocando o baú e a réplica.",
      "Após 60 dias, há uma chance cumulativa de 5% por dia de que o efeito do feitiço termine. Esse efeito termina se você lançar esse feitiço novamente, se a réplica menor do baú for destruída ou se você optar por encerrar o feitiço como uma ação. Se o feitiço terminar e o baú maior estiver no Plano Etéreo, ele será irremediavelmente perdido."
    ],
    "material": "Um baú requintado, de 1,5 m por 2 m por 2 m, construído com materiais raros no valor de pelo menos 5.000 gp, e uma réplica minúscula feita com os mesmos materiais no valor de pelo menos 50 gp.",
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "See Invisibility": {
    "name": "Ver Invisibilidade",
    "desc": [
      "Durante o período de duração do feitiço, você vê criaturas e objetos invisíveis como se fossem visíveis e pode ver através do Ethereal. Os objetos e criaturas etéreos parecem fantasmagoricamente translúcidos."
    ],
    "material": "Uma pitada de talco e uma pequena quantidade de pó de prata.",
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Seeming": {
    "name": "Parecendo",
    "desc": [
      "Esse feitiço permite que você mude a aparência de qualquer número de criaturas que você possa ver dentro do alcance. Você dá a cada alvo que escolher uma aparência nova e ilusória. Um alvo relutante pode fazer um arremesso salvador de carisma e, se for bem-sucedido, não será afetado por esse feitiço.",
      "O feitiço disfarça a aparência física, bem como roupas, armaduras, armas e equipamentos. Você pode fazer com que cada criatura pareça 1 pé mais baixa ou mais alta e pareça magra, gorda ou intermediária. Não é possível alterar o tipo de corpo do alvo, portanto, você deve escolher uma forma que tenha a mesma disposição básica de membros. Caso contrário, a extensão da ilusão fica a seu critério. O feitiço dura por toda a duração, a menos que você use sua ação para descartá-lo antes.",
      "As alterações feitas por esse feitiço não resistem à inspeção física. Por exemplo, se você usar esse feitiço para adicionar um chapéu à roupa de uma criatura, os objetos passarão pelo chapéu e qualquer pessoa que o tocar não sentirá nada ou sentirá a cabeça e o cabelo da criatura. Se você usar esse feitiço para parecer mais magro do que é, a mão de alguém que estender a mão para tocá-lo esbarrará em você enquanto estiver aparentemente parado no ar.",
      "Uma criatura pode usar sua ação para inspecionar um alvo e fazer um teste de Inteligência (Investigação) contra o seu DC de proteção de feitiço. Se for bem-sucedida, ela fica sabendo que o alvo está disfarçado."
    ],
    "duration": "8 horas",
    "casting_time": "1 ação"
  },
  "Sending": {
    "name": "Envio",
    "desc": [
      "Você envia uma mensagem curta de vinte e cinco palavras ou menos a uma criatura com a qual está familiarizado. A criatura ouve a mensagem em sua mente, reconhece você como o remetente, caso o conheça, e pode responder de forma semelhante imediatamente. O feitiço permite que criaturas com escores de Inteligência de pelo menos 1 entendam o significado de sua mensagem.",
      "Você pode enviar a mensagem a qualquer distância e até mesmo a outros planos de existência, mas se o alvo estiver em um plano diferente do seu, há uma chance de 5% de a mensagem não chegar."
    ],
    "material": "Um pedaço curto de fio de cobre fino.",
    "duration": "1 rodada",
    "casting_time": "1 ação"
  },
  "Sequester": {
    "name": "Sequestro",
    "desc": [
      "Por meio desse feitiço, uma criatura ou um objeto disposto pode ser escondido e ficar a salvo de detecção durante todo o tempo. Quando você lança o feitiço e toca o alvo, ele se torna invisível e não pode ser alvo de feitiços de adivinhação ou percebido por meio de sensores de vidência criados por feitiços de adivinhação.",
      "Se o alvo for uma criatura, ela entrará em um estado de animação suspensa. O tempo deixa de fluir para ela e ela não envelhece.",
      "Você pode definir uma condição para que o feitiço termine mais cedo. A condição pode ser qualquer coisa que você escolher, mas deve ocorrer ou ser visível em um raio de 1 milha do alvo. Os exemplos incluem \"após 1.000 anos\" ou \"quando o tarrasque despertar\". Esse feitiço também termina se o alvo sofrer algum dano."
    ],
    "material": "Um pó composto de diamante, esmeralda, rubi e pó de safira com valor mínimo de 5.000 libras esterlinas, que o feitiço consome.",
    "duration": "Até que seja dissipado",
    "casting_time": "1 ação"
  },
  "Shapechange": {
    "name": "Mudança de forma",
    "desc": [
      "Você assume a forma de uma criatura diferente durante esse período. A nova forma pode ser de qualquer criatura com um grau de desafio igual ou inferior ao seu nível. A criatura não pode ser um construto ou um morto-vivo, e você deve ter visto esse tipo de criatura pelo menos uma vez. Você se transforma em um exemplo comum dessa criatura, sem nenhum nível de classe ou característica de conjuração.",
      "Suas estatísticas de jogo são substituídas pelas estatísticas da criatura escolhida, embora você mantenha seu alinhamento e suas pontuações de Inteligência, Sabedoria e Carisma. Você também mantém todas as suas proficiências de habilidade e de arremesso salvador, além de ganhar as da criatura. Se a criatura tiver a mesma proficiência que você e o bônus listado nas estatísticas dela for maior que o seu, use o bônus da criatura no lugar do seu. Você não pode usar nenhuma ação lendária ou ação de covil da nova forma.",
      "Você assume os pontos de vida e os dados de acerto da nova forma. Ao voltar à sua forma normal, você retorna ao número de pontos de vida que tinha antes da transformação. Se você reverter como resultado de cair para 0 hit points, qualquer excesso de dano será transferido para sua forma normal. Desde que o excesso de dano não reduza sua forma normal a 0 pontos de vida, você não ficará inconsciente.",
      "Você mantém o benefício de quaisquer características de sua classe, raça ou outra fonte e pode usá-las, desde que sua nova forma seja fisicamente capaz de fazê-lo. Você não pode usar nenhum sentido especial que possua (por exemplo, visão escura) a menos que sua nova forma também tenha esse sentido. Você só pode falar se a criatura puder falar normalmente.",
      "Ao se transformar, você escolhe se o seu equipamento cai no chão, se funde com a nova forma ou é usado por ela. O equipamento usado funciona normalmente. O GM determina se é prático para a nova forma usar uma peça de equipamento, com base na forma e no tamanho da criatura. Seu equipamento não muda de forma ou tamanho para se adequar à nova forma, e qualquer equipamento que a nova forma não possa usar deve cair no chão ou se fundir à sua nova forma. Os equipamentos que se fundem não têm efeito nesse estado.",
      "Durante a duração desse feitiço, você pode usar sua ação para assumir uma forma diferente, seguindo as mesmas restrições e regras da forma original, com uma exceção: se sua nova forma tiver mais pontos de vida do que a atual, seus pontos de vida permanecerão no valor atual."
    ],
    "material": "Um anel de jade com valor mínimo de 1.500 gp, que você deve colocar na cabeça antes de lançar o feitiço.",
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Shatter": {
    "name": "Quebra",
    "desc": [
      "Um ruído repentino e alto, dolorosamente intenso, irrompe de um ponto de sua escolha dentro do alcance. Cada criatura em uma esfera de 3 metros de raio centrada nesse ponto deve fazer um arremesso de defesa de Constituição. Uma criatura recebe 3d8 de dano de trovão se a defesa falhar, ou metade do dano se for bem-sucedida. Uma criatura feita de material inorgânico, como pedra, cristal ou metal, tem desvantagem nesse arremesso de defesa.",
      "Um item não mágico que não esteja sendo usado ou carregado também sofrerá dano se estiver na área do feitiço."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço para feitiço de nível 3 ou superior, o dano do feitiço aumenta em 1d8 para cada nível de espaço para feitiço superior a 2."
    ],
    "material": "Uma explosão de mica.",
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Trovão"
  },
  "Shield": {
    "name": "Escudo",
    "desc": [
      "Uma barreira invisível de força mágica aparece e o protege. Até o início do seu próximo turno, você tem um bônus de +5 na CA, inclusive contra o ataque desencadeante, e não sofre dano de mísseis mágicos."
    ],
    "duration": "1 rodada",
    "casting_time": "1 reação"
  },
  "Shield of Faith": {
    "name": "Escudo da fé",
    "desc": [
      "Um campo cintilante aparece e envolve uma criatura de sua escolha dentro do alcance, concedendo a ela um bônus de +2 na CA enquanto durar."
    ],
    "material": "Um pequeno pergaminho com um pouco de texto sagrado escrito nele.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação bônus"
  },
  "Shillelagh": {
    "name": "Shillelagh",
    "desc": [
      "A madeira de uma clava ou de um bastão que você estiver segurando está imbuída do poder da natureza. Durante esse período, você pode usar sua habilidade de conjuração em vez de Força para as rolagens de ataque e dano de ataques corpo a corpo usando essa arma, e o dado de dano da arma se torna um d8. A arma também se torna mágica, se ainda não for. O feitiço termina se você o lançar novamente ou se soltar a arma."
    ],
    "material": "Visco, uma folha de trevo e um porrete ou bastão.",
    "duration": "1 minuto",
    "casting_time": "1 ação bônus"
  },
  "Shocking Grasp": {
    "name": "Aperto chocante",
    "desc": [
      "Um raio sai de sua mão para dar um choque em uma criatura que você tentar tocar. Faça um ataque mágico corpo a corpo contra o alvo. Você tem vantagem na rolagem de ataque se o alvo estiver usando uma armadura feita de metal. Em caso de acerto, o alvo recebe 1d8 de dano de raio e não pode realizar reações até o início do próximo turno.",
      "O dano do feitiço aumenta em 1d8 quando você atinge o 5º nível (2d8), o 11º nível (3d8) e o 17º nível (4d8)."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "attack_type": "corpo a corpo",
    "damage_type": "Relâmpagos"
  },
  "Silence": {
    "name": "Silêncio",
    "desc": [
      "Durante esse período, nenhum som pode ser criado ou passar por uma esfera de 20 pés de raio centrada em um ponto que você escolher dentro do alcance. Qualquer criatura ou objeto totalmente dentro da esfera é imune a dano de trovão, e as criaturas ficam surdas enquanto estiverem totalmente dentro dela.",
      "Lançar um feitiço que inclua um componente verbal é impossível lá."
    ],
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Silent Image": {
    "name": "Imagem silenciosa",
    "desc": [
      "Você cria a imagem de um objeto, uma criatura ou algum outro fenômeno visível que não seja maior do que um cubo de 15 pés. A imagem aparece em um ponto dentro do alcance e dura a duração. A imagem é puramente visual; não é acompanhada de som, cheiro ou outros efeitos sensoriais.",
      "Você pode usar sua ação para fazer com que a imagem se mova para qualquer ponto dentro do alcance. À medida que a imagem muda de local, você pode alterar sua aparência para que os movimentos pareçam naturais para a imagem. Por exemplo, se você criar uma imagem de uma criatura e movê-la, poderá alterar a imagem para que ela pareça estar andando.",
      "A interação física com a imagem revela que ela é uma ilusão, pois as coisas podem passar por ela. Uma criatura que use sua ação para examinar a imagem pode determinar que se trata de uma ilusão com um teste bem-sucedido de Inteligência (Investigação) contra sua CD de proteção contra feitiço. Se uma criatura discernir a ilusão pelo que ela é, ela poderá ver através da imagem."
    ],
    "material": "Um pouco de lã.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Simulacrum": {
    "name": "Simulacrum",
    "desc": [
      "Você forma uma duplicata ilusória de uma fera ou humanoide que esteja dentro do alcance durante todo o tempo de lançamento do feitiço. A duplicata é uma criatura, parcialmente real e formada de gelo ou neve, e pode realizar ações e ser afetada como uma criatura normal. Ela parece ser igual à original, mas tem metade do máximo de pontos de vida da criatura e é formada sem nenhum equipamento. Além disso, a ilusão usa todas as estatísticas da criatura que ela duplica.",
      "O simulacro é amigável com você e com as criaturas que você designar. Ele obedece aos seus comandos falados, movendo-se e agindo de acordo com seus desejos e agindo no seu turno em combate. O simulacro não tem a capacidade de aprender ou se tornar mais poderoso, portanto, nunca aumenta seu nível ou outras habilidades, nem pode recuperar espaços de feitiços gastos.",
      "Se o simulacro for danificado, você poderá repará-lo em um laboratório alquímico, usando ervas e minerais raros no valor de 100 gp por ponto de vida que ele recuperar. O simulacro dura até chegar a 0 pontos de vida, quando então se transforma em neve e derrete instantaneamente.",
      "Se você lançar esse feitiço novamente, todas as duplicatas ativas no momento que você criou com esse feitiço serão destruídas instantaneamente."
    ],
    "material": "Neve ou gelo em quantidade suficiente para fazer uma cópia em tamanho real da criatura duplicada; alguns fios de cabelo, cortes de unha ou outro pedaço do corpo da criatura colocado dentro da neve ou do gelo; e rubi em pó no valor de 1.500 gp, polvilhado sobre a duplicata e consumido pelo feitiço.",
    "duration": "Até que seja dissipado",
    "casting_time": "12 horas"
  },
  "Sleep": {
    "name": "Dormir",
    "desc": [
      "Esse feitiço faz com que as criaturas entrem em um sono mágico. Role 5d8; o total é o número de pontos de vida das criaturas que esse feitiço pode afetar. As criaturas em um raio de 6 metros de um ponto que você escolher dentro do alcance são afetadas em ordem crescente de seus pontos de vida atuais (ignorando as criaturas inconscientes).",
      "Começando com a criatura que tem os pontos de vida atuais mais baixos, cada criatura afetada por esse feitiço fica inconsciente até que o feitiço termine, o adormecido sofra dano ou alguém use uma ação para sacudir ou dar um tapa no adormecido para acordá-lo. Subtraia os pontos de vida de cada criatura do total antes de passar para a criatura com os próximos pontos de vida mais baixos. Os pontos de vida de uma criatura devem ser iguais ou inferiores ao total restante para que ela seja afetada.",
      "Mortos-vivos e criaturas imunes a serem encantados não são afetados por esse feitiço."
    ],
    "higher_level": [
      "Quando você lançar esse feitiço usando um espaço de feitiço de 2º nível ou superior, role 2d8 adicionais para cada nível de espaço acima do 1º."
    ],
    "material": "Uma pitada de areia fina, pétalas de rosa ou um grilo.",
    "duration": "1 minuto",
    "casting_time": "1 ação"
  },
  "Sleet Storm": {
    "name": "Tempestade de granizo",
    "desc": [
      "Até que o feitiço termine, a chuva congelante e o granizo caem em um cilindro de 20 pés de altura com um raio de 40 pés centrado em um ponto que você escolher dentro do alcance. A área é fortemente obscurecida, e as chamas expostas na área são apagadas.",
      "O solo na área é coberto por gelo escorregadio, o que torna o terreno difícil. Quando uma criatura entra na área do feitiço pela primeira vez em um turno ou começa seu turno ali, ela deve fazer um arremesso salvador de destreza. Se a defesa falhar, ela cai de bruços.",
      "Se uma criatura estiver se concentrando na área do feitiço, ela deverá fazer um lance de defesa de constituição bem-sucedido contra a sua CD de defesa de feitiço ou perderá a concentração."
    ],
    "material": "Uma pitada de pó e algumas gotas de água.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Slow": {
    "name": "Lento",
    "desc": [
      "Você altera o tempo em torno de até seis criaturas de sua escolha em um cubo de 12 metros dentro do alcance. Cada alvo deve ser bem-sucedido em um arremesso de sabedoria ou será afetado por esse feitiço durante toda a duração.",
      "A velocidade do alvo afetado é reduzida à metade, ele sofre uma penalidade de -2 na CA e nos lançamentos de defesa de destreza e não pode usar reações. Em seu turno, ele pode usar uma ação ou uma ação bônus, mas não ambas. Independentemente das habilidades ou itens mágicos da criatura, ela não pode fazer mais de um ataque corpo a corpo ou à distância durante seu turno.",
      "Se a criatura tentar lançar um feitiço com um tempo de lançamento de 1 ação, role um d20. Com um 11 ou mais, o feitiço não entrará em vigor até o próximo turno da criatura, e ela deverá usar sua ação nesse turno para completar o feitiço. Se não conseguir, o feitiço é desperdiçado.",
      "Uma criatura afetada por esse feitiço faz outro lance de defesa de sabedoria no final de seu turno. Se a defesa for bem-sucedida, o efeito termina para ela."
    ],
    "material": "Uma gota de melaço.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Spare the Dying": {
    "name": "Poupe os moribundos",
    "desc": [
      "Você toca uma criatura viva que tenha 0 pontos de vida. A criatura se torna estável. Esse feitiço não tem efeito sobre mortos-vivos ou construtos."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Speak with Animals": {
    "name": "Fale com os animais",
    "desc": [
      "Você ganha a capacidade de compreender e se comunicar verbalmente com feras durante esse período. O conhecimento e a percepção de muitas feras são limitados pela inteligência delas, mas, no mínimo, as feras podem lhe dar informações sobre locais e monstros próximos, incluindo tudo o que elas podem perceber ou perceberam no último dia. Talvez você consiga persuadir uma fera a fazer um pequeno favor para você, a critério do MJ."
    ],
    "duration": "10 minutos",
    "casting_time": "1 ação"
  },
  "Speak with Dead": {
    "name": "Falar com os mortos",
    "desc": [
      "Você concede a aparência de vida e inteligência a um cadáver de sua escolha dentro do alcance, permitindo que ele responda às perguntas que você fizer. O cadáver ainda deve ter uma boca e não pode ser um morto-vivo. O feitiço falha se o cadáver tiver sido alvo desse feitiço nos últimos 10 dias.",
      "Até o fim do feitiço, você pode fazer até cinco perguntas ao cadáver. O cadáver sabe apenas o que sabia em vida, inclusive os idiomas que conhecia. As respostas geralmente são breves, enigmáticas ou repetitivas, e o cadáver não é obrigado a oferecer uma resposta verdadeira se você for hostil a ele ou se ele o reconhecer como inimigo. Esse feitiço não devolve a alma da criatura ao seu corpo, apenas seu espírito animador. Portanto, o cadáver não pode aprender novas informações, não compreende nada que tenha acontecido desde que morreu e não pode especular sobre eventos futuros."
    ],
    "material": "Queima de incenso.",
    "duration": "10 minutos",
    "casting_time": "1 ação"
  },
  "Speak with Plants": {
    "name": "Fale com as plantas",
    "desc": [
      "Você imbui as plantas em um raio de 30 pés de você com sensibilidade e animação limitadas, dando a elas a capacidade de se comunicar com você e seguir seus comandos simples. Você pode questionar as plantas sobre eventos ocorridos na área do feitiço no último dia, obtendo informações sobre criaturas que passaram, clima e outras circunstâncias.",
      "Você também pode transformar o terreno difícil causado pelo crescimento de plantas (como matagais e vegetação rasteira) em terreno comum que dura a duração. Ou você pode transformar um terreno comum onde há plantas em um terreno difícil que dura por toda a duração, fazendo com que as vinhas e os galhos atrapalhem os perseguidores, por exemplo.",
      "As plantas podem ser capazes de realizar outras tarefas em seu nome, a critério do GM. O feitiço não permite que as plantas se desenraízem e se movimentem, mas elas podem mover livremente galhos, gavinhas e caules.",
      "Se uma criatura vegetal estiver na área, você poderá se comunicar com ela como se tivesse um idioma em comum, mas não ganhará nenhuma habilidade mágica para influenciá-la.",
      "Esse feitiço pode fazer com que as plantas criadas pelo feitiço de emaranhamento liberem uma criatura presa."
    ],
    "duration": "10 minutos",
    "casting_time": "1 ação"
  },
  "Spider Climb": {
    "name": "Escalada de aranha",
    "desc": [
      "Até o fim do feitiço, uma criatura disposta que você tocar ganha a habilidade de se mover para cima, para baixo e através de superfícies verticais e de cabeça para baixo ao longo de tetos, deixando as mãos livres. O alvo também ganha uma velocidade de escalada igual à sua velocidade de caminhada."
    ],
    "material": "Uma gota de betume e uma aranha.",
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Spike Growth": {
    "name": "Crescimento do pico",
    "desc": [
      "O solo em um raio de 6 metros centrado em um ponto dentro do alcance se retorce e brota espinhos e pontas duras. A área se torna um terreno difícil durante esse período. Quando uma criatura se move para a área ou dentro dela, ela recebe 2d4 de dano penetrante para cada 1,5 metro que percorrer.",
      "A transformação do solo é camuflada para parecer natural. Qualquer criatura que não possa ver a área no momento em que o feitiço é lançado pode fazer um teste de Sabedoria (Percepção) contra a sua CD de proteção contra feitiço para reconhecer o terreno como perigoso antes de entrar nele."
    ],
    "material": "Sete espinhos afiados ou sete galhos pequenos, cada um afiado em uma ponta.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Spirit Guardians": {
    "name": "Guardiões espirituais",
    "desc": [
      "Você invoca espíritos para protegê-lo. Eles voam ao seu redor a uma distância de 3,5 metros durante todo o tempo. Eles voam ao seu redor a uma distância de 15 pés durante o período. Se você for bom ou neutro, a forma espectral deles parecerá angelical ou feérica (à sua escolha). Se você for do mal, eles parecerão demoníacos.",
      "Ao lançar esse feitiço, você pode designar qualquer número de criaturas que possa ver para não serem afetadas por ele. A velocidade de uma criatura afetada é reduzida à metade na área e, quando a criatura entra na área pela primeira vez em um turno ou começa o seu turno nessa área, ela deve fazer um arremesso de defesa de sabedoria. Se a defesa falhar, a criatura sofrerá 3d8 de dano radiante (se você for bom ou neutro) ou 3d8 de dano necrótico (se você for mau). Em um salvamento bem-sucedido, a criatura recebe metade do dano."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 4º nível ou superior, o dano aumenta em 1d8 para cada nível de espaço acima do 3º."
    ],
    "material": "Um símbolo sagrado.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Spiritual Weapon": {
    "name": "Arma espiritual",
    "desc": [
      "Você cria uma arma espectral flutuante dentro do alcance que dura a duração ou até que você lance esse feitiço novamente. Ao lançar o feitiço, você pode fazer um ataque mágico corpo a corpo contra uma criatura em um raio de 1,5 m da arma. Em caso de acerto, o alvo recebe dano de força igual a 1d8 + seu modificador de habilidade de lançamento de feitiço.",
      "Como uma ação bônus no seu turno, você pode mover a arma até 6 metros e repetir o ataque contra uma criatura a até 1,5 metro dela.",
      "A arma pode assumir a forma que você escolher. Os clérigos de divindades associadas a uma arma específica (como São Cuthbert é conhecido por sua maça e Thor por seu martelo) fazem com que o efeito desse feitiço se assemelhe a essa arma."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 3º nível ou superior, o dano aumenta em 1d8 para cada dois níveis de espaço acima do 2º."
    ],
    "duration": "1 minuto",
    "casting_time": "1 ação bônus",
    "attack_type": "corpo a corpo",
    "damage_type": "Força"
  },
  "Stinking Cloud": {
    "name": "Nuvem fétida",
    "desc": [
      "Você cria uma esfera de gás amarelo e nauseante com 20 pés de raio, centrada em um ponto dentro do alcance. A nuvem se espalha pelos cantos e sua área é fortemente obscurecida. A nuvem permanece no ar por toda a duração.",
      "Cada criatura que estiver completamente dentro da nuvem no início de seu turno deve fazer um arremesso salvador de constituição contra o veneno. Se a defesa falhar, a criatura gasta sua ação naquele turno vomitando e se contorcendo. As criaturas que não precisam respirar ou que são imunes a veneno são automaticamente bem-sucedidas nesse arremesso de defesa.",
      "Um vento moderado (pelo menos 10 milhas por hora) dispersa a nuvem após 4 rodadas. Um vento forte (pelo menos 32 quilômetros por hora) a dispersa após 1 rodada."
    ],
    "material": "Um ovo podre ou várias folhas de repolho de gambá.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Stone Shape": {
    "name": "Forma da pedra",
    "desc": [
      "Você toca em um objeto de pedra de tamanho médio ou menor ou em uma seção de pedra de no máximo 1,5 metro em qualquer dimensão e o transforma em qualquer forma que se adeque ao seu objetivo. Assim, por exemplo, você pode transformar uma pedra grande em uma arma, ídolo ou cofre, ou fazer uma pequena passagem através de uma parede, desde que a parede tenha menos de 1,5 metro de espessura. Você também pode moldar uma porta de pedra ou sua moldura para fechar a porta. O objeto que você criar pode ter até duas dobradiças e um trinco, mas não é possível obter detalhes mecânicos mais finos."
    ],
    "material": "Argila macia, a ser trabalhada grosseiramente na forma desejada para o objeto de pedra.",
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Stoneskin": {
    "name": "Pele de pedra",
    "desc": [
      "Esse feitiço torna a carne de uma criatura disposta que você tocar tão dura quanto pedra. Até que o feitiço termine, o alvo tem resistência a dano não mágico de arma branca, perfurante e cortante."
    ],
    "material": "Pó de diamante no valor de 100 gp, que o feitiço consome.",
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Storm of Vengeance": {
    "name": "Tempestade de vingança",
    "desc": [
      "Forma-se uma nuvem de tempestade agitada, centrada em um ponto que você pode ver e que se espalha em um raio de 360 pés. Os relâmpagos brilham na área, os trovões explodem e os ventos fortes rugem. Cada criatura sob a nuvem (não mais do que 1.000 pés abaixo da nuvem) quando ela aparece deve fazer um arremesso de defesa de Constituição. Se o salvamento falhar, a criatura recebe 2d6 de dano de trovão e fica ensurdecida por 5 minutos.",
      "A cada rodada em que você mantém a concentração nesse feitiço, a tempestade produz efeitos adicionais no seu turno.",
      "***Chuva ácida cai da nuvem. Cada criatura e objeto sob a nuvem recebe 1d6 de dano de ácido.",
      "***Você invoca seis relâmpagos da nuvem para atingir seis criaturas ou objetos de sua escolha abaixo da nuvem. Uma determinada criatura ou objeto não pode ser atingido por mais de um raio. A criatura atingida deve fazer um arremesso salvador de destreza. A criatura recebe 10d6 de dano de raio se a defesa falhar, ou metade do dano se for bem-sucedida.",
      "***Chuva de granizo da nuvem. Cada criatura sob a nuvem recebe 2d6 de dano de arma branca.",
      "***Rajadas e chuva congelante atacam a área sob a nuvem. A área se torna um terreno difícil e fica fortemente obscurecida. Cada criatura que estiver lá recebe 1d6 de dano de frio. Ataques com armas de longo alcance na área são impossíveis. O vento e a chuva contam como uma distração grave para fins de manter a concentração em feitiços. Por fim, rajadas de vento forte (variando de 30 a 50 milhas por hora) dispersam automaticamente a neblina, as névoas e fenômenos semelhantes na área, sejam eles mundanos ou mágicos."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação",
    "damage_type": "Trovão"
  },
  "Suggestion": {
    "name": "Sugestão",
    "desc": [
      "Você sugere um curso de atividade (limitado a uma ou duas frases) e influencia magicamente uma criatura que você possa ver dentro do alcance e que possa ouvir e entender você. As criaturas que não podem ser encantadas são imunes a esse efeito. A sugestão deve ser redigida de modo a fazer com que o curso de ação pareça razoável. Pedir que a criatura se apunhale, se jogue em uma lança, se imole ou faça algum outro ato obviamente prejudicial encerra o feitiço.",
      "O alvo deve fazer um arremesso de sabedoria. Se o salvamento falhar, ele seguirá o curso de ação descrito por você da melhor forma possível. O curso de ação sugerido pode continuar por toda a duração. Se a atividade sugerida puder ser concluída em um período mais curto, o feitiço termina quando o sujeito terminar o que foi solicitado a fazer.",
      "Você também pode especificar condições que acionarão uma atividade especial durante a duração. Por exemplo, você pode sugerir que um cavaleiro dê seu cavalo de guerra ao primeiro mendigo que encontrar. Se a condição não for atendida antes da expiração do feitiço, a atividade não será realizada.",
      "Se você ou qualquer um de seus companheiros causar dano ao alvo, o feitiço termina."
    ],
    "material": "Uma língua de cobra e um pouco de favo de mel ou uma gota de óleo doce.",
    "duration": "Até 8 horas",
    "casting_time": "1 ação"
  },
  "Sunbeam": {
    "name": "Raio de sol",
    "desc": [
      "Um feixe de luz brilhante sai da sua mão em uma linha de 5 pés de largura e 60 pés de comprimento. Cada criatura na linha deve fazer um arremesso de salvamento de constituição. Se o salvamento falhar, a criatura recebe 6d8 de dano radiante e fica cega até o seu próximo turno. Em um salvamento bem-sucedido, ela recebe metade do dano e não é cegada por esse feitiço. Mortos-vivos e gosmas têm desvantagem nesse lance de defesa.",
      "Você pode criar uma nova linha de radiância como sua ação em qualquer turno até que o feitiço termine.",
      "Durante esse período, um cisco de brilho resplandecente brilha em sua mão. Ele emite uma luz brilhante em um raio de 30 pés e uma luz fraca por mais 30 pés. Essa luz é a luz do sol."
    ],
    "material": "Uma lente de aumento.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação",
    "damage_type": "Radiante"
  },
  "Sunburst": {
    "name": "Sunburst",
    "desc": [
      "A luz solar brilhante pisca em um raio de 60 pés centrado em um ponto que você escolher dentro do alcance. Cada criatura nessa luz deve fazer um arremesso de defesa de constituição. Se a defesa falhar, a criatura recebe 12d6 de dano radiante e fica cega por 1 minuto. Em um salvamento bem-sucedido, ela recebe metade do dano e não é cegada por esse feitiço. Mortos-vivos e gosmas têm desvantagem nesse arremesso de defesa.",
      "Uma criatura cegada por esse feitiço faz outro arremesso de defesa de constituição no final de cada um de seus turnos. Se a defesa for bem-sucedida, ela não ficará mais cega.",
      "Esse feitiço dissipa qualquer escuridão em sua área que tenha sido criada por um feitiço."
    ],
    "material": "Fogo e um pedaço de pedra do sol.",
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Radiante"
  },
  "Symbol": {
    "name": "Símbolo",
    "desc": [
      "Ao lançar esse feitiço, você inscreve um glifo prejudicial em uma superfície (como uma seção do piso, uma parede ou uma mesa) ou dentro de um objeto que possa ser fechado para ocultar o glifo (como um livro, um pergaminho ou um baú de tesouro). Se você escolher uma superfície, o glifo poderá cobrir uma área da superfície que não exceda 3 metros de diâmetro. Se você escolher um objeto, esse objeto deve permanecer em seu lugar; se o objeto for movido a mais de 3 metros de onde você lançou esse feitiço, o glifo será quebrado e o feitiço terminará sem ser acionado.",
      "O glifo é quase invisível, exigindo um teste de Inteligência (Investigação) contra a sua CD de proteção contra feitiço para encontrá-lo.",
      "Você decide o que aciona o glifo quando lança o feitiço. Para glifos inscritos em uma superfície, os gatilhos mais comuns incluem tocar ou pisar no glifo, remover outro objeto que o cubra, aproximar-se a uma certa distância dele ou manipular o objeto que o contém. Para glifos inscritos em um objeto, os gatilhos mais comuns são abrir o objeto, aproximar-se a uma certa distância dele ou ver ou ler o glifo.",
      "Você pode refinar ainda mais o gatilho para que o feitiço seja ativado somente em determinadas circunstâncias ou de acordo com as características físicas de uma criatura (como altura ou peso) ou tipo físico (por exemplo, a ala pode ser definida para afetar bruxas ou metamorfos). Você também pode especificar criaturas que não ativam o glifo, como aquelas que dizem uma determinada senha.",
      "Quando você inscrever o glifo, escolha uma das opções abaixo para o efeito. Uma vez acionado, o glifo brilha, preenchendo uma esfera de 60 pés de raio com luz fraca por 10 minutos, após os quais o feitiço termina. Cada criatura na esfera quando o glifo é ativado é alvo de seu efeito, assim como uma criatura que entra na esfera pela primeira vez em um turno ou termina seu turno ali.",
      "***Cada alvo deve fazer um arremesso de salvamento de Constituição, recebendo 10d 10 de dano necrótico se o salvamento falhar, ou metade do dano se o salvamento for bem-sucedido.",
      "***Discórdia *** Cada alvo deve fazer um arremesso de salvamento de constituição. Se o salvamento falhar, o alvo discute e briga com outras criaturas por 1 minuto. Durante esse tempo, ele é incapaz de se comunicar de forma significativa e tem desvantagem em rolagens de ataque e verificações de habilidade.",
      "***Medo: Cada alvo deve fazer um arremesso de sabedoria e fica assustado por 1 minuto se o arremesso falhar. Enquanto estiver assustado, o alvo larga o que estiver segurando e deve se afastar pelo menos 30 pés do glifo em cada um de seus turnos, se for capaz.",
      "***Desespero *** Cada alvo deve fazer um arremesso de salvamento de carisma. Se o salvamento falhar, o alvo é dominado pelo desespero por 1 minuto. Durante esse período, o alvo não pode atacar nem atingir nenhuma criatura com habilidades prejudiciais, feitiços ou outros efeitos mágicos.",
      "***Insanidade *** Cada alvo deve fazer um lance de salvamento de inteligência. Se o salvamento falhar, o alvo ficará insano por 1 minuto. Uma criatura insana não pode realizar ações, não pode entender o que as outras criaturas dizem, não pode ler e fala apenas em linguagem sem sentido. O GM controla seu movimento, que é irregular.",
      "***Dor. Cada alvo deve fazer um lance de salvamento de Constituição e fica incapacitado com dor excruciante por 1 minuto se o salvamento falhar.",
      "***Cada alvo deve fazer um arremesso de sabedoria e, se o arremesso falhar, fica inconsciente por 10 minutos. A criatura desperta se sofrer dano ou se alguém usar uma ação para sacudi-la ou dar um tapa para acordá-la.",
      "***Atordoamento: Cada alvo deve fazer um lançamento de salvamento de sabedoria e fica atordoado por 1 minuto se o lançamento falhar."
    ],
    "material": "Mercúrio, fósforo e diamante e opala em pó com um valor total de pelo menos 1.000 gp, que o feitiço consome.",
    "duration": "Até que seja dissipado",
    "casting_time": "1 minuto"
  },
  "Telekinesis": {
    "name": "Telecinesia",
    "desc": [
      "Você ganha a habilidade de mover ou manipular criaturas ou objetos pelo pensamento. Ao lançar o feitiço e como sua ação a cada rodada durante o período de duração, você pode exercer sua vontade em uma criatura ou objeto que possa ver dentro do alcance, causando o efeito apropriado abaixo. Você pode afetar o mesmo alvo rodada após rodada ou escolher um novo alvo a qualquer momento. Se você trocar de alvo, o alvo anterior não será mais afetado pelo feitiço.",
      "***Criatura.*** Você pode tentar mover uma criatura Enorme ou menor. Faça uma verificação de habilidade com sua habilidade de conjuração contestada pela verificação de Força da criatura. Se vencer a disputa, você moverá a criatura até 30 pés em qualquer direção, inclusive para cima, mas não além do alcance desse feitiço. Até o final do seu próximo turno, a criatura fica presa em sua garra telecinética. Uma criatura levantada para cima fica suspensa em pleno ar.",
      "Nas rodadas subsequentes, você pode usar sua ação para tentar manter seu controle telecinético sobre a criatura, repetindo a disputa.",
      "***Objeto *** Você pode tentar mover um objeto que pese até 1.000 libras. Se o objeto não estiver sendo usado ou carregado, você o moverá automaticamente até 30 pés em qualquer direção, mas não além do alcance desse feitiço.",
      "Se o objeto for usado ou carregado por uma criatura, você deve fazer uma verificação de habilidade com a sua habilidade de conjuração contestada pela verificação de Força da criatura. Se for bem-sucedido, você puxa o objeto para longe da criatura e pode movê-lo até 30 pés em qualquer direção, mas não além do alcance desse feitiço.",
      "Você pode exercer controle fino sobre objetos com sua garra telecinética, como manipular uma ferramenta simples, abrir uma porta ou um recipiente, guardar ou recuperar um item de um recipiente aberto ou despejar o conteúdo de um frasco."
    ],
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Telepathic Bond": {
    "name": "Ligação telepática",
    "desc": [
      "Você cria um vínculo telepático entre até oito criaturas voluntárias de sua escolha dentro do alcance, ligando psiquicamente cada criatura a todas as outras durante o período. As criaturas com escore de Inteligência igual ou inferior a 2 não são afetadas por esse feitiço.",
      "Até que o feitiço termine, os alvos podem se comunicar telepaticamente por meio do vínculo, independentemente de terem ou não um idioma em comum. A comunicação é possível em qualquer distância, embora não possa se estender a outros planos de existência."
    ],
    "material": "Pedaços de casca de ovo de dois tipos diferentes de criaturas",
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Teleport": {
    "name": "Teletransporte",
    "desc": [
      "Esse feitiço transporta instantaneamente você e até oito criaturas voluntárias de sua escolha que você possa ver dentro do alcance, ou um único objeto que você possa ver dentro do alcance, para um destino que você selecionar. Se você escolher um objeto como alvo, ele deve caber inteiramente dentro de um cubo de 3 metros e não pode ser segurado ou carregado por uma criatura não disposta.",
      "O destino que você escolher deve ser conhecido por você e deve estar no mesmo plano de existência que você. Sua familiaridade com o destino determina se você chegará lá com sucesso. O GM rola d100 e consulta a tabela.",
      "| Familiaridade | Acidente | Área semelhante | Fora do alvo | No alvo",
      "|---|---|---|---|---|",
      "| Círculo permanente | -- -- | | 01-100 |",
      "| Objeto associado -- -- -- | | 01-100 |",
      "| Muito familiar | 01-05 | 06-13 | 14-24 | 25-100 |",
      "| Visto casualmente | 01-33 | 34-43 | 44-53 | 54-100 |",
      "| Visto uma vez | 01-43 | 44-53 | 54-73 | 74-100 |",
      "| Descrição | 01-43 | 44-53 | 54-73 | 74-100 |",
      "| False destination | 01-50 | 51-100 | -- | | | |",
      "***\"Círculo permanente\" significa um círculo de teletransporte permanente cuja sequência de sigilo você conhece.",
      "\"Objeto associado\" significa que você possui um objeto retirado do destino desejado nos últimos seis meses, como um livro da biblioteca de um mago, roupas de cama de uma suíte real ou um pedaço de mármore da tumba secreta de um lich.",
      "\"Muito familiar\" é um local em que você esteve com muita frequência, um local que você estudou cuidadosamente ou um local que você pode ver quando lança o feitiço.",
      "\"Visto casualmente\" é um lugar que você já viu mais de uma vez, mas com o qual não está muito familiarizado.",
      "\"Viewed once\" é um local que você viu uma vez, possivelmente usando magia.",
      "\"Descrição\" é um local cuja localização e aparência você conhece por meio da descrição de outra pessoa, talvez a partir de um mapa.",
      "\"Destino falso\" é um local que não existe. Talvez você tenha tentado Cristalocar o santuário de um inimigo e, em vez disso, tenha visto uma ilusão, ou esteja tentando se teletransportar para um local conhecido que não existe mais.",
      "***No alvo *** Você e seu grupo (ou o objeto-alvo) aparecem onde você deseja.",
      "***Você e seu grupo (ou o objeto-alvo) aparecem a uma distância aleatória do destino em uma direção aleatória. A distância fora do alvo é 1d10 x 1d10 por cento da distância que deveria ser percorrida. Por exemplo, se você tentou viajar 120 milhas, aterrissou fora do alvo e rolou 5 e 3 nos dois d10s, então você estaria fora do alvo em 15%, ou 18 milhas. O GM determina a direção fora do alvo aleatoriamente rolando um d8 e designando 1 como norte, 2 como nordeste, 3 como leste e assim por diante em torno dos pontos da bússola.  Se você estivesse se teletransportando para uma cidade costeira e acabasse a 18 milhas do mar, poderia estar em apuros.",
      "***Área semelhante: Você e seu grupo (ou o objeto-alvo) acabam em uma área diferente que é visual ou tematicamente semelhante à área-alvo. Se estiver indo para o laboratório de sua casa, por exemplo, você pode acabar no laboratório de outro mago ou em uma loja de suprimentos alquímicos que tenha muitas das mesmas ferramentas e implementos que o seu laboratório. Em geral, você aparece no local semelhante mais próximo, mas como o feitiço não tem limite de alcance, você pode ir parar em qualquer lugar do plano.",
      "***A magia imprevisível do feitiço resulta em uma jornada difícil. Cada criatura que se teletransporta (ou o objeto-alvo) recebe 3d10 de dano de força, e o MJ faz uma nova rolagem na tabela para ver onde você vai parar (podem ocorrer vários contratempos, causando dano a cada vez)."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Teleportation Circle": {
    "name": "Círculo de teletransporte",
    "desc": [
      "Ao lançar o feitiço, você desenha um círculo de 3 metros de diâmetro no chão, inscrito com sigilos que ligam sua localização a um círculo de teletransporte permanente de sua escolha, cuja sequência de sigilos você conheça e que esteja no mesmo plano de existência que você. Um portal cintilante se abre dentro do círculo que você desenhou e permanece aberto até o final do seu próximo turno. Qualquer criatura que entrar no portal aparece instantaneamente em um raio de 1,5 metro do círculo de destino ou no espaço desocupado mais próximo, se esse espaço estiver ocupado.",
      "Muitos dos principais templos, guildas e outros locais importantes têm círculos de teletransporte permanentes inscritos em algum lugar dentro de seus limites. Cada um desses círculos inclui uma sequência de sigilo exclusiva, uma sequência de runas mágicas dispostas em um padrão específico. Ao adquirir a habilidade de lançar esse feitiço pela primeira vez, você aprende as sequências de sigilos para dois destinos no Plano Material, determinados pelo MJ. Você pode aprender sequências de sigilos adicionais durante suas aventuras. Você pode memorizar uma nova sequência de sigilos depois de estudá-la por 1 minuto.",
      "Você pode criar um círculo de teletransporte permanente lançando esse feitiço no mesmo local todos os dias durante um ano. Você não precisa usar o círculo para se teletransportar quando lançar o feitiço dessa forma."
    ],
    "material": "Tintas e gizes raros infundidos com gemas preciosas com 50 gp, que o feitiço consome.",
    "duration": "1 rodada",
    "casting_time": "1 minuto"
  },
  "Thaumaturgy": {
    "name": "Taumaturgia",
    "desc": [
      "Você manifesta uma maravilha menor, um sinal de poder sobrenatural, dentro do alcance. Você cria um dos seguintes efeitos mágicos dentro do alcance.",
      "- Sua voz é três vezes mais alta que o normal por 1 minuto.",
      "- Você faz com que as chamas tremulem, brilhem, escureçam ou mudem de cor por 1 minuto.",
      "- Você causa tremores inofensivos no solo por 1 minuto.",
      "- Você cria um som instantâneo que se origina de um ponto de sua escolha dentro do alcance, como o estrondo de um trovão, o grito de um corvo ou sussurros sinistros.",
      "- Você faz com que uma porta ou janela destrancada se abra ou se feche instantaneamente.",
      "- Você altera a aparência de seus olhos por 1 minuto.",
      "Se você conjurar esse feitiço várias vezes, poderá ter até três de seus efeitos de 1 minuto ativos por vez e poderá descartar esse efeito como uma ação."
    ],
    "duration": "1 minuto",
    "casting_time": "1 ação"
  },
  "Thunderwave": {
    "name": "Thunderwave",
    "desc": [
      "Uma onda de força estrondosa se espalha a partir de você. Cada criatura em um cubo de 15 pés que se origina de você deve fazer um arremesso de defesa de constituição. Se o salvamento falhar, a criatura recebe 2d8 de dano de trovão e é empurrada 3 metros para longe de você. Em um salvamento bem-sucedido, a criatura recebe metade do dano e não é empurrada.",
      "Além disso, os objetos não protegidos que estiverem completamente dentro da área de efeito são automaticamente empurrados 10 pés para longe de você pelo efeito do feitiço, e o feitiço emite um estrondo estrondoso audível a até 300 pés."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 2º nível ou superior, o dano aumenta em 1d8 para cada nível de espaço acima do 1º."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Trovão"
  },
  "Time Stop": {
    "name": "Parada de tempo",
    "desc": [
      "Você interrompe brevemente o fluxo do tempo para todos, exceto para si mesmo. Nenhum tempo passa para as outras criaturas, enquanto você faz 1d4 + 1 turnos seguidos, durante os quais pode usar ações e se mover normalmente.",
      "Esse feitiço termina se uma das ações que você usar durante esse período, ou qualquer efeito que você criar durante esse período, afetar uma criatura que não seja você ou um objeto que esteja sendo usado ou carregado por alguém que não seja você. Além disso, o feitiço termina se você se deslocar para um local a mais de 1.000 pés do local onde o lançou."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Tiny Hut": {
    "name": "Tiny Hut",
    "desc": [
      "Uma cúpula de força imóvel em um raio de 3 metros passa a existir ao redor e acima de você e permanece estacionária durante todo o tempo. O feitiço termina se você sair da área.",
      "Nove criaturas de tamanho médio ou menor podem caber dentro da cúpula com você. O feitiço falha se sua área incluir uma criatura maior ou mais de nove criaturas. As criaturas e os objetos que estiverem dentro da cúpula quando você lançar esse feitiço poderão se mover livremente por ela. Todas as outras criaturas e objetos são impedidos de passar por ela. Os feitiços e outros efeitos mágicos não podem se estender pela cúpula nem ser lançados por meio dela. A atmosfera dentro do espaço é confortável e seca, independentemente do clima externo.",
      "Até que o feitiço termine, você pode comandar o interior para que fique pouco iluminado ou escuro. A cúpula é opaca por fora, de qualquer cor que você escolher, mas é transparente por dentro."
    ],
    "material": "Uma pequena conta de cristal.",
    "duration": "8 horas",
    "casting_time": "1 minuto"
  },
  "Tongues": {
    "name": "Chinelos",
    "desc": [
      "Esse feitiço concede à criatura que você tocar a capacidade de entender qualquer idioma falado que ela ouvir. Além disso, quando o alvo fala, qualquer criatura que conheça pelo menos um idioma e possa ouvir o alvo entende o que ele diz."
    ],
    "material": "Um pequeno modelo de argila de um zigurate.",
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Transport via Plants": {
    "name": "Transporte via plantas",
    "desc": [
      "Esse feitiço cria um vínculo mágico entre uma planta inanimada grande ou maior dentro do alcance e outra planta, a qualquer distância, no mesmo plano de existência. Você deve ter visto ou tocado a planta de destino pelo menos uma vez antes. Durante esse período, qualquer criatura pode entrar na planta-alvo e sair da planta de destino usando 1,5 m de movimento."
    ],
    "duration": "1 rodada",
    "casting_time": "1 ação"
  },
  "Tree Stride": {
    "name": "Tree Stride",
    "desc": [
      "Você ganha a habilidade de entrar em uma árvore e mover-se de dentro dela para dentro de outra árvore do mesmo tipo em um raio de 500 pés. Ambas as árvores devem estar vivas e ter, no mínimo, o mesmo tamanho que você. Você deve usar 1,5 m de movimento para entrar em uma árvore. Você sabe instantaneamente a localização de todas as outras árvores do mesmo tipo em um raio de 500 pés e, como parte do movimento usado para entrar na árvore, pode passar para uma dessas árvores ou sair da árvore em que está. Você aparece em um local de sua escolha a até 1,5 metro da árvore de destino, usando mais 1,5 metro de movimento. Se não tiver mais movimento, você aparecerá a 1,5 m da árvore em que entrou.",
      "Você pode usar essa habilidade de transporte uma vez por rodada durante todo o tempo. Você deve terminar cada turno fora de uma árvore."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "True Polymorph": {
    "name": "Polimorfo verdadeiro",
    "desc": [
      "Escolha uma criatura ou objeto não mágico que você possa ver dentro do alcance. Você transforma a criatura em uma criatura diferente, a criatura em um objeto ou o objeto em uma criatura (o objeto não deve ser usado nem carregado por outra criatura). A transformação dura a duração do feitiço ou até que o alvo chegue a 0 pontos de vida ou morra. Se você se concentrar nesse feitiço por toda a duração, a transformação se tornará permanente.",
      "Os metamorfos não são afetados por esse feitiço. Uma criatura relutante pode fazer um arremesso de sabedoria e, se for bem-sucedida, não será afetada por esse feitiço.",
      "***Se você transformar uma criatura em outro tipo de criatura, a nova forma pode ser de qualquer tipo que você escolher cujo grau de desafio seja igual ou inferior ao do alvo (ou seu nível, se o alvo não tiver um grau de desafio). As estatísticas de jogo do alvo, incluindo as pontuações de habilidade mental, são substituídas pelas estatísticas da nova forma. Ele mantém seu alinhamento e personalidade.",
      "O alvo assume os pontos de vida de sua nova forma e, quando reverte para sua forma normal, a criatura retorna ao número de pontos de vida que tinha antes de se transformar. Se ela reverter como resultado de cair para 0 hit points, qualquer dano em excesso será transferido para sua forma normal. Enquanto o excesso de dano não reduzir a forma normal da criatura a 0 pontos de vida, ela não ficará inconsciente.",
      "A criatura é limitada nas ações que pode realizar pela natureza de sua nova forma e não pode falar, lançar feitiços ou realizar qualquer outra ação que exija mãos ou fala, a menos que sua nova forma seja capaz de realizar tais ações.",
      "O equipamento do alvo se funde com a nova forma. A criatura não pode ativar, usar, empunhar ou se beneficiar de nenhum de seus equipamentos.",
      "***Objeto em criatura*** Você pode transformar um objeto em qualquer tipo de criatura, desde que o tamanho da criatura não seja maior do que o tamanho do objeto e que a classificação de desafio da criatura seja 9 ou menor. A criatura é amigável com você e seus companheiros. Ela age em cada um de seus turnos. Você decide qual ação ela realiza e como ela se move. O GM tem as estatísticas da criatura e resolve todas as suas ações e movimentos.",
      "Se o feitiço se tornar permanente, você não controlará mais a criatura. Ela pode continuar amigável com você, dependendo de como você a tratou.",
      "***Criatura em objeto*** Se você transformar uma criatura em um objeto, ela se transforma junto com o que estiver vestindo e carregando para essa forma. As estatísticas da criatura se tornam as do objeto, e a criatura não se lembra do tempo passado nessa forma, depois que o feitiço termina e ela retorna à sua forma normal."
    ],
    "material": "Uma gota de mercúrio, um pouco de goma arábica e um fio de fumaça.",
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "True Resurrection": {
    "name": "A verdadeira ressurreição",
    "desc": [
      "Você toca uma criatura que esteja morta há no máximo 200 anos e que tenha morrido por qualquer motivo, exceto velhice. Se a alma da criatura estiver livre e disposta, a criatura será restaurada à vida com todos os seus pontos de vida.",
      "Esse feitiço fecha todos os ferimentos, neutraliza qualquer veneno, cura todas as doenças e remove todas as maldições que afetavam a criatura quando ela morreu. O feitiço substitui órgãos e membros danificados ou ausentes.",
      "O feitiço pode até mesmo fornecer um novo corpo se o original não existir mais e, nesse caso, você deve dizer o nome da criatura. A criatura então aparece em um espaço desocupado que você escolher em um raio de 3 metros de você."
    ],
    "material": "Uma borrifada de água benta e diamantes no valor mínimo de 25.000gp, que o feitiço consome.",
    "duration": "Instantâneo",
    "casting_time": "1 hora"
  },
  "True Seeing": {
    "name": "Visão real",
    "desc": [
      "Esse feitiço concede à criatura disposta que você tocar a capacidade de ver as coisas como elas realmente são. Enquanto durar, a criatura terá visão verdadeira, perceberá portas secretas ocultas por magia e poderá ver o Plano Etéreo, tudo em um alcance de 120 pés."
    ],
    "material": "Uma pomada para os olhos que custa 25gp, é feita de pó de cogumelo, açafrão e gordura e é consumida pelo feitiço.",
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "True Strike": {
    "name": "True Strike",
    "desc": [
      "Você estende a mão e aponta um dedo para um alvo ao alcance. Sua magia lhe concede uma breve percepção das defesas do alvo. No seu próximo turno, você ganha vantagem na sua primeira rolagem de ataque contra o alvo, desde que esse feitiço não tenha terminado."
    ],
    "duration": "Até 1 rodada",
    "casting_time": "1 ação"
  },
  "Unseen Servant": {
    "name": "Servo invisível",
    "desc": [
      "Esse feitiço cria uma força invisível, sem mente e sem forma que executa tarefas simples sob seu comando até o fim do feitiço. O servo passa a existir em um espaço desocupado no chão dentro do alcance. Ele tem CA 10, 1 ponto de vida e Força 2, e não pode atacar. Se cair para 0 pontos de vida, o feitiço termina.",
      "Uma vez em cada um dos seus turnos, como uma ação adicional, você pode comandar mentalmente o servo para se mover até 15 pés e interagir com um objeto. O servo pode realizar tarefas simples que um servo humano poderia fazer, como buscar coisas, limpar, consertar, dobrar roupas, acender fogueiras, servir comida e servir vinho. Depois que você dá o comando, o servo executa a tarefa da melhor forma possível até concluí-la e, em seguida, aguarda o próximo comando.",
      "Se você ordenar que o servo execute uma tarefa que o afaste mais de 60 pés de você, o feitiço termina."
    ],
    "material": "Um pedaço de barbante e um pedaço de madeira.",
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Vampiric Touch": {
    "name": "Toque Vampírico",
    "desc": [
      "O toque de sua mão coberta de sombras pode sugar a força vital de outras pessoas para curar seus ferimentos. Faça um ataque mágico corpo a corpo contra uma criatura que esteja ao seu alcance. Em caso de acerto, o alvo recebe 3d6 de dano necrótico e você recupera pontos de vida iguais à metade do dano necrótico causado. Até que o feitiço termine, você pode fazer o ataque novamente em cada um de seus turnos como uma ação."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 4º nível ou superior, o dano aumenta em 1d6 para cada nível de espaço acima do 3º."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação",
    "attack_type": "corpo a corpo",
    "damage_type": "Necrótico"
  },
  "Vicious Mockery": {
    "name": "Zombaria cruel",
    "desc": [
      "Você desfere uma série de insultos com encantamentos sutis a uma criatura que possa ver dentro do alcance. Se o alvo puder ouvi-lo (embora não precise entendê-lo), ele deverá ser bem-sucedido em um arremesso salvador de sabedoria ou sofrerá 1d4 de dano psíquico e ficará em desvantagem na próxima rolagem de ataque que fizer antes do final do seu próximo turno.",
      "O dano desse feitiço aumenta em 1d4 quando você atinge o 5º nível (2d4), o 11º nível (3d4) e o 17º nível (4d4)."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação",
    "damage_type": "Psíquico"
  },
  "Wall of Fire": {
    "name": "Muro de Fogo",
    "desc": [
      "Você cria uma parede de fogo em uma superfície sólida dentro do alcance. Você pode fazer uma parede de até 60 pés de comprimento, 20 pés de altura e 1 pé de espessura, ou uma parede em forma de anel de até 20 pés de diâmetro, 20 pés de altura e 1 pé de espessura. A parede é opaca e dura por toda a duração.",
      "Quando a parede aparece, cada criatura dentro de sua área deve fazer um arremesso de salvamento de Destreza. Se a defesa falhar, a criatura recebe 5d8 de dano de fogo ou metade desse dano se a defesa for bem-sucedida.",
      "Um lado da parede, selecionado por você ao lançar esse feitiço, causa 5d8 de dano de fogo a cada criatura que terminar seu turno em um raio de 3 metros desse lado ou dentro da parede. Uma criatura sofre o mesmo dano quando entra na muralha pela primeira vez em um turno ou termina seu turno ali. O outro lado da parede não causa dano.",
      "O outro lado da parede não causa dano."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 5º nível ou superior, o dano aumenta em 1d8 para cada nível de espaço acima do 4º."
    ],
    "material": "Um pequeno pedaço de fósforo.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação",
    "damage_type": "Incêndio"
  },
  "Wall of Force": {
    "name": "Muro de força",
    "desc": [
      "Uma parede invisível de força passa a existir em um ponto que você escolher dentro do alcance. A parede aparece em qualquer orientação que você escolher, como uma barreira horizontal, vertical ou em um ângulo. Ela pode estar flutuando livremente ou apoiada em uma superfície sólida. Você pode formar uma cúpula hemisférica ou uma esfera com um raio de até 3 metros, ou pode formar uma superfície plana composta de dez painéis de 3 metros por 3 metros. Cada painel deve ser contíguo a outro painel. Em qualquer forma, a parede tem 1/4 de polegada de espessura. Ela dura por toda a duração. Se a parede atravessar o espaço de uma criatura quando aparecer, a criatura será empurrada para um lado da parede (você escolhe qual lado).",
      "Nada pode atravessar fisicamente a parede. Ela é imune a todos os danos e não pode ser dissipada por magia de dissipação. Entretanto, um feitiço de desintegração destrói a parede instantaneamente. A parede também se estende para o Plano Etéreo, bloqueando a viagem etérea através da parede."
    ],
    "material": "Uma pitada de pó feita com a trituração de uma pedra preciosa transparente.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Wall of Ice": {
    "name": "Parede de gelo",
    "desc": [
      "Você cria uma parede de gelo em uma superfície sólida dentro do alcance. Você pode formar uma cúpula hemisférica ou uma esfera com um raio de até 3 metros, ou pode formar uma superfície plana composta de dez painéis quadrados de 3 metros. Cada painel deve ser contíguo a outro painel. Em qualquer forma, a parede tem 1 pé de espessura e dura por toda a duração.",
      "Se a parede atravessar o espaço de uma criatura quando aparecer, a criatura dentro de sua área será empurrada para um lado da parede e deverá fazer um arremesso salvador de destreza. Se a defesa falhar, a criatura recebe 10d6 de dano de frio ou metade desse dano se a defesa for bem-sucedida.",
      "A parede é um objeto que pode ser danificado e, portanto, violado. Ela tem CA 12 e 30 pontos de vida por seção de 3 metros e é vulnerável a dano por fogo. Reduzir uma seção de 3 metros da parede a 0 pontos de vida a destrói e deixa para trás uma camada de ar gelado no espaço que a parede ocupava. Uma criatura que se mova através da camada de ar gelado pela primeira vez em um turno deve fazer um arremesso salvador de Constituição. Essa criatura recebe 5d6 de dano de frio se o salvamento falhar, ou metade do dano se for bem-sucedido."
    ],
    "higher_level": [
      "Quando você conjura esse feitiço usando um espaço de 7º nível ou superior, o dano que a parede causa quando aparece aumenta em 2d6 e o dano causado ao atravessar a camada de ar gelado aumenta em 1d6, para cada nível de espaço acima do 6º."
    ],
    "material": "Um pequeno pedaço de quartzo.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação",
    "damage_type": "Frio"
  },
  "Wall of Stone": {
    "name": "Muro de pedra",
    "desc": [
      "Uma parede não mágica de pedra sólida surge em um ponto que você escolher dentro do alcance. A parede tem 15 cm de espessura e é composta por dez painéis de 3 metros por 3 metros. Cada painel deve ser contíguo a pelo menos um outro painel. Como alternativa, você pode criar painéis de 3 metros por 20 metros que tenham apenas 5 centímetros de espessura.",
      "Se a parede atravessar o espaço de uma criatura quando aparecer, a criatura será empurrada para um lado da parede (à sua escolha). Se uma criatura estiver cercada por todos os lados pela parede (ou pela parede e outra superfície sólida), ela poderá fazer um arremesso salvador de destreza. Se for bem-sucedida, ela pode usar sua reação para se mover até sua velocidade de modo que não fique mais cercada pela parede.",
      "A parede pode ter qualquer forma que você desejar, embora não possa ocupar o mesmo espaço que uma criatura ou objeto. A parede não precisa ser vertical nem estar sobre uma base firme. No entanto, ela deve se fundir com a pedra existente e ser solidamente sustentada por ela. Assim, você pode usar esse feitiço para transpor um abismo ou criar uma rampa.",
      "Se você criar um vão com mais de 6 metros de comprimento, deverá reduzir pela metade o tamanho de cada painel para criar suportes. Você pode moldar a parede de forma grosseira para criar ameias, ameias e assim por diante.",
      "A parede é um objeto feito de pedra que pode ser danificado e, portanto, violado. Cada painel tem CA 15 e 30 pontos de vida por polegada de espessura. Reduzir um painel a 0 hit points o destrói e pode causar o colapso de painéis conectados, a critério do GM.",
      "Se você mantiver a concentração nesse feitiço por toda a sua duração, a parede se tornará permanente e não poderá ser dissipada. Caso contrário, a parede desaparecerá quando o feitiço terminar."
    ],
    "material": "Um pequeno bloco de granito.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação"
  },
  "Wall of Thorns": {
    "name": "Muro de espinhos",
    "desc": [
      "Você cria uma parede de arbustos resistentes, maleáveis e emaranhados, com espinhos afiados como agulhas. A parede aparece dentro do alcance em uma superfície sólida e dura a duração. Você escolhe fazer a parede com até 60 pés de comprimento, 10 pés de altura e 5 pés de espessura ou um círculo com 20 pés de diâmetro e até 20 pés de altura e 5 pés de espessura. A parede bloqueia a linha de visão.",
      "Quando a parede aparece, cada criatura dentro de sua área deve fazer um arremesso de salvamento de destreza. Se a defesa falhar, a criatura recebe 7d8 de dano perfurante ou metade desse dano se a defesa for bem-sucedida.",
      "Uma criatura pode se mover através da parede, embora de forma lenta e dolorosa. Para cada 1 pé que uma criatura se move através da parede, ela deve gastar 4 pés de movimento. Além disso, a primeira vez que uma criatura entra na parede em um turno ou termina seu turno ali, ela deve fazer um arremesso salvador de destreza. Ela recebe 7d8 de dano cortante se a defesa falhar, ou metade do dano se for bem-sucedida."
    ],
    "higher_level": [
      "Quando você lança esse feitiço usando um espaço de feitiço de 7º nível ou superior, ambos os tipos de dano aumentam em 1d8 para cada nível de espaço acima do 6º."
    ],
    "material": "Um punhado de espinhos.",
    "duration": "Até 10 minutos",
    "casting_time": "1 ação",
    "damage_type": "Piercing"
  },
  "Warding Bond": {
    "name": "Vínculo de proteção",
    "desc": [
      "Esse feitiço protege uma criatura disposta que você tocar e cria uma conexão mística entre você e o alvo até o fim do feitiço. Enquanto o alvo estiver a até 60 pés de você, ele recebe um bônus de +1 na CA e nos lançamentos de defesa e tem resistência a todo o dano. Além disso, toda vez que ele sofrer dano, você sofrerá a mesma quantidade de dano.",
      "O feitiço termina se você chegar a 0 pontos de vida ou se você e o alvo estiverem separados por mais de 60 pés.",
      "Ele também termina se o feitiço for lançado novamente em qualquer uma das criaturas conectadas. Você também pode descartar o feitiço como uma ação."
    ],
    "material": "Um par de anéis de platina com valor mínimo de 50gp cada, que você e o alvo devem usar durante todo o tempo.",
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Water Breathing": {
    "name": "Respiração na água",
    "desc": [
      "Esse feitiço concede a um máximo de dez criaturas dispostas, dentro do alcance e que você possa ver, a capacidade de respirar debaixo d'água até o final do período de validade. As criaturas afetadas também mantêm seu padrão normal de respiração."
    ],
    "material": "Um pedaço curto de cana ou palha.",
    "duration": "24 horas",
    "casting_time": "1 ação"
  },
  "Water Walk": {
    "name": "Caminhada na água",
    "desc": [
      "Esse feitiço concede a habilidade de se mover em qualquer superfície líquida - como água, ácido, lama, neve, areia movediça ou lava - como se fosse um solo sólido e inofensivo (as criaturas que atravessam lava derretida ainda podem receber dano do calor). Até dez criaturas dispostas que você possa ver dentro do alcance ganham essa habilidade pela duração.",
      "Se você tiver como alvo uma criatura submersa em um líquido, o feitiço leva o alvo até a superfície do líquido a uma velocidade de 60 pés por rodada."
    ],
    "material": "Um pedaço de cortiça.",
    "duration": "1 hora",
    "casting_time": "1 ação"
  },
  "Web": {
    "name": "Web",
    "desc": [
      "Você conjura uma massa de teias grossas e pegajosas em um ponto de sua escolha dentro do alcance. As teias preenchem um cubo de 6 metros a partir desse ponto durante todo o tempo. As teias são um terreno difícil e obscurecem levemente sua área.",
      "Se as teias não estiverem ancoradas entre duas massas sólidas (como paredes ou árvores) ou em camadas sobre um piso, parede ou teto, a teia conjurada desmorona sobre si mesma e o feitiço termina no início do seu próximo turno. As teias colocadas em camadas sobre uma superfície plana têm uma profundidade de 1,5 metro.",
      "Cada criatura que começa seu turno nas teias ou que entra nelas durante seu turno deve fazer um arremesso de salvamento de destreza. Se a defesa falhar, a criatura ficará presa enquanto permanecer nas teias ou até se libertar.",
      "Uma criatura presa pelas teias pode usar sua ação para fazer um teste de Força contra a sua CD de proteção contra feitiço. Se for bem-sucedida, ela não ficará mais presa.",
      "As teias são inflamáveis. Qualquer cubo de 5 pés de teias exposto ao fogo queima em 1 rodada, causando 2d4 de dano de fogo a qualquer criatura que comece seu turno no fogo."
    ],
    "material": "Um pouco de teia de aranha.",
    "duration": "Até 1 hora",
    "casting_time": "1 ação"
  },
  "Weird": {
    "name": "Estranho",
    "desc": [
      "Com base nos medos mais profundos de um grupo de criaturas, você cria criaturas ilusórias em suas mentes, visíveis apenas para elas. Cada criatura em uma esfera de 30 pés de raio centrada em um ponto de sua escolha dentro do alcance deve fazer um teste de defesa de sabedoria. Se a defesa falhar, a criatura fica assustada durante o período. A ilusão invoca os medos mais profundos da criatura, manifestando seus piores pesadelos como uma ameaça implacável. No início de cada um dos turnos da criatura amedrontada, ela deve ser bem-sucedida em um teste de defesa de sabedoria ou sofrerá 4d10 de dano psíquico. Em um salvamento bem-sucedido, o feitiço termina para essa criatura."
    ],
    "duration": "Até 1 minuto",
    "casting_time": "1 ação"
  },
  "Wind Walk": {
    "name": "Caminhada ao vento",
    "desc": [
      "Você e até dez criaturas dispostas que você possa ver dentro do alcance assumem uma forma gasosa durante esse período, aparecendo como nuvens. Enquanto estiver nessa forma de nuvem, a criatura tem uma velocidade de voo de 300 pés e resistência a dano de armas não mágicas. As únicas ações que uma criatura pode realizar nessa forma são a ação Dash ou reverter à sua forma normal. A reversão leva 1 minuto, período durante o qual a criatura fica incapacitada e não pode se mover. Até que o feitiço termine, a criatura pode reverter para a forma de nuvem, o que também requer a transformação de 1 minuto.",
      "Se uma criatura estiver na forma de nuvem e voando quando o efeito terminar, ela descerá 60 pés por rodada durante 1 minuto até aterrissar, o que será feito com segurança. Se não conseguir aterrissar após 1 minuto, a criatura cairá a distância restante."
    ],
    "material": "Fogo e água benta.",
    "duration": "8 horas",
    "casting_time": "1 minuto"
  },
  "Wind Wall": {
    "name": "Parede de vento",
    "desc": [
      "Uma parede de vento forte se ergue do chão em um ponto que você escolher dentro do alcance. Você pode fazer a parede com até 15 pés de comprimento, 15 pés de altura e 1 pé de espessura. Você pode moldar a parede da maneira que quiser, desde que ela faça um caminho contínuo ao longo do solo. A parede dura por toda a duração.",
      "Quando a parede aparece, cada criatura dentro de sua área deve fazer um arremesso salvador de força. Uma criatura recebe 3d8 de dano de contundência se a defesa falhar, ou metade do dano se for bem-sucedida.",
      "O vento forte mantém a neblina, a fumaça e outros gases afastados. Criaturas ou objetos voadores pequenos ou menores não conseguem atravessar a parede. Materiais soltos e leves trazidos para dentro da parede voam para cima. Flechas, parafusos e outros projéteis comuns lançados contra alvos atrás da parede são desviados para cima e falham automaticamente. (Pedregulhos lançados por gigantes ou máquinas de cerco e projéteis semelhantes não são afetados). As criaturas em forma gasosa não podem passar por ela."
    ],
    "material": "Um pequeno leque e uma pena de origem exótica.",
    "duration": "Até 1 minuto",
    "casting_time": "1 ação",
    "damage_type": "Espancamento"
  },
  "Wish": {
    "name": "Desejo",
    "desc": [
      "O desejo é o feitiço mais poderoso que uma criatura mortal pode lançar. Com uma simples fala em voz alta, você pode alterar os fundamentos da realidade de acordo com seus desejos.",
      "O uso básico desse feitiço é duplicar qualquer outro feitiço de 8º nível ou inferior. Você não precisa atender a nenhum requisito desse feitiço, incluindo componentes caros. O feitiço simplesmente entra em vigor.",
      "Como alternativa, você pode criar um dos seguintes efeitos de sua escolha:",
      "- Você cria um objeto de até 25.000 gp de valor que não seja um item mágico. O objeto não pode ter mais de 300 pés em qualquer dimensão e aparece em um espaço desocupado que você possa ver no chão.",
      "- Você permite que até 20 criaturas que você pode ver recuperem todos os pontos de vida e encerra todos os efeitos sobre elas descritos no feitiço de restauração maior.",
      "- Você concede a até dez criaturas que você pode ver resistência a um tipo de dano que você escolher.",
      "- Você concede imunidade a um único feitiço ou outro efeito mágico por 8 horas a até dez criaturas que possa ver. Por exemplo, você pode tornar a si mesmo e a todos os seus companheiros imunes ao ataque de drenagem de vida de um lich.",
      "- Você desfaz um único evento recente forçando uma nova rolagem de qualquer rolagem feita na última rodada (incluindo o seu último turno). A realidade se remodela para acomodar o novo resultado. Por exemplo, um feitiço de desejo pode desfazer a defesa bem-sucedida de um oponente, o acerto crítico de um inimigo ou a defesa fracassada de um amigo. Você pode forçar a nova rolagem a ser feita com vantagem ou desvantagem e pode escolher se quer usar a nova rolagem ou a rolagem original.",
      "Talvez você consiga realizar algo além do escopo dos exemplos acima. Declare seu desejo ao MJ da forma mais precisa possível. O MJ tem grande liberdade para decidir o que ocorre em tal caso; quanto maior o desejo, maior a probabilidade de algo dar errado. Esse feitiço pode simplesmente falhar, o efeito que você deseja pode ser alcançado apenas parcialmente ou você pode sofrer alguma consequência imprevista como resultado da forma como você formulou o desejo. Por exemplo, desejar que um vilão morra pode fazer com que você avance no tempo para um período em que esse vilão não esteja mais vivo, removendo-o efetivamente do jogo. Da mesma forma, desejar um item mágico ou artefato lendário pode transportá-lo instantaneamente para a presença do atual proprietário do item.",
      "O estresse de lançar esse feitiço para produzir qualquer efeito que não seja a duplicação de outro feitiço o enfraquece. Depois de suportar esse estresse, toda vez que lançar um feitiço até terminar um descanso longo, você sofrerá 1d10 de dano necrótico por nível desse feitiço. Esse dano não pode ser reduzido ou evitado de forma alguma. Além disso, sua Força cai para 3, se já não for 3 ou menor, por 2d4 dias. Para cada um desses dias que você passar descansando e sem fazer nada além de atividades leves, seu tempo de recuperação restante diminui em 2 dias. Por fim, há 33% de chance de você não conseguir lançar um desejo nunca mais se sofrer esse estresse."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Word of Recall": {
    "name": "Palavra de recordação",
    "desc": [
      "Você e até cinco criaturas dispostas em um raio de 1,5 metro se teletransportam instantaneamente para um santuário previamente designado. Você e todas as criaturas que se teletransportarem com você aparecerão no espaço desocupado mais próximo do local que você designou quando preparou o santuário (veja abaixo). Se você lançar esse feitiço sem antes preparar um santuário, o feitiço não terá efeito.",
      "Você deve designar um santuário ao lançar esse feitiço em um local, como um templo, dedicado ou fortemente ligado à sua divindade. Se tentar lançar o feitiço dessa forma em uma área que não seja dedicada à sua divindade, o feitiço não terá efeito."
    ],
    "duration": "Instantâneo",
    "casting_time": "1 ação"
  },
  "Zone of Truth": {
    "name": "Zona da verdade",
    "desc": [
      "Você cria uma zona mágica que protege contra o engano em uma esfera de 15 pés de raio centrada em um ponto de sua escolha dentro do alcance. Até que o feitiço termine, uma criatura que entre na área do feitiço pela primeira vez em um turno ou que inicie seu turno nesse local deve fazer um arremesso de salvamento de Carisma. Se o salvamento falhar, a criatura não poderá falar uma mentira deliberada enquanto estiver no raio de ação. Você sabe se cada criatura é bem-sucedida ou não em seu arremesso de defesa.",
      "Uma criatura afetada está ciente do feitiço e pode, portanto, evitar responder a perguntas às quais normalmente responderia com uma mentira. Essa criatura pode permanecer evasiva em suas respostas, desde que permaneça dentro dos limites da verdade."
    ],
    "duration": "10 minutos",
    "casting_time": "1 ação"
  }
};

export const translateSpell = (spell: any): any => {
    const translatedSpell = TRANSLATIONS_SPELLS[spell.name];
    if (translatedSpell) {
        return {
            ...spell,
            name: translatedSpell.name,
            desc: translatedSpell.desc,
            higher_level: translatedSpell.higher_level,
            material: translatedSpell.material,
            duration: translatedSpell.duration,
            casting_time: translatedSpell.casting_time,
            attack_type: translatedSpell.attack_type,
            damage: {
                ...spell.damage,
                damage_type: {
                    ...spell.damage?.damage_type,
                    name: translatedSpell.damage_type,
                },
            },
        };
    }
    return spell;
};
